import { useState } from 'react'
import type { Patient } from '../types/Patient'
import { filterPatients } from '../utils/patientFilters'
import { PatientCard } from './PatientCard'

interface PatientsListProps {
  onViewPatient: (patientId: number) => void
  patients: Patient[]
}

export function PatientsList({ onViewPatient, patients }: PatientsListProps) {
  const [searchText, setSearchText] = useState('')
  const filteredPatients = filterPatients(patients, searchText)

  return (
    <section className="patients-section" aria-label="Listado de pacientes">
      <div className="patients-header">
        <div className="section-heading">
          <p className="eyebrow">Pacientes</p>
          <h2>Pacientes recientes</h2>
        </div>

        <label className="patient-search">
          <span>Buscar paciente</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Nombre, apellido o telefono"
          />
        </label>
      </div>

      <div className="patients-grid">
        {filteredPatients.map((patient) => (
          <PatientCard
            key={patient.id}
            onViewDetail={onViewPatient}
            patient={patient}
          />
        ))}
      </div>

      {filteredPatients.length === 0 && (
        <p className="empty-state">No encontramos pacientes con esa busqueda.</p>
      )}
    </section>
  )
}
