import type { OdontogramEntry } from '../types/Odontogram'

export const odontogramEntries: OdontogramEntry[] = [
  {
    id: 1,
    patientId: 1,
    toothCode: '16',
    surface: null,
    status: 'restored',
    notes: 'Restauración previa en buen estado',
    updatedAt: '2026-05-18',
  },
  {
    id: 2,
    patientId: 1,
    toothCode: '26',
    surface: null,
    status: 'observation',
    notes: 'Controlar sensibilidad en próxima visita',
    updatedAt: '2026-05-18',
  },
  {
    id: 3,
    patientId: 2,
    toothCode: '36',
    surface: null,
    status: 'caries',
    notes: 'Lesión cariosa visible',
    updatedAt: '2026-04-29',
  },
  {
    id: 4,
    patientId: 2,
    toothCode: '46',
    surface: null,
    status: 'pending',
    notes: 'Pendiente restauración definitiva',
    updatedAt: '2026-04-29',
  },
]
