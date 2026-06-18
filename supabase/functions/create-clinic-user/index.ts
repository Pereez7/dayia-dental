import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type AllowedClinicRole = 'clinic_admin' | 'doctor' | 'receptionist'

interface CreateClinicUserPayload {
  email?: string
  fullName?: string
  role?: string
}

const allowedRoles: AllowedClinicRole[] = [
  'clinic_admin',
  'doctor',
  'receptionist',
]

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '').trim()

  if (!token) {
    return jsonResponse({ error: 'Missing authorization token.' }, 401)
  }

  const payload = await readPayload(request)
  const validationError = validatePayload(payload)

  if (validationError) {
    return jsonResponse({ error: validationError }, 400)
  }

  const supabase = createAdminClient()
  const { data: callerData, error: callerError } =
    await supabase.auth.getUser(token)

  if (callerError || !callerData.user) {
    return jsonResponse({ error: 'Invalid session.' }, 401)
  }

  const { data: callerProfile, error: callerProfileError } = await supabase
    .from('profiles')
    .select('id, clinic_id, role')
    .eq('id', callerData.user.id)
    .maybeSingle()

  if (callerProfileError || !callerProfile?.clinic_id) {
    return jsonResponse({ error: 'Caller profile is not linked to a clinic.' }, 403)
  }

  if (!['clinic_admin', 'super_admin'].includes(callerProfile.role)) {
    return jsonResponse({ error: 'Only clinic admins can create users.' }, 403)
  }

  const email = payload.email?.trim().toLowerCase() ?? ''
  const fullName = payload.fullName?.trim() ?? ''
  const role = payload.role as AllowedClinicRole

  const { data: createdUserData, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        clinic_id: callerProfile.clinic_id,
        full_name: fullName,
        role,
      },
    })

  if (inviteError || !createdUserData.user) {
    return jsonResponse({ error: 'Could not create auth user.' }, 400)
  }

  const now = new Date().toISOString()
  const { data: createdProfile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      clinic_id: callerProfile.clinic_id,
      created_at: now,
      email,
      full_name: fullName,
      id: createdUserData.user.id,
      is_active: true,
      role,
      updated_at: now,
    })
    .select('id, clinic_id, full_name, email, role, is_active, created_at')
    .single()

  if (profileError || !createdProfile) {
    await supabase.auth.admin.deleteUser(createdUserData.user.id)
    return jsonResponse({ error: 'Could not create clinic profile.' }, 400)
  }

  return jsonResponse({
    user: {
      clinicId: createdProfile.clinic_id,
      createdAt: createdProfile.created_at,
      email: createdProfile.email,
      fullName: createdProfile.full_name,
      id: createdProfile.id,
      isActive: createdProfile.is_active,
      role: createdProfile.role,
    },
  })
})

async function readPayload(request: Request): Promise<CreateClinicUserPayload> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function validatePayload(payload: CreateClinicUserPayload) {
  const email = payload.email?.trim().toLowerCase() ?? ''
  const fullName = payload.fullName?.trim() ?? ''

  if (!fullName || fullName.length < 3) {
    return 'Full name is required.'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Valid email is required.'
  }

  if (!allowedRoles.includes(payload.role as AllowedClinicRole)) {
    return 'Invalid role.'
  }

  return ''
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin environment is not configured.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}
