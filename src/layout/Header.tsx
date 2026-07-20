import type { AppSection } from './navigation'

const sectionContent: Record<AppSection, { title: string; description: string }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'Resumen operativo del consultorio dental.',
  },
  'patients-list': {
    title: 'Pacientes',
    description: 'Listado, búsqueda y seguimiento básico de pacientes.',
  },
  'patient-new': {
    title: 'Nuevo paciente',
    description: 'Registra un paciente con datos listos para contacto.',
  },
  'patient-detail': {
    title: 'Detalle de paciente',
    description: 'Ficha básica y próximas citas asociadas.',
  },
  'appointments-agenda': {
    title: 'Citas',
    description: 'Agenda odontológica y próximas atenciones.',
  },
  'appointment-new': {
    title: 'Nueva cita',
    description: 'Prepara el flujo para programar una atención odontológica.',
  },
  'clinical-history': {
    title: 'Historial clínico',
    description: 'Antecedentes, evoluciones y notas clínicas del paciente.',
  },
  odontogram: {
    title: 'Odontograma',
    description: 'Registro visual del estado dental del paciente.',
  },
  'whatsapp-reminders': {
    title: 'Recordatorios WhatsApp',
    description: 'Cola manual de mensajes y seguimiento de citas.',
  },
  administration: {
    title: 'Administración DayIA',
    description: 'Gestión interna de consultorios y planes.',
  },
  settings: {
    title: 'Configuración',
    description: 'Preferencias generales de DayIA Dental.',
  },
}

interface HeaderProps {
  activeSection: AppSection
}

export function Header({ activeSection }: HeaderProps) {
  const content = sectionContent[activeSection]

  return (
    <header className="top-header">
      <div>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </div>
    </header>
  )
}
