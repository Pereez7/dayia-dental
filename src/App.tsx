import './App.css'
import { AppointmentsOverview } from './components/AppointmentsOverview'
import { Header } from './components/Header'
import { PatientsList } from './components/PatientsList'
import { appointments } from './data/appointments'
import { patients } from './data/patients'

function App() {
  return (
    <main className="app-shell">
      <Header />
      <AppointmentsOverview appointments={appointments} />
      <PatientsList patients={patients} />
    </main>
  )
}

export default App
