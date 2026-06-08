import type { Patient } from '../types/Patient'

interface DashboardPatientsListProps {
  patients: Patient[]
}

export function DashboardPatientsList({ patients }: DashboardPatientsListProps) {
  if (patients.length === 0) {
    return <p className="dashboard-empty-state">No hay pacientes registrados.</p>
  }

  return (
    <div className="dashboard-patient-list">
      {patients.map((patient) => (
        <article className="dashboard-patient-row" key={patient.id}>
          <div>
            <h3>{patient.fullName}</h3>
            <p>{patient.phone}</p>
          </div>

          <span>{patient.lastVisit}</span>
        </article>
      ))}
    </div>
  )
}
