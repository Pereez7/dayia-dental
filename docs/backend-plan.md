# Backend Plan

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

## Migracion por modulos

La app conserva modo demo con datos mock/locales cuando Supabase no esta
configurado. En modo real, los modulos se migraran gradualmente:

1. Auth y perfiles de usuario por consultorio.
2. Pacientes.
3. Citas y logs de cambios.
4. Configuracion: tratamientos, horarios y excepciones.
5. Recordatorios generados desde citas reales.
6. WhatsApp real mediante Edge Functions y webhooks.

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

Esta etapa prepara la migracion por `clinic_id`. En modo real, Pacientes y
Citas ya pueden leer y crear/actualizar registros en Supabase; Configuracion,
Recordatorios, Historial clinico y Odontograma siguen usando datos mock/locales.

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
siguen vivos como legacy para no romper el MVP actual.

## Gestión de usuarios del consultorio

Configuracion incluia una seccion basica de "Usuarios del consultorio". Mientras
se completa la nueva arquitectura de memberships, planes e invitaciones, esa
gestion queda oculta para plan Basic y la creacion/invitacion desde la UI actual
queda pausada.

En modo real, el flujo legacy podia leer `profiles` filtrado por `clinic_id` del
consultorio actual y mostrar datos no secretos: nombre completo, email, rol,
fecha de creacion y estado. Ese flujo no se elimina todavia, pero la nueva
fuente de permisos para equipo sera `clinic_memberships` y el plan activo del
consultorio.

El frontend no debe crear usuarios directamente con la anon key y nunca usa
`service_role`. La Function legacy `create-clinic-user` queda como referencia
transitoria, pero el siguiente flujo real debe ser `invite-clinic-member`, usando
`clinic_memberships`, plan activo, limites de usuarios e invitacion segura.

No se guardan contrasenas en frontend, base de datos ni repositorio. Las claves
secretas necesarias para Admin API pertenecen al entorno seguro de Supabase
Functions. En modo demo, la seccion usa usuarios mock en memoria para mantener
el desarrollo fluido sin configurar credenciales reales.

## Creación segura de usuarios

La creacion/invitacion de usuarios desde la UI actual queda pausada hasta que el
flujo nuevo use memberships, planes y limites de usuarios. En plan Basic no se
muestra gestion de usuarios: el doctor dueño puede operar pacientes, citas,
agenda, configuracion y recordatorios sin equipo adicional.

La Function futura recomendada es `invite-clinic-member`. El frontend debera
invocarla con la sesion actual y solo enviar datos de invitacion; nunca enviara
contrasenas, tokens, `service_role`, `clinic_id` confiado ni roles de plataforma.

La Edge Function debera usar `SUPABASE_SERVICE_ROLE_KEY` desde Supabase Secrets,
validar el JWT del solicitante, resolver la membresia activa, confirmar que el
rol sea `clinic_owner` o `clinic_admin`, validar que el plan permita
`can_manage_team`, respetar `max_users` y crear una membership `pending`.

La invitacion redirige a `/activar-cuenta`, donde el usuario invitado define su
contrasena con `supabase.auth.updateUser({ password })`. Esa pantalla es
publica dentro del frontend y tiene prioridad sobre el flujo normal de Auth
para evitar enviar al usuario al dashboard antes de terminar su contrasena. Al
activarse, la app intenta marcar `activated_at` en el propio perfil y luego
cierra la sesion temporal del enlace para volver al login.

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

Esta fase es solo lectura. La creación, edición y eliminación de consultorios
siguen pendientes y deshabilitadas; no existe `create-platform-clinic`.

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

Los estados reales de la cola son `pending`, `scheduled`, `sent`, `failed`,
`cancelled` y `skipped`. Marcar enviado actualiza `status = 'sent'` y
`sent_at = now()` en Supabase. Marcar fallido actualiza `status = 'failed'` y
`failed_reason` con un motivo manual.

El boton "Abrir WhatsApp" usa un enlace manual `https://wa.me/...` con telefono
normalizado y mensaje precargado. Esto no es envio automatico ni WhatsApp API:
solo prepara el flujo manual para validar el MVP antes de incorporar backend de
mensajeria.

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
- Edge Function `create-clinic-user` para crear usuarios del consultorio sin
  exponer `service_role` en frontend.

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
- Servicios reales de Pacientes, Citas, Configuracion y Recordatorios, con
  placeholders pendientes para otros modulos en `src/services`.
- Gestion basica de usuarios del consultorio en Configuracion, con lectura de
  perfiles del mismo consultorio y Edge Function preparada para altas seguras.
- SQL inicial y policies Auth en `supabase/migrations`.

Pacientes, Citas, Configuracion y Recordatorios consumen Supabase en modo real
y conservan mocks en modo demo. Dashboard, Nueva Cita, Agenda, Detalle de
paciente y Recordatorios leen esos datos desde el estado central de App.
Historial clinico y Odontograma siguen usando estado local/mock actual.

## Setup real

La guia para probar el MVP con un proyecto Supabase real vive en
`docs/supabase-setup.md`. Incluye pasos para crear `.env`, ejecutar
migraciones, crear usuario en Supabase Auth, vincular el perfil con un
consultorio inicial mediante `supabase/seed/001_initial_clinic_seed.sql` y
validar Pacientes, Citas, Configuracion, Recordatorios y WhatsApp dry-run.

El seed es una plantilla comentada con placeholders. No contiene contrasenas,
tokens, `service_role` ni datos reales.
