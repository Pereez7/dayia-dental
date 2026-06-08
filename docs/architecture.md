# Arquitectura

DayIA Dental empieza como una aplicacion frontend interna para clinicas
dentales. Por ahora no incluye backend, base de datos ni autenticacion.

## Base tecnica

- React + TypeScript + Vite.
- Vitest para pruebas unitarias de logica pura.
- Git inicializado y remoto GitHub configurado.
- Navegacion por estado local, sin React Router por ahora.

## Estructura de carpetas

```text
src/
  components/
  data/
  layout/
  types/
  utils/
  views/
  App.tsx
  App.css
  index.css
  main.tsx
```

## Responsabilidades

`src/components`

Contiene componentes visuales reutilizables. Un componente debe enfocarse en
renderizar UI y recibir datos por props cuando sea posible.

`src/data`

Contiene datos de ejemplo usados por la interfaz mientras no existe backend.
Actualmente guarda citas, pacientes y tratamientos mock.

`src/layout`

Contiene la estructura principal de la aplicacion: layout base, navegacion,
sidebar y header superior.

`src/types`

Contiene tipos compartidos del dominio. Por ejemplo, `Patient` describe la
forma minima que debe tener un paciente dentro del frontend.

`src/utils`

Contiene funciones puras para transformar, formatear o filtrar datos. Estas
funciones no dependen de React y son buenas candidatas para pruebas unitarias.

`src/views`

Contiene vistas completas de la aplicacion. Una vista puede componer varios
componentes y manejar estado local propio de esa pantalla.

`src/App.tsx`

Controla la seccion activa y renderiza la vista correspondiente dentro de
`AppLayout`. Debe mantenerse simple y evitar mezclar logica propia de cada
pantalla.

`src/App.css`

Contiene estilos globales de layout y de los componentes actuales. Todavia no
hay sistema de diseno separado.

`src/index.css`

Contiene estilos globales, variables de color, reset basico y reglas generales.

## Flujo general

1. `src/main.tsx` monta la aplicacion React.
2. `src/App.tsx` mantiene la seccion activa con estado local.
3. `AppLayout` muestra `Sidebar`, `Header` superior y el contenido de la vista
   activa.
4. `Sidebar` usa el mapa de `src/layout/navigation.ts` para renderizar
   secciones principales y acciones rapidas.
5. `App.tsx` mantiene el estado local de citas y pacientes para compartirlo
   entre Dashboard, Pacientes y Citas.
6. `PatientsView` recibe pacientes y el callback de alta desde `App.tsx`, y
   compone `PatientForm` con `PatientsList`.
7. `AppointmentsView` alterna entre la agenda y el formulario de nueva cita.
8. `DashboardView` recibe citas y pacientes desde `App.tsx`, calcula metricas
   con `src/utils/dashboardMetrics.ts` y compone las secciones del Dashboard.
9. `AppointmentForm` busca pacientes mock, guarda el paciente seleccionado por
   identificador, valida campos con funciones de `src/utils` y avisa a
   `App.tsx` cuando hay una nueva cita.
10. `App.tsx` agrega la nueva cita al estado local y vuelve a la agenda.
11. `AppointmentCard` usa funciones de `src/utils` para mostrar fecha, hora y
   estado en formato legible.
12. `PatientForm` maneja los campos del formulario con estado local, valida con
   funciones de `src/utils` y avisa a `PatientsView` cuando hay un nuevo
   paciente.
13. `PatientsList` recibe pacientes, maneja el texto de busqueda local y usa
   `filterPatients` para decidir que registros mostrar.
14. `PatientCard` muestra cada paciente filtrado.

## Modulos actuales

`Dashboard`

Incluye KPIs operativos, proximas atenciones, pacientes recientes y resumen
operativo. No muestra nuevos pacientes del mes porque aun no existe una fecha
real de registro para pacientes.

Participan:

- `src/views/DashboardView.tsx`: compone la pantalla principal.
- `src/components/DashboardKpiCard.tsx`: muestra cada indicador principal.
- `src/components/DashboardAppointmentList.tsx`: muestra hasta 5 proximas
  atenciones.
- `src/components/DashboardPatientsList.tsx`: muestra pacientes recientes.
- `src/components/DashboardActivityList.tsx`: muestra mensajes operativos.
- `src/utils/dashboardMetrics.ts`: calcula KPIs, citas de hoy, citas del mes,
  proximas citas, pacientes recientes y mensajes operativos.

`Pacientes`

Incluye listado, busqueda, formulario de registro, validaciones y telefono en
formato internacional compacto.

`Citas`

Incluye datos mock, resumen visual de proximas atenciones, una agenda
mobile-first y creacion local de citas en memoria.

Participan:

- `src/types/Appointment.ts`: define `Appointment`, `AppointmentStatus` y los
  valores del formulario de citas.
- `src/data/appointments.ts`: contiene citas mock.
- `src/data/treatments.ts`: contiene el catalogo mock de tratamientos.
- `src/views/AppointmentsView.tsx`: compone la vista de agenda o el formulario
  de nueva cita.
- `src/components/AppointmentsAgenda.tsx`: muestra la agenda agrupada por fecha
  y el resumen superior.
- `src/components/AppointmentAgendaCard.tsx`: muestra cada cita.
- `src/components/AppointmentForm.tsx`: registra una cita nueva en el estado
  local de la aplicacion.
- `src/utils/appointmentSorters.ts`: ordena citas por fecha y hora.
- `src/utils/appointmentGroups.ts`: agrupa citas por fecha y calcula resumen por
  estado.
- `src/utils/appointmentFormatters.ts`: formatea fecha, hora y estados.
- `src/utils/appointmentValidators.ts`: valida los campos del formulario de
  nueva cita.
- `src/utils/appointmentTimeSlots.ts`: genera el catalogo de horas exactas en
  intervalos de 15 minutos para el formulario.

La logica de ordenamiento, agrupacion, resumen, horarios y validacion debe
mantenerse fuera de los componentes para poder probarse con Vitest.

La edicion, eliminacion, cancelacion real y persistencia siguen pendientes.

`Historial clinico`, `Odontograma`, `Recordatorios` y `Configuracion`

Existen como vistas iniciales o placeholders para sostener la navegacion y el
mapa futuro de la aplicacion.
