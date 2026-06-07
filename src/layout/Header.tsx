import type { AppSection } from './navigation'

const sectionContent: Record<AppSection, { title: string; description: string }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'Resumen operativo del consultorio dental.',
  },
  'patients-list': {
    title: 'Pacientes',
    description: 'Listado, busqueda y seguimiento basico de pacientes.',
  },
  'patient-new': {
    title: 'Nuevo paciente',
    description: 'Registra un paciente con datos listos para contacto.',
  },
  'appointments-agenda': {
    title: 'Citas',
    description: 'Agenda odontologica y proximas atenciones.',
  },
  'appointment-new': {
    title: 'Nueva cita',
    description: 'Prepara el flujo para programar una atencion odontologica.',
  },
  'clinical-history': {
    title: 'Historial clinico',
    description: 'Antecedentes, evoluciones y notas clinicas del paciente.',
  },
  odontogram: {
    title: 'Odontograma',
    description: 'Registro visual del estado dental del paciente.',
  },
  'whatsapp-reminders': {
    title: 'Recordatorios WhatsApp',
    description: 'Mensajes y seguimiento automatizado de citas.',
  },
  settings: {
    title: 'Configuracion',
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
        <p className="eyebrow">DayIA Dental</p>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </div>
    </header>
  )
}
