import { supabase } from '../lib/supabaseClient'
import type {
  ClinicMemberActivationStatus,
  ClinicMembersList,
  ClinicUser,
  ClinicUserFormValues,
} from '../types/ClinicUser'
import type {
  ClinicMembershipRecordStatus,
  UserRole,
} from '../types/database'
import {
  normalizeClinicUserEmail,
  normalizeClinicUserFullName,
} from '../utils/clinicUsers'
import { normalizeUserRole } from '../auth/permissions'

interface ClinicMemberResponseRow {
  activatedAt?: string | null
  clinicId?: string | null
  createdAt?: string | null
  email?: string | null
  fullName?: string | null
  invitedAt?: string | null
  role?: string | null
  status?: string | null
  userId?: string
}

interface ListClinicMembersResponse {
  memberCount?: number
  members?: ClinicMemberResponseRow[]
  plan?: { id?: string; maxUsers?: number }
}

interface InviteClinicMemberResponse {
  activation?: { status?: ClinicMemberActivationStatus }
  code?: string
  error?: string
  member?: ClinicMemberResponseRow
}

export async function listClinicMembers() {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } =
    await supabase.functions.invoke<ListClinicMembersResponse>(
      'invite-clinic-member',
      { method: 'GET' },
    )

  if (error || !isClinicMembersListResponse(data)) {
    return {
      data: null,
      error: error
        ? await getClinicMembersErrorMessage(error)
        : 'No pudimos cargar los usuarios del consultorio.',
    }
  }

  return {
    data: {
      memberCount: data.memberCount,
      members: data.members.map(mapMembershipToClinicUser),
      plan: { id: data.plan.id, maxUsers: data.plan.maxUsers },
    } satisfies ClinicMembersList,
    error: null,
  }
}

export async function inviteClinicMember(values: ClinicUserFormValues) {
  if (!supabase) {
    return { data: null, error: 'Supabase is not configured yet.' }
  }

  const { data, error } =
    await supabase.functions.invoke<InviteClinicMemberResponse>(
      'invite-clinic-member',
      {
        body: {
          email: normalizeClinicUserEmail(values.email),
          fullName: normalizeClinicUserFullName(values.fullName),
          role: values.role,
        },
      },
    )

  if (error) {
    return { data: null, error: await getClinicMembersErrorMessage(error) }
  }

  if (!data?.member?.userId || !data.activation?.status) {
    return { data: null, error: getClinicMembersResponseError(data?.code) }
  }

  return {
    data: {
      activationStatus: data.activation.status,
      member: mapMembershipToClinicUser(data.member),
    },
    error: null,
  }
}

export function mapMembershipToClinicUser(
  member: ClinicMemberResponseRow,
): ClinicUser {
  return {
    activatedAt: member.activatedAt ?? null,
    clinicId: member.clinicId ?? null,
    createdAt: member.createdAt ?? null,
    email: member.email?.trim().toLowerCase() || null,
    fullName: member.fullName?.trim() || 'Usuario sin nombre',
    id: member.userId ?? '',
    invitedAt: member.invitedAt ?? null,
    role: normalizeUserRole(member.role) as UserRole,
    status: normalizeMembershipStatus(member.status),
  }
}

export function getClinicMembersResponseError(
  code: string | null | undefined,
  status?: number,
) {
  const normalizedCode = code?.trim().toUpperCase()
  const messages: Record<string, string> = {
    CLINIC_NOT_LINKED: 'No tienes un consultorio activo.',
    FORBIDDEN: 'No tienes permiso para gestionar usuarios.',
    FUNCTION_NOT_FOUND: 'La función de invitaciones no está desplegada.',
    INVALID_PAYLOAD: 'Revisa el nombre, email y rol antes de continuar.',
    INVALID_ROLE: 'El rol seleccionado no es válido.',
    INVITATION_SEND_ERROR: 'No pudimos enviar la invitación del nuevo usuario.',
    MEMBER_LIMIT_REACHED: 'Tu plan alcanzó el límite de usuarios.',
    MEMBERSHIP_ALREADY_EXISTS: 'Este usuario ya pertenece al consultorio.',
    PLAN_NOT_ELIGIBLE:
      'Tu plan actual no permite gestionar usuarios del consultorio.',
    SERVER_CONFIGURATION_ERROR:
      'La gestión de usuarios no está configurada en el servidor.',
    SUBSCRIPTION_NOT_AVAILABLE:
      'El consultorio no tiene una suscripción activa.',
    UNAUTHORIZED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  }

  if (normalizedCode && messages[normalizedCode]) {
    return messages[normalizedCode]
  }

  if (status === 401) return messages.UNAUTHORIZED
  if (status === 403) return messages.FORBIDDEN
  if (status === 409) return 'No pudimos completar la invitación por un conflicto.'
  return 'No pudimos gestionar los usuarios del consultorio.'
}

async function getClinicMembersErrorMessage(error: unknown) {
  const functionsError = error as { context?: Response; message?: string }

  if (functionsError.context?.status === 404) {
    return getClinicMembersResponseError('FUNCTION_NOT_FOUND')
  }

  if (functionsError.context) {
    try {
      const body = (await functionsError.context.clone().json()) as {
        code?: string
      }
      return getClinicMembersResponseError(
        body.code,
        functionsError.context.status,
      )
    } catch {
      return getClinicMembersResponseError(
        undefined,
        functionsError.context.status,
      )
    }
  }

  return 'No pudimos conectar con la gestión de usuarios.'
}

function normalizeMembershipStatus(
  status: string | null | undefined,
): ClinicMembershipRecordStatus {
  if (
    status === 'active' ||
    status === 'inactive' ||
    status === 'pending' ||
    status === 'pending_activation'
  ) {
    return status
  }

  return 'inactive'
}

function isClinicMembersListResponse(
  value: ListClinicMembersResponse | null,
): value is Required<ListClinicMembersResponse> & {
  plan: { id: string; maxUsers: number }
} {
  return Boolean(
    value &&
      Array.isArray(value.members) &&
      Number.isInteger(value.memberCount) &&
      value.plan &&
      typeof value.plan.id === 'string' &&
      Number.isInteger(value.plan.maxUsers),
  )
}
