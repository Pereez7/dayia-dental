# Contexto del proyecto

DayIA Dental es una aplicacion interna para consultorios dentales. El objetivo
es ayudar a registrar pacientes, organizar citas y preparar recordatorios,
especialmente pensando en una futura integracion con WhatsApp.

## Estado actual

- Frontend con React, TypeScript y Vite.
- Pruebas unitarias configuradas con Vitest.
- Git inicializado y remoto GitHub configurado.
- Layout base con sidebar, header superior y navegacion por estado local.
- Sidebar visualmente estructurado con marca, acciones rapidas y modulos.
- Dashboard operativo con KPIs, proximas atenciones, pacientes recientes y
  resumen operativo, con composicion visual refinada.
- Configuracion de horarios y tratamientos del consultorio, conectada con
  Nueva Cita para tratamientos activos y disponibilidad de horarios.
- Primera version de historial clinico dentro del detalle de paciente.
- Primera version de odontograma dentro del detalle de paciente.
- Primera version del modulo Recordatorios WhatsApp con simulacion local.
- Componentes separados en `src/components`.
- Vistas completas en `src/views`.
- Datos mock separados en `src/data`.
- Tipos compartidos en `src/types`.
- Utilidades puras en `src/utils`.
- Pruebas unitarias para formatters, filtros y validaciones.

## Dashboard

Actualmente existe una pantalla principal operativa:

- Muestra KPIs de atenciones de hoy, atenciones del mes, pendientes por
  confirmar, pacientes registrados y reprogramadas del mes.
- Muestra maximo 5 proximas atenciones con fecha, hora, paciente, tratamiento y
  estado.
- Muestra pacientes recientes usando el estado local actual de pacientes.
- Muestra un resumen operativo con mensajes derivados de citas actuales.
- No muestra nuevos pacientes del mes porque los pacientes mock no tienen fecha
  real de registro.
- Organiza los KPIs en un panel visual equilibrado para evitar huecos en
  desktop y mantener lectura clara en mobile.
- Los calculos viven en `src/utils/dashboardMetrics.ts` y tienen pruebas
  unitarias.

## Modulo pacientes

Actualmente existe:

- Listado de pacientes.
- Busqueda por nombre, apellido o telefono.
- Cards de pacientes con formato de ficha clinica escaneable.
- Formulario de registro de paciente.
- Vista completa de detalle de paciente.
- Validaciones de nombre, apellido, telefono, email y fecha de nacimiento.
- Selector manual de prefijo telefonico.
- Guardado del telefono en formato internacional compacto, por ejemplo
  `+59170000000`.
- Ficha de paciente con telefono, email, fecha de nacimiento, edad, ultima
  visita y proxima cita.
- Citas asociadas al paciente usando `patientId` cuando existe y nombre exacto
  como fallback para citas mock antiguas.
- Historial clinico asociado al paciente mediante `patientId`.
- Registro local de evoluciones clinicas con fecha, motivo, diagnostico,
  tratamiento y observaciones.
- Textos clinicos normalizados antes de guardarse: espacios compactados y
  capitalizacion como oracion.
- Fechas del historial clinico mostradas con año y resumen temporal del rango
  de registros.
- Odontograma asociado al paciente mediante `patientId`.
- Grilla simple de piezas permanentes adultas usando numeracion FDI.
- Registro local de estado, observaciones y fecha de actualizacion por pieza.
- Resumen de piezas por estado con colores suaves.
- Sidebar y fichas de pacientes tienen mejoras visuales controladas sin cambiar
  el flujo funcional.

Este modulo esta preparado para una futura integracion con WhatsApp, pero aun no
envia mensajes ni consume APIs externas.

El detalle de paciente se mantiene como vista completa, no como popup ni drawer,
porque mas adelante debe alojar secciones clinicas con mas contexto, como
historial clinico, odontograma, recordatorios y evoluciones.

## Historial clinico

Actualmente existe una primera version dentro del detalle de paciente:

- Usa datos mock desde `src/data/clinicalRecords.ts`.
- Mantiene los registros clinicos en estado local dentro de `src/App.tsx`.
- Cada registro se asocia a un paciente mediante `patientId`.
- Muestra registros del paciente ordenados del mas reciente al mas antiguo.
- Cada registro muestra fecha con año, motivo de consulta, diagnostico,
  tratamiento y observaciones.
- Muestra un resumen temporal cuando existen registros, por ejemplo
  `3 registros · Desde 10-mar-2025 hasta 09-jun-2026`.
- Permite agregar una evolucion clinica basica desde el detalle del paciente.
- Valida campos obligatorios y no permite fechas futuras.
- Normaliza los textos clinicos escritos por el doctor antes de guardarlos.

El menu lateral `Historial clinico` sigue como placeholder. Por ahora el
historial permanece dentro del detalle de cada paciente porque necesita contexto
clinico del paciente seleccionado.

## Odontograma

Actualmente existe una primera version dentro del detalle de paciente:

- Usa datos mock desde `src/data/odontogram.ts`.
- Mantiene las entradas del odontograma en estado local dentro de `src/App.tsx`.
- Cada entrada se asocia a un paciente mediante `patientId` y a una pieza por
  `toothNumber`.
- Usa piezas permanentes adultas con numeracion FDI: `11-18`, `21-28`,
  `31-38` y `41-48`.
- Muestra una grilla simple y responsive de piezas dentales.
- Cada pieza muestra numero y estado actual.
- Si una pieza no tiene entrada, se considera `Sano`.
- Permite seleccionar una pieza y actualizar estado y observaciones.
- Normaliza observaciones antes de guardarlas.
- Actualiza `updatedAt` al guardar.
- Muestra resumen por estado con colores suaves.

El menu lateral `Odontograma` sigue como placeholder global. Por ahora el
odontograma permanece dentro del detalle de cada paciente porque necesita el
contexto del paciente seleccionado.

## Modulo citas

Actualmente existe una primera version funcional en frontend:

- Usa citas mock desde `src/data/appointments.ts`.
- Mantiene las citas en estado local dentro de `src/App.tsx`.
- Muestra una agenda diaria enfocada en el dia seleccionado.
- El valor inicial de la agenda diaria es hoy.
- Tiene selector horizontal de dias con etiquetas compactas para hoy, mañana y
  proximos dias con citas.
- Ordena las citas del dia seleccionado por hora ascendente.
- Muestra resumen del dia con total, pendientes, confirmadas, reprogramadas y
  canceladas.
- Cada cita muestra hora, paciente, telefono cuando existe, tratamiento o motivo
  y estado.
- La Agenda tiene pulido visual para KPIs, selector de dias, cards, botones,
  estado vacio y panel de reprogramacion, alineado con Recordatorios y
  Configuracion.
- La agenda permite confirmar citas pendientes.
- La agenda permite cancelar citas pendientes, confirmadas o reprogramadas sin
  eliminarlas, despues de pedir confirmacion al usuario.
- La agenda permite reprogramar citas pendientes, confirmadas o reprogramadas
  desde un panel inline contextual.
- Las citas canceladas quedan visibles con badge `Cancelada`.
- Las citas canceladas no se reprograman directamente; si el paciente desea
  asistir nuevamente, se crea una nueva cita.
- Una cita cancelada no muestra acciones y no puede guardar reprogramaciones,
  aunque quedara un intento de formulario activo.
- El panel de reprogramacion se cierra al cambiar de dia, al volver a pulsar
  `Reprogramar`, al cancelar el formulario o al cancelar la cita.
- Confirmar muestra Toast de confirmacion; cancelar muestra Toast de aviso.
- Si no hay citas para el dia seleccionado, muestra un estado vacio profesional
  que sugiere usar la accion global `+ Cita`.
- Los estados usan badges con colores semanticos suaves.
- Permite registrar una nueva cita desde la accion rapida `+ Cita`.
- El formulario de nueva cita permite buscar y seleccionar pacientes mock.
- La seleccion de paciente distingue el texto del buscador del paciente
  realmente seleccionado mediante un identificador interno.
- El formulario valida paciente, fecha, hora, tratamiento y estado inicial.
- La hora se elige desde un catalogo de 24 horas en intervalos de 15 minutos,
  por ejemplo `08:15`, `08:30` o `08:45`.
- Las opciones de hora se calculan con los horarios del consultorio, el
  intervalo configurado y las citas existentes.
- Nueva Cita oculta horas ocupadas por citas pendientes, confirmadas o
  reprogramadas.
- Las citas canceladas no bloquean un horario.
- Si una fecha no tiene horas disponibles, el formulario muestra un mensaje
  claro sin permitir seleccionar una hora invalida.
- El guardado mantiene una validacion final de choque exacto por fecha y hora.
- El formulario no permite que el mismo paciente tenga mas de una cita activa
  en el mismo dia.
- El buscador de pacientes desactiva el autocompletado nativo del navegador
  para que no compita con el dropdown propio de la app.
- Los mensajes de ayuda, seleccion y error del formulario usan espacios
  consistentes para no desalinear la grilla.
- El formulario muestra solo tratamientos activos configurados localmente.

Todavia no existe edicion general, eliminacion, motivo de cancelacion, historial
de cambios ni persistencia de citas. Las citas nuevas y reprogramadas solo viven
en memoria durante la sesion actual.

Mas adelante, cuando exista integracion real con WhatsApp, se evaluaran estados
intermedios como `Solicitud de cancelacion` para evitar cancelaciones
accidentales antes de convertir una cita en cancelada.

## Recordatorios WhatsApp

Actualmente existe una primera version funcional en frontend:

- Genera recordatorios desde citas futuras no canceladas usando datos locales de
  citas y pacientes.
- Agrupa recordatorios por cita y fecha de cita.
- Muestra KPIs de todos, pendientes, programados, enviados simulados y fallidos.
- Tiene selector horizontal por fecha y filtros compactos por estado.
- Genera recordatorios de `24h` y `2h` solo si su horario programado queda en
  el futuro.
- Omite recordatorios que ya quedaron en el pasado por registro tardio.
- Para citas con menos de 24 horas, puede omitir el recordatorio de `24h` y
  mantener el de `2h` si todavia aplica.
- Para citas con menos de 2 horas, genera una confirmacion inmediata con estado
  pendiente.
- No muestra citas pasadas en Recordatorios.
- Muestra notas suaves cuando un recordatorio fue omitido por poca anticipacion.
- Permite ver una vista previa del mensaje.
- Permite marcar recordatorios como enviados o fallidos de forma simulada.
- Si el paciente no tiene telefono, mantiene `Ver mensaje`, deshabilita
  `Marcar enviado` y permite marcar fallido si corresponde a la simulacion.
- Usa un Toast flotante reutilizable para feedback sin mover el layout.

El modulo no envia mensajes reales, no se conecta a WhatsApp API y no persiste
estados fuera de la sesion actual.

## Configuracion

Actualmente existe una primera version de horarios y tratamientos del
consultorio:

- Horarios del consultorio con horario semanal base.
- Estado abierto/cerrado por dia.
- Horarios en formato 24 horas.
- Intervalo de atencion configurable.
- Validacion local de horarios del consultorio.
- Toast flotante al guardar horarios, sin mover el layout.
- Bloque informativo `Excepciones del calendario` para preparar feriados,
  cierres especiales o dias con horario distinto, sin implementar la logica
  todavia.
- Usa el tipo `Treatment` con `id`, `name` e `isActive`.
- Permite agregar tratamientos.
- Normaliza nombres antes de guardarlos, por ejemplo `LIMPIEZA DentaL` pasa a
  `Limpieza dental`.
- Evita duplicados ignorando acentos, mayusculas/minusculas y espacios extra.
- Permite buscar tratamientos ignorando acentos y mayusculas.
- Permite editar el nombre sin cambiar el `id`.
- Permite activar y desactivar tratamientos.
- No permite eliminar tratamientos fisicamente para evitar problemas con citas
  relacionadas.
- Muestra feedback por agregar, editar, activar y desactivar mediante el Toast
  flotante reutilizable.
- El Toast de desactivar tratamiento se trata como aviso, no como error.
- Los botones de tratamientos usan estilo compacto coherente con Recordatorios:
  acciones neutras con color semantico en el texto.
- Nueva Cita consume solo tratamientos activos desde el estado local compartido.

## Navegacion

La app usa `AppLayout` con:

- Sidebar principal.
- Acciones rapidas: `+ Paciente` y `+ Cita`.
- Secciones visuales para marca, acciones y modulos.
- Header superior por seccion.
- Navegacion controlada con estado local en `App.tsx`.
- Seccion interna de detalle de paciente controlada tambien por estado local.
- En mobile, la navegacion se mantiene horizontal y desplazable, sin drawer ni
  bottom navigation.

No se usa React Router todavia.

## Fuera de alcance actual

Todavia no existe:

- Backend.
- Base de datos.
- Supabase.
- Autenticacion.
- Integracion real con WhatsApp.
- Facturacion.
- Persistencia de datos.
