import { ClinicalRecordForm } from '../components/ClinicalRecordForm'
import { ClinicalRecordsList } from '../components/ClinicalRecordsList'
import { PatientAppointmentsList } from '../components/PatientAppointmentsList'
import { PatientOdontogram } from '../components/PatientOdontogram'
import type { Appointment } from '../types/Appointment'
import type {
  ClinicalRecord,
  ClinicalRecordFormValues,
} from '../types/ClinicalRecord'
import type {
  OdontogramEntry,
  OdontogramFormValues,
  OdontogramSaveResult,
  ToothCode,
} from '../types/Odontogram'
import type { Patient } from '../types/Patient'
import { getClinicalRecordsByPatient } from '../utils/clinicalRecords'
import { formatOptionalCompactDateWithYear } from '../utils/dateFormatters'
import { getOdontogramEntriesByPatient } from '../utils/odontogram'
import {
  calculatePatientAge,
  getActivePatientAppointments,
  getNextActivePatientAppointment,
  getPatientAppointments,
} from '../utils/patientDetails'
import {
  formatAppointmentDate,
  formatAppointmentTime,
} from '../utils/appointmentFormatters'

interface PatientDetailViewProps {
  appointments: Appointment[]
  canAccessClinicalHistory: boolean
  canAccessOdontogram: boolean
  clinicalRecords: ClinicalRecord[]
  clinicalRecordsError?: string
  isClinicalRecordsLoading?: boolean
  isOdontogramLoading?: boolean
  odontogramError?: string
  odontogramEntries: OdontogramEntry[]
  onCreateClinicalRecord: (
    values: ClinicalRecordFormValues,
  ) =>
    | Promise<{ error?: string; success: boolean }>
    | { error?: string; success: boolean }
  onSaveOdontogramTooth: (
    toothCode: ToothCode,
    values: OdontogramFormValues,
  ) => Promise<OdontogramSaveResult> | OdontogramSaveResult
  onBackToList: () => void
  onCreateAppointment?: () => void
  patient: Patient
}

export function PatientDetailView({
  appointments,
  canAccessClinicalHistory,
  canAccessOdontogram,
  clinicalRecords,
  clinicalRecordsError = '',
  isClinicalRecordsLoading = false,
  isOdontogramLoading = false,
  odontogramError = '',
  odontogramEntries,
  onCreateClinicalRecord,
  onSaveOdontogramTooth,
  onBackToList,
  onCreateAppointment,
  patient,
}: PatientDetailViewProps) {
  const patientAppointments = getPatientAppointments(
    patient,
    appointments,
  )
  const activeAppointments = getActivePatientAppointments(patient, appointments)
  const nextActiveAppointment = getNextActivePatientAppointment(
    patient,
    appointments,
  )
  const ageLabel = patient.birthDate
    ? `${calculatePatientAge(patient.birthDate)} años`
    : 'Sin registro'
  const patientClinicalRecords = canAccessClinicalHistory
    ? getClinicalRecordsByPatient(clinicalRecords, patient.id)
    : []
  const patientOdontogramEntries = canAccessOdontogram
    ? getOdontogramEntriesByPatient(odontogramEntries, patient.id)
    : []
  const lastVisitLabel = formatOptionalCompactDateWithYear(patient.lastVisit)
  const birthDateLabel = formatOptionalCompactDateWithYear(patient.birthDate)
  const nextAppointmentLabel = nextActiveAppointment
    ? `${formatAppointmentDate(nextActiveAppointment.date)} · ${formatAppointmentTime(
        nextActiveAppointment.time,
      )}`
    : 'Sin cita activa'
  const patientData = [
    { label: 'Teléfono', value: patient.phone },
    { label: 'Email', value: patient.email ?? 'Sin registro' },
    { label: 'Nacimiento', value: birthDateLabel },
    { label: 'Edad', value: ageLabel },
  ]
  const patientSummary = [
    { label: 'Citas activas', value: String(activeAppointments.length) },
    { label: 'Última atención', value: lastVisitLabel },
    { label: 'Próxima cita', value: nextAppointmentLabel },
  ]

  return (
    <section className="patient-detail-view">
      <div className="patient-detail-actions">
        <button className="secondary-action" type="button" onClick={onBackToList}>
          Volver al listado
        </button>
      </div>

      <section className="patient-detail-grid">
        <article className="patient-detail-panel patient-detail-panel--hero">
          <div className="patient-detail-hero">
            <div>
              <p className="eyebrow">Ficha del paciente</p>
              <h2>{patient.fullName}</h2>
              <p>
                {patient.phone}
                {patient.email ? ` · ${patient.email}` : ''}
              </p>
            </div>
            <span className="status-pill">Paciente activo</span>
          </div>

          <nav
            aria-label="Accesos rápidos del paciente"
            className="patient-quick-actions"
          >
            {onCreateAppointment && (
              <button
                className="primary-action"
                type="button"
                onClick={onCreateAppointment}
              >
                Nueva cita
              </button>
            )}
            {canAccessClinicalHistory && (
              <a className="secondary-action" href="#patient-clinical-history">
                Ver historial clínico
              </a>
            )}
            {canAccessOdontogram && (
              <a className="secondary-action" href="#patient-odontogram">
                Ver odontograma
              </a>
            )}
          </nav>

          <div className="patient-summary-grid" aria-label="Resumen del paciente">
            {patientSummary.map((item) => (
              <div key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
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
        </article>

        <article className="patient-detail-panel patient-detail-panel--appointments">
          <div className="section-heading">
            <p className="eyebrow">Agenda del paciente</p>
            <h2>Citas del paciente</h2>
          </div>

          <PatientAppointmentsList appointments={patientAppointments} />
        </article>

        {canAccessClinicalHistory && (
          <article
            className="patient-detail-panel patient-clinical-panel"
            id="patient-clinical-history"
          >
            <div className="section-heading">
              <p className="eyebrow">Seguimiento odontológico</p>
              <h2>Historial clínico</h2>
              <p className="section-description">
                Registra evoluciones básicas asociadas a este paciente.
              </p>
            </div>

            {clinicalRecordsError && (
              <p className="field-message field-message--error" role="alert">
                {clinicalRecordsError}
              </p>
            )}

            {isClinicalRecordsLoading ? (
              <p className="settings-note">Cargando historial clínico...</p>
            ) : (
              <>
                <ClinicalRecordForm onCreateRecord={onCreateClinicalRecord} />
                <ClinicalRecordsList records={patientClinicalRecords} />
              </>
            )}
          </article>
        )}

        {canAccessOdontogram && (
          <article
            className="patient-detail-panel patient-odontogram-panel"
            id="patient-odontogram"
          >
            <div className="section-heading">
              <p className="eyebrow">Registro dental</p>
              <h2>Odontograma</h2>
              <p className="section-description">
                Registra estados básicos por pieza dental permanente.
              </p>
            </div>

            {isOdontogramLoading ? (
              <p className="settings-note">Cargando odontograma...</p>
            ) : (
              <PatientOdontogram
                entries={patientOdontogramEntries}
                errorMessage={odontogramError}
                onSaveTooth={onSaveOdontogramTooth}
              />
            )}
          </article>
        )}
      </section>
    </section>
  )
}
