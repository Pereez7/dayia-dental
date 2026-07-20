import type { AppointmentFormValues } from '../types/Appointment'
import { defaultTreatmentDurationMinutes } from './treatmentUtils'

export function createEmptyAppointmentDraft(): AppointmentFormValues {
  return {
    patientId: null,
    patient: '',
    date: '',
    durationMinutes: defaultTreatmentDurationMinutes,
    time: '',
    treatment: '',
    status: 'pending',
  }
}
