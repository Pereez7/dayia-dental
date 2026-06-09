import { ClinicalRecordForm } from '../components/ClinicalRecordForm'
import { ClinicalRecordsList } from '../components/ClinicalRecordsList'
import { PatientAppointmentsList } from '../components/PatientAppointmentsList'
import type { Appointment } from '../types/Appointment'
import type {
  ClinicalRecord,
  ClinicalRecordFormValues,
} from '../types/ClinicalRecord'
import type { Patient } from '../types/Patient'
import { getClinicalRecordsByPatient } from '../utils/clinicalRecords'
import {
  calculatePatientAge,
  getUpcomingPatientAppointments,
} from '../utils/patientDetails'

interface PatientDetailViewProps {
  appointments: Appointment[]
  clinicalRecords: ClinicalRecord[]
  onCreateClinicalRecord: (values: ClinicalRecordFormValues) => void
  onBackToList: () => void
  patient: Patient
}

export function PatientDetailView({
  appointments,
  clinicalRecords,
  onCreateClinicalRecord,
  onBackToList,
  patient,
}: PatientDetailViewProps) {
  const upcomingAppointments = getUpcomingPatientAppointments(
    patient,
    appointments,
  )
  const ageLabel = patient.birthDate
    ? `${calculatePatientAge(patient.birthDate)} años`
    : 'Sin registro'
  const patientClinicalRecords = getClinicalRecordsByPatient(
    clinicalRecords,
    patient.id,
  )
  const patientData = [
    { label: 'Telefono', value: patient.phone },
    { label: 'Email', value: patient.email ?? 'Sin registro' },
    {
      label: 'Fecha de nacimiento',
      value: patient.birthDate ?? 'Sin registro',
    },
    { label: 'Edad', value: ageLabel },
    { label: 'Ultima visita', value: patient.lastVisit },
    {
      label: 'Proxima cita',
      value: patient.nextAppointment ?? 'Sin cita agendada',
    },
  ]

  return (
    <section className="patient-detail-view">
      <div className="patient-detail-actions">
        <button className="secondary-action" type="button" onClick={onBackToList}>
          Volver al listado
        </button>
      </div>

      <section className="patient-detail-grid">
        <article className="patient-detail-panel">
          <div className="patient-detail-hero">
            <div>
              <p className="eyebrow">Ficha del paciente</p>
              <h2>{patient.fullName}</h2>
              <p>{patient.phone}</p>
            </div>
            <span className="status-pill">Paciente activo</span>
          </div>

          <dl className="patient-detail-data">
            {patientData.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd className={item.value === 'Sin registro' ? 'muted-value' : ''}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="patient-future-sections">
            <p>Preparado para agregar historial clinico, odontograma, recordatorios y evoluciones.</p>
          </div>
        </article>

        <article className="patient-detail-panel">
          <div className="section-heading">
            <p className="eyebrow">Agenda del paciente</p>
            <h2>Proximas citas</h2>
          </div>

          <PatientAppointmentsList appointments={upcomingAppointments} />
        </article>

        <article className="patient-detail-panel patient-clinical-panel">
          <div className="section-heading">
            <p className="eyebrow">Seguimiento odontologico</p>
            <h2>Historial clinico</h2>
            <p className="section-description">
              Registra evoluciones basicas asociadas a este paciente.
            </p>
          </div>

          <ClinicalRecordForm onCreateRecord={onCreateClinicalRecord} />
          <ClinicalRecordsList records={patientClinicalRecords} />
        </article>
      </section>
    </section>
  )
}
