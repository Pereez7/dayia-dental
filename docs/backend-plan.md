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

Cuando se implemente Auth, cada usuario tendra un registro en `profiles` con su
`clinic_id`. Las policies de RLS deberan permitir leer o escribir solo los datos
del consultorio del usuario autenticado.

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
- Tipos backend base en `src/types/database.ts`.
- Servicios placeholder en `src/services`.
- SQL inicial en `supabase/migrations`.

Ninguna vista consume Supabase todavia. Dashboard, Pacientes, Citas,
Configuracion, Recordatorios, Historial clinico y Odontograma siguen usando el
estado local/mock actual.
