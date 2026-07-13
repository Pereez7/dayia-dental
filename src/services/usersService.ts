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
  details?: string
  message?: string
  user?: {
    activatedAt?: string | null
    clinicId?: string | null
    createdAt?: string | null
    email?: string | null
    fullName?: string | null
    id?: string
    invitedAt?: string | null
    isActive?: boolean
    role?: string | null
  }
}

interface EdgeFunctionErrorDiagnostics {
  code?: string
  details?: string
  message?: string
  rawMessage?: string
  status?: number
}

type ProfileSelectRecord = Pick<
  UserProfile,
  'clinic_id' | 'created_at' | 'full_name' | 'id' | 'role' | 'updated_at'
> &
  Partial<Pick<UserProfile, 'activated_at' | 'email' | 'invited_at' | 'is_active'>>

export function mapProfileToClinicUser(profile: UserProfile): ClinicUser {
  return {
    activatedAt: profile.activated_at ?? null,
    clinicId: profile.clinic_id,
    createdAt: profile.created_at,
    email: profile.email ?? null,
    fullName: profile.full_name?.trim() || 'Usuario sin nombre',
    id: profile.id,
    invitedAt: profile.invited_at ?? null,
    isActive: profile.is_active ?? true,
    role: normalizeUserRole(profile.role, {
      allowLegacyPlatformAdmin: true,
    }),
  }
}

export async function getClinicUsers(clinicId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const fullResult = await supabase
    .from('profiles')
    .select('id, clinic_id, full_name, email, role, is_active, invited_at, activated_at, created_at, updated_at')
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

export async function resendClinicUserInvitation(userId: string) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  if (!userId.trim()) {
    return { data: null, error: 'Selecciona un usuario válido.' }
  }

  return {
    data: null,
    error: 'El reenvío de invitaciones se conectará en una siguiente fase.',
  }
}

function mapCreatedClinicUser(
  user: NonNullable<CreateClinicUserResponse['user']>,
): ClinicUser {
  return {
    activatedAt: user.activatedAt ?? null,
    clinicId: user.clinicId ?? null,
    createdAt: user.createdAt ?? null,
    email: user.email ?? null,
    fullName: user.fullName?.trim() || 'Usuario sin nombre',
    id: user.id ?? '',
    invitedAt: user.invitedAt ?? null,
    isActive: user.isActive ?? true,
    role: normalizeUserRole(user.role, {
      allowLegacyPlatformAdmin: true,
    }),
  }
}

function getUsersServiceErrorMessage() {
  return 'No pudimos cargar los usuarios del consultorio.'
}

async function getCreateUserServiceErrorMessage(error: unknown) {
  const diagnostics = await getCreateUserErrorDiagnostics(error)

  if (import.meta.env.DEV) {
    console.info('create-clinic-user failed', diagnostics)
  }

  return getCreateUserResponseErrorMessage(diagnostics.code, diagnostics.status)
}

async function getCreateUserErrorDiagnostics(
  error: unknown,
): Promise<EdgeFunctionErrorDiagnostics> {
  const functionsError = error as {
    context?: Response
    message?: string
    name?: string
  }
  const context = functionsError.context
  const message = functionsError.message?.toLowerCase() ?? ''
  const name = functionsError.name?.toLowerCase() ?? ''
  const diagnostics: EdgeFunctionErrorDiagnostics = {
    rawMessage: functionsError.message,
  }

  if (context) {
    diagnostics.status = context.status

    if (context.status === 404) {
      diagnostics.code = 'function_not_found'
      return diagnostics
    }

    try {
      const body = (await context.clone().json()) as CreateClinicUserResponse
      diagnostics.code = body.code
      diagnostics.details = body.details ?? body.error
      diagnostics.message = body.message
      return diagnostics
    } catch {
      diagnostics.code = getCreateUserCodeFromMessage(message)
      return diagnostics
    }
  }

  if (
    name.includes('fetch') ||
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('failed to send')
  ) {
    diagnostics.code = 'function_unreachable'
    return diagnostics
  }

  diagnostics.code = getCreateUserCodeFromMessage(message)
  return diagnostics
}

export function getCreateUserResponseErrorMessage(
  code: string | undefined,
  status?: number,
) {
  const normalizedCode = normalizeCreateUserErrorCode(code)

  if (normalizedCode === 'FUNCTION_NOT_FOUND') {
    return 'La función de creación de usuarios no está desplegada.'
  }

  if (normalizedCode === 'FUNCTION_UNREACHABLE') {
    return 'No pudimos conectar con el servicio de creación de usuarios.'
  }

  if (normalizedCode === 'EMAIL_ALREADY_EXISTS') {
    return 'Este correo ya está registrado.'
  }

  if (normalizedCode === 'FORBIDDEN') {
    return 'No tienes permiso para crear usuarios.'
  }

  if (normalizedCode === 'PROFILE_NOT_FOUND') {
    return 'No encontramos tu perfil de administrador.'
  }

  if (normalizedCode === 'PROFILE_QUERY_FAILED') {
    return 'No pudimos validar el perfil del administrador.'
  }

  if (normalizedCode === 'CLINIC_NOT_LINKED') {
    return 'Tu perfil no está vinculado a un consultorio.'
  }

  if (normalizedCode === 'INVALID_PAYLOAD') {
    return 'Revisa el nombre, email y rol antes de continuar.'
  }

  if (normalizedCode === 'INVALID_ROLE') {
    return 'El rol seleccionado no es válido.'
  }

  if (normalizedCode === 'SERVER_CONFIGURATION_ERROR') {
    return 'La creación de usuarios no está configurada en el servidor.'
  }

  if (normalizedCode === 'UNAUTHORIZED') {
    return 'Tu sesión expiró o no tienes permiso.'
  }

  if (normalizedCode === 'AUTH_ADMIN_ERROR') {
    return 'No pudimos crear el usuario en Supabase Auth.'
  }

  if (normalizedCode === 'INVITATION_SEND_ERROR') {
    return 'No pudimos enviar la invitación del nuevo usuario.'
  }

  if (normalizedCode === 'AUTH_ADMIN_PERMISSION_ERROR') {
    return 'No fue posible crear el acceso del nuevo usuario.'
  }

  if (normalizedCode === 'PROFILE_CREATE_ERROR') {
    return 'El usuario se creó, pero no pudimos guardar su perfil del consultorio.'
  }

  if (status === 401) {
    return 'Tu sesión expiró o no tienes permiso.'
  }

  if (status === 403) {
    return 'No tienes permiso para crear usuarios.'
  }

  return 'No pudimos crear el usuario del consultorio.'
}

function normalizeCreateUserErrorCode(code: string | undefined) {
  if (!code) {
    return undefined
  }

  const normalizedCode = code.toUpperCase()

  if (normalizedCode === 'EMAIL_EXISTS') {
    return 'EMAIL_ALREADY_EXISTS'
  }

  if (normalizedCode === 'SERVER_NOT_CONFIGURED') {
    return 'SERVER_CONFIGURATION_ERROR'
  }

  if (normalizedCode === 'FUNCTION_NOT_FOUND') {
    return 'FUNCTION_NOT_FOUND'
  }

  if (normalizedCode === 'FUNCTION_UNREACHABLE') {
    return 'FUNCTION_UNREACHABLE'
  }

  return normalizedCode
}

function getCreateUserCodeFromMessage(message: string) {
  if (
    message.includes('not found') ||
    message.includes('404') ||
    message.includes('function')
  ) {
    return 'function_not_found'
  }

  if (message.includes('unauthorized') || message.includes('jwt')) {
    return 'unauthorized'
  }

  return undefined
}
