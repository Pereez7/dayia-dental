import type { ClinicalRecord } from '../types/ClinicalRecord'

export const clinicalRecords: ClinicalRecord[] = [
  {
    id: 1,
    patientId: 1,
    date: '2026-05-18',
    reason: 'Sensibilidad dental',
    diagnosis: 'Sensibilidad posterior a limpieza profunda',
    treatment: 'Aplicacion de fluor y recomendaciones de higiene',
    notes: 'Control recomendado en dos semanas si persiste la molestia.',
  },
  {
    id: 2,
    patientId: 2,
    date: '2026-04-29',
    reason: 'Dolor en molar inferior',
    diagnosis: 'Caries activa en pieza posterior',
    treatment: 'Curacion dental provisional',
    notes: 'Paciente debe volver para restauracion definitiva.',
  },
  {
    id: 3,
    patientId: 1,
    date: '2026-03-10',
    reason: 'Control odontologico',
    diagnosis: 'Encías sin signos inflamatorios relevantes',
    treatment: 'Control preventivo y profilaxis',
    notes: 'Mantener rutina de higiene actual.',
  },
]
