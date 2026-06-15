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

## Migracion por modulos

La app seguira usando datos mock/locales en esta etapa. La migracion recomendada
es gradual:

1. Auth y perfiles de usuario por consultorio.
2. Configuracion: tratamientos, horarios y excepciones.
3. Pacientes.
4. Citas y logs de cambios.
5. Recordatorios generados desde citas reales.
6. WhatsApp real mediante Edge Functions y webhooks.

Este orden reduce riesgo porque primero estabiliza el contexto del consultorio y
la configuracion que despues consume Agenda.

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

Esta etapa prepara la migracion por `clinic_id`, pero Dashboard, Pacientes,
Citas, Configuracion, Recordatorios, Historial clinico y Odontograma siguen
usando datos mock/locales despues del login.

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

## WhatsApp real

WhatsApp real no debe implementarse desde el frontend. Cada consultorio tendra
su propia configuracion en `whatsapp_settings`, pero tokens y secretos deberan
guardarse de forma protegida en backend/Edge Functions.

Las fases futuras deben incluir:

- Conexion del numero propio del consultorio.
- Edge Function para envio de mensajes.
- Webhooks para estados de entrega y respuestas.
- Politicas de seguridad para que un consultorio no vea datos de otro.
- Auditoria de intentos de envio.

## Estado actual

La preparacion actual agrega:

- Variables de entorno de ejemplo en `.env.example`.
- Cliente Supabase seguro en `src/lib/supabaseClient.ts`.
- Capa Auth en `src/auth` para login, sesion, perfil y consultorio actual.
- Tipos backend base en `src/types/database.ts`.
- Servicios placeholder en `src/services`.
- SQL inicial y policies Auth en `supabase/migrations`.

Ninguna vista consume Supabase todavia. Dashboard, Pacientes, Citas,
Configuracion, Recordatorios, Historial clinico y Odontograma siguen usando el
estado local/mock actual.
