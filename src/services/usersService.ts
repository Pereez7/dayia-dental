import { supabase } from '../lib/supabaseClient'
import type { ClinicUser, ClinicUserFormValues } from '../types/ClinicUser'
import type { UserProfile } from '../types/database'
import {
  normalizeClinicUserEmail,
  normalizeClinicUserFullName,
} from '../utils/clinicUsers'
import { normalizeUserRole } from '../auth/permissions'

interface CreateClinicUserResponse {
  code?: string
  error?: string
  user?: {
    clinicId?: string | null
    createdAt?: string | null
    email?: string | null
    fullName?: string | null
    id?: string
    isActive?: boolean
    role?: string | null
  }
}

type ProfileSelectRecord = Pick<
  UserProfile,
  'clinic_id' | 'created_at' | 'full_name' | 'id' | 'role' | 'updated_at'
> &
  Partial<Pick<UserProfile, 'email' | 'is_active'>>

export function mapProfileToClinicUser(profile: UserProfile): ClinicUser {
  return {
    clinicId: profile.clinic_id,
    createdAt: profile.created_at,
    email: profile.email ?? null,
    fullName: profile.full_name?.trim() || 'Usuario sin nombre',
    id: profile.id,
    isActive: profile.is_active ?? true,
    role: normalizeUserRole(profile.role),
  }
}

export async function getClinicUsers(clinicId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const fullResult = await supabase
    .from('profiles')
    .select('id, clinic_id, full_name, email, role, is_active, created_at, updated_at')
    .eq('clinic_id', clinicId)
    .order('full_name', { ascending: true })

  if (!fullResult.error) {
    return {
      data: (fullResult.data ?? []).map((profile) =>
        mapProfileToClinicUser(profile as UserProfile),
      ),
      error: null,
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, clinic_id, full_name, role, created_at, updated_at')
    .eq('clinic_id', clinicId)
    .order('full_name', { ascending: true })

  if (error) {
    return { data: null, error: getUsersServiceErrorMessage() }
  }

  return {
    data: (data ?? []).map((profile) =>
      mapProfileToClinicUser(profile as ProfileSelectRecord as UserProfile),
    ),
    error: null,
  }
}

export async function createClinicUser(values: ClinicUserFormValues) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } =
    await supabase.functions.invoke<CreateClinicUserResponse>(
      'create-clinic-user',
      {
        body: {
          email: normalizeClinicUserEmail(values.email),
          fullName: normalizeClinicUserFullName(values.fullName),
          role: values.role,
        },
      },
    )

  if (error) {
    return {
      data: null,
      error: await getCreateUserServiceErrorMessage(error),
    }
  }

  if (!data?.user?.id) {
    return {
      data: null,
      error: getCreateUserResponseErrorMessage(data?.code),
    }
  }

  return {
    data: mapCreatedClinicUser(data.user),
    error: null,
  }
}

function mapCreatedClinicUser(
  user: NonNullable<CreateClinicUserResponse['user']>,
): ClinicUser {
  return {
    clinicId: user.clinicId ?? null,
    createdAt: user.createdAt ?? null,
    email: user.email ?? null,
    fullName: user.fullName?.trim() || 'Usuario sin nombre',
    id: user.id ?? '',
    isActive: user.isActive ?? true,
    role: normalizeUserRole(user.role),
  }
}

function getUsersServiceErrorMessage() {
  return 'No pudimos cargar los usuarios del consultorio.'
}

async function getCreateUserServiceErrorMessage(error: unknown) {
  const functionsError = error as {
    context?: Response
    message?: string
    name?: string
  }
  const context = functionsError.context
  const message = functionsError.message?.toLowerCase() ?? ''
  const name = functionsError.name?.toLowerCase() ?? ''

  if (context) {
    if (context.status === 404) {
      return 'No pudimos conectar con el servicio de creación de usuarios.'
    }

    try {
      const body = (await context.json()) as CreateClinicUserResponse
      return getCreateUserResponseErrorMessage(body.code)
    } catch {
      return 'No pudimos crear el usuario del consultorio.'
    }
  }

  if (
    name.includes('fetch') ||
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('failed to send')
  ) {
    return 'No pudimos conectar con el servicio de creación de usuarios.'
  }

  return 'No pudimos crear el usuario del consultorio.'
}

export function getCreateUserResponseErrorMessage(code: string | undefined) {
  if (code === 'email_exists') {
    return 'Este correo ya está registrado.'
  }

  if (code === 'forbidden') {
    return 'No tienes permiso para crear usuarios.'
  }

  if (code === 'invalid_payload') {
    return 'Revisa el nombre, email y rol antes de continuar.'
  }

  if (code === 'server_not_configured') {
    return 'La creación de usuarios no está configurada todavía.'
  }

  if (code === 'unauthorized') {
    return 'Tu sesión no está activa. Vuelve a iniciar sesión.'
  }

  return 'No pudimos crear el usuario del consultorio.'
}
