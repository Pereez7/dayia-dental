import { useState } from 'react'
import type { Patient } from '../types/Patient'
import { filterPatients } from '../utils/patientFilters'
import { PatientCard } from './PatientCard'

interface PatientsListProps {
  emptyMessage?: string
  errorMessage?: string
  isLoading?: boolean
  onViewPatient: (patientId: Patient['id']) => void
  patients: Patient[]
}

export function PatientsList({
  emptyMessage = 'No hay pacientes registrados todavía.',
  errorMessage = '',
  isLoading = false,
  onViewPatient,
  patients,
}: PatientsListProps) {
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

      {isLoading ? (
        <p className="empty-state">Cargando pacientes del consultorio...</p>
      ) : errorMessage ? (
        <p className="empty-state">{errorMessage}</p>
      ) : (
        <div className="patients-grid">
          {filteredPatients.map((patient) => (
            <PatientCard
              key={patient.id}
              onViewDetail={onViewPatient}
              patient={patient}
            />
          ))}
        </div>
      )}

      {!isLoading && !errorMessage && filteredPatients.length === 0 && (
        <p className="empty-state">
          {searchText.trim()
            ? 'No encontramos pacientes con esa busqueda.'
            : emptyMessage}
        </p>
      )}
    </section>
  )
}
