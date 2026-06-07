import { AppointmentsOverview } from '../components/AppointmentsOverview'
import { appointments } from '../data/appointments'

interface AppointmentsViewProps {
  mode?: 'agenda' | 'new'
}

export function AppointmentsView({ mode = 'agenda' }: AppointmentsViewProps) {
  if (mode === 'new') {
    return (
      <section className="placeholder-panel">
        <p className="eyebrow">Accion rapida</p>
        <h2>Nueva cita</h2>
        <p>
          Aqui agregaremos el formulario para seleccionar paciente, fecha, hora y
          motivo de atencion.
        </p>
      </section>
    )
  }

  return (
    <section className="view-stack">
      <div className="placeholder-panel">
        <p className="eyebrow">Modulo de citas</p>
        <h2>Agenda odontologica</h2>
        <p>
          Aqui construiremos el flujo completo para crear, editar y recordar
          citas.
        </p>
      </div>

      <AppointmentsOverview appointments={appointments} />
    </section>
  )
}
