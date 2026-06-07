import type { Patient } from '../types/Patient'

export const patients: Patient[] = [
  {
    id: 1,
    fullName: 'Mariana Rojas',
    phone: '+591 70012345',
    lastVisit: '2026-05-18',
    nextAppointment: '2026-06-05',
    status: 'active',
  },
  {
    id: 2,
    fullName: 'Carlos Medina',
    phone: '+591 71234567',
    lastVisit: '2026-04-29',
    nextAppointment: '2026-06-05',
    status: 'follow-up',
  },
  {
    id: 3,
    fullName: 'Ana Salazar',
    phone: '+591 76543210',
    lastVisit: '2026-03-14',
    nextAppointment: null,
    status: 'inactive',
  },
]
