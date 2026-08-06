import { useMemo, useState } from 'react'
import type {
  GlobalClinicalHistorySummary,
} from '../services/clinicalRecordsService'
import type { ClinicalRecord } from '../types/ClinicalRecord'
import type { Patient, PatientId } from '../types/Patient'
import {
  type ClinicalHistoryPeriodFilter,
  type ClinicalRecordPatientGroup,
  type GlobalClinicalRecord,
  filterClinicalRecordGroups,
  formatClinicalRecordDisplayText,
  filterGlobalClinicalRecordsByPeriod,
  getClinicalHistorySummary,
  getGlobalClinicalRecords,
  groupClinicalRecordsByPatient,
} from '../utils/clinicalRecords'
import { formatClinicalHistoryDate } from '../utils/dateFormatters'

interface ClinicalHistoryViewProps {
  clinicalRecords: ClinicalRecord[]
  errorMessage?: string
  hasMore?: boolean
  isLoading?: boolean
  isLoadingMore?: boolean
  isServerPaginated?: boolean
  onLoadMore?: () => void
  onPeriodChange?: (period: ClinicalHistoryPeriodFilter) => void
  onSearchChange?: (searchText: string) => void
  patients: Patient[]
  serverGroups?: ClinicalRecordPatientGroup[]
  serverSummary?: GlobalClinicalHistorySummary | null
  onViewPatient: (patientId: PatientId) => void
}

const periodFilters: Array<{
  label: string
  value: ClinicalHistoryPeriodFilter
}> = [
  { label: 'Todos', value: 'all' },
  { label: 'Este mes', value: 'this-month' },
  { label: 'Últimos 30 días', value: 'last-30-days' },
]

export function ClinicalHistoryView({
  clinicalRecords,
  errorMessage = '',
  hasMore = false,
  isLoading = false,
  isLoadingMore = false,
  isServerPaginated = false,
  onLoadMore,
  onPeriodChange,
  onSearchChange,
  patients,
  serverGroups = [],
  serverSummary = null,
  onViewPatient,
}: ClinicalHistoryViewProps) {
  const [searchText, setSearchText] = useState('')
  const [periodFilter, setPeriodFilter] =
    useState<ClinicalHistoryPeriodFilter>('all')
  const [expandedPatientIds, setExpandedPatientIds] = useState<PatientId[]>([])

  const globalRecords = useMemo(
    () => getGlobalClinicalRecords(clinicalRecords, patients),
    [clinicalRecords, patients],
  )
  const recordsByPeriod = useMemo(
    () => filterGlobalClinicalRecordsByPeriod(globalRecords, periodFilter),
    [globalRecords, periodFilter],
  )
  const patientGroups = useMemo(
    () => groupClinicalRecordsByPatient(recordsByPeriod),
    [recordsByPeriod],
  )
  const locallyFilteredGroups = useMemo(
    () => filterClinicalRecordGroups(patientGroups, searchText),
    [patientGroups, searchText],
  )
  const filteredGroups = isServerPaginated
    ? serverGroups
    : locallyFilteredGroups
  const visibleRecords = useMemo(
    () => filteredGroups.flatMap((group) => group.matchingRecords),
    [filteredGroups],
  )
  const localSummary = useMemo(
    () => getClinicalHistorySummary(visibleRecords),
    [visibleRecords],
  )
  const summary = isServerPaginated && serverSummary
    ? serverSummary
    : localSummary

  function togglePatientRecords(patientId: PatientId) {
    setExpandedPatientIds((currentIds) =>
      currentIds.includes(patientId)
        ? currentIds.filter((currentId) => currentId !== patientId)
        : [...currentIds, patientId],
    )
  }

  const hasActiveFilters = Boolean(searchText.trim()) || periodFilter !== 'all'
  const hasRecords = isServerPaginated
    ? summary.totalRecords > 0 || hasActiveFilters
    : globalRecords.length > 0
  const hasSearchResults = filteredGroups.length > 0

  return (
    <section className="clinical-history-view view-stack">
      <div className="clinical-history-panel">
        <div className="section-heading clinical-history-heading">
          <p className="eyebrow">Historial global</p>
          <h2>Registros clínicos</h2>
          <p>
            Consulta la actividad clínica registrada desde el detalle de cada
            paciente.
          </p>
        </div>

        <div className="clinical-history-summary-grid" aria-label="Resumen">
          <article className="ui-kpi clinical-history-kpi">
            <strong>{summary.totalRecords}</strong>
            <span>Registros totales</span>
          </article>
          <article className="ui-kpi clinical-history-kpi">
            <strong>{summary.recordsThisMonth}</strong>
            <span>Este mes</span>
          </article>
          <article className="ui-kpi clinical-history-kpi">
            <strong>{summary.patientsWithHistory}</strong>
            <span>Pacientes con historial</span>
          </article>
        </div>

        <div className="clinical-history-controls">
          <label className="clinical-history-search">
            <span>Buscar registros</span>
            <input
              type="search"
              value={searchText}
              onChange={(event) => {
                const nextSearchText = event.target.value
                setSearchText(nextSearchText)
                setExpandedPatientIds([])
                onSearchChange?.(nextSearchText)
              }}
              placeholder="Paciente, diagnóstico, tratamiento, motivo u observación"
            />
          </label>

          <div className="clinical-history-filter-bar" aria-label="Filtros">
            {periodFilters.map((filter) => (
              <button
                type="button"
                className="clinical-history-filter"
                key={filter.value}
                aria-pressed={periodFilter === filter.value}
                onClick={() => {
                  setPeriodFilter(filter.value)
                  setExpandedPatientIds([])
                  onPeriodChange?.(filter.value)
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {errorMessage ? (
          <p className="field-message field-message--error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {isLoading ? (
          <div className="clinical-history-empty-state" aria-live="polite">
            <strong>Cargando historial clínico...</strong>
            <span>Estamos consultando los registros del consultorio.</span>
          </div>
        ) : null}

        {!isLoading && !errorMessage && !hasRecords ? (
          <div className="clinical-history-empty-state">
            <strong>No hay registros clínicos todavía.</strong>
            <span>
              Los registros aparecerán cuando se agreguen desde el detalle del
              paciente.
            </span>
          </div>
        ) : null}

        {!isLoading && !errorMessage && hasRecords && !hasSearchResults ? (
          <div className="clinical-history-empty-state">
            <strong>No se encontraron registros con ese criterio.</strong>
            <span>Prueba con otro paciente, diagnóstico o tratamiento.</span>
          </div>
        ) : null}

        {!isLoading && !errorMessage && hasSearchResults ? (
          <div className="clinical-history-list">
            {filteredGroups.map((group) => {
              const isExpanded = expandedPatientIds.includes(group.patientId)
              const displayedRecords = isExpanded
                ? group.matchingRecords
                : [group.matchingRecords[0]]
              const hasMoreRecords = group.totalRecords > 1

              return (
                <article className="clinical-history-card" key={group.patientId}>
                  <header className="clinical-history-card-header">
                    <div className="clinical-history-card-title">
                      <h3>{group.patientName}</h3>
                      {group.patientPhone ? <p>{group.patientPhone}</p> : null}
                    </div>

                    <time
                      className="clinical-history-date-badge"
                      dateTime={group.latestRecord.date}
                    >
                      Último:{' '}
                      {formatClinicalHistoryDate(group.latestRecord.date)}
                    </time>

                    {group.hasPatient ? (
                      <button
                        type="button"
                        className="secondary-action clinical-history-card-action"
                        onClick={() => onViewPatient(group.patientId)}
                      >
                        Ver paciente
                      </button>
                    ) : null}
                  </header>

                  <div className="clinical-history-card-meta">
                    <span>
                      {group.totalRecords === 1
                        ? '1 registro clínico'
                        : `${group.totalRecords} registros clínicos`}
                    </span>
                  </div>

                  <dl className="clinical-history-details">
                    <div>
                      <dt>Último motivo</dt>
                      <dd>
                        {formatClinicalRecordDisplayText(
                          group.latestRecord.reason,
                        ) || 'Sin motivo registrado'}
                      </dd>
                    </div>
                    <div>
                      <dt>Último diagnóstico</dt>
                      <dd>
                        {formatClinicalRecordDisplayText(
                          group.latestRecord.diagnosis,
                        ) ||
                          'Sin diagnóstico registrado'}
                      </dd>
                    </div>
                    <div>
                      <dt>Último tratamiento</dt>
                      <dd>
                        {formatClinicalRecordDisplayText(
                          group.latestRecord.treatment,
                        ) ||
                          'Sin tratamiento registrado'}
                      </dd>
                    </div>
                    {group.latestRecord.notes ? (
                      <div className="clinical-history-notes">
                        <dt>Observaciones</dt>
                        <dd>
                          {formatClinicalRecordDisplayText(
                            group.latestRecord.notes,
                          )}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="clinical-history-record-preview">
                    <div className="clinical-history-record-preview-header">
                      <span>
                        {isExpanded
                          ? 'Últimos registros'
                          : 'Registro más reciente'}
                      </span>

                      {hasMoreRecords ? (
                        <button
                          type="button"
                          className="soft-action clinical-history-toggle"
                          onClick={() => togglePatientRecords(group.patientId)}
                        >
                          {isExpanded ? 'Ocultar' : 'Ver últimos registros'}
                        </button>
                      ) : null}
                    </div>

                    <div className="clinical-history-record-stack">
                      {displayedRecords.map((record) => (
                        <ClinicalHistoryRecordPreview
                          key={record.id}
                          record={record}
                        />
                      ))}
                    </div>

                    {isExpanded && group.totalRecords > 3 ? (
                      <p className="clinical-history-record-limit">
                        Mostrando 3 de {group.totalRecords} registros.
                      </p>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}

        {!isLoading && !errorMessage && hasSearchResults && hasMore && onLoadMore ? (
          <div className="clinical-history-load-more">
            <button
              className="secondary-action"
              disabled={isLoadingMore}
              type="button"
              onClick={onLoadMore}
            >
              {isLoadingMore ? 'Cargando pacientes...' : 'Cargar más pacientes'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

interface ClinicalHistoryRecordPreviewProps {
  record: GlobalClinicalRecord
}

function ClinicalHistoryRecordPreview({
  record,
}: ClinicalHistoryRecordPreviewProps) {
  return (
    <article className="clinical-history-record-item">
      <time dateTime={record.date}>{formatClinicalHistoryDate(record.date)}</time>
      <div>
        <strong>
          {formatClinicalRecordDisplayText(record.reason) ||
            'Sin motivo registrado'}
        </strong>
        <span>
          {formatClinicalRecordDisplayText(record.diagnosis) ||
            'Sin diagnóstico registrado'}{' '}
          ·{' '}
          {formatClinicalRecordDisplayText(record.treatment) ||
            'Sin tratamiento registrado'}
        </span>
      </div>
    </article>
  )
}
