# Contexto del proyecto

## Punto de continuidad

El programa de rendimiento y escalabilidad está definido en
[`performance-and-scalability-plan.md`](performance-and-scalability-plan.md).
`PERF-001` ya instrumenta por fases el alta de consultorios sin registrar
información personal ni secretos. El hito cerró el 30 de julio de 2026 con una
alta autenticada controlada en staging y el mismo `operationId` correlacionado
entre navegador y Function. La muestra midió 6,143.0 ms para el flujo completo:
3,751.1 ms en la invocación de creación y 2,380.7 ms en el refresco bloqueante
del listado. El total interno de la Function fue 3,153.0 ms y sus fases sumaron
3,148.0 ms. `PERF-002` cerró el 30 de julio de 2026 con una segunda alta
autenticada en staging. El formulario confirmó a los 4,490.5 ms y
`list-platform-clinics` terminó 2,041.7 ms después en segundo plano. Frente a
los 6,143.0 ms bloqueantes de la línea base, el éxito apareció 1,652.5 ms antes,
una reducción del 26.9 %. Un fallo del refresco conserva el alta exitosa,
muestra un aviso cercano y permite reintentar.

`PERF-003` cerró el 30 de julio de 2026 y está desplegado únicamente en staging. El listado
administrativo usa páginas de servidor de 10 consultorios con cursor estable y
solo devuelve resumen y contadores. La gestión comercial se obtiene al abrir
un consultorio mediante `get-platform-clinic-billing`; pagos y solicitudes
pendientes usan páginas independientes de 5. La migración `031` reemplaza el
RPC N+1 de planes programados por una operación acotada por lote. Sus 10
pruebas pgTAP pasan localmente y contra staging con rollback; la suite completa
supera 714 pruebas, lint y build. La prueba autenticada devolvió `200`, con
1.6–1.7 kB para el listado y 1.5 kB para el detalle. Diez lecturas del listado
estuvieron entre 1.03 y 2.38 s; el detalle observado tardó 1.95 s. El tamaño
queda acotado, pero la latencia aún supera el presupuesto y permanece
documentada como deuda antes de producción.

`PERF-004` cerró el 30 de julio de 2026 y está desplegado únicamente en
staging. La migración
`032_atomic_platform_clinic_creation.sql` agrega una clave idempotente por
solicitante y payload, unicidad global del email normalizado de perfiles y una
búsqueda exacta de Auth que usa el índice nativo; ya no existe ningún
`auth.admin.listUsers` en las Edge Functions. El alta valida plan y tarifa,
reserva la operación, invita al owner en Auth y confirma clínica, perfil,
membership y suscripción en una sola transacción PostgreSQL. Si la respuesta
del commit es ambigua, consulta primero el estado: nunca elimina Auth sin
confirmar que PostgreSQL no completó.

La suite de cierre de `PERF-004` superó 732 pruebas de aplicación y 105 pruebas SQL. El pgTAP
específico de `032` pasa sus 31 controles tanto localmente como contra staging
con rollback; `db lint --linked --level warning`, lint y build también pasan.
`create-platform-clinic` v8, `invite-clinic-member` v3 y
`correct-platform-clinic-owner-email` v2 están `ACTIVE` con JWT. La utilidad
legacy `migrate-owner-email` no permanece desplegada.

La alta autenticada controlada de `PERF-004` tardó 3,700 ms en el navegador y
3,472.2 ms dentro de la Function. La invitación Auth fue la fase dominante con
1,481.4 ms; la persistencia atómica de clínica, perfil, membership y
suscripción tardó 241.6 ms. El reintento idéntico terminó en 721.6 ms internos,
una reducción del 79.2 %, y no ejecutó búsqueda del owner, invitación ni
persistencia. La comprobación remota confirmó exactamente una solicitud, una
clínica, un usuario Auth, un perfil, una membership y una suscripción.

`PERF-005` comenzó el 4 de agosto de 2026. Su primer subhito, `PERF-005A`,
reemplaza las colecciones completas del Dashboard real por una única RPC
autorizada y acotada. La migración `033_bounded_clinic_dashboard.sql` devuelve
seis KPIs, hasta 5 próximas citas, 5 casos de atención, 5 eventos recientes y
4 pacientes recientes. `App.tsx` ya no descarga pacientes, citas ni logs
completos mientras la sección activa es Dashboard; el modo demo conserva el
cálculo local.

`033` fue recreada desde una base local vacía y aplicada únicamente al staging
`zjsnfgxvaimddmchrwre`. Sus 13 controles pgTAP pasan localmente y contra
staging con rollback; `db lint` no reporta errores. Un benchmark local
reproducible con 2.000 pacientes, 20.000 citas y 20.000 logs ficticios confirmó
los tres índices ordenados y un snapshot por debajo de 1.500 ms. La suite
actual alcanza 741 pruebas de aplicación y 118 SQL, con lint y build correctos.

`PERF-005A` cerró técnicamente en staging el 5 de agosto. Una captura móvil
limpia a 415 × 725 confirmó exactamente una llamada autenticada a
`get_clinic_dashboard_snapshot`: `200`, 1.1 kB y 273 ms. No aparecieron
lecturas de `patients`, `appointments` ni `appointment_change_logs`; el
`invite-clinic-member` visible pertenecía a una operación independiente con
iniciador `clinicMembersService`.

`PERF-005B1` cerró técnicamente en staging el 5 de agosto de 2026. La migración
`034_bounded_clinic_agenda.sql` agrega un snapshot autorizado por fecha, página
de 20 filas, cursor estable, KPIs completos del día y disponibilidad mínima.
Agenda real no descarga toda la historia ni toda la tabla de pacientes; incluye
el teléfono en cada fila y consulta otra fecha solo al reprogramar. Sus 15
controles SQL y el benchmark reversible con 20.000 citas pasan localmente.
`034` está aplicada únicamente en staging, sus 15 controles remotos pasan con
rollback y `db lint` de `public` está limpio. La regresión actual supera 751
pruebas de aplicación y 133 controles SQL, además de lint y build. La revisión
autenticada en 415 × 725 registró la carga inicial y el cambio a Mañana como dos
respuestas `200`: 0.9 kB en 464 ms y 1.0 kB en 313 ms; el preflight inicial
tardó 236 ms. Son muestras individuales, no percentiles. La composición móvil
no presentó overflow ni texto cortado.

`PERF-005B2` está implementado y desplegado únicamente en staging. La migración
`035_atomic_appointment_scheduling.sql` incorpora creación y reprogramación
atómicas, serializa por consultorio y fecha, valida la disponibilidad completa
en PostgreSQL y guarda cita y auditoría en la misma transacción. Revoca al
frontend las escrituras directas de los campos de agenda. Sus 31 controles
pgTAP pasan localmente y contra staging con rollback; el benchmark reversible
usa 20.000 citas y confirma los índices parciales, y `db lint` remoto está
limpio. La regresión completa alcanza 760 pruebas de aplicación y 164 controles
SQL. La prueba móvil autenticada confirmó creación `200` en 287 ms,
reprogramación `200` en 418 ms y el rechazo controlado de una segunda pestaña
con el mismo horario. `PERF-005B2` queda cerrado en staging. El historial está
alineado `001–035`; producción continúa intacta.

La subdivisión oficial restante de `PERF-005` es: `005C` Pacientes, `005D`
Historial clínico, `005E` Recordatorios y `005F` Odontograma/Configuración.
Cada subhito conserva la misma puerta de pruebas, benchmark, staging,
documentación y revisión móvil. No se inicia `PERF-006` hasta cerrar A–F. El
siguiente bloque de trabajo es `PERF-005C`.

Antes de iniciar `PERF-003`, el alta de plataforma dejó de reutilizar correos
existentes. Un correo registrado en Auth o `profiles` responde `409`. Para un
consultorio pendiente, Administración DayIA permite corregir el correo,
reemplaza solo su membership propietaria, reenvía la invitación y registra la
sustitución en `platform_clinic_owner_corrections`. La migración `030` está
aplicada y verificada en staging; `create-platform-clinic` versión 7 y
`correct-platform-clinic-owner-email` versión 1 están `ACTIVE` con JWT.

Como antecedente, el bloque de endurecimiento de seguridad y permisos se cerró
antes de iniciar el programa de rendimiento. La migración
`027_membership_rls_hardening.sql` ya fue validada localmente desde una base
vacía y aplicada al staging `zjsnfgxvaimddmchrwre`. En esa etapa, el historial
remoto quedó alineado de `001` a `030`; las 38 pruebas de aislamiento RLS y
`supabase db lint --linked --level warning` finalizaron correctamente:

- la autorización clínica usa membership activa, consultorio activo,
  suscripción vigente y rol permitido;
- owner/admin gestionan configuración; doctor no puede modificarla;
- recepción no puede leer historial clínico ni odontograma;
- las relaciones de citas y recordatorios no pueden cruzar consultorios;
- React no puede modificar roles, `is_platform_admin`, IDs, alcance clínico,
  fechas de auditoría ni `whatsapp_settings.is_connected`;
- los módulos operativos no ofrecen borrado físico en base de datos, salvo la
  compatibilidad temporal de excepciones de calendario;
- la suite completa pasa con 701 pruebas, lint y build correctos.

El primer bloque queda validado técnicamente en local y staging. La prueba
remota se ejecuta dentro de una transacción y no dejó perfiles, usuarios,
funciones auxiliares ni la extensión pgTAP persistentes. `027` todavía no debe
considerarse aplicada a producción: ese despliegue requiere respaldo, ventana
controlada y verificación posterior independiente.

El CRUD de Usuarios del consultorio comenzó por el ciclo de acceso reversible:

- `028_clinic_membership_lifecycle.sql` está aplicada en staging;
- usuarios activos no propietarios pueden desactivarse con motivo;
- usuarios inactivos pueden reactivarse si el plan conserva un cupo;
- no se eliminan Auth users, perfiles ni memberships;
- el propietario, el usuario actual y las membresías de otro consultorio están
  protegidos en servidor;
- cada cambio crea un registro en `clinic_membership_events`;
- React no puede leer el ledger ni ejecutar directamente la RPC;
- `invite-clinic-member` y `manage-clinic-member` están desplegadas en staging;
- la prueba remota transaccional de `028` supera 16 controles con rollback.

La prueba visual confirmó owner protegido, usuario activo, usuario inactivo,
reactivación y contador actualizado. Las acciones repetidas usan las etiquetas
compactas `Desactivar` y `Reactivar`; el motivo hereda el control visual común
y el resultado exitoso se comunica mediante el Toast flotante compartido.
Antes de implementar edición de nombre y rol debe cerrarse y documentarse esta
primera etapa.

El guardado de horarios usa desde `029` la RPC
`save_clinic_business_hours`. Guarda los siete días en una sola transacción,
verifica `clinic_owner` o `clinic_admin` mediante la autorización común y evita
el `upsert` directo que intentaba modificar las columnas protegidas
`clinic_id` y `weekday`. La prueba remota de `029` supera 9 controles con
rollback.

La referencia visual obligatoria para nuevas pantallas es
[`DESIGN.md`](../DESIGN.md). Los controles nuevos reutilizan `.field-control`
y sus modificadores; las acciones repetidas dentro de cards son compactas, el
feedback permanece cerca de la acción y todo cambio se revisa desde 360 px.

El último bloque terminado es la estabilización de cambios de plan,
suscripciones y pagos manuales:

- El propietario elige Basic, Medium o Pro desde Suscripción. Un upgrade activo
  cobra la diferencia prorrateada y conserva el vencimiento; un downgrade se
  programa para el cierre del periodo y puede cancelarse.
- Si la cuenta está vencida o bloqueada, puede elegir otro plan y pagar el
  periodo completo. El plan y la nueva vigencia se aplican únicamente cuando
  Platform Admin valida el pago.
- `manage-owner-subscription-plan` calcula el importe en servidor, valida al
  propietario y crea el aviso pendiente. React no inserta directamente en
  `subscription_payment_submissions`.
- Un cambio administrativo inmediato es una excepción con motivo obligatorio,
  confirmación y escritura atómica de suscripción más auditoría.
- La tarifa fundador conserva una ventana de 24 horas desde `blocked_at` o,
  cuando el vencimiento es natural, desde `grace_ends_at`. Reactivar o conceder
  días no recupera una tarifa ya vencida.
- Los avisos de pago pendientes pueden aprobarse o rechazarse con motivo y
  auditoría.
- La anulación del último pago conserva los días adicionales concedidos después
  del cobro y restaura el resto de la instantánea anterior.
- Aumentar días exige confirmación previa y muestra el resultado mediante el
  Toast flotante común.
- La membresía vitalicia administrativa puede asignarse y retirarse. Al
  asignarla guarda la vigencia anterior; al retirarla la restaura.
- Una membresía vitalicia originada por pago se retira anulando ese pago, no
  mediante la acción administrativa.
- Mientras vitalicio está activo se bloquean nuevos pagos y días adicionales
  para evitar sustituir accidentalmente la condición comercial.
- El historial administrativo pagina en servidor cinco pagos por vista,
  muestra el rango consultado y conserva todos los registros anulados para
  auditoría.

Supabase ya tiene aplicadas las migraciones `023`, `024`, `025` y `026`. Las
Edge Functions `manage-owner-subscription-plan`,
`reject-subscription-payment-submission`, `void-subscription-payment`,
`update-clinic-subscription`, `register-subscription-payment` y
`list-platform-clinics` están desplegadas. La gestión paginada agrega
`get-platform-clinic-billing` y la migración `031`, también presentes solo en
staging. La migración `026` se validó primero dentro de una transacción con
rollback y luego se aplicó.

El bloque cerró con lint, 645 pruebas y build correctos. Para continuar desde
otro equipo se debe actualizar `main` desde `origin`, conservar su `.env` local
y seguir la guía de [Retomar el proyecto en otro equipo](../README.md#retomar-el-proyecto-en-otro-equipo).

## Billing manual

DayIA Dental dispone de prueba gratuita, gracia, cobro por QR e historial de
pagos administrado por plataforma. Un consultorio bloqueado conserva sesión y
datos, pero no monta módulos clínicos. Vitalicio no vence y puede retirarse de
forma auditable restaurando la vigencia previa. No hay pasarela, verificación
bancaria ni cobro recurrente automático.

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
- Suscripciones QR con confirmación administrativa, ledger anulable sin borrado
  y comprobantes enviados manualmente por WhatsApp. Incluye rechazo de avisos,
  conservación de días posteriores al anular, cambios de plan seguros y
  membresía vitalicia reversible.

## Dashboard

Actualmente existe una pantalla principal operativa:

- Muestra KPIs de citas de hoy, pendientes de hoy, confirmadas de hoy,
  reprogramadas del mes, canceladas del mes y pacientes registrados.
- Muestra maximo 5 proximas citas futuras activas con fecha, hora, paciente,
  tratamiento y estado.
- Excluye citas canceladas de proximas citas.
- Muestra hasta 5 citas que requieren atención: pendientes próximas y
  reprogramaciones recientes.
- Muestra actividad reciente basada en `changeLog`, ignorando eventos internos
  de creacion y mostrando confirmaciones, cancelaciones y reprogramaciones.
- Muestra resumen del mes con total, confirmadas, canceladas y reprogramadas.
- Mantiene hasta 4 pacientes recientes como bloque secundario.
- No muestra nuevos pacientes del mes porque los pacientes mock no tienen fecha
  real de registro.
- Organiza los KPIs en un panel visual equilibrado para evitar huecos en
  desktop y mantener lectura clara en mobile.
- En modo real obtiene un snapshot fijo mediante
  `get_clinic_dashboard_snapshot`; no descarga la historia completa de
  pacientes, citas o logs para calcular la pantalla. La RPC autoriza la
  membership, el consultorio y la vigencia comercial mediante
  `can_access_clinic_data`.
- En modo demo, los cálculos equivalentes viven en
  `src/utils/dashboardMetrics.ts` y tienen pruebas unitarias.

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
- Horarios, Excepciones y Tratamientos se muestran como bloques visuales
  diferenciados, con fondo suave compartido para mantener coherencia.
- El boton `Guardar horarios` queda dentro del bloque de Horarios para evitar
  que parezca una accion de Excepciones.
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

Todavía no existe:

- Integración real con WhatsApp Cloud API y webhooks productivos.
- Facturación.
- Selector multi-consultorio.
- Revocación de invitaciones y reenvío público autoservicio.

Supabase, Auth, RLS y persistencia clínica ya forman parte del MVP.

## Actualización de plataforma, 2026-07-13

Supabase ya sostiene autenticación y administración interna. La Edge Function
`create-platform-clinic` recibe las altas reales desde el formulario y requiere
JWT válido, `profiles.is_platform_admin = true` y
`DAYIA_PLATFORM_CREATE_ENABLED === "true"`. Solo gestiona consultorio, owner,
membresía y suscripción; no toca datos clínicos. La UI no decide el estado del
feature flag.

## Reenvío seguro de propietarios, 2026-07-27

Los consultorios pendientes conservan visible el nombre y correo de su
propietario aunque la membership todavía esté en `pending_activation`.
Administración DayIA puede emitir una invitación nueva desde la fila del
consultorio mediante `resend-platform-clinic-invitation`.

La Function recibe únicamente `clinicId`, exige JWT de `platform_admin`,
comprueba en servidor que la membership propietaria siga pendiente y que el
usuario Auth no esté confirmado, y limita los reenvíos a uno por minuto. La UI
deshabilita el doble envío y presenta carga, éxito o error junto al propietario.
El enlace público vencido no envía correos para evitar enumeración y abuso.

En staging `zjsnfgxvaimddmchrwre` están activas
`list-platform-clinics`, `get-platform-clinic-billing` y
`resend-platform-clinic-invitation`, con autenticación obligatoria. La versión
paginada del listado y el detalle comercial se desplegaron el 30 de julio de
2026.

## Pulido comercial de Pacientes y Citas, 2026-07-14

Pacientes presenta un listado más compacto y un bloque de registro claramente
separado. La búsqueda incluye nombre, apellido, nombre completo, teléfono y
email, con normalización de tildes y mayúsculas. El alta evita duplicados
básicos por teléfono, limpia el formulario y destaca el registro creado.

El detalle conserva el alcance clínico por rol, reúne todas las citas del
paciente y ofrece accesos a nueva cita, historial y odontograma sólo cuando
corresponde. Agenda mantiene las reglas existentes de disponibilidad,
solapamiento, cancelación y reprogramación, y agrega CTA en vacío, feedback de
éxito y preselección del paciente desde su ficha.

## Auditoría de calidad, 2026-07-20

Las sesiones Supabase ya no muestran configuración demo durante la carga. Los
formularios dependientes esperan horarios y tratamientos reales, los diálogos
contienen el foco y los flujos de escritura bloquean envíos concurrentes. La
auditoría confirmó guards de permisos antes de loaders sensibles y filtros por
`clinic_id` en los servicios operativos.
