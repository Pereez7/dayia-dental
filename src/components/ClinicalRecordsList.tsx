import type { ClinicalRecord } from '../types/ClinicalRecord'
import type { ClinicalRecordPageSummary } from '../services/clinicalRecordsService'
import {
  getClinicalRecordsTimelineSummary,
} from '../utils/clinicalRecords'
import { formatCompactDateWithYear } from '../utils/dateFormatters'

interface ClinicalRecordsListProps {
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  records: ClinicalRecord[]
  summary?: ClinicalRecordPageSummary | null
}

export function ClinicalRecordsList({
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  records,
  summary = null,
}: ClinicalRecordsListProps) {
  const timelineSummary = summary
    ? getBoundedTimelineSummary(summary)
    : getClinicalRecordsTimelineSummary(records)

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

      {hasMore && onLoadMore ? (
        <div className="clinical-record-load-more">
          <button
            className="secondary-action"
            disabled={isLoadingMore}
            type="button"
            onClick={onLoadMore}
          >
            {isLoadingMore ? 'Cargando registros...' : 'Cargar más registros'}
          </button>
        </div>
      ) : null}
    </>
  )
}

function getBoundedTimelineSummary(summary: ClinicalRecordPageSummary) {
  if (summary.totalRecords === 0) {
    return ''
  }

  if (summary.totalRecords === 1) {
    return '1 registro clínico'
  }

  if (!summary.firstRecordDate || !summary.lastRecordDate) {
    return `${summary.totalRecords} registros clínicos`
  }

  return `${summary.totalRecords} registros · Desde ${formatCompactDateWithYear(
    summary.firstRecordDate,
  )} hasta ${formatCompactDateWithYear(summary.lastRecordDate)}`
}
