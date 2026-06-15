import type { Treatment } from '../types/Treatment'

export const treatments: Treatment[] = [
  { id: 1, name: 'Evaluación inicial', durationMinutes: 30, isActive: true },
  { id: 2, name: 'Limpieza dental', durationMinutes: 45, isActive: true },
  { id: 3, name: 'Control odontológico', durationMinutes: 30, isActive: true },
  { id: 4, name: 'Consulta de emergencia', durationMinutes: 30, isActive: true },
  { id: 5, name: 'Extracción simple', durationMinutes: 45, isActive: true },
  { id: 6, name: 'Curación dental', durationMinutes: 45, isActive: true },
  { id: 7, name: 'Restauración / resina', durationMinutes: 60, isActive: true },
  { id: 8, name: 'Endodoncia', durationMinutes: 90, isActive: true },
  { id: 9, name: 'Control de ortodoncia', durationMinutes: 30, isActive: true },
  { id: 10, name: 'Instalación de brackets', durationMinutes: 90, isActive: true },
  { id: 11, name: 'Retiro de brackets', durationMinutes: 60, isActive: true },
  { id: 12, name: 'Blanqueamiento dental', durationMinutes: 60, isActive: true },
  { id: 13, name: 'Radiografía / diagnóstico', durationMinutes: 30, isActive: true },
  { id: 14, name: 'Revisión post tratamiento', durationMinutes: 30, isActive: true },
  { id: 15, name: 'Cirugía menor', durationMinutes: 60, isActive: true },
  { id: 16, name: 'Otro', durationMinutes: 30, isActive: true },
]
