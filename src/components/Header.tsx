export function Header() {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">DayIA Dental</p>
        <h1>Agenda odontologica</h1>
        <p className="header-description">
          Organiza citas, revisa el dia de atencion y prepara recordatorios para
          tus pacientes.
        </p>
      </div>

      <button className="primary-action" type="button">
        Nueva cita
      </button>
    </header>
  )
}
