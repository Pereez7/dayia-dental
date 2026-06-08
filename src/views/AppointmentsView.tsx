import { AppointmentsAgenda } from '../components/AppointmentsAgenda'
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

  return <AppointmentsAgenda appointments={appointments} />
}
