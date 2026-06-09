import type { Patient } from '../types/Patient'

const patientStatusLabels: Record<Patient['status'], string> = {
  active: 'Activo',
  'follow-up': 'Seguimiento',
  inactive: 'Inactivo',
}

interface PatientCardProps {
  onViewDetail: (patientId: number) => void
  patient: Patient
}

export function PatientCard({ onViewDetail, patient }: PatientCardProps) {
  const nextAppointmentLabel = patient.nextAppointment ?? 'Sin cita agendada'
  const statusClassName = `patient-status patient-status--${patient.status}`

  return (
    <article className="patient-card">
      <div className="patient-card-header">
        <div>
          <p className="patient-name">{patient.fullName}</p>
          <p className="patient-phone">{patient.phone}</p>
        </div>
        <span className={statusClassName}>{patientStatusLabels[patient.status]}</span>
      </div>

      <dl className="patient-details">
        <div>
          <dt>Ultima visita</dt>
          <dd>{patient.lastVisit}</dd>
        </div>
        <div>
          <dt>Proxima cita</dt>
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
