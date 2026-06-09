import type { OdontogramEntry } from '../types/Odontogram'

export const odontogramEntries: OdontogramEntry[] = [
  {
    id: 1,
    patientId: 1,
    toothNumber: 16,
    status: 'restored',
    notes: 'Restauración previa en buen estado',
    updatedAt: '2026-05-18',
  },
  {
    id: 2,
    patientId: 1,
    toothNumber: 26,
    status: 'watch',
    notes: 'Controlar sensibilidad en próxima visita',
    updatedAt: '2026-05-18',
  },
  {
    id: 3,
    patientId: 2,
    toothNumber: 36,
    status: 'caries',
    notes: 'Lesión cariosa visible',
    updatedAt: '2026-04-29',
  },
  {
    id: 4,
    patientId: 2,
    toothNumber: 46,
    status: 'pending',
    notes: 'Pendiente restauración definitiva',
    updatedAt: '2026-04-29',
  },
]
