import type { Patient } from '../types/Patient'

const patientStatusLabels: Record<Patient['status'], string> = {
  active: 'Activo',
  'follow-up': 'Seguimiento',
  inactive: 'Inactivo',
}

interface PatientCardProps {
  patient: Patient
}

export function PatientCard({ patient }: PatientCardProps) {
  const nextAppointmentLabel = patient.nextAppointment ?? 'Sin cita agendada'

  return (
    <article className="patient-card">
      <div>
        <p className="patient-name">{patient.fullName}</p>
        <p className="patient-phone">{patient.phone}</p>
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

      <span className="status-pill">{patientStatusLabels[patient.status]}</span>
    </article>
  )
}
