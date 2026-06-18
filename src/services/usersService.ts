import { supabase } from '../lib/supabaseClient'
import type { ClinicUser, ClinicUserFormValues } from '../types/ClinicUser'
import type { UserProfile } from '../types/database'
import {
  normalizeClinicUserEmail,
  normalizeClinicUserFullName,
} from '../utils/clinicUsers'
import { normalizeUserRole } from '../auth/permissions'

interface CreateClinicUserResponse {
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

export function mapProfileToClinicUser(profile: UserProfile): ClinicUser {
  return {
    clinicId: profile.clinic_id,
    createdAt: profile.created_at,
    email: profile.email,
    fullName: profile.full_name?.trim() || 'Usuario sin nombre',
    id: profile.id,
    isActive: profile.is_active,
    role: normalizeUserRole(profile.role),
  }
}

export async function getClinicUsers(clinicId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, clinic_id, full_name, email, role, is_active, created_at, updated_at')
    .eq('clinic_id', clinicId)
    .order('full_name', { ascending: true })

  if (error) {
    return { data: null, error: getUsersServiceErrorMessage() }
  }

  return {
    data: (data ?? []).map((profile) =>
      mapProfileToClinicUser(profile as UserProfile),
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
    return { data: null, error: getCreateUserServiceErrorMessage() }
  }

  if (!data?.user?.id) {
    return { data: null, error: getCreateUserServiceErrorMessage() }
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

function getCreateUserServiceErrorMessage() {
  return 'No pudimos crear el usuario del consultorio.'
}
