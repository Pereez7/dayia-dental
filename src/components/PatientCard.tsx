import type { Patient } from '../types/Patient'
import { formatOptionalCompactDateWithYear } from '../utils/dateFormatters'

const patientStatusLabels: Record<Patient['status'], string> = {
  active: 'Activo',
  'follow-up': 'Seguimiento',
  inactive: 'Inactivo',
}

interface PatientCardProps {
  isHighlighted?: boolean
  onViewDetail: (patientId: Patient['id']) => void
  patient: Patient
}

export function PatientCard({
  isHighlighted = false,
  onViewDetail,
  patient,
}: PatientCardProps) {
  const nextAppointmentLabel = formatOptionalCompactDateWithYear(
    patient.nextAppointment,
    'Sin cita agendada',
  )
  const lastVisitLabel = formatOptionalCompactDateWithYear(patient.lastVisit)
  const statusClassName = `patient-status patient-status--${patient.status}`
  const emailLabel = patient.email ?? 'Sin email'

  return (
    <article
      className={`patient-card${isHighlighted ? ' patient-card--highlighted' : ''}`}
    >
      <div className="patient-card-header">
        <div>
          <p className="patient-name">{patient.fullName}</p>
          <p className="patient-phone">{patient.phone}</p>
          <p className="patient-email">{emailLabel}</p>
        </div>
        <span className={statusClassName}>{patientStatusLabels[patient.status]}</span>
      </div>

      <dl className="patient-details">
        <div>
          <dt>Última visita</dt>
          <dd>{lastVisitLabel}</dd>
        </div>
        <div>
          <dt>Próxima cita</dt>
          <dd>{nextAppointmentLabel}</dd>
        </div>
      </dl>

      <div className="patient-card-footer">
        <button
          className="secondary-action"
          type="button"
          onClick={() => onViewDetail(patient.id)}
        >
          Ver detalle
        </button>
      </div>
    </article>
  )
}
