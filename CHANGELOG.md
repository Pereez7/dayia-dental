# Changelog

Registro breve de cambios relevantes en DayIA Dental.

## 2026-07-21

### Suscripciones y pagos QR

- El registro administrativo ahora bloquea Enter y exige una revisión y
  confirmación explícitas antes de escribir el pago.
- Se añadió historial auditable con detalle y anulación lógica del último pago,
  restaurando la vigencia previa sin borrar el ledger.
- El propietario dispone de una vista de Suscripción con periodos de 1, 6 y 12
  meses, descuentos, monto exacto, QR por plan y envío del comprobante por
  WhatsApp para validación administrativa.
- La migración `021_subscription_payment_workflow.sql` agrega estados de pago,
  instantáneas de suscripción y avisos de comprobante protegidos por RLS.
- Suscripción refresca silenciosamente la condición comercial al abrirse y
  muestra si la tarifa es estándar, fundador o personalizada.
- La tarifa fundador se aplica solo al periodo mensual; 6 y 12 meses vuelven a
  calcularse desde el precio estándar con sus descuentos de periodo.
- La tarifa fundador puede configurarse para cualquiera de los tres planes y
  vence 24 horas después del bloqueo; el backend valida el límite con la hora
  real del pago.
- La revisión administrativa ya no interpreta el monto informado por el cliente
  como una edición manual y las renovaciones bloqueadas comienzan en `paid_at`.

## 2026-07-20

### Cambios realizados

- Se agregó billing manual por QR con prueba de 15 días, gracia de 5 días,
  bloqueo sin cierre de sesión y licencia vitalicia.
- La migración `020` amplía suscripciones, crea historial de pagos y opciones de
  cobro, agrega precios configurables y mantiene intactos los datos existentes.
- `create-platform-clinic` crea nuevas cuentas en `trialing`.
- Se agregaron `register-subscription-payment` y
  `update-clinic-subscription`, exclusivas para `platform_admin`.
- Platform Admin incorpora resumen, pago, QR por plan, días extra, cambio de
  plan, bloqueo, reactivación, vitalicio e historial.
- La app clínica muestra avisos de vencimiento y gracia; fuera de gracia deja de
  montar servicios clínicos y presenta el pago sin cerrar sesión.
- Billing distingue tarifa normal, fundador y personalizada sin multiplicar
  los QR. Los upgrades se prorratean y conservan el vencimiento; los downgrades
  quedan programados para el cierre del periodo y los cambios se auditan.

## 2026-07-20

### Preparación de demo y preproducción

- Se agrega un checklist de readiness con variables, secrets, Functions,
  migraciones, redirects, cuentas por rol y límites conocidos del MVP.
- Se incorpora un guion comercial con datos ficticios y recorrido por los
  módulos existentes.
- Recordatorios y Configuración aclaran con el mismo texto que WhatsApp opera
  manualmente y que la automatización corresponde a una etapa posterior.
- Se documenta la reducción del bundle de `616.91 kB` a `493.58 kB`, manteniendo
  navegación local sin React Router.

### Carga diferida por vistas

- Las vistas principales se cargan mediante `React.lazy` y `Suspense`, sin
  cambiar la navegación local ni introducir React Router.
- El layout permanece visible mientras se descarga un módulo y muestra un
  fallback accesible y consistente con DayIA Dental.
- Los guards de rol y plan se evalúan antes de renderizar la vista diferida,
  por lo que una sección no autorizada no solicita su módulo ni ejecuta sus
  loaders sensibles.

### Edición de pacientes y teléfonos flexibles

- Las fichas y el detalle permiten editar nombre, apellido, teléfono, email y
  fecha de nacimiento sin abandonar el contexto del paciente.
- La actualización usa `patientsService.updatePatient`, conserva el ID activo
  y limita la escritura por `clinic_id` y RLS.
- Alta y edición comparten prefijos frecuentes y la opción `Otro`, que acepta
  un prefijo manual con `+` y entre 1 y 4 dígitos.
- Los nombres se capitalizan por palabra, el email se guarda en minúsculas y el
  teléfono se persiste sin espacios.
- Se bloquean fechas futuras, guardados sin cambios y duplicados activos por
  teléfono o email. No se añadió una librería de telefonía.

### Auditoría de calidad del MVP

- Las sesiones Supabase dejan de mostrar horarios, tratamientos y excepciones
  mock mientras carga la configuración real del consultorio.
- Nueva cita, Agenda, Recordatorios y Configuración esperan los datos
  operativos antes de habilitar acciones dependientes de disponibilidad.
- `ConfirmDialog` contiene el foco del teclado, admite Escape y restaura el
  foco al cerrar.
- Los formularios secundarios bloquean envíos concurrentes y convierten
  excepciones inesperadas en mensajes controlados.
- Fechas de usuarios y consultorios reutilizan `formatAppDate`; se corrigieron
  tildes visibles y atributos accesibles.
- WhatsApp se describe como configuración pendiente, sin afirmar que el envío
  automático esté activo.
- Los objetivos táctiles principales alcanzan 44 px en mobile y se retiraron
  tres componentes legacy sin consumidores.
- Se confirmó el aislamiento por `clinic_id`, los guards de cargas sensibles y
  la matriz de permisos por rol y plan.

## 2026-07-17

### Cambios realizados

- Recordatorios reconcilia al cargar los estados mutables con la fecha y hora
  real de la cita: una cita pasada cambia a `skipped` y una cita cancelada a
  `cancelled`.
- La comparacion usa la zona horaria clinica `America/La_Paz`, por lo que una
  cita de hoy con hora futura conserva su estado pendiente o programado.
- Los recordatorios omitidos muestran el motivo "Omitido porque la cita ya
  paso", aparecen en su filtro y KPI, y dejan de ofrecer acciones manuales de
  envio.
- `process-due-reminders` y `send-whatsapp-reminder` impiden preparar envios de
  citas pasadas o canceladas y persisten el estado terminal correspondiente.
- Se agregaron pruebas de reconciliacion, filtros, KPIs, acciones y proteccion
  de zona horaria tanto en frontend como en la logica compartida de Functions.
- Recordatorios presenta una jerarquia operativa renovada para demo: siete
  KPIs, filtros con conteos, estados vacios por contexto y vista previa con
  paciente, cita, tipo, tratamiento y mensaje final.
- El flujo diferencia el enlace manual de WhatsApp de las acciones para marcar
  enviado o fallido, bloquea dobles actualizaciones y mantiene omitidos y
  cancelados sin acciones de envio.
- Basic y Medium muestran `Modo manual`; Pro muestra `Automatico pendiente de
  configuracion`, sin afirmar que WhatsApp Cloud API este activo.
- Las citas pasadas pendientes, confirmadas o reprogramadas pueden resolverse
  desde Recordatorios como atendidas, no asistidas, reprogramadas o canceladas.
- Se agregaron los estados terminales `completed` y `no_show`, con actividad,
  badges, KPIs de Agenda y exclusion de disponibilidad, proximas citas y envios.
- Los omitidos no se reactivan al resolver una cita. Al reprogramar conservan
  una instantanea de la ocurrencia original y la nueva fecha genera otra cola.
- La cola incorpora busqueda por paciente, telefono o tratamiento y filtro
  independiente por estado de cita, incluida `Pasada sin cierre`.
- El modal Resolver cita pasada usa el mismo calculo de disponibilidad que
  Nueva cita: respeta horarios, excepciones, duracion, solapamientos y horas
  vencidas mediante un selector controlado, sin desplegable horario nativo.
- Las fechas del modal usan el formato humano global y los errores o
  advertencias se presentan como alertas accesibles con mensajes controlados.
- Los errores de constraint o RLS al cerrar una cita se traducen a mensajes
  seguros; `completed` y `no_show` requieren que la migracion `019` este
  aplicada en Supabase.

## 2026-07-14

### Cambios realizados

- El Dashboard separa la operación de hoy del resumen mensual y usa datos
  reales ya limitados al consultorio activo por `clinic_id`.
- Citas de hoy excluye estados cancelados y completados; pendientes y
  confirmadas se calculan sobre la misma fecha local del consultorio.
- Reprogramaciones y cancelaciones del mes priorizan eventos reales de
  `appointment_change_logs`; si no existe historial de ese tipo, usan el estado
  de las citas del mes como compatibilidad.
- Próximas citas muestra solo citas activas realmente futuras, y Requieren
  atención se limita a pendientes de hoy o posteriores y reprogramaciones de
  los últimos 14 días.
- Actividad reciente incorpora altas, confirmaciones, reprogramaciones y
  cancelaciones reales, ordenadas de forma descendente.
- Los KPIs y paneles muestran skeletons durante la carga para evitar ceros o
  estados vacíos transitorios.
- Se agregaron pruebas de semántica temporal, exclusión de canceladas,
  fallback mensual, alcance por consultorio y estados de carga.
- Pacientes adopta un layout operativo más compacto: listado y alta conviven en
  dos columnas en desktop, con acceso directo al registro en mobile.
- La búsqueda de pacientes ahora contempla nombre, apellido, nombre completo,
  teléfono y email, ignorando diferencias de mayúsculas y tildes.
- El alta valida duplicados por teléfono, normaliza el email, bloquea dobles
  envíos, limpia el formulario y mantiene visible la ficha creada.
- El detalle muestra datos personales, resumen, todas las citas relacionadas y
  accesos rápidos a nueva cita, historial clínico y odontograma según permisos.
- Agenda conserva sus KPIs compactos y suma un estado vacío con CTA para crear
  citas. En mobile, el total se separa del resumen por estados.
- Nueva cita puede iniciar con el paciente preseleccionado desde su ficha,
  bloquea envíos concurrentes y confirma el guardado con feedback visible.
- Se corrigieron tildes y mensajes visibles en Pacientes, Citas y validaciones.
- Owner, admin, doctor y recepción conservan la gestión de Pacientes y Citas;
  recepción no recibe accesos clínicos sensibles y platform admin permanece
  fuera de los módulos clínicos.
- Auth usa `clinic_memberships.role` y `clinic_memberships.clinic_id` como
  fuente principal del contexto clínico activo.
- `profiles.role` y `profiles.clinic_id` quedan deprecados como fuente primaria
  y solo se usan como fallback cuando no existe membership activa.
- Si existen varias memberships activas, se selecciona la activada más
  recientemente con desempates estables; el selector multi-consultorio queda
  pendiente.
- `SessionSummary` muestra `Propietario` cuando el rol clínico resuelto es
  `clinic_owner` y mantiene `Administrador DayIA` para contexto de plataforma.
- El plan real se carga desde `clinic_subscriptions.plan_id`; Medium y Pro ya no
  quedan reducidos a Basic en frontend.
- La bandera `profiles.is_platform_admin` permanece independiente del rol
  clínico, permitiendo conservar ambos datos de contexto en la sesión.
- Se agregó una matriz única de permisos por rol y plan para sidebar, acciones
  rápidas, protección de vistas y carga de datos.
- Recepción dejó de ver Historial clínico y Odontograma, incluso dentro del
  detalle de paciente; Doctor dejó de acceder a configuración sensible.
- Usuarios del consultorio se muestra solo para owner/admin con Medium o Pro.
- WhatsApp automático se muestra y carga solo para owner/admin con Pro.
- Los planes desconocidos aplican el mínimo seguro y no habilitan capacidades
  premium.
- Se corrigieron las tildes visibles de Historial clínico, Configuración y
  Administración DayIA.
- Usuarios del consultorio ahora lista roles y estados desde
  `clinic_memberships`, sin depender de `profiles.role` ni `profiles.clinic_id`.
- Se agregó `invite-clinic-member`, protegida por JWT, membership activa,
  owner/admin, suscripción real y límites Medium 4 / Pro 10.
- La invitación solo admite `clinic_admin`, `doctor` y `receptionist`; rechaza
  owners adicionales, administradores de plataforma y memberships duplicadas.
- Las cuentas nuevas usan invitación de Supabase Auth sin contraseña visible y
  quedan `pending_activation`; las cuentas confirmadas pueden reutilizarse sin
  sobrescribir `is_platform_admin`.
- La UI muestra nombre, email, rol, estado, fecha de invitación y contador del
  plan, y bloquea nuevas invitaciones cuando se agota el cupo.
- La migración `015` amplía la activación existente a miembros clínicos y
  mantiene la activación del consultorio reservada a `clinic_owner`.
- La migración `016` aplica el límite de miembros de forma transaccional para
  impedir sobrecupos por invitaciones concurrentes.
- `create-clinic-user` queda documentada como legacy/deprecated.
- Se agrego `017_clinical_records.sql` con tabla, indices, trigger de alcance
  inmutable y RLS basada en memberships activas.
- Owner, admin y doctor pueden leer y crear historial clinico; recepcion,
  platform admin puro y memberships inactivas quedan sin acceso.
- El historial real se carga desde Supabase por clinica y puede filtrarse por
  paciente; los mocks quedan exclusivamente para modo demo.
- El formulario normaliza motivo, diagnostico, tratamiento y observaciones, y
  espera confirmacion del insert antes de mostrar exito.
- La vista global y el detalle incorporan loading, vacio y errores publicos sin
  mostrar informacion tecnica.
- Se agrego `018_odontogram_entries.sql` con FDI adulto, unicidad segura para
  superficie nullable, auditoria y RLS basada en memberships activas.
- Owner, admin y doctor pueden leer y guardar odontogramas; recepcion,
  platform admin puro y memberships inactivas quedan sin acceso.
- El modulo global de Odontograma ahora permite buscar y seleccionar paciente,
  reutiliza el mapa del detalle y carga solo `clinic_id + patient_id`.
- El guardado usa upsert real, normaliza observaciones y solo confirma exito
  despues de la respuesta de Supabase; los mocks quedan para modo demo.
- Quedan pendientes superficies avanzadas, denticion infantil, PDF y adjuntos
  o radiografias.

## 2026-07-13

### Cambios realizados

- Se agregó `create-platform-clinic`, protegida por JWT,
  `profiles.is_platform_admin = true` y
  `DAYIA_PLATFORM_CREATE_ENABLED === "true"`.
- La Function normaliza el payload, reutiliza owners existentes y prepara
  owners nuevos mediante invitación de Supabase Auth, sin contraseña manual.
- Se agregó compensación ante fallos parciales y unicidad normalizada para
  nombres de consultorios mediante la migración `013`.
- El frontend llama únicamente a la Function, muestra errores amigables y
  refresca el listado solo tras una creación real.
- El formulario quedó conectado a la Function sin una compuerta frontend. La
  autorización y el feature flag se resuelven exclusivamente en el servidor.
- El botón muestra carga, bloquea envíos duplicados, presenta errores seguros y
  refresca el listado después de una creación confirmada.
- Se agregaron pruebas de autorización, feature flag, validación, owner
  existente, compensación, servicio y refresco del listado.

### Seguridad

- `service_role` se inicializa solo después de validar JWT, perfil y feature
  flag.
- La Function no consulta ni devuelve pacientes, citas, historial clínico,
  odontograma, recordatorios ni configuración de WhatsApp.

## 2026-06-15

### Cambios realizados

- Se pulio visualmente Configuracion para separar mejor Horarios del
  consultorio, Excepciones del calendario y Tratamientos.
- `Guardar horarios` quedo visualmente asociado al bloque de Horarios, antes de
  Excepciones.
- Horarios, Excepciones y Tratamientos ahora comparten un degradado suave para
  mantener coherencia entre subpaneles y columnas.
- La lista de excepciones se ajusto como item compacto con fecha principal,
  tipo/motivo secundario y accion de eliminacion discreta.
- Se implemento el MVP de excepciones del calendario en Configuracion.
- El bloque `Excepciones del calendario` dejo de ser solo informativo y ahora
  participa en la disponibilidad real de citas.
- Configuracion ahora permite agregar fechas cerradas o fechas con horario
  especial, con motivo opcional y detalle cuando corresponde.
- Se bloqueo el registro de dos excepciones para la misma fecha.
- Las excepciones se pueden eliminar con `ConfirmDialog` y muestran feedback
  mediante Toast al agregarse o eliminarse.
- Nueva Cita usa el horario efectivo del dia: excepcion cerrada, horario
  especial o horario semanal segun corresponda.
- Reprogramar usa las mismas excepciones al calcular horas disponibles y al
  validar el guardado.
- La disponibilidad por duracion toma en cuenta excepciones de calendario antes
  de ofrecer horas disponibles.
- Se agregaron pruebas unitarias para fechas cerradas, horarios especiales,
  duplicados y validaciones de excepciones.
- Se implemento disponibilidad real de citas por duracion del tratamiento.
- Nueva Cita ahora oculta horas que se solaparian con rangos de citas activas o
  que harian que la cita termine despues del cierre.
- Reprogramar usa la misma validacion de disponibilidad por duracion e ignora la
  cita actual mediante `appointmentIdToIgnore`.
- Las citas pendientes, confirmadas y reprogramadas bloquean disponibilidad; las
  canceladas no bloquean.
- Se agrego fallback seguro de 30 minutos para citas antiguas sin duracion
  resoluble.
- Se agregaron pruebas unitarias para solapamientos por rango, bordes exactos
  permitidos, citas canceladas, reprogramacion y horas disponibles por duracion.
- Se reorganizaron las cards de Agenda para separar rango horario, datos del
  paciente, estado, tratamiento, metadatos y acciones.
- El rango horario, por ejemplo `13:00 - 13:30`, ahora tiene un bloque propio
  para evitar que se junte visualmente con nombre, telefono o tratamiento.
- En mobile, la card se apila para mantener paciente/estado, rango horario,
  tratamiento y acciones legibles sin desbordes.
- Se corrigio la alerta duplicada al intentar reprogramar sin cambiar fecha u
  hora: el error queda inline dentro del panel y no se muestra tambien como
  Toast.
- Se actualizo la documentacion del proyecto para explicitar el contrato actual
  del odontograma.
- Se documento que el resumen recorre las 32 piezas permanentes adultas FDI y
  cuenta como sanas las piezas sin entrada guardada.
- Se aclararon los estados canonicos del odontograma y el uso de etiquetas
  largas y cortas desde `src/utils/odontogram.ts`.
- Se agrego contexto tecnico sobre la lectura por pieza: `PatientDetailView`
  entrega entradas filtradas por paciente y los helpers buscan por
  `toothNumber` dentro de esa coleccion.

### Motivo del cambio

Dejar alineada la documentacion con el comportamiento real de Agenda,
Configuracion y Odontograma. Las citas ya no dependen solo del horario semanal:
la disponibilidad se calcula con duracion, citas activas y excepciones del
calendario, manteniendo validaciones finales antes de guardar.

## 2026-06-14

### Cambios realizados

- Se consolido `formatAppDate` como formatter global para fechas visibles de la
  app.
- `formatAppDate` muestra año solo cuando la fecha no pertenece al año actual y
  mantiene hora en formato 24 horas.
- La fecha de `Ultima actualizacion` del Odontograma usa el formato global de
  la app, evitando formatos ISO, con guiones o numericos rigidos.
- Se agregaron pruebas unitarias para fechas del año actual, fechas de otro
  año, fechas con hora en 24 horas y fechas invalidas.
- Se pulio el Odontograma inicial dentro del detalle de paciente.
- El Odontograma ahora separa arcada superior e inferior con cuadrantes FDI
  identificados como derecha o izquierda del paciente.
- La confirmacion de guardado del Odontograma usa Toast flotante reutilizable.
- El estado actual de la pieza se muestra como badge con el mismo color
  semantico del estado.
- Las observaciones del Odontograma tienen limite de 160 caracteres, contador
  discreto, textarea fijo con scroll interno y normalizacion al guardar.
- Se implemento la primera version del modulo global `Historial clinico`.
- El modulo global usa los registros clinicos y pacientes del estado local
  compartido en `App.tsx`.
- Se agrupan los registros por paciente para evitar repetir una card completa
  por cada evolucion clinica.
- Cada card muestra nombre, telefono si existe, total de registros, fecha del
  ultimo registro, ultimo motivo, ultimo diagnostico y ultimo tratamiento.
- Se agrego expansion controlada con `Ver ultimos registros`, mostrando hasta
  los ultimos 3 registros del paciente.
- Se mantuvo el acceso `Ver paciente` para volver al detalle del paciente.
- Se agrego busqueda global por paciente, motivo, diagnostico, tratamiento y
  observaciones.
- Se mantuvieron filtros de periodo: todos, este mes y ultimos 30 dias.
- Los KPIs del modulo global reflejan los registros visibles segun busqueda y
  filtros.
- Se agrego formato de fecha global para historial, por ejemplo `18 may`, con
  año solo cuando corresponde.
- Se agrego formatter de presentacion para textos clinicos visibles, corrigiendo
  casos conservadores como `Aplicacion de fluor` a `Aplicación de flúor` sin
  modificar el dato original.
- Se pulio visualmente el modulo con acentos clinicos suaves, badges compactos,
  botones secundarios y bloques internos mas legibles.
- Se agregaron y actualizaron pruebas unitarias para agrupacion, busqueda,
  resumen, fechas y textos clinicos visibles.
- Se actualizo la documentacion del proyecto para reflejar el nuevo estado del
  modulo global `Historial clinico`.

### Motivo del cambio

Evitar que el historial global se vuelva una lista repetitiva cuando un paciente
tiene varios registros. La agrupacion por paciente permite escanear mejor el
seguimiento clinico, mantener una card compacta por persona y entrar al detalle
cuando se necesita mas contexto.

El pulido visual busca cerrar las primeras versiones con jerarquia clara sin
convertir los modulos en interfaces recargadas. El odontograma sigue siendo una
grilla inicial funcional, sin superficies dentales, denticion temporal,
imagenes, PDF ni historial por pieza.

La consolidacion de fechas evita que convivan formatos rigidos como ISO,
`14-jun-2026` o `14/06/2026` en superficies visibles. La app queda preparada
para migrar gradualmente otros modulos hacia `formatAppDate`.

## 2026-06-13

### Cambios realizados

- Se alineo Recordatorios WhatsApp con los estados reales de citas activas.
- Recordatorios ahora genera cola solo para citas pendientes, confirmadas y
  reprogramadas.
- Las citas canceladas no generan recordatorios, no aparecen en la cola y no
  afectan los KPIs del modulo.
- Las citas reprogramadas usan su fecha y hora vigentes para los recordatorios.
- Se agrego contexto de estado de cita dentro del tipo `Reminder`.
- Se ajustaron los mensajes sugeridos:
  - Pendiente: pide confirmar asistencia.
  - Confirmada: recuerda que la cita ya esta confirmada.
  - Reprogramada: menciona que la cita fue reprogramada.
- Se agrego prioridad de cola para destacar recordatorios pendientes de citas
  pendientes antes que otros casos.
- Se reforzo el manejo de pacientes sin telefono: `Marcar enviado` queda
  deshabilitado y la accion se protege con una funcion pura.
- Se actualizo el estado vacio de Recordatorios para indicar que no hay
  recordatorios pendientes para citas activas y que las citas canceladas no
  generan recordatorios.
- Se agrego formato visible corto 24 horas para recordatorios, por ejemplo
  `15 jun, 10:00`, sin `a. m.` ni `p. m.`.
- Se suavizo el protagonismo visual de `Marcar fallido`.
- Se suavizo el borde general de la card para que un estado interno fallido no
  domine toda la cita.
- Se pulio visualmente el modulo Pacientes para priorizar listado, busqueda y
  fichas compactas.
- El formulario de paciente queda debajo del listado en modo Pacientes y se
  mantiene como vista principal cuando se entra por `+ Paciente`.
- Las fichas de paciente ahora priorizan nombre, telefono y email como datos
  escaneables, con menos peso visual.
- Se pulio el detalle de paciente con resumen superior de citas activas, ultima
  atencion y proxima cita activa.
- Las proximas citas del detalle de paciente consideran solo citas activas.
- Se ajustaron citas asociadas, historial clinico y odontograma para mantener
  una jerarquia mas compacta y coherente con Dashboard, Agenda y Recordatorios.
- Se agrego `formatOptionalCompactDateWithYear` para mostrar fechas opcionales
  con formato humano y fallback seguro.
- Pacientes, detalle de paciente y pacientes recientes del Dashboard ya no
  muestran fechas crudas tipo `2026-05-18`.
- Se agregaron y actualizaron pruebas unitarias para generacion por estado,
  mensajes sugeridos, citas canceladas, reprogramaciones, telefono faltante y
  formato 24 horas.
- Se agregaron pruebas unitarias para citas activas del paciente, proxima cita
  activa y fechas opcionales.
- Se verifico el cambio con `npm run lint`, `npm run test` y `npm run build`.

### Motivo del cambio

Mantener Recordatorios coherente con Agenda y Dashboard. El modulo debe preparar
mensajes utiles para citas activas, evitar comunicaciones para citas canceladas
y usar un formato de hora claro para el equipo del consultorio.

El pulido visual mantiene la interfaz compacta y clinica: las acciones sensibles
siguen visibles, pero no compiten con las acciones principales ni convierten
toda la card en una alerta.

El pulido de Pacientes busca que listado y detalle queden al nivel visual de
Dashboard, Agenda, Recordatorios y Configuracion, sin agregar edicion,
eliminacion ni nuevas reglas de negocio. Tambien se consolida el formato de
fechas para evitar valores ISO crudos en la ficha clinica.

## 2026-06-12

### Cambios realizados

- Se convirtio el Dashboard en un panel operativo mas completo para el
  consultorio.
- Se actualizaron los KPIs del Dashboard a: citas de hoy, pendientes de hoy,
  confirmadas de hoy, reprogramadas del mes, canceladas del mes y pacientes
  registrados.
- Las proximas citas del Dashboard ahora muestran solo citas futuras activas,
  ordenadas por fecha y hora, excluyendo citas canceladas.
- Se agrego la seccion `Requieren atencion` para destacar citas pendientes
  proximas, reprogramaciones recientes y pacientes sin telefono registrado
  cuando existe el dato del paciente.
- Se agrego actividad reciente basada en `changeLog`, ignorando eventos
  internos de creacion y mostrando confirmaciones, cancelaciones y
  reprogramaciones relevantes.
- Se agrego resumen del mes con total, confirmadas, canceladas y
  reprogramadas.
- Se agregaron componentes especificos para atencion operativa y resumen
  mensual del Dashboard.
- Se ampliaron las pruebas unitarias de `dashboardMetrics` para cubrir KPIs,
  proximas citas, actividad reciente y citas que requieren atencion.
- Se hizo explicito el cierre del panel de reprogramacion con
  `closeReschedulePanel` y la limpieza de valores temporales con
  `resetRescheduleForm`.
- El boton `Cancelar` dentro del panel de reprogramacion ahora cierra la edicion
  y limpia fecha, hora, motivo, detalle y errores inline sin cancelar la cita.
- Al abrir el flujo de cancelar cita, se cierra y limpia cualquier panel de
  reprogramacion activo antes de mostrar `ConfirmDialog`.
- Mientras una card esta en modo reprogramacion, se ocultan las acciones
  externas de la cita para dejar solo `Guardar` y `Cancelar` del panel.
- Se agrego `changeLog` opcional a las citas para registrar historial simple de
  creacion, confirmacion, cancelacion y reprogramacion.
- Se creo `src/utils/appointmentChangeLog.ts` para crear eventos, agregarlos de
  forma inmutable y formatear el ultimo cambio visible.
- Se agregan eventos de historial al crear, confirmar, cancelar y reprogramar
  una cita sin permitir edicion ni borrado desde la UI.
- La card de agenda muestra solo el ultimo cambio relevante cuando el evento es
  `confirmed`, `cancelled` o `rescheduled`; el evento interno `created` se
  conserva pero no se muestra como ultimo cambio.
- Se pulio la card de cita para que tratamiento, motivo, ultimo cambio, estado
  y acciones se vean mas ordenados y menos ambiguos.
- Se agregaron pruebas unitarias para el historial simple de cambios de cita.
- Se verifico el cambio con `npm run lint`, `npm run test` y `npm run build`.

### Motivo del cambio

Evitar ambiguedad entre cancelar una edicion de reprogramacion y cancelar la
cita completa. La card queda enfocada en una sola decision operativa a la vez,
sin cambiar reglas de negocio ni introducir nuevas funcionalidades.

El historial simple agrega trazabilidad basica sin backend, usuario responsable
ni auditoria avanzada. La UI muestra solo un resumen discreto para no saturar la
agenda, mientras conserva internamente el evento de creacion.

El Dashboard queda orientado a seguimiento operativo: muestra carga del dia,
estados relevantes del mes, proximas citas activas y eventos recientes sin
inventar datos ni agregar graficos.

## 2026-06-11

### Cambios realizados

- Se agregaron motivos obligatorios al cancelar una cita desde Agenda.
- Se agregaron motivos obligatorios al reprogramar una cita desde el panel
  inline.
- Se agrego soporte para `Otro` con detalle breve obligatorio y normalizacion
  de texto.
- Se extendio `Appointment` con campos opcionales para guardar motivo y detalle
  de cancelacion o reprogramacion.
- Se creo `src/utils/appointmentReasons.ts` para centralizar listas de motivos,
  validaciones, normalizacion y texto visible.
- Se agregaron pruebas unitarias para motivos de citas.
- Se extendio `ConfirmDialog` para aceptar contenido adicional opcional sin
  romper su uso en Tratamientos.
- Se muestran los motivos de cancelacion o reprogramacion como texto secundario
  en la card de agenda cuando corresponde.
- Se limito el detalle `Otro` de motivos a 120 caracteres, con contador visual
  y textarea fijo para evitar que rompa el layout.
- Se agrego validacion para impedir reprogramar si la nueva fecha y hora son
  iguales a las actuales.
- Se reorganizo la card de cita para ordenar hora, paciente, estado,
  tratamiento, motivo y acciones tanto en desktop como en mobile.
- Se mantuvo la regla de que una cita cancelada no se reprograma directamente y
  no bloquea horario.
- Se ajusto visualmente la Agenda diaria para reducir estiramiento en desktop,
  compactar KPIs, mejorar cards y evitar botones demasiado pesados en mobile.
- Se actualizaron `README.md`, `PRODUCT.md` y los documentos dentro de `docs/`
  para reflejar el estado real del modulo Citas.

### Motivo del cambio

Agregar trazabilidad operativa basica sin implementar todavia historial completo
de cambios, usuario responsable, persistencia ni auditoria. Los motivos simples
permiten entender por que una cita fue cancelada o reprogramada mientras la app
sigue funcionando solo en frontend con datos mock.

La reprogramacion ahora exige mover realmente la cita. Cambiar solo el motivo
queda fuera del flujo actual y se reserva para una futura accion especifica de
edicion de motivo.

El ajuste visual de Agenda busca que Citas se sienta mas como una herramienta
operativa de consultorio: compacta en desktop, legible en mobile y alineada con
el tono clinico de DayIA Dental.

## 2026-06-10

### Cambios realizados

- Se convirtio la vista Citas en una agenda diaria operativa enfocada en el
  dia seleccionado.
- Se agrego selector horizontal de dias con etiquetas compactas para hoy,
  mañana y proximos dias con citas.
- Se agregaron KPIs diarios de total, pendientes, confirmadas, reprogramadas y
  canceladas.
- Se cambio la lista de Citas para mostrar solo las citas del dia seleccionado,
  ordenadas por hora ascendente.
- Las cards de agenda muestran hora, paciente, telefono cuando existe,
  tratamiento y badge de estado.
- Se agrego estado vacio profesional cuando el dia seleccionado no tiene citas.
- Se agregaron utilidades puras para generar dias visibles, filtrar citas por
  dia, ordenar por hora y etiquetar dias del selector.
- Se agregaron pruebas unitarias para la agenda diaria y sus etiquetas.
- Se agregaron acciones locales en Agenda diaria para confirmar citas
  pendientes.
- Se agregaron acciones locales para cancelar citas pendientes, confirmadas o
  reprogramadas sin eliminarlas.
- Se agrego Toast flotante de confirmacion para citas confirmadas y Toast de
  aviso para citas canceladas.
- Se documento la decision de producto: las citas canceladas no se reprograman
  directamente; si el paciente desea asistir nuevamente, se crea una nueva
  cita.
- Se pulio visualmente la Agenda diaria para alinear KPIs, selector de dias,
  cards, botones, estado vacio y panel de reprogramacion con el lenguaje de
  Recordatorios y Configuracion.
- Se agrego reprogramacion inline de citas con validacion de fecha, hora,
  horarios disponibles, choques de horario y doble cita activa del paciente.
- Se creo `ConfirmDialog` reutilizable con variantes `danger`, `warning` e
  `info`, overlay centrado, cierre con Escape y atributos basicos de
  accesibilidad.
- Se reemplazo `window.confirm` por `ConfirmDialog` al cancelar una cita desde
  Agenda.
- Se bloqueo la reprogramacion de citas canceladas desde validaciones,
  acciones visibles y handler principal de estado.
- Se hizo que cancelar una cita cierre y limpie el panel de reprogramacion si
  estaba abierto.
- Se hizo que el panel de reprogramacion se cierre al cambiar de dia y que el
  boton `Reprogramar` funcione como toggle sobre la misma cita.
- Se agregaron pruebas unitarias para confirmacion de cancelacion, cierre del
  panel de reprogramacion, toggle del panel y bloqueo de reprogramacion en
  citas canceladas.
- Se agrego utilidad pura para definir acciones disponibles segun estado de
  cita.
- Se ajusto Recordatorios para no generar recordatorios de citas canceladas.
- Se agregaron pruebas unitarias para acciones disponibles por estado y para
  evitar recordatorios en citas canceladas.
- Se conecto Nueva Cita con los horarios del consultorio configurados en
  Configuracion.
- Se agrego validacion para impedir choques exactos de fecha y hora entre citas
  activas.
- Se ocultaron en Nueva Cita las horas ya ocupadas por citas pendientes,
  confirmadas o reprogramadas.
- Se mantiene disponible una hora si la cita existente esta cancelada.
- Se agrego mensaje cuando una fecha no tiene horarios disponibles.
- Se agrego validacion para impedir que un mismo paciente tenga mas de una cita
  activa el mismo dia.
- Se desactivo el autocompletado nativo del navegador en el buscador de
  pacientes de Nueva Cita para no competir con el dropdown propio.
- Se agregaron utilidades puras para conflictos de citas, disponibilidad de
  horarios y doble cita activa por paciente.
- Se agregaron pruebas unitarias para conflictos de horario, horas disponibles,
  citas canceladas, dias cerrados y doble cita del paciente.
- Se refino la vista Configuracion para alinear visualmente Horarios y
  Tratamientos con el lenguaje del modulo Recordatorios.
- Se agrego el panel `Horarios del consultorio` con horario semanal base,
  intervalo de atencion, dias abiertos/cerrados, validacion de horarios y Toast
  flotante al guardar.
- Se agrego el bloque informativo `Excepciones del calendario` como preparacion
  visual para feriados, cierres especiales o dias con horario distinto, sin
  implementar la logica todavia.
- Se reemplazaron las alertas internas de Tratamientos por el `Toast` flotante
  reutilizable para evitar saltos visuales en el layout.
- Se ajustaron los mensajes de Tratamientos a textos compactos:
  `Tratamiento agregado.`, `Tratamiento actualizado.`,
  `Tratamiento desactivado.` y `Tratamiento activado.`.
- Se corrigio el tono del Toast al desactivar tratamientos para tratarlo como
  aviso, no como error.
- Se agrego confirmacion con `ConfirmDialog` antes de desactivar un
  tratamiento.
- Se alineo el color de la accion `Sí, desactivar` con el boton
  `Desactivar`, usando rojo suave para acciones sensibles sin tratarlas como
  errores.
- Se alineo el boton `Agregar tratamiento` con la altura del input del
  formulario.
- Se compactaron espacios entre nuevo tratamiento, busqueda y lista de
  tratamientos.
- Se unificaron los botones de Configuracion con el estilo compacto de
  Recordatorios: acciones neutras con color semantico en el texto, primarios
  sobrios, activar en verde, desactivar en rojo suave y editar/guardar en ambar.
- Se actualizo la documentacion para incluir `PRODUCT.md` dentro del conjunto
  de documentos que se mantienen al actualizar la documentacion.
- Se implemento una primera version funcional de Recordatorios WhatsApp en
  frontend.
- Se agregaron tipos de recordatorio para `24h`, `2h` y confirmacion inmediata.
- Se generan recordatorios desde citas futuras usando datos locales de citas y
  pacientes.
- Se evita generar recordatorios con horario programado en el pasado.
- Se omite el recordatorio de `24h` cuando una cita fue registrada con poca
  anticipacion y todavia aplica el recordatorio de `2h`.
- Se genera confirmacion inmediata cuando la cita esta demasiado cerca y ya no
  aplican `24h` ni `2h`.
- Se dejan notas visuales suaves cuando un recordatorio fue omitido.
- Se agrupan recordatorios por fecha y por cita.
- Se agrego selector horizontal por fecha y filtros compactos por estado.
- Se agregaron KPIs de todos, pendientes, programados, enviados simulados y
  fallidos.
- Se agrego vista previa del mensaje sugerido.
- Se permite marcar recordatorios como enviados o fallidos de forma local y
  simulada.
- Se maneja el caso de pacientes sin telefono deshabilitando `Marcar enviado`.
- Se agrego un componente `Toast` reutilizable para feedback flotante.
- Se reemplazo la alerta inline de Recordatorios por Toast para evitar saltos
  visuales en el layout.
- Se pulio el Toast con tamaño adaptable al contenido, colores suaves y
  transicion de entrada y salida.
- Se agregaron pruebas unitarias para generacion de recordatorios, omisiones,
  confirmacion inmediata, filtros y agrupacion.
- Se actualizo la documentacion para reflejar el estado actual del modulo.

### Motivo del cambio

Avanzar Recordatorios WhatsApp como simulacion local antes de integrar envio
real. La prioridad fue validar reglas de programacion, evitar recordatorios en
el pasado, manejar citas registradas con poca anticipacion y ofrecer feedback
visual estable sin mover el contenido de la pantalla.

Tambien consolidar Configuracion como una pantalla operativa coherente con el
sistema visual actual, evitando alertas que empujen contenido, botones
demasiado pesados y documentacion incompleta sobre criterios de producto.

Nueva Cita queda mas protegida contra sobreagendamiento: el usuario ve solo
horas disponibles, pero la validacion final sigue bloqueando choques si el
estado cambia antes de guardar.

La vista Citas deja de ser solo un listado agrupado y empieza a comportarse
como agenda diaria para recepcion, con foco operativo en el dia seleccionado.

Las acciones de confirmar y cancelar avanzan la operacion diaria sin introducir
edicion, reprogramacion, eliminacion fisica ni persistencia. Cancelar una cita
es una accion administrativa valida, por eso usa Toast de aviso y la cita queda
visible como cancelada.

Las citas canceladas no se reprograman directamente. Si el paciente desea
asistir nuevamente, se crea una nueva cita. Mas adelante, cuando exista
integracion real con WhatsApp, se evaluaran estados intermedios como
`Solicitud de cancelacion` para evitar cancelaciones accidentales.

La reprogramacion queda como panel inline contextual de la cita y del dia
seleccionado: se cierra al cambiar de dia, al volver a pulsar `Reprogramar`, al
cancelar el formulario o al cancelar la cita. Ademas, la validacion y el estado
principal bloquean cualquier intento de reprogramar una cita cancelada.

La cancelacion de citas ya no usa la confirmacion nativa del navegador. Ahora
usa `ConfirmDialog`, un dialogo reutilizable y coherente con el diseño de
DayIA Dental, preparado para futuras acciones sensibles.

La desactivacion de tratamientos tambien usa `ConfirmDialog` para evitar
acciones accidentales. La accion principal usa color rojo suave por tratarse de
una accion sensible, pero el feedback posterior sigue siendo un aviso
administrativo y no un error.

## 2026-06-09

### Cambios realizados

- Se agrego el tipo `ClinicalRecord` para representar registros clinicos por
  paciente.
- Se agregaron datos mock de historial clinico en `src/data/clinicalRecords.ts`.
- Se agrego estado local de registros clinicos en `src/App.tsx`.
- Se integro el historial clinico dentro del detalle de paciente.
- Se agrego formulario para registrar evoluciones clinicas basicas.
- Se agrego listado de registros clinicos asociados por `patientId`.
- Se ordenan los registros clinicos del mas reciente al mas antiguo.
- Se agrego validacion de campos obligatorios y fecha no futura.
- Se agrego mensaje de exito al guardar un registro clinico.
- Se agrego normalizacion reutilizable de textos en `src/utils/textNormalizers.ts`.
- Se normalizan motivo, diagnostico, tratamiento y observaciones antes de
  guardar.
- Se agrego formateo de fechas clinicas con año en
  `src/utils/dateFormatters.ts`.
- Se agrego resumen temporal del historial clinico, con cantidad de registros y
  rango de fechas.
- Se agregaron pruebas unitarias para historial clinico, normalizacion de texto
  y formateo de fechas.
- Se agrego el tipo `OdontogramEntry` para representar estados por pieza dental
  y paciente.
- Se agregaron datos mock de odontograma en `src/data/odontogram.ts`.
- Se agrego estado local de odontograma en `src/App.tsx`.
- Se integro el odontograma dentro del detalle de paciente.
- Se agrego una grilla simple de piezas permanentes adultas con numeracion FDI.
- Se agrego seleccion de pieza dental y panel simple de actualizacion.
- Se agregaron estados iniciales de pieza: sano, caries, restaurado, ausente,
  tratamiento pendiente, en observacion y otro.
- Se agregaron colores suaves por estado y resumen de piezas por estado.
- Se normalizan observaciones del odontograma antes de guardarlas.
- La ultima actualizacion de una pieza queda documentada como fecha visible del
  odontograma; luego se migro al formato global `formatAppDate`.
- Se agregaron pruebas unitarias para piezas FDI, filtrado por paciente,
  resumen por estado, validacion y actualizacion de entradas de odontograma.
- Se aplico una mejora visual mediana controlada sin cambiar logica funcional.
- Se reorganizo visualmente el Dashboard con un panel de KPIs equilibrado y
  mejor jerarquia entre indicadores, proximas atenciones y resumen lateral.
- Se reforzo el detalle de paciente con una cabecera clinica mas destacada y
  secciones secundarias mejor diferenciadas.
- Se mejoro el odontograma visualmente para sentirse mas como herramienta
  clinica, con grilla, seleccion y editor mas claros.
- Se mejoro el Sidebar con bloque de marca, secciones de acciones y modulos, y
  estado activo mas visible.
- Se hizo que la navegacion movil horizontal se vea mas intencional, sin drawer
  ni bottom navigation.
- Se rediseñaron visualmente las cards de pacientes como fichas clinicas
  escaneables, con badge semantico por estado.
- Se consolidaron estilos visuales de botones, inputs, cards, badges, mensajes
  y superficies manteniendo la identidad actual.
- Se actualizo la documentacion del proyecto para reflejar el historial clinico
  inicial y el odontograma inicial.

### Motivo del cambio

Preparar DayIA Dental para seguimiento odontologico por paciente, manteniendo
historial clinico y odontograma dentro del detalle del paciente y sin introducir
backend, persistencia, odontograma grafico avanzado ni pantalla global de
historial clinico todavia. Tambien elevar la calidad visual de las pantallas
principales sin agregar librerias, iconos, graficos ni cambios funcionales.

## 2026-06-08

### Cambios realizados

- Se agrego el tipo `AppointmentFormValues` y errores de formulario de citas.
- Se agrego `patientId` al formulario de citas para distinguir texto de busqueda
  de paciente realmente seleccionado.
- Se corrigio la validacion de paciente para evitar mostrar seleccion positiva y
  error al mismo tiempo.
- Se estabilizo la grilla del formulario de nueva cita con zonas de mensaje
  consistentes.
- Se agrego el catalogo mock de tratamientos en `src/data/treatments.ts`.
- Se creo `AppointmentForm` para registrar nuevas citas desde el frontend.
- Se agrego busqueda y seleccion de pacientes dentro del formulario de citas.
- Se agregaron validaciones puras para paciente, fecha, hora, tratamiento y
  estado inicial de citas.
- Se agrego un catalogo de horarios exactos de 24 horas en intervalos de 15
  minutos.
- Se cambio el selector de hora para elegir valores como `08:15`, `08:30` o
  `08:45`, evitando seleccion minuto a minuto.
- Se valido que la hora seleccionada pertenezca al catalogo de intervalos de 15
  minutos.
- Se agregaron pruebas unitarias para validaciones de citas.
- Se agregaron pruebas unitarias para el catalogo de horarios.
- Se conecto la accion rapida `+ Cita` con el formulario de nueva cita.
- Se agrego creacion local de citas en memoria desde `App.tsx`.
- Se hizo que Dashboard y Agenda usen el estado local actualizado de citas.
- Se levanto el estado local de pacientes a `src/App.tsx` para compartirlo con
  Dashboard, Pacientes y Nueva Cita.
- Se mejoro el Dashboard con KPIs operativos, proximas atenciones, pacientes
  recientes y resumen operativo.
- Se agregaron componentes visuales especificos para el Dashboard.
- Se agrego `dashboardMetrics` como utilidad pura para calcular indicadores,
  citas de hoy, citas del mes, proximas citas, pacientes recientes y mensajes
  operativos.
- Se agregaron pruebas unitarias para las metricas del Dashboard.
- Se ajustaron los KPIs del Dashboard a: atenciones de hoy, atenciones del mes,
  pendientes por confirmar, pacientes registrados y reprogramadas del mes.
- Se elimino temporalmente el KPI de nuevos pacientes del mes porque no existe
  una fecha real de registro en los pacientes mock.
- Se agrego el tipo `Treatment` con `id`, `name` e `isActive`.
- Se convirtio `src/data/treatments.ts` en un catalogo tipado de tratamientos.
- Se levanto el estado local de tratamientos a `src/App.tsx` para compartirlo
  entre Configuracion y Nueva Cita.
- Se implemento Configuracion > Tratamientos del consultorio.
- Se agrego alta local de tratamientos con normalizacion de nombres.
- Se agrego busqueda de tratamientos ignorando acentos y mayusculas.
- Se agrego edicion simple de tratamientos conservando el mismo `id`.
- Se agrego activacion y desactivacion de tratamientos sin eliminacion fisica.
- Se agregaron mensajes de exito por agregar, editar, activar y desactivar.
- Se ajustaron colores de feedback y botones: verde para agregar/activar,
  ambar para editar y rojo suave para desactivar.
- Se conecto Nueva Cita para mostrar solo tratamientos activos.
- Se agregaron utilidades puras para tratamientos y pruebas unitarias.
- Se redujo repeticion visual de encabezados manteniendo la marca en el sidebar.
- Se agrego la vista completa de detalle de paciente desde el modulo Pacientes.
- Se agrego navegacion local hacia detalle de paciente sin React Router.
- Se agrego una ficha de paciente con nombre, telefono, email, fecha de
  nacimiento, edad, ultima visita y proxima cita.
- Se agrego listado de citas asociadas al paciente con fecha, hora, tratamiento
  y estado.
- Se agrego asociacion de citas por `patientId` y fallback por nombre exacto
  para citas mock antiguas.
- Se agregaron utilidades puras para detalle de paciente y pruebas unitarias.
- Se unificaron clases globales de botones para acciones primarias,
  secundarias, suaves, de advertencia, exito y peligro.
- Se dejo la estructura visual del detalle preparada para futuros modulos
  clinicos como historial, odontograma, recordatorios y evoluciones.
- Se actualizo la documentacion para reflejar el estado real del proyecto.

### Motivo del cambio

Avanzar los modulos principales desde vistas solamente visuales hacia flujos
frontend funcionales, con estado local compartido, logica testeable, una
interfaz estable y sin introducir backend ni persistencia todavia.

## 2026-06-07

### Cambios realizados

- Se agrego el tipo `Patient` en `src/types`.
- Se agregaron pacientes mock en `src/data/patients.ts`.
- Se crearon los componentes `PatientsList` y `PatientCard`.
- Se integro un listado simple de pacientes en la pantalla principal.
- Se agrego busqueda frontend por nombre, apellido o telefono.
- Se agrego `filterPatients` como funcion pura testeable.
- Se agregaron pruebas unitarias para el filtro de pacientes.
- Se agrego formulario frontend para registrar pacientes.
- Se agregaron validaciones puras para campos obligatorios del paciente.
- Se mejoraron validaciones de nombre, apellido, telefono y email.
- Se agrego validacion de fecha de nacimiento opcional.
- Se corrigio la visualizacion de errores de email y fecha de nacimiento.
- Se agrego validacion de longitud minima para telefono.
- Se separo el telefono del formulario en prefijo de pais y numero local.
- Se guarda el telefono del paciente en formato internacional compacto.
- Se agrego mensaje visual de exito al registrar pacientes.
- Se agregaron pruebas unitarias para validaciones de pacientes.
- Se agrego layout base con sidebar, header superior y navegacion local.
- Se rediseño la navegacion principal con mapa futuro de modulos.
- Se agregaron subitems simples para Pacientes y Citas.
- Se agregaron acciones rapidas para nuevo paciente y nueva cita.
- Se simplifico el sidebar eliminando submenus visibles duplicados.
- Se agregaron placeholders para Historial clinico, Odontograma y Recordatorios WhatsApp.
- Se crearon vistas iniciales para Dashboard, Pacientes, Citas y Configuracion.
- Se movio el flujo de pacientes a `PatientsView`.
- Se agrego primera agenda mobile-first de citas.
- Se agrego ordenamiento puro de citas por fecha y hora.
- Se agregaron pruebas unitarias para ordenamiento de citas.
- Se agregaron estilos responsive para tarjetas de pacientes.
- Se agrego documentacion de contexto del proyecto.
- Se agrego roadmap funcional.
- Se actualizo la documentacion tecnica.

### Motivo del cambio

Iniciar el modulo de pacientes con una estructura simple, tipada y preparada
para crecer sin introducir backend, autenticacion ni arquitectura innecesaria.

## 2026-06-05

### Cambios realizados

- Se inicio el proyecto con React, Vite y TypeScript.
- Se limpio la plantilla inicial de Vite.
- Se creo una pantalla base tipo dashboard para citas odontologicas.
- Se agrego responsive basico para celular, tablet y escritorio.
- Se separaron datos de ejemplo en `src/data`.
- Se separo la interfaz en componentes pequenos.
- Se creo una capa de utilidades en `src/utils`.
- Se agregaron pruebas unitarias basicas con Vitest.
- Se agrego documentacion tecnica minima.

### Motivo del cambio

Crear una base ordenada, entendible y preparada para crecer paso a paso sin
mezclar UI, datos, formateo y pruebas en los mismos archivos.
