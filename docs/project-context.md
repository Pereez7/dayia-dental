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
- Dashboard operativo con KPIs diarios y mensuales, proximas citas activas,
  citas que requieren atencion, actividad reciente, resumen mensual y pacientes
  recientes.
- Configuracion de horarios y tratamientos del consultorio, conectada con
  Nueva Cita para tratamientos activos, disponibilidad de horarios y
  excepciones del calendario.
- Primera version de historial clinico dentro del detalle de paciente.
- Primera version del modulo global Historial clinico con registros agrupados
  por paciente, busqueda, filtros y resumen superior.
- Primera version de odontograma dentro del detalle de paciente.
- Primera version del modulo Recordatorios WhatsApp con simulacion local,
  alineada con estados reales de citas activas.
- Componentes separados en `src/components`.
- Vistas completas en `src/views`.
- Datos mock separados en `src/data`.
- Tipos compartidos en `src/types`.
- Utilidades puras en `src/utils`.
- Pruebas unitarias para formatters, filtros y validaciones.

## Dashboard

Actualmente existe una pantalla principal operativa:

- Muestra KPIs de citas de hoy, pendientes de hoy, confirmadas de hoy,
  reprogramadas del mes, canceladas del mes y pacientes registrados.
- Muestra maximo 5 proximas citas futuras activas con fecha, hora, paciente,
  tratamiento y estado.
- Excluye citas canceladas de proximas citas.
- Muestra citas que requieren atencion: pendientes proximas, reprogramaciones
  recientes y casos con telefono faltante cuando existe el dato del paciente.
- Muestra actividad reciente basada en `changeLog`, ignorando eventos internos
  de creacion y mostrando confirmaciones, cancelaciones y reprogramaciones.
- Muestra resumen del mes con total, confirmadas, canceladas y reprogramadas.
- Mantiene pacientes recientes como bloque secundario usando el estado local
  actual de pacientes.
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
- Cards de pacientes compactas, con nombre como dato principal y telefono/email
  como informacion secundaria.
- Formulario de registro de paciente.
- Vista completa de detalle de paciente.
- Validaciones de nombre, apellido, telefono, email y fecha de nacimiento.
- Selector manual de prefijo telefonico.
- Guardado del telefono en formato internacional compacto, por ejemplo
  `+59170000000`.
- Ficha de paciente con telefono, email, fecha de nacimiento, edad y resumen
  superior de citas activas, ultima atencion y proxima cita activa.
- Citas asociadas al paciente usando `patientId` cuando existe y nombre exacto
  como fallback para citas mock antiguas.
- Las proximas citas visibles en el detalle del paciente consideran solo citas
  activas.
- Historial clinico asociado al paciente mediante `patientId`.
- Registro local de evoluciones clinicas con fecha, motivo, diagnostico,
  tratamiento y observaciones.
- Textos clinicos normalizados antes de guardarse: espacios compactados y
  capitalizacion como oracion.
- Fechas del historial clinico mostradas con formato legible y resumen temporal
  del rango de registros.
- Las fechas visibles evitan valores ISO crudos y usan formatters compartidos.
  Para fechas operativas y clinicas recientes se usa un formato como `14 jun`,
  agregando año solo cuando corresponde, por ejemplo `14 jun 2025`.
- Odontograma asociado al paciente mediante `patientId`.
- Grilla simple de piezas permanentes adultas usando numeracion FDI.
- Registro local de estado, observaciones y fecha de actualizacion por pieza.
- Resumen de piezas por estado con colores suaves.
- Sidebar, fichas de pacientes, detalle de paciente, historial inicial y
  odontograma tienen mejoras visuales controladas sin cambiar el flujo
  funcional.

Este modulo esta preparado para una futura integracion con WhatsApp, pero aun no
envia mensajes ni consume APIs externas.

El detalle de paciente se mantiene como vista completa, no como popup ni drawer,
porque mas adelante debe alojar secciones clinicas con mas contexto, como
historial clinico, odontograma, recordatorios y evoluciones.

## Historial clinico

Actualmente existen dos superficies iniciales de historial clinico.

Dentro del detalle de paciente:

- Usa datos mock desde `src/data/clinicalRecords.ts`.
- Mantiene los registros clinicos en estado local dentro de `src/App.tsx`.
- Cada registro se asocia a un paciente mediante `patientId`.
- Muestra registros del paciente ordenados del mas reciente al mas antiguo.
- Cada registro muestra fecha con año, motivo de consulta, diagnostico,
  tratamiento y observaciones.
- Muestra un resumen temporal cuando existen registros, usando fechas legibles
  y año solo cuando corresponde.
- Permite agregar una evolucion clinica basica desde el detalle del paciente.
- Valida campos obligatorios y no permite fechas futuras.
- Normaliza los textos clinicos escritos por el doctor antes de guardarlos.

En el modulo global `Historial clinico`:

- Usa los mismos registros clinicos y pacientes desde el estado local de
  `App.tsx`.
- Agrupa registros por paciente para evitar repetir una card completa por cada
  evolucion clinica.
- Cada card muestra paciente, telefono si existe, total de registros, fecha del
  ultimo registro, ultimo motivo, ultimo diagnostico, ultimo tratamiento y
  observaciones cuando aportan contexto.
- Muestra solo el registro mas reciente por defecto.
- Permite expandir hasta los ultimos 3 registros mediante `Ver ultimos
  registros`, sin implementar paginacion real.
- Mantiene busqueda por paciente, motivo, diagnostico, tratamiento y
  observaciones.
- Mantiene filtros locales: todos, este mes y ultimos 30 dias.
- Los KPIs reflejan los registros visibles segun filtros y busqueda.
- Usa fechas cortas de lectura global, por ejemplo `18 may`, y agrega año solo
  cuando corresponde.
- Aplica un formatter de presentacion para corregir textos clinicos visibles de
  forma conservadora, por ejemplo `Aplicacion de fluor` se muestra como
  `Aplicación de flúor` sin modificar el dato mock original.

Todavia no existe edicion, eliminacion, impresion PDF, adjuntos, imagenes,
radiografias, IA medica ni persistencia para registros clinicos.

## Odontograma

Actualmente existe una primera version dentro del detalle de paciente:

- Usa datos mock desde `src/data/odontogram.ts`.
- Mantiene las entradas del odontograma en estado local dentro de `src/App.tsx`.
- Cada entrada se asocia a un paciente mediante `patientId` y a una pieza por
  `toothNumber`.
- Usa piezas permanentes adultas con numeracion FDI: `11-18`, `21-28`,
  `31-38` y `41-48`.
- Muestra una grilla simple y responsive de piezas dentales.
- Divide visualmente arcada superior e inferior, con cuadrantes identificados
  como derecha o izquierda del paciente y rangos FDI visibles.
- Cada pieza muestra numero y estado actual.
- Si una pieza no tiene entrada, se considera `Sano`.
- El resumen recorre las 32 piezas adultas FDI y cuenta como sanas las piezas
  que todavia no tienen entrada guardada.
- Permite seleccionar una pieza y actualizar estado y observaciones.
- El estado actual se muestra como badge con el mismo color semantico del
  estado de la pieza.
- Las observaciones tienen limite de 160 caracteres, contador discreto,
  textarea estable y scroll interno.
- Normaliza observaciones antes de guardarlas.
- Actualiza `updatedAt` al guardar.
- Muestra resumen por estado con colores suaves.
- Muestra la fecha de ultima actualizacion con el formato global de la app,
  por ejemplo `14 jun` o `14 jun 2025` segun corresponda.
- Usa Toast flotante para confirmar el guardado sin mover el layout.
- Los estados canonicos del odontograma son `healthy`, `caries`, `restored`,
  `missing`, `pending`, `watch` y `other`; las etiquetas largas y cortas viven
  en `src/utils/odontogram.ts`.

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
- Las cards separan rango horario, datos del paciente, estado y acciones en
  bloques claros para que rangos como `13:00 - 13:30` no se junten con el
  nombre, telefono o tratamiento.
- La agenda permite confirmar citas pendientes.
- La agenda permite cancelar citas pendientes, confirmadas o reprogramadas sin
  eliminarlas, despues de pedir confirmacion con `ConfirmDialog`.
- Al cancelar una cita se solicita un motivo obligatorio y, si se elige `Otro`,
  un detalle breve obligatorio.
- Las citas pueden tener `changeLog` opcional para registrar eventos simples de
  creacion, confirmacion, cancelacion y reprogramacion.
- La agenda permite reprogramar citas pendientes, confirmadas o reprogramadas
  desde un panel inline contextual.
- Al reprogramar una cita se solicita un motivo obligatorio y, si se elige
  `Otro`, un detalle breve obligatorio.
- Reprogramar exige cambiar la fecha o la hora; no se permite guardar una
  reprogramacion si ambos valores son iguales a los de la cita actual.
- Los errores de reprogramacion se muestran inline dentro del panel y no se
  duplican como Toast.
- El detalle `Otro` de cancelacion o reprogramacion tiene limite de 120
  caracteres, contador visual y textarea fijo para no romper el layout.
- Mientras el panel de reprogramacion esta abierto, la card oculta acciones
  externas como confirmar o cancelar cita y muestra solo las acciones del panel.
- Las citas canceladas quedan visibles con badge `Cancelada`.
- Las citas canceladas no se reprograman directamente; si el paciente desea
  asistir nuevamente, se crea una nueva cita.
- Una cita cancelada no muestra acciones y no puede guardar reprogramaciones,
  aunque quedara un intento de formulario activo.
- El panel de reprogramacion se cierra al cambiar de dia, al volver a pulsar
  `Reprogramar`, al cancelar el formulario o al cancelar la cita.
- Al cerrar el panel se limpian nueva fecha, nueva hora, motivo, detalle de
  `Otro` y errores inline temporales.
- Confirmar muestra Toast de confirmacion; cancelar muestra Toast de aviso.
- `ConfirmDialog` reemplaza la confirmacion nativa del navegador al cancelar
  citas, acepta contenido adicional opcional y queda reutilizable para futuras
  acciones sensibles.
- Las cards de agenda muestran tratamiento, motivo y ultimo cambio como
  informacion secundaria compacta, sin desordenar hora, paciente, estado ni
  acciones.
- El evento `created` se guarda internamente, pero no se muestra como
  `Ultimo cambio`; solo se muestran confirmacion, cancelacion o reprogramacion.
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
  intervalo configurado, la duracion del tratamiento seleccionado y las citas
  existentes.
- Las opciones de hora usan el horario efectivo de la fecha: excepcion cerrada,
  horario especial o el horario semanal base.
- Si una fecha esta cerrada por excepcion, Nueva Cita y Reprogramar muestran un
  mensaje claro y no permiten guardar en esa fecha.
- Si una fecha tiene horario especial, la disponibilidad por duracion se calcula
  solo dentro del rango configurado para esa excepcion.
- Nueva Cita oculta horas cuyo rango completo se solaparia con citas
  pendientes, confirmadas o reprogramadas.
- Reprogramar usa la misma disponibilidad por duracion e ignora la cita actual
  al calcular opciones y validar el guardado.
- Las citas canceladas no bloquean disponibilidad.
- Si una fecha no tiene horas disponibles, el formulario muestra un mensaje
  claro sin permitir seleccionar una hora invalida.
- El guardado mantiene una validacion final de solapamiento por rango horario.
- Una cita puede empezar justo cuando termina otra, pero no puede iniciar o
  terminar dentro del rango de otra cita activa.
- El formulario no permite que el mismo paciente tenga mas de una cita activa
  en el mismo dia.
- El buscador de pacientes desactiva el autocompletado nativo del navegador
  para que no compita con el dropdown propio de la app.
- Los mensajes de ayuda, seleccion y error del formulario usan espacios
  consistentes para no desalinear la grilla.
- El formulario muestra solo tratamientos activos configurados localmente.

Todavia no existe edicion general, eliminacion, historial completo de cambios ni
persistencia de citas. Las citas nuevas, canceladas y reprogramadas solo viven
en memoria durante la sesion actual.

Mas adelante, cuando exista integracion real con WhatsApp, se evaluaran estados
intermedios como `Solicitud de cancelacion` para evitar cancelaciones
accidentales antes de convertir una cita en cancelada.

## Recordatorios WhatsApp

Actualmente existe una primera version funcional en frontend:

- Genera recordatorios desde citas futuras activas usando datos locales de
  citas y pacientes.
- Solo considera citas `Pendiente`, `Confirmada` y `Reprogramada`.
- No genera recordatorios para citas `Cancelada`.
- Agrupa recordatorios por cita y fecha de cita.
- Muestra KPIs de todos, pendientes, programados, enviados simulados y fallidos.
- Los KPIs se calculan desde la cola valida de recordatorios y no cuentan citas
  canceladas.
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
- Prioriza recordatorios pendientes de citas pendientes y luego ordena por
  cercania operativa.
- Permite ver una vista previa del mensaje.
- Los mensajes sugeridos cambian segun el estado real de la cita:
  - Pendiente: pide confirmar asistencia.
  - Confirmada: recuerda que la cita ya esta confirmada.
  - Reprogramada: menciona que la cita fue reprogramada y usa su fecha/hora
    vigente.
- Las fechas visibles de la cola usan formato corto 24 horas, por ejemplo
  `15 jun, 10:00`, sin `a. m.` ni `p. m.`.
- Permite marcar recordatorios como enviados o fallidos de forma simulada.
- Si el paciente no tiene telefono, mantiene `Ver mensaje`, deshabilita
  `Marcar enviado`, evita guardar ese estado por defensa en la accion y permite
  marcar fallido si corresponde a la simulacion.
- Si no hay recordatorios validos, muestra el estado vacio
  `No hay recordatorios pendientes para citas activas.` y aclara que las citas
  canceladas no generan recordatorios.
- Usa un Toast flotante reutilizable para feedback sin mover el layout.
- La accion `Marcar fallido` se mantiene visible pero con menor protagonismo
  visual que las acciones principales.

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
- Excepciones del calendario para fechas cerradas y dias con horario especial.
- Validacion de excepciones para evitar fechas duplicadas, horarios invalidos y
  rangos especiales sin inicio o fin.
- Eliminacion de excepciones con `ConfirmDialog` y feedback mediante Toast.
- Usa el tipo `Treatment` con `id`, `name` e `isActive`.
- Permite agregar tratamientos.
- Normaliza nombres antes de guardarlos, por ejemplo `LIMPIEZA DentaL` pasa a
  `Limpieza dental`.
- Evita duplicados ignorando acentos, mayusculas/minusculas y espacios extra.
- Permite buscar tratamientos ignorando acentos y mayusculas.
- Permite editar el nombre sin cambiar el `id`.
- Permite activar y desactivar tratamientos.
- Pide confirmacion con `ConfirmDialog` antes de desactivar un tratamiento.
- No permite eliminar tratamientos fisicamente para evitar problemas con citas
  relacionadas.
- Muestra feedback por agregar, editar, activar y desactivar mediante el Toast
  flotante reutilizable.
- El Toast de desactivar tratamiento se trata como aviso, no como error.
- El boton `Desactivar` y la accion confirmada `Sí, desactivar` usan rojo suave
  para mantener coherencia visual de acciones sensibles.
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
