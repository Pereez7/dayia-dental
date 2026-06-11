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
Actualmente guarda citas, pacientes, tratamientos, registros clinicos y
odontograma mock.

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
   secciones principales y acciones rapidas, separadas visualmente en marca,
   acciones y modulos.
5. `App.tsx` mantiene el estado local de citas, pacientes, tratamientos,
   registros clinicos y odontograma para compartirlo entre Dashboard,
   Pacientes, Citas, Configuracion y Detalle de paciente.
6. `PatientsView` recibe pacientes, el callback de alta y el callback para ver
   detalle desde `App.tsx`, y compone `PatientForm` con `PatientsList`.
7. `PatientCard` puede solicitar ver el detalle de un paciente.
8. `App.tsx` guarda `selectedPatientId`, cambia a la seccion interna
   `patient-detail` y renderiza `PatientDetailView`.
9. `PatientDetailView` compone la ficha del paciente con sus citas asociadas,
   historial clinico, odontograma y permite volver al listado.
10. `AppointmentsView` alterna entre la agenda y el formulario de nueva cita.
11. `DashboardView` recibe citas y pacientes desde `App.tsx`, calcula metricas
   con `src/utils/dashboardMetrics.ts` y compone las secciones del Dashboard.
12. `SettingsView` recibe tratamientos desde `App.tsx`, carga horarios mock y
   compone la configuracion del consultorio.
13. `BusinessHoursSettings` permite ajustar horario semanal, intervalo de
   atencion y estado abierto/cerrado por dia usando utilidades puras de
   `src/utils/businessHours.ts`.
14. `TreatmentsSettings` agrega, busca, edita, activa y desactiva tratamientos
   usando utilidades puras de `src/utils/treatmentUtils.ts` y feedback mediante
   `Toast`.
15. `AppointmentForm` busca pacientes mock, guarda el paciente seleccionado por
   identificador, calcula horas disponibles con horarios del consultorio y citas
   existentes, valida campos con funciones de `src/utils` y avisa a `App.tsx`
   cuando hay una nueva cita.
16. `AppointmentForm` recibe tratamientos desde `App.tsx` y muestra solo los
   tratamientos activos.
17. `App.tsx` agrega la nueva cita al estado local y vuelve a la agenda.
18. `App.tsx` tambien actualiza el estado local de una cita cuando la agenda
   solicita confirmar o cancelar.
19. `AppointmentCard` usa funciones de `src/utils` para mostrar fecha, hora y
   estado en formato legible.
20. `PatientForm` maneja los campos del formulario con estado local, valida con
   funciones de `src/utils` y avisa a `PatientsView` cuando hay un nuevo
   paciente.
21. `PatientsList` recibe pacientes, maneja el texto de busqueda local y usa
   `filterPatients` para decidir que registros mostrar.
22. `PatientCard` muestra cada paciente filtrado.
23. `ClinicalRecordForm` registra una evolucion clinica basica y normaliza los
   textos antes de avisar a `App.tsx`.
24. `ClinicalRecordsList` muestra los registros clinicos filtrados del paciente,
   con fechas compactas con año y resumen temporal.
25. `PatientOdontogram` muestra piezas permanentes adultas, resumen por estado y
   permite actualizar una pieza dental.
26. `WhatsAppRemindersView` genera recordatorios locales desde citas y
   pacientes, aplica filtros por fecha y estado, y muestra feedback mediante
   `Toast`.

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

Incluye listado, busqueda, formulario de registro, validaciones, telefono en
formato internacional compacto, detalle de paciente como vista completa e
historial clinico y odontograma inicial asociados al paciente.

Participan:

- `src/views/PatientsView.tsx`: compone listado y formulario de registro.
- `src/views/PatientDetailView.tsx`: muestra la ficha completa del paciente.
- `src/components/PatientsList.tsx`: filtra y lista pacientes.
- `src/components/PatientCard.tsx`: muestra cada paciente como ficha clinica
  escaneable y permite abrir el detalle.
- `src/components/PatientAppointmentsList.tsx`: lista citas asociadas al
  paciente.
- `src/components/ClinicalRecordForm.tsx`: registra una evolucion clinica
  basica.
- `src/components/ClinicalRecordsList.tsx`: muestra registros clinicos del
  paciente.
- `src/components/PatientOdontogram.tsx`: muestra y actualiza estados basicos
  de piezas dentales.
- `src/utils/patientFilters.ts`: filtra pacientes por busqueda.
- `src/utils/patientDetails.ts`: calcula edad y obtiene citas relacionadas.
- `src/utils/clinicalRecords.ts`: filtra, ordena, valida, normaliza y resume
  registros clinicos.
- `src/utils/odontogram.ts`: genera piezas FDI adultas, filtra entradas,
  obtiene estados, calcula resumen, valida y actualiza entradas.
- `src/utils/textNormalizers.ts`: normaliza textos escritos en formularios.
- `src/utils/dateFormatters.ts`: formatea fechas compactas con año.

El detalle asocia citas por `patientId` cuando existe. Para mantener
compatibilidad con citas mock antiguas, tambien acepta coincidencia por nombre
exacto del paciente.

El historial clinico se asocia siempre por `patientId`. Por ahora vive dentro
del detalle del paciente y no en la vista global del menu lateral.

El odontograma tambien se asocia por `patientId`; cada entrada identifica una
pieza mediante `toothNumber`. Por ahora vive dentro del detalle del paciente y
no en la vista global del menu lateral.

`Citas`

Incluye datos mock, agenda diaria mobile-first, resumen visual del dia
seleccionado y creacion local de citas en memoria.

Participan:

- `src/types/Appointment.ts`: define `Appointment`, `AppointmentStatus` y los
  valores del formulario de citas.
- `src/data/appointments.ts`: contiene citas mock.
- `src/data/treatments.ts`: contiene el catalogo inicial tipado de tratamientos.
- `src/views/AppointmentsView.tsx`: compone la vista de agenda o el formulario
  de nueva cita.
- `src/components/AppointmentsAgenda.tsx`: muestra la agenda diaria, selector
  horizontal de dias, resumen del dia, lista de citas del dia seleccionado,
  acciones locales, Toast y estado temporal de reprogramacion.
- `src/components/AppointmentAgendaCard.tsx`: muestra cada cita y el panel
  inline de reprogramacion cuando corresponde.
- `src/components/ConfirmDialog.tsx`: muestra confirmaciones reutilizables para
  acciones sensibles, con variantes visuales, Escape para cancelar y atributos
  basicos de accesibilidad.
- `src/components/AppointmentForm.tsx`: registra una cita nueva en el estado
  local de la aplicacion.
- `src/utils/appointmentActions.ts`: define que acciones estan disponibles para
  una cita segun su estado actual y reglas puras para cerrar el panel de
  reprogramacion.
- `src/utils/appointmentReschedule.ts`: valida y aplica la reprogramacion local
  de citas.
- `src/utils/appointmentSorters.ts`: ordena citas por fecha y hora.
- `src/utils/appointmentGroups.ts`: agrupa citas por fecha, filtra citas del
  dia seleccionado, genera dias visibles para el selector y calcula resumen por
  estado.
- `src/utils/appointmentFormatters.ts`: formatea fecha, hora y estados.
- `src/utils/appointmentValidators.ts`: valida los campos del formulario de
  nueva cita.
- `src/utils/appointmentTimeSlots.ts`: genera el catalogo de horas exactas en
  intervalos de 15 minutos para el formulario.
- `src/utils/businessHours.ts`: genera slots validos por fecha segun horario
  semanal e intervalo configurado.
- `src/utils/appointmentConflicts.ts`: detecta choques de fecha/hora, doble
  cita activa de paciente en el dia y calcula horas disponibles.

La agenda diaria inicia en hoy y permite saltar a mañana o a proximos dias con
citas. Las citas del dia se ordenan por hora ascendente y los KPIs se calculan
solo con el dia seleccionado.

Desde la agenda diaria se puede confirmar una cita pendiente o cancelar una
cita pendiente, confirmada o reprogramada. La cancelacion no elimina la cita:
antes pide confirmacion mediante `ConfirmDialog`, solo cambia su estado a
`cancelled`, mantiene la card visible y libera el horario para Nueva Cita.

Las citas canceladas no se reprograman directamente. Si el paciente desea
asistir nuevamente, se crea una nueva cita. Mas adelante, cuando exista
integracion real con WhatsApp, se evaluaran estados intermedios como
`Solicitud de cancelacion` para evitar cancelaciones accidentales.

La reprogramacion local vive como panel inline dentro de la card. El panel es
contextual: se cierra al cambiar el dia seleccionado, al volver a pulsar
`Reprogramar`, al cancelar el formulario o al cancelar la cita. Antes de guardar,
la agenda vuelve a consultar el estado actual de la cita y bloquea cualquier
reprogramacion de citas canceladas. `App.tsx` tambien evita aplicar una
reprogramacion si el estado actual ya no lo permite.

Nueva Cita recibe las citas existentes para ocultar horas ocupadas por citas
pendientes, confirmadas o reprogramadas. Las citas canceladas no bloquean
horario. Aunque el selector solo muestra horas disponibles, la validacion final
vuelve a comprobar choque exacto y doble cita activa del paciente en el dia.

La logica de ordenamiento, agrupacion, resumen, horarios, conflictos y
validacion debe mantenerse fuera de los componentes para poder probarse con
Vitest.

La edicion general, eliminacion, motivo de cancelacion, historial de cambios y
persistencia siguen pendientes.

`Configuracion`

Incluye horarios del consultorio y gestion local de tratamientos. Participan:

- `src/types/BusinessHours.ts`: define dias, horarios e intervalos de
  atencion.
- `src/data/businessHours.ts`: contiene la configuracion mock inicial de
  horarios.
- `src/types/Treatment.ts`: define `Treatment`.
- `src/views/SettingsView.tsx`: compone la vista de configuracion.
- `src/components/BusinessHoursSettings.tsx`: muestra horario semanal,
  intervalo de atencion, validaciones y Toast al guardar.
- `src/components/TreatmentsSettings.tsx`: muestra formulario, busqueda,
  edicion, activacion, desactivacion y Toast de feedback.
- `src/components/Toast.tsx`: muestra confirmaciones flotantes sin mover el
  layout.
- `src/utils/businessHours.ts`: valida horarios, estados de dia e intervalos.
- `src/utils/treatmentUtils.ts`: normaliza nombres, valida duplicados, filtra
  activos y aplica busqueda.

Los tratamientos se mantienen en estado local dentro de `App.tsx`; Nueva Cita
recibe esa misma lista y muestra solo tratamientos activos.

Los horarios se validan de forma local y no tienen persistencia todavia. El
bloque `Excepciones del calendario` es informativo y prepara una futura
evolucion hacia feriados, cierres especiales o dias con horario distinto.

`Historial clinico`

Existe como primera version dentro de `PatientDetailView`. Participan:

- `src/types/ClinicalRecord.ts`: define `ClinicalRecord` y los valores del
  formulario.
- `src/data/clinicalRecords.ts`: contiene registros clinicos mock.
- `src/components/ClinicalRecordForm.tsx`: captura fecha, motivo, diagnostico,
  tratamiento y observaciones.
- `src/components/ClinicalRecordsList.tsx`: renderiza los registros del
  paciente y el resumen temporal.
- `src/utils/clinicalRecords.ts`: filtra por paciente, ordena por fecha
  descendente, valida fecha no futura y campos obligatorios, normaliza valores
  y calcula el resumen temporal.
- `src/utils/textNormalizers.ts`: compacta espacios y capitaliza como oracion.
- `src/utils/dateFormatters.ts`: muestra fechas como `09-jun-2026`.

El modulo lateral `Historial clinico` sigue siendo placeholder hasta definir una
experiencia global de busqueda, filtros y seleccion de paciente.

`Odontograma`

Existe como primera version dentro de `PatientDetailView`. Participan:

- `src/types/Odontogram.ts`: define `OdontogramEntry`, `ToothStatus` y valores
  del formulario.
- `src/data/odontogram.ts`: contiene entradas mock asociadas a pacientes.
- `src/components/PatientOdontogram.tsx`: renderiza grilla de piezas, resumen
  por estado y panel de actualizacion.
- `src/utils/odontogram.ts`: genera piezas permanentes adultas FDI, filtra por
  paciente, obtiene estado por pieza, cuenta estados, valida formulario,
  normaliza observaciones y crea o actualiza entradas.
- `src/utils/textNormalizers.ts`: normaliza observaciones.
- `src/utils/dateFormatters.ts`: muestra `updatedAt` como `09-jun-2026`.

El modulo lateral `Odontograma` sigue siendo placeholder global hasta definir
una experiencia visual mas completa. La primera version evita superficies
dentales, denticion temporal infantil y graficos complejos.

## Estilos reutilizables

`src/App.css` contiene clases globales simples para botones:

- `primary-action`
- `secondary-action`
- `soft-action`
- `success-action`
- `warning-action`
- `danger-action`

Estas clases mantienen una base visual compartida y permiten aplicar color
semantico sin crear estilos aislados por vista.

Tambien centraliza el pulido visual actual de:

- Sidebar desktop y navegacion movil horizontal.
- Panel de KPIs del Dashboard.
- Cards de pacientes y badges semanticos de estado.
- Cabecera clinica del detalle de paciente.
- Grilla, resumen y editor visual del odontograma.
- Inputs, selects, textareas, mensajes y estados vacios.
- Botones compactos de Configuracion alineados con Recordatorios, con acciones
  neutras y color semantico en el texto.
- Agenda diaria con KPIs compactos, selector de dias, cards de cita, botones de
  accion, estado vacio y panel de reprogramacion alineados con Recordatorios y
  Configuracion.
- `ConfirmDialog` centrado con overlay suave, variantes semanticas y botones
  coherentes con el sistema visual actual.

Estos ajustes son visuales; la logica sigue viviendo en componentes y
utilidades separadas.

`Recordatorios WhatsApp`

Existe como primera version funcional en frontend. Genera recordatorios locales
desde citas futuras y pacientes mock, sin enviar mensajes reales.

Participan:

- `src/types/Reminder.ts`: define `Reminder`, `ReminderType`,
  `ReminderStatus`, agrupaciones por cita y opciones de fecha.
- `src/views/WhatsAppRemindersView.tsx`: compone KPIs, selector de fecha,
  filtros por estado, listado, vista previa y Toast de feedback.
- `src/components/ReminderKpiCard.tsx`: muestra indicadores del modulo.
- `src/components/RemindersList.tsx`: renderiza citas agrupadas,
  recordatorios, notas de omision y acciones.
- `src/components/ReminderMessagePreview.tsx`: muestra el mensaje sugerido.
- `src/components/Toast.tsx`: muestra feedback flotante sin mover el layout.
- `src/utils/reminders.ts`: genera recordatorios, filtra por fecha y estado,
  agrupa por cita y fecha, calcula resumen y crea mensajes sugeridos.

La generacion de recordatorios evita crear horarios en el pasado. Para cada cita
futura no cancelada, `24h` y `2h` solo se generan si su horario programado queda
despues de la fecha/hora de referencia. Si una cita esta demasiado cerca, se
registra una nota de omision y, cuando ya no aplica `24h` ni `2h`, se genera
una confirmacion inmediata con estado pendiente.

El estado de envio es local y simulado. Marcar como enviado o fallido solo
actualiza la vista durante la sesion actual. El Toast se posiciona como
elemento flotante para evitar saltos visuales en el layout.
