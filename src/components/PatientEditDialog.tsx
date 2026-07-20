import { useId, useRef, useState, type FormEvent } from 'react'
import type {
  Patient,
  PatientFormErrors,
  PatientFormValues,
} from '../types/Patient'
import {
  getPatientFormValues,
  havePatientFormValuesChanged,
} from '../utils/patientForm'
import {
  getDuplicatePatientMessage,
  hasPatientFormErrors,
  validatePatientForm,
} from '../utils/patientValidators'
import { ConfirmDialog } from './ConfirmDialog'
import { PatientFields } from './PatientFields'

interface PatientEditDialogProps {
  patient: Patient
  patients: Patient[]
  onCancel: () => void
  onUpdated: () => void
  onUpdatePatient: (
    patientId: Patient['id'],
    values: PatientFormValues,
  ) => Promise<{ error?: string; success: boolean }>
}

export function PatientEditDialog({
  patient,
  patients,
  onCancel,
  onUpdated,
  onUpdatePatient,
}: PatientEditDialogProps) {
  const formId = `patient-edit-${useId().replace(/:/g, '')}`
  const submissionLock = useRef(false)
  const [formValues, setFormValues] = useState(() =>
    getPatientFormValues(patient),
  )
  const [errors, setErrors] = useState<PatientFormErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(field: keyof PatientFormValues, value: string) {
    setFormValues((currentValues) => ({ ...currentValues, [field]: value }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }))
    setSubmitError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submissionLock.current) {
      return
    }

    const validationErrors = validatePatientForm(formValues)
    setErrors(validationErrors)

    if (hasPatientFormErrors(validationErrors)) {
      return
    }

    if (!havePatientFormValuesChanged(patient, formValues)) {
      setSubmitError('No hay cambios para guardar.')
      return
    }

    const duplicateMessage = getDuplicatePatientMessage(
      patients,
      formValues,
      patient.id,
    )

    if (duplicateMessage) {
      setSubmitError(duplicateMessage)
      return
    }

    submissionLock.current = true
    setIsSubmitting(true)
    let didUpdate = false

    try {
      const result = await onUpdatePatient(patient.id, formValues)

      if (!result.success) {
        setSubmitError(result.error ?? 'No pudimos actualizar el paciente.')
        return
      }

      didUpdate = true
    } catch {
      setSubmitError('No pudimos actualizar el paciente. Intenta nuevamente.')
    } finally {
      submissionLock.current = false
      setIsSubmitting(false)
    }

    if (didUpdate) {
      onUpdated()
    }
  }

  return (
    <ConfirmDialog
      cancelLabel="Cancelar"
      confirmFormId={formId}
      confirmLabel={isSubmitting ? 'Guardando...' : 'Guardar cambios'}
      confirmType="submit"
      isCancelDisabled={isSubmitting}
      isConfirmDisabled={isSubmitting}
      isOpen
      message="Actualiza los datos personales y de contacto."
      size="wide"
      title="Editar paciente"
      variant="info"
      onCancel={isSubmitting ? () => undefined : onCancel}
    >
      <form className="patient-form patient-edit-form" id={formId} onSubmit={handleSubmit}>
        <PatientFields
          disabled={isSubmitting}
          errors={errors}
          idPrefix={formId}
          values={formValues}
          onChange={updateField}
        />
        {submitError && (
          <p className="field-message field-message--error" role="alert">
            {submitError}
          </p>
        )}
      </form>
    </ConfirmDialog>
  )
}
