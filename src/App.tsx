import './App.css'
import { AppointmentsOverview } from './components/AppointmentsOverview'
import { Header } from './components/Header'
import { appointments } from './data/appointments'

function App() {
  return (
    <main className="app-shell">
      <Header />
      <AppointmentsOverview appointments={appointments} />
    </main>
  )
}

export default App
