# Backend Plan

## Billing manual por QR

La migración `020_manual_billing_subscriptions.sql` amplía
`clinic_subscriptions`, agrega `subscription_payments`,
`plan_billing_options`, precios mensuales configurables y un RPC transaccional.
Los pagos se validan manualmente mediante `register-subscription-payment`; las
acciones sin pago usan `update-clinic-subscription`. Ambas Functions son
exclusivas de plataforma y no consultan tablas clínicas.

Quedan pendientes auditoría administrativa general, pasarela, conciliación
bancaria, comprobantes adjuntos y pagos recurrentes.

DayIA Dental iniciara su fase backend con Supabase, manteniendo por ahora la app
frontend/mock funcionando sin migrar modulos de golpe.

## Por que Supabase

Supabase cubre las necesidades del MVP comercial:

- Base de datos PostgreSQL.
- Autenticacion integrada para usuarios del consultorio.
- Row Level Security para separar datos por consultorio.
- Cliente oficial para frontend con anon key publica.
- Edge Functions futuras para WhatsApp, webhooks y tareas de backend.

No se usara service role key en frontend. Las claves secretas y tokens de
WhatsApp deberan vivir en backend o Edge Functions.

## Modo demo/desarrollo

Supabase real sera necesario para el MVP comercial: login, base de datos,
separacion por consultorio, RLS y WhatsApp real dependen de esa configuracion.

Mientras falten `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`, la app activa un
modo demo/desarrollo en memoria. En ese modo no se muestra el login real, no se
guardan credenciales y no se crea una sesion persistente. El objetivo es poder
seguir trabajando sobre Dashboard, Pacientes, Citas, Configuracion,
Recordatorios, Historial clinico y Odontograma sin bloquear el desarrollo por
falta de `.env`.

El modo demo usa:

- `currentClinic.id = demo-clinic`
- `currentClinic.name = Consultorio Demo`
- Un perfil temporal `Usuario Demo` vinculado a `demo-clinic`
- Datos mock/locales para Pacientes y el resto de modulos

Cuando las variables de Supabase existan, el modo demo no se activa y la app usa
el flujo real de Supabase Auth: pantalla de login, sesion, perfil y consultorio
actual desde `profiles` y `clinics`.

Este modo no debe interpretarse como seguridad real ni como sustituto de Auth.
Solo existe como fallback de desarrollo cuando Supabase no esta configurado.

## Multi-consultorio

Multi-consultorio significa que cada consultorio tiene sus propios pacientes,
citas, tratamientos, horarios, excepciones, recordatorios y configuracion de
WhatsApp. La tabla `clinics` es la raiz del modelo y las tablas operativas usan
`clinic_id` para separar datos.

Con Auth, cada usuario tendra un registro en `profiles` con su `clinic_id`. Las
policies de RLS permiten leer o escribir solo los datos del consultorio del
usuario autenticado.

## Tablas MVP

El esquema inicial vive en:

- `supabase/migrations/001_initial_mvp_schema.sql`

Incluye:

- `clinics`
- `profiles`
- `patients`
- `treatments`
- `business_hours`
- `calendar_exceptions`
- `appointments`
- `appointment_change_logs`
- `reminders`
- `whatsapp_settings`

El esquema agrega constraints basicos para duraciones, dias de semana, tipos de
excepcion, estados de cita, canal de recordatorio y estados de recordatorio.
Tambien incluye indices por `clinic_id` y fechas operativas para preparar
consultas frecuentes.

Las migraciones actuales son:

- `001_initial_mvp_schema.sql`: tablas, constraints, indices y RLS habilitado.
- `002_auth_profiles_policies.sql`: helper `current_clinic_id()` y policies
  iniciales por consultorio.
- `003_initial_clinic_setup_template.sql`: plantilla comentada para crear
  manualmente el primer consultorio y vincular un usuario de Auth sin guardar
  datos reales en el repositorio.
- `004_patients_indexes.sql`: indice adicional para listar/buscar pacientes por
  consultorio y apellido.
- `005_appointments_indexes.sql`: indice adicional para logs de citas por
  consultorio/cita y comentarios del contrato de Agenda.
- `006_settings_indexes.sql`: indice/unique de horarios por consultorio/dia y
  comentarios del contrato de Configuracion.
- `007_reminders_indexes.sql`: tipo de recordatorio, indices por cita/estado y
  contrato de cola manual para WhatsApp.
- `008_whatsapp_settings_and_delivery.sql`: metadatos de entrega WhatsApp,
  comentarios de configuracion no secreta e indices para webhooks futuros.
- `009_profiles_roles.sql`: normalizacion de roles de usuario y constraint para
  `super_admin`, `clinic_admin`, `doctor` y `receptionist`.
- `010_profiles_email_and_user_management.sql`: campos publicos para usuarios
  del consultorio, `email`, `is_active`, `invited_at`, `activated_at`, indices
  por consultorio/email y lectura RLS de perfiles del mismo consultorio.
- `011_memberships_plans_architecture.sql`: base multi-consultorio nueva con
  `clinic_memberships`, `plans`, `clinic_subscriptions`, helpers SQL de rol/plan
  y RLS inicial para esas tablas sin reemplazar todavia las policies clinicas.
- `017_clinical_records.sql`: historial clinico por paciente con RLS de
  membership activa.
- `018_odontogram_entries.sql`: odontograma adulto FDI por paciente, upsert por
  pieza/superficie y RLS clinica.
- `019_appointment_resolution_statuses.sql`: estados terminales `completed` y
  `no_show` para cerrar citas pasadas sin afectar disponibilidad futura.

## Migracion por modulos

La app conserva modo demo con datos mock/locales cuando Supabase no esta
configurado. En modo real, los modulos se migraran gradualmente:

1. Auth y perfiles de usuario por consultorio.
2. Pacientes.
3. Citas y logs de cambios.
4. Configuracion: tratamientos, horarios y excepciones.
5. Recordatorios generados desde citas reales.
6. WhatsApp real mediante Edge Functions y webhooks.
7. Historial clinico y odontograma persistentes por paciente.

Este orden reduce riesgo porque primero estabiliza el contexto del consultorio y
el primer CRUD real antes de mover Agenda y sus dependencias.

## Auth y consultorio actual

La primera capa de autenticacion usa Supabase Auth para obtener la sesion actual
y escuchar cambios de sesion desde el frontend. La app no usa React Router: el
proveedor de autenticacion envuelve la app principal y decide si mostrar el
login o la aplicacion actual.

Despues de iniciar sesion, DayIA Dental busca el perfil del usuario en
`profiles` usando el `id` del usuario autenticado. Ese perfil debe tener
`clinic_id`. Con ese valor se carga el consultorio actual desde `clinics` y se
guarda como contexto de sesion.

Estados incompletos esperados:

- Si el usuario no tiene perfil, se muestra
  `Tu usuario aún no está vinculado a un consultorio.`
- Si el perfil no tiene `clinic_id`, se muestra
  `Tu usuario no tiene consultorio asignado.`
- Si no se puede cargar el consultorio, la app muestra un mensaje claro y evita
  dejar la pantalla en blanco.

En modo real, Pacientes, Citas, Historial clinico y Odontograma leen y escriben
en Supabase. Configuracion y Recordatorios mantienen sus integraciones actuales.

La migracion `supabase/migrations/002_auth_profiles_policies.sql` agrega una
funcion `current_clinic_id()` y policies RLS basicas para que un usuario
autenticado acceda solo a su perfil y a datos del consultorio asociado. No se
abren policies publicas para datos clinicos.

La migracion `supabase/migrations/003_initial_clinic_setup_template.sql` no crea
datos reales automaticamente. Es una plantilla comentada para el setup manual
del primer tenant: crear usuario en Supabase Auth, copiar su `auth.users.id`,
crear un registro en `clinics` y vincular ese usuario en `profiles`.

Por ahora no hay registro publico, invitaciones ni creacion de consultorios
desde el frontend. Esa decision evita que usuarios autenticados puedan crear
tenants arbitrariamente antes de definir roles y administracion.

## Sesion, logout y roles

La sesion visible muestra el usuario actual, su rol legible, el consultorio
activo y la accion "Cerrar sesion" desde el layout principal. En modo demo se
muestra `Usuario Demo`, `Modo demo` y `Consultorio Demo` para no confundir ese
contexto con una sesion real.

El cierre de sesion real usa Supabase Auth y, si falla, muestra el mensaje
`No pudimos cerrar sesión. Intenta nuevamente.` sin exponer errores tecnicos.
En modo demo no se persiste una sesion real ni credenciales; el fallback vuelve
a dejar activo el contexto demo para no bloquear el desarrollo sin `.env`.

Los roles preparados para el MVP comercial son:

- `platform_admin`: administracion interna de DayIA Dental. No representa al
  doctor dueño y no debe aparecer como opcion en UI clinica.
- `clinic_owner`: doctor dueño del consultorio y rol principal para Basic.
- `clinic_admin`: administracion delegada del consultorio.
- `doctor`: atencion clinica, pacientes, citas e historial.
- `receptionist`: recepcion, pacientes, citas y recordatorios operativos.

El frontend expone helpers de permisos en `src/auth/permissions.ts` para
preparar controles futuros sin ocultar modulos agresivamente todavia. Tambien
normaliza valores historicos: `owner` y `admin` pasan a `clinic_admin`,
`dentist` pasa a `doctor` y `reception` pasa a `receptionist`.

La migracion `009_profiles_roles.sql` aplica la normalizacion legacy anterior.
La migracion `010_profiles_email_and_user_management.sql` agrega `email`,
`is_active`, `invited_at`, `activated_at`, indices de soporte y una policy para
que un usuario autenticado pueda leer perfiles del mismo consultorio sin ver
usuarios de otros consultorios. La migracion
`011_memberships_plans_architecture.sql` separa el nuevo modelo:
`profiles` queda como identidad personal y `clinic_memberships` guarda rol,
estado y pertenencia al consultorio. `profiles.clinic_id` y `profiles.role`
siguen vivos como legacy para no romper el MVP actual, pero Auth ya prioriza la
membership activa. Si no existe ninguna, usa el perfil como fallback temporal.
El plan de sesión sale de `clinic_subscriptions.plan_id`, no de un valor Basic
hardcodeado.

La app aplica una matriz frontend única para navegación, acciones rápidas,
protección de vistas y carga de datos. Owner y admin conservan operación y
configuración; doctor no accede a Usuarios, WhatsApp ni configuración sensible;
Recepción no accede a historial ni odontograma. Usuarios requiere Medium/Pro y
WhatsApp automático requiere Pro. Planes desconocidos no habilitan capacidades
premium.

## Historial clinico persistente

La migracion `017_clinical_records.sql` crea `clinical_records` con UUID,
clinica, paciente, autor, fecha clinica, motivo, diagnostico, tratamiento,
observaciones y timestamps. Los indices por clinica/paciente y fecha sostienen
el detalle y la vista global.

RLS usa `clinic_memberships`, no `profiles.role`. Owner, admin y doctor con
membership activa pueden leer y crear; receptionist, platform_admin sin
membership clinica autorizada y usuarios inactivos no reciben filas. La policy
de escritura valida que el paciente pertenezca a la misma clinica, fija
`created_by = auth.uid()` y un trigger hace inmutables clinica, paciente y
autor. El frontend usa la anon key con RLS; no usa `service_role`.

`src/services/clinicalRecordsService.ts` carga registros reales en modo
Supabase. Los mocks quedan reservados al modo demo. El formulario normaliza los
cuatro textos y solo muestra exito despues del insert confirmado.

## Odontograma persistente

La migracion `018_odontogram_entries.sql` crea `odontogram_entries` para el
odontograma adulto FDI. Cada fila pertenece a una clinica, un paciente, una
pieza y una superficie opcional. La unicidad `NULLS NOT DISTINCT` permite un
upsert estable de la pieza completa cuando `surface` es null.

RLS autoriza solo memberships activas `clinic_owner`, `clinic_admin` y
`doctor`, y comprueba que el paciente pertenezca a la misma clinica.
`receptionist`, platform admin puro y memberships inactivas no pueden leer ni
escribir. El frontend consulta por `clinic_id + patient_id`, usa anon key y
reserva los mocks para modo demo.

## Gestión de usuarios del consultorio

Configuracion incluia una seccion basica de "Usuarios del consultorio". Mientras
se completa la nueva arquitectura de memberships, planes e invitaciones, esa
gestion queda oculta para plan Basic y la creacion/invitacion desde la UI actual
queda pausada.

En modo real, el flujo legacy podia leer `profiles` filtrado por `clinic_id` del
consultorio actual y mostrar datos no secretos: nombre completo, email, rol,
fecha de creacion y estado. Ese flujo no se elimina todavia, pero la fuente de
permisos clínicos ya es la membership activa y el plan real del consultorio. La
selección explícita entre varios consultorios queda pendiente.

El frontend no crea usuarios directamente con la anon key y nunca usa
`service_role`. El flujo real es `invite-clinic-member`: resuelve la membership
activa con el JWT, exige owner/admin, verifica la suscripción y el límite del
plan y recién entonces usa `service_role`. `create-clinic-user` queda como
referencia legacy/deprecated y ya no es invocada por React.

Medium admite hasta 4 miembros y Pro hasta 10. Cuentan los estados `active`,
`pending` y `pending_activation`; `inactive` no consume cupo. Solo pueden
invitarse `clinic_admin`, `doctor` y `receptionist`. Un email ya vinculado al
mismo consultorio produce `409`; una cuenta existente de otro consultorio puede
recibir una membership adicional sin sobrescribir su perfil ni su bandera de
plataforma.

Las cuentas nuevas se crean con `inviteUserByEmail` y redirección a
`/activar-cuenta`. La migración `015_generalize_member_activation.sql` permite
que `complete-account-activation` active cualquier membership pendiente del
usuario; la activación del estado del consultorio continúa reservada al owner.

No se guardan contrasenas en frontend, base de datos ni repositorio. Las claves
secretas necesarias para Admin API pertenecen al entorno seguro de Supabase
Functions. En modo demo, la seccion usa usuarios mock en memoria para mantener
el desarrollo fluido sin configurar credenciales reales.

## Creación segura de usuarios

La creación/invitación usa memberships, planes y límites reales. En Basic no se
muestra gestión de usuarios: el doctor dueño puede operar pacientes, citas,
agenda, configuración y recordatorios sin equipo adicional.

El frontend invoca `invite-clinic-member` con la sesión actual y solo envía
nombre, email y rol de invitación; nunca envía contraseñas, tokens,
`service_role`, un `clinic_id` confiado ni roles de plataforma.

La Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` desde Supabase Secrets después
de validar JWT, membership activa, rol `clinic_owner`/`clinic_admin`, plan con
`can_manage_team` y `max_users`. Una cuenta nueva queda en membership
`pending_activation`; una cuenta existente confirmada puede quedar `active`.
La migración `016_atomic_clinic_member_invitation.sql` serializa las altas por
consultorio y vuelve a comprobar plan, duplicado y cupo dentro de la misma
transacción para evitar exceder el límite con invitaciones concurrentes.

La invitacion redirige a `/activar-cuenta`, donde el usuario invitado define su
contrasena con `supabase.auth.updateUser({ password })`. Esa pantalla es
publica dentro del frontend y tiene prioridad sobre el flujo normal de Auth
para evitar enviar al usuario al dashboard antes de terminar su contrasena. Al
activarse, la app llama a `complete-account-activation`, que marca el perfil y
sus memberships pendientes, y luego cierra la sesión temporal para volver al
login.

La URL base del frontend puede definirse con `VITE_APP_URL`, por ejemplo
`http://localhost:5173` en desarrollo local. En Supabase Auth tambien debe
permitirse esa URL de redireccion. En produccion, la Edge Function puede recibir
una URL publica equivalente mediante secrets de entorno del backend si no se
desea depender del `Origin` de la solicitud.

Para que las Edge Functions puedan leer identidad y memberships, las migraciones
otorgan al rol `service_role` permisos sobre tablas necesarias. Estos permisos
son solo para backend/Edge Functions y no se exponen al frontend.

El formulario del consultorio no permite crear `super_admin`. Los roles
permitidos son `clinic_admin`, `doctor` y `receptionist`. Si el email ya existe,
si faltan datos o si el solicitante no tiene permiso, la funcion devuelve
codigos seguros que el frontend convierte en mensajes amables.

Para perfiles existentes sin `profiles.email`, hay dos caminos seguros:
completar el email con una actualizacion SQL puntual durante el setup, o dejar
que la Edge Function sincronice el email del administrador solicitante cuando
Auth lo tenga disponible. El frontend no lee `auth.users` ni usa Admin API.

Esta etapa no implementa invitaciones completas, edicion de usuarios,
desactivacion ni roles granulares por modulo. El caso de un solo doctor dueño
sigue siendo valido y no requiere agregar usuarios. Mas detalle vive en
`docs/auth-architecture.md`.

## Listado de consultorios de plataforma

La Edge Function `list-platform-clinics` implementa la primera lectura real de
`Administración DayIA`. Valida el JWT y exige
`profiles.is_platform_admin = true`; solo entonces usa `service_role` dentro de
la Function para leer `clinics`, `clinic_subscriptions`, `plans`,
`clinic_memberships` y los perfiles de propietarios activos.

El contrato no incluye información clínica. Devuelve nombre, estado y fecha del
consultorio, plan y suscripción, propietario, email y cantidad de miembros
activos. La migración `012_clinics_status.sql` agrega el estado administrativo
nullable. Las filas legacy usan suscripción activa como fallback a `active` y
en otro caso quedan `pending_activation`, sin inferir nada desde pacientes,
citas u otra actividad.

`create-platform-clinic` ejecuta el alta administrativa cuando el feature flag
del servidor lo permite. Valida primero JWT y
`profiles.is_platform_admin` con el cliente del solicitante; luego exige que
`DAYIA_PLATFORM_CREATE_ENABLED` sea exactamente `true` y recién entonces usa
`service_role`.

La Function solo escribe `clinics`, `profiles` cuando debe preparar un owner,
`clinic_memberships` y `clinic_subscriptions`. No crea tratamientos, pacientes,
citas ni otros datos clínicos. Usa invitación de Supabase Auth sin contraseña
manual y compensa altas parciales eliminando el consultorio y, cuando
corresponde, el usuario Auth recién creado.

La migración `013_platform_clinic_creation.sql` admite
`pending_activation` en membresías y agrega unicidad por nombre normalizado.
La habilitación o deshabilitación se administra solo mediante el secret de la
Function; React no mantiene una copia de esa decisión.

## Migración de Pacientes

Pacientes es el primer modulo conectado a Supabase en modo real. Despues del
login real, la app carga pacientes desde `patients` filtrando siempre por
`clinic_id` del consultorio actual. La busqueda visible sigue siendo local sobre
los pacientes cargados.

En modo demo/desarrollo, Pacientes no llama a Supabase: usa los datos mock
locales y las altas nuevas viven solo en memoria. No se mezclan pacientes mock
con pacientes reales y no se crean pacientes demo en la base de datos.

Al registrar un paciente, el formulario mantiene las validaciones actuales,
normaliza nombre y apellido, conserva el prefijo telefonico y crea el registro
en Supabase asociado al `clinic_id`. Si la operacion falla, no se crea un
paciente local falso.

La forma de datos de frontend sigue siendo compatible con `Patient`, pero los
pacientes reales usan UUID como `id`. Las citas, historial clinico, odontograma
y recordatorios no se migran todavia. En esta etapa pueden seguir usando datos
mock/locales y fallbacks por nombre cuando corresponda.

Las policies de `002_auth_profiles_policies.sql` ya permiten que un usuario
autenticado gestione solo pacientes de su consultorio. La migracion
`004_patients_indexes.sql` agrega el indice `patients(clinic_id, last_name)` y
documenta el contrato de Pacientes como tabla filtrada por consultorio. La app
tambien filtra por `clinic_id` desde el frontend, pero la separacion de datos
depende de RLS.

## Migración de Citas

Citas/Agenda consume Supabase en modo real y conserva datos mock/locales en modo
demo. El modo real se activa solo cuando Supabase esta configurado, la app no
esta en modo demo y existe `currentClinic.id`.

En modo real, las citas se cargan desde `appointments` filtrando siempre por
`clinic_id` del consultorio actual. Las operaciones de crear, confirmar,
cancelar y reprogramar actualizan Supabase y registran eventos en
`appointment_change_logs`, tambien filtrados por `clinic_id`.

La migracion `019_appointment_resolution_statuses.sql` amplia el constraint de
`appointments.status` con `completed` y `no_show`. Ambos son terminales: no
bloquean disponibilidad, no aparecen como proximas citas y no generan
recordatorios activos. Cada cierre registra un evento homonimo en
`appointment_change_logs` para actividad reciente.

La migracion `019` debe aplicarse antes de usar Resolver cita pasada contra
Supabase. Si el constraint remoto aun no admite el estado o RLS rechaza la
actualizacion, el frontend muestra un mensaje controlado y nunca expone el
detalle tecnico devuelto por Postgres.

El frontend conserva su forma actual de datos:

- `patientId` usa el UUID real de `patients.id` en modo Supabase y numeros en
  modo demo.
- `date` se guarda como `appointment_date`.
- `time` se guarda como `start_time`.
- `durationMinutes` se guarda como `duration_minutes`.
- `treatment` se guarda temporalmente en `appointments.reason`.
- `treatment_id` permanece `null` hasta migrar Tratamientos.

Las reglas existentes de Agenda se mantienen en frontend: disponibilidad por
duracion, validacion contra horarios del consultorio, excepciones del
calendario, bloqueo de solapamientos, bloqueo de doble cita activa del mismo
paciente en el mismo dia, citas canceladas que no bloquean horario y restriccion
para no reprogramar citas canceladas.

Recordatorios puede resolver una cita pasada sin cierre reutilizando estos
servicios. Completar, marcar no asistencia o cancelar cambia el estado de la
cita y cancela solo recordatorios `pending/scheduled`. Reprogramar exige nueva
fecha, hora y motivo, conserva los `skipped` como historico y crea la cola de la
nueva ocurrencia.

La reprogramacion desde Recordatorios reutiliza
`getAvailableTimeOptionsByDuration`, igual que Nueva cita. El selector respeta
horarios del consultorio, excepciones, duracion del tratamiento, solapamientos
y horas pasadas, e ignora solo la cita que se esta reprogramando.

En modo demo/desarrollo, Citas no llama a Supabase: usa `initialAppointments` y
las altas/cambios viven solo en memoria. No se mezclan citas mock con citas
reales.

Recordatorios, Historial clinico y Detalle de paciente consumen la lista de
citas cargada en App. Por eso en modo real ven citas reales cargadas desde
Supabase, mientras que en modo demo siguen viendo las citas mock.

Las policies de `002_auth_profiles_policies.sql` ya cubren `appointments` y
`appointment_change_logs` con separacion por consultorio. La migracion
`005_appointments_indexes.sql` agrega el indice
`appointment_change_logs(clinic_id, appointment_id)` para consultar el historial
de cambios por cita y documenta que `reason` es el campo temporal para el
tratamiento visible hasta migrar Tratamientos.

## Migración de Configuración

Configuracion consume Supabase en modo real para los datos que afectan Agenda y
disponibilidad: tratamientos, horarios del consultorio y excepciones del
calendario. En modo demo/desarrollo conserva los datos mock/locales y los
cambios viven solo en memoria.

En modo real, la app carga:

- `treatments` filtrando siempre por `clinic_id`.
- `business_hours` filtrando por `clinic_id` y ordenando por `weekday`.
- `calendar_exceptions` filtrando por `clinic_id` y ordenando por `date`.

Los tratamientos reales mantienen la forma de frontend `Treatment`, pero usan
UUID como `id`. El mapeo principal es `durationMinutes` hacia
`duration_minutes` e `isActive` hacia `is_active`. Crear, editar, activar y
desactivar tratamientos escribe en Supabase asociado al consultorio actual.

Los horarios reales guardan `weekday`, `is_open`, `start_time`, `end_time` y
`slot_interval_minutes`. La app guarda los 7 dias mediante upsert por
`clinic_id, weekday`. Si un consultorio real todavia no tiene horarios, la app
no crea mocks en la base: muestra una configuracion cerrada editable y avisa que
hay que configurar horarios para generar citas.

Las excepciones reales guardan `date`, `type`, `start_time`, `end_time`,
`reason` y `reason_detail`. El indice unico `calendar_exceptions(clinic_id,
date)` evita duplicados por fecha dentro del mismo consultorio. La eliminacion
de excepciones tambien filtra por `clinic_id`.

Nueva Cita y Reprogramar no cambian sus reglas: consumen los tratamientos,
horarios y excepciones desde el estado central de App. Por eso usan datos reales
en modo Supabase y datos mock en modo demo. Siguen vigentes la disponibilidad
por duracion, excepciones cerradas, horarios especiales, solapamientos por rango
horario y la restriccion de una cita activa por paciente/dia.

Las policies de `002_auth_profiles_policies.sql` ya cubren `treatments`,
`business_hours` y `calendar_exceptions` para usuarios autenticados del mismo
consultorio. La migracion `006_settings_indexes.sql` agrega el unique faltante
`business_hours(clinic_id, weekday)` y documenta el contrato de Configuracion.

## Migración de Recordatorios

Recordatorios consume Supabase en modo real y conserva la generacion mock/local
en modo demo. En modo real, la app carga la cola desde `reminders` filtrando
siempre por `clinic_id`, y en modo demo la vista sigue calculando recordatorios
desde las citas y pacientes en memoria.

La generacion mantiene las reglas actuales:

- No genera recordatorios para citas canceladas.
- Genera recordatorios para citas pendientes, confirmadas y reprogramadas.
- Usa recordatorios de 24h y 2h cuando aplican.
- Usa recordatorio inmediato cuando la cita esta demasiado cerca.
- Si no hay telefono valido, el recordatorio queda como `skipped`.

Cuando se crea una cita real, la app crea sus recordatorios en Supabase. Cuando
se confirma una cita, actualiza/reemplaza los recordatorios pendientes para que
el mensaje refleje el estado confirmado. Cuando se reprograma una cita, cancela
recordatorios pendientes/programados anteriores y crea una nueva cola para la
fecha/hora vigente. Cuando se cancela una cita, no borra registros: marca como
`cancelled` los recordatorios pendientes/programados de esa cita.

Antes de listar la cola real, el frontend reconcilia los estados mutables. Un
recordatorio `pending` o `scheduled` cuya fecha y hora de cita ya paso cambia a
`skipped`, con `metadata.reason = 'appointment_passed'`; si la cita esta
cancelada cambia a `cancelled`. La comparacion se hace con fecha y hora completas
en `America/La_Paz`: `scheduled_at` indica cuando corresponde intentar el
recordatorio, pero no determina por si solo que la cita haya vencido.

Los estados reales de la cola son `pending`, `scheduled`, `sent`, `failed`,
`cancelled` y `skipped`. Marcar enviado actualiza `status = 'sent'` y
`sent_at = now()` en Supabase. Marcar fallido actualiza `status = 'failed'` y
`failed_reason` con un motivo manual. `pending` todavia espera su ventana,
`scheduled` esta programado, `sent` fue enviado, `failed` registra un intento
fallido, `cancelled` deja de aplicar por cancelacion y `skipped` representa un
recordatorio omitido sin intento, por ejemplo porque la cita ya paso.

`process-due-reminders` repite esta validacion antes de preparar cada entrega:
no intenta enviar citas pasadas ni canceladas y persiste `skipped` o
`cancelled`. `send-whatsapp-reminder` aplica la misma defensa para las llamadas
directas. La reconciliacion de React usa la sesion y RLS; no expone
`service_role` en frontend.

Cuando un recordatorio cambia a `skipped` por cita pasada, `metadata` conserva
fecha, hora y estado de la ocurrencia original. Esa instantanea evita que un
omitido historico adopte la fecha nueva si la cita se reprograma despues.

El boton "Abrir WhatsApp" usa un enlace manual `https://wa.me/...` con telefono
normalizado y mensaje precargado. Esto no es envio automatico ni WhatsApp API:
solo prepara el flujo manual para validar el MVP antes de incorporar backend de
mensajeria. Despues de abrir el enlace, el operador registra por separado si el
recordatorio fue enviado o fallo. La interfaz evita dobles actualizaciones y no
ofrece estas acciones para estados `skipped` o `cancelled`.

El resumen visual cuenta Todos, Pendientes, Programados, Enviados, Fallidos,
Omitidos y Cancelados sin mezclar estados terminales con pendientes. Basic y
Medium identifican el flujo como `Modo manual`; Pro puede indicar `Automatico
pendiente de configuracion`, pero esa etiqueta no habilita entrega automatica.

Las policies de `002_auth_profiles_policies.sql` ya cubren `reminders` para
usuarios autenticados del mismo consultorio. La migracion
`007_reminders_indexes.sql` agrega `reminder_type`, indices por
`clinic_id/appointment_id` y `clinic_id/status`, y evita duplicados activos por
consultorio, cita y tipo.

WhatsApp API automatica todavia no esta implementada. El siguiente paso de
backend debera usar Edge Functions, jobs programados, webhooks de estado y
configuracion propia de WhatsApp por consultorio. Ningun token o secreto debe
vivir en frontend.

El siguiente paso recomendado es preparar WhatsApp API real con backend seguro.

## Recuperación temporal del administrador principal

Si el administrador inicial quedo con un correo inventado y no puede iniciar
sesion ni recibir recuperacion de contrasena, existe una Edge Function temporal:
`migrate-owner-email`.

Esta funcion no crea ni borra usuarios. Usa un UID fijo de rescate
(`87f2b938-f6ea-4564-a3f3-8e7233fc6184`) y un email destino fijo
(`pereezcharles@gmail.com`) para actualizar ese mismo usuario de Auth mediante
Admin API dentro de Supabase Functions. Despues actualiza `profiles.email` del
mismo `id`. No recibe `userId` ni email desde el frontend, no cambia `role`,
`clinic_id`, `is_active` ni datos clinicos, y no usa SQL directo sobre
`auth.users`.

Como el usuario puede no poder iniciar sesion, la funcion tambien acepta un
header temporal `x-owner-migration-token`. Ese token debe configurarse como
secret en Supabase Functions (`OWNER_EMAIL_MIGRATION_TOKEN`), no en frontend ni
en el repositorio.

Uso previsto:

1. Crear un token temporal largo y configurarlo como secret:
   `supabase secrets set OWNER_EMAIL_MIGRATION_TOKEN=valor-largo-temporal`.
2. Desplegar `migrate-owner-email`.
3. Ejecutar una sola llamada `POST` a la Function con el header
   `x-owner-migration-token`.
4. Verificar en Supabase Auth que el mismo UID ahora tenga
   `pereezcharles@gmail.com`. Si el correo sigue como `charles@test.com`, la
   Function no fue desplegada, no se ejecuto o fallo.
5. En Login, usar "¿Olvidaste tu contraseña?" con `pereezcharles@gmail.com`.
6. Abrir el enlace recibido y definir la nueva contrasena en `/activar-cuenta`.

Supabase puede responder exito al solicitar recuperacion aunque el correo no
exista, para evitar enumeracion de usuarios. Por eso la recuperacion solo
llegara despues de que `migrate-owner-email` haya cambiado realmente el correo
del usuario en Supabase Auth.

Despues de completar la recuperacion, la funcion temporal debe eliminarse,
deshabilitarse o dejar de desplegarse, y el secret temporal debe retirarse, para
que no forme parte del flujo normal del MVP. Esta herramienta es solo para
rescatar el primer administrador sin perder el UID vinculado al consultorio.

## WhatsApp real

WhatsApp real no debe implementarse desde el frontend. Cada consultorio tendra
su propia configuracion en `whatsapp_settings`, pero tokens y secretos deberan
guardarse de forma protegida en backend/Edge Functions.

La arquitectura preparada usa:

- `whatsapp_settings` para datos no secretos por consultorio: proveedor, numero,
  `phone_number_id`, `business_account_id` e indicador `is_connected`.
- Supabase Secrets para valores sensibles: `WHATSAPP_ACCESS_TOKEN`,
  `WHATSAPP_SEND_ENABLED` y `WHATSAPP_VERIFY_TOKEN`.
- Edge Function `send-whatsapp-reminder` para preparar un envio por
  `reminderId`.
- Edge Function `process-due-reminders` para el futuro job programado.
- Edge Function `whatsapp-webhook` para verificacion y estados futuros.
- Edge Function `invite-clinic-member` para listar e invitar miembros sin
  exponer `service_role` en frontend. `create-clinic-user` queda deprecated.

Por defecto, las funciones deben operar en modo dry-run. El envio real solo
podra activarse explicitamente con `WHATSAPP_SEND_ENABLED=true` desde backend.
No hay tokens ni service role key en frontend.

La migracion `008_whatsapp_settings_and_delivery.sql` agrega metadatos de
entrega a `reminders`: `provider_message_id`, `delivered_at`, `read_at` y
`metadata`. Estos campos preparan webhooks futuros sin cambiar la UI actual.

El boton manual "Abrir WhatsApp" sigue siendo el fallback operativo: abre
`wa.me` con telefono normalizado y mensaje precargado, sin usar WhatsApp API.

Las fases futuras deben incluir:

- Conexion del numero propio del consultorio.
- Edge Function para envio de mensajes.
- Webhooks para estados de entrega y respuestas.
- Politicas de seguridad para que un consultorio no vea datos de otro.
- Auditoria de intentos de envio.

Mas detalle vive en `docs/whatsapp-plan.md`.

## Estado actual

La preparacion actual agrega:

- Variables de entorno de ejemplo en `.env.example`.
- Cliente Supabase seguro en `src/lib/supabaseClient.ts`.
- Capa Auth en `src/auth` para login, sesion, perfil y consultorio actual.
- Sesion visible, cierre de sesion y helpers de permisos por rol MVP.
- Modo demo/desarrollo cuando faltan variables de Supabase.
- Tipos backend base en `src/types/database.ts`.
- Servicios reales de Pacientes, Citas, Historial clinico, Configuracion y Recordatorios, con
  placeholders pendientes para otros modulos en `src/services`.
- Gestión de usuarios del consultorio en Configuración basada en memberships,
  roles permitidos, estados de activación y límites reales Medium/Pro.
- SQL inicial y policies Auth en `supabase/migrations`.

Pacientes, Citas, Historial clinico, Odontograma, Configuracion y Recordatorios consumen Supabase en modo real
y conservan mocks en modo demo. Dashboard, Nueva Cita, Agenda, Detalle de
paciente y Recordatorios leen esos datos desde el estado central de App.
Odontograma carga y guarda por paciente mediante `odontogram_entries`.

El Dashboard no consulta tablas directamente. `App.tsx` carga pacientes,
citas y `appointment_change_logs` mediante servicios que aplican
`eq('clinic_id', currentClinic.id)` antes de entregar los datos a la vista. Los
KPIs diarios usan la fecha local del navegador; los movimientos mensuales
priorizan el timestamp real del log y recurren al estado de la cita solo cuando
no existe historial de ese tipo. La actividad de pacientes no incluye altas
porque el modelo `Patient` todavía no expone `created_at`.

## Setup real

La guia para probar el MVP con un proyecto Supabase real vive en
`docs/supabase-setup.md`. Incluye pasos para crear `.env`, ejecutar
migraciones, crear usuario en Supabase Auth, vincular el perfil con un
consultorio inicial mediante `supabase/seed/001_initial_clinic_seed.sql` y
validar Pacientes, Citas, Configuracion, Recordatorios y WhatsApp dry-run.

El seed es una plantilla comentada con placeholders. No contiene contrasenas,
tokens, `service_role` ni datos reales.

## Validaciones operativas de Pacientes y Citas

El frontend normaliza nombre, apellido, teléfono y email antes de crear o
actualizar un paciente. La lista cargada del consultorio se usa para rechazar
duplicados activos por teléfono y email, excluyendo al propio registro durante
la edición. Supabase continúa siendo la fuente real y todas las operaciones
permanecen limitadas por `clinic_id` y RLS.

`updatePatient` actualiza únicamente datos personales mediante filtros por
`clinic_id` e ID. El frontend no usa `service_role`. El prefijo telefónico puede
seleccionarse de una lista frecuente o escribirse manualmente; por ahora se
aplica validación estructural básica sin `libphonenumber-js`.

La creación y reprogramación de citas reutiliza las validaciones de fecha,
horario efectivo, excepciones, duración, solapamiento y cita activa del mismo
paciente. Las canceladas no bloquean disponibilidad. No se introdujeron nuevas
tablas, migraciones, Functions ni credenciales frontend para este pulido.

## Estado de calidad del MVP

El frontend real inicia pacientes, citas y configuración sin datos mock. Los
datos demo solo se cargan cuando faltan las variables de Supabase y
`isDemoMode` está activo. Los formularios dependientes de horarios esperan la
configuración real antes de habilitarse.

Los servicios clínicos filtran por `clinic_id` y las cargas sensibles se
detienen antes de llamar al servicio cuando el rol carece de permiso. Se
mantienen como pendientes la selección multi-consultorio, la migración completa
de policies legacy y la medición de Core Web Vitals en dispositivos reales.
