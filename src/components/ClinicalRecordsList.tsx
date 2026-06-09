import type { ClinicalRecord } from '../types/ClinicalRecord'
import {
  getClinicalRecordsTimelineSummary,
} from '../utils/clinicalRecords'
import { formatCompactDateWithYear } from '../utils/dateFormatters'

interface ClinicalRecordsListProps {
  records: ClinicalRecord[]
}

export function ClinicalRecordsList({ records }: ClinicalRecordsListProps) {
  const timelineSummary = getClinicalRecordsTimelineSummary(records)

  if (records.length === 0) {
    return (
      <p className="dashboard-empty-state">
        Este paciente aún no tiene registros clínicos.
      </p>
    )
  }

  return (
    <>
      <p className="clinical-record-summary">{timelineSummary}</p>

      <div className="clinical-record-list">
        {records.map((record) => (
          <article className="clinical-record-card" key={record.id}>
            <time dateTime={record.date}>
              {formatCompactDateWithYear(record.date)}
            </time>

            <dl>
              <div>
                <dt>Motivo de consulta</dt>
                <dd>{record.reason}</dd>
              </div>
              <div>
                <dt>Diagnostico</dt>
                <dd>{record.diagnosis}</dd>
              </div>
              <div>
                <dt>Tratamiento</dt>
                <dd>{record.treatment}</dd>
              </div>
              <div>
                <dt>Observaciones</dt>
                <dd>{record.notes || 'Sin observaciones'}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </>
  )
}
