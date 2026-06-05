export type AppointmentStatus = 'confirmed' | 'pending' | 'reminder'

export interface Appointment {
  id: number
  date: string
  time: string
  patient: string
  treatment: string
  status: AppointmentStatus
}

export const appointments: Appointment[] = [
  {
    id: 1,
    date: '2026-06-05',
    time: '09:00',
    patient: 'Mariana Rojas',
    treatment: 'Limpieza dental',
    status: 'confirmed',
  },
  {
    id: 2,
    date: '2026-06-05',
    time: '10:30',
    patient: 'Carlos Medina',
    treatment: 'Evaluacion inicial',
    status: 'pending',
  },
  {
    id: 3,
    date: '2026-06-05',
    time: '12:00',
    patient: 'Ana Salazar',
    treatment: 'Control de ortodoncia',
    status: 'reminder',
  },
]
