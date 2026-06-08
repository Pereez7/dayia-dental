import type { Appointment } from '../types/Appointment'

export const appointments: Appointment[] = [
  {
    id: 1,
    date: '2026-06-07',
    time: '09:00',
    patient: 'Mariana Rojas',
    treatment: 'Limpieza dental',
    status: 'confirmed',
  },
  {
    id: 2,
    date: '2026-06-07',
    time: '10:30',
    patient: 'Carlos Medina',
    treatment: 'Evaluacion inicial',
    status: 'pending',
  },
  {
    id: 3,
    date: '2026-06-08',
    time: '12:00',
    patient: 'Ana Salazar',
    treatment: 'Control de ortodoncia',
    status: 'rescheduled',
  },
  {
    id: 4,
    date: '2026-06-08',
    time: '08:30',
    patient: 'Lucia Vargas',
    treatment: 'Revision post tratamiento',
    status: 'confirmed',
  },
  {
    id: 5,
    date: '2026-06-09',
    time: '15:00',
    patient: 'Jorge Quiroga',
    treatment: 'Extraccion simple',
    status: 'pending',
  },
]
