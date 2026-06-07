import type { Patient } from '../types/Patient'
import { PatientCard } from './PatientCard'

interface PatientsListProps {
  patients: Patient[]
}

export function PatientsList({ patients }: PatientsListProps) {
  return (
    <section className="patients-section" aria-label="Listado de pacientes">
      <div className="section-heading">
        <p className="eyebrow">Pacientes</p>
        <h2>Pacientes recientes</h2>
      </div>

      <div className="patients-grid">
        {patients.map((patient) => (
          <PatientCard key={patient.id} patient={patient} />
        ))}
      </div>
    </section>
  )
}
