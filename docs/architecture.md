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
Actualmente conserva datos mock para el modo demo, incluidos registros clinicos
y odontograma. En modo real, el historial clinico ya no consume estos mocks.

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
5. `App.tsx` coordina los datos compartidos. En modo real carga pacientes,
   citas e historial clinico desde Supabase; en demo mantiene sus colecciones
   mock. El odontograma continua en memoria.
6. `PatientsView` recibe pacientes, el callback de alta y el callback para ver
   detalle desde `App.tsx`. En modo listado prioriza `PatientsList` y deja el
   formulario debajo; en modo `new` muestra solo `PatientForm`.
7. `PatientCard` puede solicitar ver el detalle de un paciente.
8. `App.tsx` guarda `selectedPatientId`, cambia a la seccion interna
   `patient-detail` y renderiza `PatientDetailView`.
9. `PatientDetailView` compone la ficha del paciente con resumen superior,
   citas activas asociadas, historial clinico, odontograma y permite volver al
   listado.
10. `AppointmentsView` alterna entre la agenda y el formulario de nueva cita.
11. `DashboardView` recibe citas y pacientes desde `App.tsx`, calcula metricas
   con `src/utils/dashboardMetrics.ts` y compone KPIs, proximas citas activas,
   citas que requieren atencion, actividad reciente, resumen mensual y
   pacientes recientes.
12. `SettingsView` recibe tratamientos y excepciones del calendario desde
   `App.tsx`, carga horarios mock y compone la configuracion del consultorio.
13. `BusinessHoursSettings` permite ajustar horario semanal, intervalo de
   atencion, estado abierto/cerrado por dia y excepciones del calendario usando
   utilidades puras de `src/utils/businessHours.ts`.
14. `TreatmentsSettings` agrega, busca, edita, activa y desactiva tratamientos
   usando utilidades puras de `src/utils/treatmentUtils.ts`, confirma la
   desactivacion con `ConfirmDialog` y muestra feedback mediante `Toast`.
15. `AppointmentForm` busca pacientes mock, guarda el paciente seleccionado por
   identificador, calcula horas disponibles con horarios del consultorio y citas
   existentes, valida campos con funciones de `src/utils` y avisa a `App.tsx`
   cuando hay una nueva cita.
16. `AppointmentForm` recibe tratamientos desde `App.tsx` y muestra solo los
   tratamientos activos.
17. `App.tsx` agrega la nueva cita al estado local y vuelve a la agenda.
18. `App.tsx` tambien actualiza el estado local de una cita cuando la agenda
   solicita confirmar, cancelar o reprogramar con motivo.
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
26. `ClinicalHistoryView` recibe pacientes y registros clinicos desde `App.tsx`,
   agrupa los registros por paciente, aplica busqueda/filtros locales y permite
   volver al detalle del paciente con `onViewPatient`.
27. `WhatsAppRemindersView` genera recordatorios locales desde citas activas y
   pacientes, aplica filtros por fecha y estado, usa mensajes segun estado de
   cita y muestra feedback mediante `Toast`.

## Modulos actuales

`Dashboard`

Incluye KPIs operativos, proximas citas activas, citas que requieren atencion,
actividad reciente, resumen mensual y pacientes recientes. No muestra nuevos
pacientes del mes porque aun no existe una fecha real de registro para
pacientes.

Participan:

- `src/views/DashboardView.tsx`: compone la pantalla principal.
- `src/components/DashboardKpiCard.tsx`: muestra cada indicador principal.
- `src/components/DashboardAppointmentList.tsx`: muestra hasta 5 proximas
  citas activas.
- `src/components/DashboardAttentionList.tsx`: muestra citas que requieren
  seguimiento operativo.
- `src/components/DashboardMonthSummary.tsx`: muestra resumen del mes.
- `src/components/DashboardPatientsList.tsx`: muestra pacientes recientes.
- `src/components/DashboardActivityList.tsx`: muestra actividad reciente basada
  en cambios de cita.
- `src/utils/dashboardMetrics.ts`: calcula KPIs, citas de hoy, resumen mensual,
  proximas citas, citas que requieren atencion, actividad reciente y pacientes
  recientes.

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
- `src/utils/patientDetails.ts`: calcula edad, obtiene citas relacionadas,
  filtra citas activas y obtiene la proxima cita activa del paciente.
- `src/utils/clinicalRecords.ts`: filtra, ordena, valida, normaliza y resume
  registros clinicos.
- `src/utils/odontogram.ts`: genera piezas FDI adultas, filtra entradas,
  obtiene estados, calcula resumen, valida y actualiza entradas.
- `src/utils/textNormalizers.ts`: normaliza textos escritos en formularios.
- `src/utils/dateFormatters.ts`: formatea fechas de la app con
  `formatAppDate`, agrega año solo cuando corresponde, mantiene horas en 24
  horas y ofrece fallbacks seguros para fechas invalidas.

El detalle asocia citas por `patientId` cuando existe. Para mantener
compatibilidad con citas mock antiguas, tambien acepta coincidencia por nombre
exacto del paciente.

La ficha superior del detalle muestra resumen operativo con cantidad de citas
activas, ultima atencion y proxima cita activa. Las citas canceladas no cuentan
como proxima atencion del paciente.

Las fechas visibles usan utilidades compartidas para evitar valores crudos como
`2026-05-18`. El formato global preferido es `14 jun` para fechas del año
actual y `14 jun 2025` para otros años. Cuando existe hora, se muestra en
formato 24 horas, por ejemplo `14 jun, 15:16`.

El historial clinico se asocia siempre por `patientId`. Existe dentro del
detalle del paciente para registrar y revisar evoluciones de un paciente
seleccionado, y tambien existe como vista global agrupada por paciente para
consultar historiales entre pacientes sin repetir cards por cada registro.

El odontograma tambien se asocia por `patientId`; cada entrada identifica una
pieza mediante `toothNumber`. `PatientOdontogram` usa grupos FDI generados por
`src/utils/odontogram.ts` para separar arcada superior e inferior y mostrar
cuadrantes como derecha o izquierda del paciente. Por ahora vive dentro del
detalle del paciente y no en la vista global del menu lateral.

`Citas`

Incluye datos mock, agenda diaria mobile-first, resumen visual del dia
seleccionado y creacion local de citas en memoria.

Participan:

- `src/types/Appointment.ts`: define `Appointment`, `AppointmentStatus`,
  `AppointmentChangeLogEntry` y los valores del formulario de citas.
- `src/data/appointments.ts`: contiene citas mock.
- `src/data/treatments.ts`: contiene el catalogo inicial tipado de tratamientos.
- `src/data/calendarExceptions.ts`: contiene la lista inicial de excepciones
  del calendario.
- `src/views/AppointmentsView.tsx`: compone la vista de agenda o el formulario
  de nueva cita.
- `src/components/AppointmentsAgenda.tsx`: muestra la agenda diaria, selector
  horizontal de dias, resumen del dia, lista de citas del dia seleccionado,
  acciones locales, Toast, motivo temporal de cancelacion y estado temporal de
  reprogramacion.
- `src/components/AppointmentAgendaCard.tsx`: muestra cada cita con bloques
  separados para rango horario, paciente, estado, tratamiento, metadatos y
  acciones; tambien muestra el panel inline de reprogramacion cuando
  corresponde, incluyendo motivo de reprogramacion.
- `src/components/ConfirmDialog.tsx`: muestra confirmaciones reutilizables para
  acciones sensibles, acepta contenido adicional opcional, tiene variantes
  visuales, Escape para cancelar y atributos basicos de accesibilidad.
- `src/components/AppointmentForm.tsx`: registra una cita nueva en el estado
  local de la aplicacion.
- `src/utils/appointmentActions.ts`: define que acciones estan disponibles para
  una cita segun su estado actual y reglas puras para cerrar el panel de
  reprogramacion.
- `src/utils/appointmentReasons.ts`: define motivos permitidos, valida motivo y
  detalle `Otro`, normaliza detalles y arma el texto guardado en la cita.
- `src/utils/appointmentReschedule.ts`: valida y aplica la reprogramacion local
  de citas, incluyendo cambio real de fecha u hora y motivo guardado.
- `src/utils/appointmentChangeLog.ts`: crea eventos simples de historial,
  agrega eventos de forma inmutable y formatea el ultimo cambio visible en la
  card.
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
  efectivo, horario semanal, excepciones del calendario e intervalo
  configurado.
- `src/utils/appointmentConflicts.ts`: calcula rangos horarios por duracion,
  detecta solapamientos entre citas activas, valida doble cita activa de
  paciente en el dia y calcula horas disponibles.

La agenda diaria inicia en hoy y permite saltar a mañana o a proximos dias con
citas. Las citas del dia se ordenan por hora ascendente y los KPIs se calculan
solo con el dia seleccionado.

Desde la agenda diaria se puede confirmar una cita pendiente o cancelar una
cita pendiente, confirmada o reprogramada. La cancelacion no elimina la cita:
antes pide confirmacion mediante `ConfirmDialog`, solicita un motivo obligatorio,
solo cambia su estado a `cancelled`, guarda el motivo en la cita, mantiene la
card visible y libera el horario para Nueva Cita.

Si el motivo de cancelacion es `Otro`, la agenda solicita un detalle breve,
normaliza el texto y lo guarda como detalle del motivo. Los errores de motivo se
muestran inline dentro del dialogo y no usan Toast.

Las citas canceladas no se reprograman directamente. Si el paciente desea
asistir nuevamente, se crea una nueva cita. Mas adelante, cuando exista
integracion real con WhatsApp, se evaluaran estados intermedios como
`Solicitud de cancelacion` para evitar cancelaciones accidentales.

La reprogramacion local vive como panel inline dentro de la card. El panel es
contextual: se cierra al cambiar el dia seleccionado, al volver a pulsar
`Reprogramar`, al cancelar el formulario o al cancelar la cita. El cierre usa
una funcion explicita para limpiar fecha, hora, motivo, detalle de `Otro` y
errores inline temporales. Antes de guardar, la agenda vuelve a consultar el
estado actual de la cita y bloquea cualquier reprogramacion de citas canceladas.
`App.tsx` tambien evita aplicar una reprogramacion si el estado actual ya no lo
permite.

Mientras el panel esta abierto, `AppointmentAgendaCard` oculta las acciones
externas de la cita y deja visibles solo `Guardar` y `Cancelar` del panel. Esto
evita mezclar cancelar la edicion con cancelar la cita completa.

La card de agenda separa visualmente el rango horario de los datos del paciente
y de las acciones. En desktop reserva una columna propia para rangos como
`13:00 - 13:30`, una columna flexible para paciente/tratamiento y una columna a
la derecha para estado y acciones. En mobile se apila para conservar lectura y
evitar desbordes.

Al reprogramar se solicita un motivo obligatorio. Si el motivo es `Otro`, se
requiere un detalle breve, se normaliza y se guarda en la cita. Por ahora una
nueva reprogramacion sobrescribe el ultimo motivo y no crea historial acumulado
de cambios.

La reprogramacion solo se guarda si cambia la fecha o la hora respecto a la cita
actual. Si ambos valores son iguales, `validateAppointmentReschedule` devuelve
un error inline de accion y no se cambia el estado a `rescheduled`. Ese error
se queda dentro del panel de reprogramacion y no dispara Toast para evitar
mensajes duplicados.

El detalle `Otro` de motivos se limita a 120 caracteres, muestra contador visual
y usa un textarea de altura fija para no afectar la composicion de la agenda. En
las cards, el motivo se muestra como texto secundario truncado para conservar la
lectura rapida de hora, paciente, tratamiento, estado y acciones.

Las citas pueden incluir `changeLog` opcional. `App.tsx` agrega eventos al crear,
confirmar y cancelar citas; `appointmentReschedule.ts` agrega eventos al
reprogramar. Los eventos existentes se conservan con append inmutable y no se
exponen acciones de edicion o borrado en la UI.

La card de agenda muestra solo un resumen del ultimo cambio relevante. El evento
`created` se conserva internamente para trazabilidad, pero no se muestra como
`Ultimo cambio`; se muestran confirmaciones, cancelaciones y reprogramaciones en
formato corto y legible.

Nueva Cita recibe las citas existentes para ocultar horas cuyo rango completo se
solaparia con citas pendientes, confirmadas o reprogramadas. La disponibilidad
usa la duracion del tratamiento seleccionado, el intervalo configurado, el
horario efectivo del consultorio y las horas pasadas cuando la fecha es hoy. Las
citas canceladas no bloquean horario. Aunque el selector solo muestra horas
disponibles, la validacion final vuelve a comprobar solapamiento por rango,
ajuste al horario de cierre y doble cita activa del paciente en el dia.

El horario efectivo de una fecha se calcula en `src/utils/businessHours.ts`.
Primero se busca una excepcion del calendario para la fecha; si existe una
excepcion cerrada, el dia queda cerrado aunque el horario semanal diga lo
contrario. Si existe una excepcion de horario especial, ese rango reemplaza al
horario semanal. Si no existe excepcion, se usa el horario semanal base.

La deteccion de solapamiento usa rangos `[inicio, fin)`: hay conflicto cuando el
inicio de una cita queda antes del fin de otra y su fin queda despues del inicio
de la otra. Con esa regla, `13:00 - 13:30` y `13:30 - 14:00` pueden convivir,
pero `13:15 - 13:45` se bloquea.

Reprogramar usa la misma regla de disponibilidad por duracion, pasando
`appointmentIdToIgnore` para ignorar la cita que se esta moviendo. Las citas
antiguas sin `durationMinutes` usan la duracion del tratamiento cuando se puede
resolver y, si no, el fallback seguro de 30 minutos.

La logica de ordenamiento, agrupacion, resumen, horarios, conflictos y
validacion debe mantenerse fuera de los componentes para poder probarse con
Vitest.

La edicion general, eliminacion, historial completo de cambios y persistencia
siguen pendientes.

`Configuracion`

Incluye horarios del consultorio, excepciones del calendario y gestion local de
tratamientos. Participan:

- `src/types/BusinessHours.ts`: define dias, horarios e intervalos de
  atencion, ademas de tipos para excepciones del calendario.
- `src/data/businessHours.ts`: contiene la configuracion mock inicial de
  horarios.
- `src/data/calendarExceptions.ts`: contiene la lista inicial de excepciones
  del calendario.
- `src/types/Treatment.ts`: define `Treatment`.
- `src/views/SettingsView.tsx`: compone la vista de configuracion.
- `src/components/BusinessHoursSettings.tsx`: muestra horario semanal,
  intervalo de atencion, excepciones del calendario, validaciones,
  `ConfirmDialog` para eliminar excepciones y Toast de feedback.
- `src/components/TreatmentsSettings.tsx`: muestra formulario, busqueda,
  edicion, activacion, confirmacion de desactivacion y Toast de feedback.
- `src/components/Toast.tsx`: muestra confirmaciones flotantes sin mover el
  layout.
- `src/components/ConfirmDialog.tsx`: confirma acciones sensibles como cancelar
  citas o desactivar tratamientos.
- `src/utils/businessHours.ts`: valida horarios, estados de dia, intervalos,
  excepciones del calendario y calcula horarios efectivos por fecha.
- `src/utils/treatmentUtils.ts`: normaliza nombres, valida duplicados, filtra
  activos y aplica busqueda.

Los tratamientos se mantienen en estado local dentro de `App.tsx`; Nueva Cita
recibe esa misma lista y muestra solo tratamientos activos.

Los horarios y excepciones se validan de forma local y no tienen persistencia
todavia. Las excepciones permiten cerrar una fecha puntual o definir un horario
especial. Nueva Cita y Reprogramar consumen esas excepciones para calcular
opciones disponibles y validar el guardado.

`Historial clinico`

Existe como primera version dentro de `PatientDetailView` y como vista global
agrupada por paciente. Participan:

- `src/types/ClinicalRecord.ts`: define `ClinicalRecord` y los valores del
  formulario.
- `src/data/clinicalRecords.ts`: contiene registros clinicos mock.
- `src/views/ClinicalHistoryView.tsx`: compone el modulo global con KPIs,
  buscador, filtros, cards agrupadas por paciente y expansion controlada de
  registros.
- `src/components/ClinicalRecordForm.tsx`: captura fecha, motivo, diagnostico,
  tratamiento y observaciones.
- `src/components/ClinicalRecordsList.tsx`: renderiza los registros del
  paciente y el resumen temporal.
- `src/services/clinicalRecordsService.ts`: lista por clinica o paciente,
  crea registros y mapea `observations` al campo visible `notes`.
- `src/utils/clinicalRecords.ts`: filtra por paciente, ordena por fecha
  descendente, valida fecha no futura y campos obligatorios, normaliza valores,
  calcula resumen temporal, compone registros globales con datos de pacientes,
  agrupa por paciente, obtiene el ultimo registro, filtra grupos por busqueda y
  calcula KPIs globales.
- `src/utils/textNormalizers.ts`: compacta espacios y capitaliza como oracion.
- `src/utils/dateFormatters.ts`: muestra fechas con año dentro del detalle del
  paciente y fechas cortas en la vista global, como `18 may` o
  `12 jun, 15:16` cuando hay hora.

El detalle de paciente muestra todos los registros del paciente seleccionado y
permite agregar evoluciones. La vista global no permite editar ni eliminar:
resume una card por paciente, muestra el ultimo registro, permite expandir hasta
los ultimos 3 registros y ofrece `Ver paciente` para volver al detalle.

La busqueda global revisa paciente, motivo, diagnostico, tratamiento y
observaciones. Si una coincidencia esta dentro de los registros, se muestra la
card del paciente y los registros coincidentes como muestra interna.

Los textos clinicos guardados se normalizan al crear registros. Para datos mock
antiguos o textos sin tilde, la vista global usa un formatter de presentacion
conservador que mejora tildes visibles sin cambiar el dato original.

En modo real, `clinical_records` es la fuente persistente. Cada fila contiene
`clinic_id`, `patient_id`, `created_by`, `record_date`, motivo, diagnostico,
tratamiento y observaciones. RLS permite lectura, creacion y actualizacion solo
a memberships activas `clinic_owner`, `clinic_admin` o `doctor`; recepcion y un
administrador de plataforma sin membership clinica autorizada no reciben datos.
La policy de escritura comprueba ademas que el paciente pertenezca a la misma
clinica y el trigger impide cambiar el alcance del registro despues de crearlo.

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
- `src/utils/dateFormatters.ts`: muestra `updatedAt` con `formatAppDate`, por
  ejemplo `14 jun` o `14 jun 2025` segun corresponda.

El modulo lateral `Odontograma` sigue siendo placeholder global hasta definir
una experiencia visual mas completa. La primera version evita superficies
dentales, denticion temporal infantil y graficos complejos.

No existe tabla `odontogram_entries` ni persistencia de odontograma. Este paso
no modifica su UI o comportamiento local.

`PatientDetailView` entrega a `PatientOdontogram` entradas ya filtradas por
paciente. Por eso los helpers de lectura de pieza trabajan sobre la coleccion
recibida y buscan por `toothNumber`; el filtrado por `patientId` queda en
`getOdontogramEntriesByPatient`.

El resumen del odontograma no cuenta solo entradas existentes: recorre las 32
piezas adultas FDI generadas por `generateAdultTeethNumbers` y usa `healthy`
como estado por defecto cuando una pieza aun no tiene entrada. Esto permite que
el resumen siempre represente la boca adulta completa.

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
- Subpaneles de Configuracion para Horarios, Excepciones y Tratamientos con
  degradado suave compartido, separacion por borde y acciones asociadas a su
  bloque.
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
  `ReminderStatus`, estado de cita asociado al recordatorio, agrupaciones por
  cita y opciones de fecha.
- `src/views/WhatsAppRemindersView.tsx`: compone KPIs, selector de fecha,
  filtros por estado, listado, vista previa y Toast de feedback.
- `src/components/ReminderKpiCard.tsx`: muestra indicadores del modulo.
- `src/components/RemindersList.tsx`: renderiza citas agrupadas,
  recordatorios, notas de omision y acciones.
- `src/components/ReminderMessagePreview.tsx`: muestra el mensaje sugerido.
- `src/components/Toast.tsx`: muestra feedback flotante sin mover el layout.
- `src/utils/reminders.ts`: genera recordatorios, filtra por fecha y estado,
  agrupa por cita y fecha, calcula resumen, prioriza la cola, valida si un
  recordatorio puede marcarse como enviado, formatea fecha/hora visible y crea
  mensajes sugeridos.

La generacion de recordatorios solo considera citas futuras activas:
`pending`, `confirmed` y `rescheduled`. Las citas `cancelled` no generan
recordatorios, no aparecen en la cola y no afectan KPIs del modulo. Las citas
`completed` tampoco entran en esta cola inicial.

Para cada cita activa, `24h` y `2h` solo se generan si su horario programado
queda despues de la fecha/hora de referencia. Si una cita esta demasiado cerca,
se registra una nota de omision y, cuando ya no aplica `24h` ni `2h`, se genera
una confirmacion inmediata con estado pendiente.

Las citas reprogramadas usan siempre su fecha y hora vigentes. Si existe motivo
de reprogramacion, la card puede mostrarlo como texto secundario discreto.

Los mensajes sugeridos se crean segun el estado real de la cita:

- Pendiente: pide confirmar asistencia.
- Confirmada: menciona que la cita ya esta confirmada y no pide confirmar de
  nuevo.
- Reprogramada: menciona que la cita fue reprogramada y pide confirmar
  asistencia.

La cola se ordena priorizando recordatorios pendientes de citas pendientes y
luego proximidad operativa. Las fechas visibles en filas de recordatorio usan
formato corto 24 horas, por ejemplo `15 jun, 10:00`, mediante
`formatReminderScheduledDateTime`.

El estado de envio es local y simulado. Marcar como enviado o fallido solo
actualiza la vista durante la sesion actual. Si falta telefono, `Marcar
enviado` queda deshabilitado y `canMarkReminderAsSent` evita aplicar ese estado
por defensa de presentacion. El Toast se posiciona como elemento flotante para
evitar saltos visuales en el layout.

## Administración de plataforma

React accede a consultorios mediante `platformAdminService` y las Edge
Functions `list-platform-clinics` y `create-platform-clinic`. La creación
valida JWT e `is_platform_admin` con RLS antes del feature flag y de usar
`service_role`. Su escritura se limita a `clinics`, Auth/profile del owner,
`clinic_memberships` y `clinic_subscriptions`; los datos clínicos quedan fuera.
El formulario siempre llama a la Function, bloquea solicitudes concurrentes y
refresca el listado solo después de una respuesta exitosa.
