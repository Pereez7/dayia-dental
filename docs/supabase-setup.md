# Supabase Setup

## Billing manual

Ejecuta `supabase/migrations/020_manual_billing_subscriptions.sql`, configura
`plans.monthly_price` y coloca los QR en `public/payment-qr/`. Despliega:

```bash
npx supabase functions deploy create-platform-clinic
npx supabase functions deploy list-platform-clinics
npx supabase functions deploy register-subscription-payment
npx supabase functions deploy update-clinic-subscription
```

`SUPABASE_SERVICE_ROLE_KEY` permanece únicamente en secrets de Supabase y nunca
debe copiarse a variables `VITE_*`.

Esta guia prepara DayIA Dental para probar el MVP con datos reales en Supabase.
No reemplaza el modo demo: si faltan variables `.env`, la app sigue entrando en
modo demo/desarrollo.

## 1. Crear proyecto Supabase

1. Crea un proyecto en Supabase.
2. En Project Settings > API copia:
   - `Project URL`
   - `anon public key`
3. Crea un archivo `.env` local en la raiz del proyecto:

```env
VITE_SUPABASE_URL=REEMPLAZAR_CON_PROJECT_URL
VITE_SUPABASE_ANON_KEY=REEMPLAZAR_CON_ANON_KEY
VITE_APP_URL=http://localhost:5173
VITE_ENABLE_DEMO_MODE=false
```

4. Reinicia Vite despues de crear o cambiar `.env`:

```bash
npm run dev
```

`VITE_SUPABASE_ANON_KEY` puede existir en frontend porque trabaja junto con RLS.
Nunca pongas `service_role` en frontend. Los tokens de WhatsApp tampoco van en
React ni en variables `VITE_`.

## 2. Ejecutar migraciones

Ejecuta en Supabase SQL Editor, en orden, los archivos de
`supabase/migrations`:

1. `001_initial_mvp_schema.sql`
2. `002_auth_profiles_policies.sql`
3. `003_initial_clinic_setup_template.sql` solo como referencia, no automatico
4. `004_patients_indexes.sql`
5. `005_appointments_indexes.sql`
6. `006_settings_indexes.sql`
7. `007_reminders_indexes.sql`
8. `008_whatsapp_settings_and_delivery.sql`
9. `009_profiles_roles.sql`
10. `010_profiles_email_and_user_management.sql`
11. `011_memberships_plans_architecture.sql`
12. `012_clinics_status.sql`
13. `013_platform_clinic_creation.sql`
14. `014_complete_account_activation.sql`
15. `015_generalize_member_activation.sql`
16. `016_atomic_clinic_member_invitation.sql`
17. `017_clinical_records.sql`
18. `018_odontogram_entries.sql`
19. `019_appointment_resolution_statuses.sql`

Si usas Supabase CLI en el futuro, puedes adaptar este flujo a `supabase db
push`, pero esta guia asume SQL Editor para una primera prueba controlada.

### Inventario de preproducción

Antes de una demo con Supabase real, confirma en el proyecto remoto que están
aplicadas las migraciones `001` a `019`. El repositorio solo contiene los
archivos; no garantiza el estado del entorno remoto. La migración `003` es una
plantilla de setup y no debe reemplazar un seed revisado.

Functions vigentes para el MVP:

```bash
npx supabase functions deploy list-platform-clinics
npx supabase functions deploy create-platform-clinic
npx supabase functions deploy invite-clinic-member
npx supabase functions deploy complete-account-activation
npx supabase functions deploy process-due-reminders
npx supabase functions deploy send-whatsapp-reminder
npx supabase functions deploy whatsapp-webhook
```

Para una demo clínica sin alta de consultorios ni pruebas de webhook basta con
desplegar las Functions que participan en el recorrido. `create-clinic-user` es
legacy/deprecated y `migrate-owner-email` es una utilidad de transición.

Secrets backend:

| Secret | Valor seguro de preproducción |
| --- | --- |
| `DAYIA_APP_URL` | URL pública sin barra final |
| `DAYIA_PLATFORM_CREATE_ENABLED` | `false` o ausente |
| `WHATSAPP_SEND_ENABLED` | `false` o ausente |
| `WHATSAPP_VERIFY_TOKEN` | Solo para verificar webhook |
| `WHATSAPP_ACCESS_TOKEN` | No necesario mientras no exista envío real |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` son variables
administradas por Supabase para Functions. No copiarlas a React salvo URL y
anon key bajo sus equivalentes `VITE_`.

WhatsApp sigue siendo manual. `send-whatsapp-reminder` prepara un resultado en
dry-run y el código actual no llama a Meta incluso si el flag cambia. Mantén el
flag en `false` y no configures tokens productivos.

En la revisión del 20 de julio de 2026, el remoto enlazado tenía activas todas
las Functions anteriores salvo `whatsapp-webhook`; también conservaba activas
`create-clinic-user` y `migrate-owner-email`. No había secrets de WhatsApp. El
secret `DAYIA_PLATFORM_CREATE_ENABLED` existía, pero la CLI solo muestra su
hash. Durante la revisión se restableció explícitamente a `false`; repite esta
verificación antes de cada demo o prueba controlada.

```bash
npx supabase secrets set DAYIA_PLATFORM_CREATE_ENABLED=false
```

### URLs de autenticación

Configura el Site URL con el origen de la app y registra:

```text
https://TU_DOMINIO/activar-cuenta
http://localhost:5173/activar-cuenta
```

`VITE_APP_URL` pertenece al frontend. `DAYIA_APP_URL` pertenece a las Edge
Functions. Ambos deben apuntar al mismo origen en cada entorno. El hosting debe
servir `index.html` también en `/activar-cuenta`.

## 3. Crear usuario real

1. En Supabase Dashboard ve a Authentication > Users.
2. Crea un usuario con email y contraseña.
3. Copia el `User UID`. Ese valor es el `auth.users.id` real.
4. No guardes contraseñas en el repositorio ni en documentos.

## 4. Crear consultorio y perfil

Usa la plantilla:

- `supabase/seed/001_initial_clinic_seed.sql`

Pasos:

1. Copia el contenido del seed al SQL Editor.
2. Reemplaza:
   - `REEMPLAZAR_CON_AUTH_USER_ID`
   - `REEMPLAZAR_CON_NOMBRE_CONSULTORIO`
   - `REEMPLAZAR_CON_TELEFONO_CONSULTORIO`
   - `REEMPLAZAR_CON_NOMBRE_USUARIO`
3. Ejecuta el bloque principal.
4. Opcionalmente ejecuta los bloques de tratamientos y horarios iniciales.

El perfil en `profiles.id` debe tener exactamente el mismo UUID que el usuario
de Supabase Auth. `profiles.clinic_id` vincula ese usuario al consultorio.

## 5. Probar login

1. Asegurate de que `.env` existe y Vite fue reiniciado.
2. Abre la app.
3. Debe aparecer la pantalla de login real.
4. Ingresa con el usuario creado en Supabase Auth.

Si el usuario no tiene perfil, la app debe mostrar:
`Tu usuario aún no está vinculado a un consultorio.`

Si el perfil no tiene consultorio, la app debe mostrar:
`Tu usuario no tiene consultorio asignado.`

## 6. Desplegar el listado de Administración DayIA

Aplica primero la migración `012_clinics_status.sql` y despliega la Function de
lectura administrativa:

```bash
npx supabase db push
npx supabase functions deploy list-platform-clinics
```

Supabase Functions proporciona `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` en el entorno del proyecto. Esta Function no
necesita un secret personalizado. La `service_role` permanece en backend y no
debe copiarse a `.env` ni a variables `VITE_`.

Para acceder, el usuario autenticado debe tener
`profiles.is_platform_admin = true`. Un usuario clínico sin esa bandera recibe
`403`, incluso si intenta invocar la Function directamente.

## 7. Preparar el alta protegida de consultorios

Aplica la migración y despliega la Function:

```bash
npx supabase db push
npx supabase functions deploy create-platform-clinic
```

Verifica los secrets sin habilitar la creación:

```bash
npx supabase secrets list
```

La condición autoritativa es
`DAYIA_PLATFORM_CREATE_ENABLED === "true"`. Cualquier otro valor, incluido un
secret ausente, responde `409` con
`La creación real de consultorios está deshabilitada.` Puede configurarse
`DAYIA_APP_URL` para el redirect de activación.

El frontend no necesita un switch equivalente. Siempre invoca la Function y
muestra el rechazo controlado cuando el secret no es `true`. Nunca agregues
`DAYIA_PLATFORM_CREATE_ENABLED` ni `SUPABASE_SERVICE_ROLE_KEY` a `.env`,
variables `VITE_` o React.

Para demo y preproducción general debe permanecer `false` o ausente. Habilítalo
solo durante una prueba controlada de alta, con un `platform_admin` específico,
y vuelve a deshabilitarlo al terminar.

## Usuarios del consultorio

Aplica la migración de activación y despliega las dos Functions involucradas:

```bash
npx supabase db push
npx supabase functions deploy invite-clinic-member
npx supabase functions deploy complete-account-activation
```

`invite-clinic-member` usa los secrets estándar `SUPABASE_URL`,
`SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. Configura además
`DAYIA_APP_URL` con la URL pública de la app, sin barra final, para que las
invitaciones redirijan a `/activar-cuenta`.

En Supabase Auth agrega como Redirect URL la ruta pública equivalente, por
ejemplo `https://app.dayia.example/activar-cuenta`. Para desarrollo agrega
`http://localhost:5173/activar-cuenta`. El enlace no se muestra en la UI: se
envía mediante `inviteUserByEmail`; para una cuenta existente no confirmada la
respuesta puede quedar `not_sent` hasta implementar reenvío de invitaciones.

Prueba con owner/admin de Medium y Pro. Basic, doctor, recepción y un usuario
sin membership activa deben recibir rechazo aunque invoquen la Function fuera
de la UI. Confirma también que una membership pendiente pasa a `active` después
de definir la contraseña en la vista de activación.

Prueba primero los rechazos sin sesión, sin `is_platform_admin` y con feature
flag deshabilitado. Cuando el secret esté habilitado, crea un consultorio sin
datos clínicos y confirma que el listado se refresque con la nueva fila.

## Checklist de prueba

### A. Auth

- Login funciona con usuario real.
- Usuario sin perfil muestra mensaje claro.
- Usuario sin consultorio muestra mensaje claro.
- Cerrar sesion vuelve al login.

### B. Pacientes

- Crear paciente.
- Listar pacientes.
- Buscar paciente.
- Ver detalle del paciente.

### C. Citas

- Crear cita.
- Confirmar cita.
- Cancelar cita.
- Reprogramar cita.
- Validar que una cita cancelada no bloquea horario.
- Validar solapamientos por rango horario.
- Validar duracion del tratamiento.
- Validar horario de cierre.

### D. Configuracion

- Crear tratamiento.
- Editar duracion.
- Desactivar tratamiento.
- Guardar horarios.
- Crear excepcion del calendario.
- Eliminar excepcion del calendario.
- Guardar configuracion no secreta de WhatsApp.
- Listar únicamente memberships del consultorio activo.
- Invitar un usuario y verificar `pending_activation`.
- Bloquear la invitación al llegar a 4 miembros en Medium o 10 en Pro.

### E. Historial clinico

- Aplicar `017_clinical_records.sql` o ejecutar `npx supabase db push`.
- Ingresar como owner, admin y doctor y crear un registro desde el paciente.
- Recargar la app y confirmar que el registro continua visible.
- Confirmar que la vista global carga solo registros de la clinica activa.
- Ingresar como recepcion y confirmar que no aparece Historial clinico ni se
  ejecuta su consulta.
- Confirmar que un platform admin puro no puede consultar `clinical_records`.
- Intentar asociar un paciente de otra clinica y confirmar el rechazo RLS.

### F. Odontograma

- Aplicar `018_odontogram_entries.sql` o ejecutar `npx supabase db push`.
- Ingresar como owner, admin y doctor, seleccionar un paciente y guardar una
  pieza; recargar y confirmar que persiste.
- Cambiar de paciente y confirmar que no aparecen piezas del anterior.
- Confirmar que recepcion no ve Odontograma ni ejecuta consultas.
- Confirmar que un platform admin puro no puede consultar
  `odontogram_entries`.
- Verificar que el upsert de la misma pieza actualiza una fila y no duplica.

### G. Recordatorios

- Crear una cita futura y verificar que genera recordatorios.
- Ver recordatorios persistidos.
- Abrir WhatsApp manual con mensaje precargado.
- Marcar recordatorio como enviado.
- Marcar recordatorio como fallido.

### H. WhatsApp API dry-run

- Verificar que `whatsapp_settings` existe para el consultorio.
- Configurar Supabase Secrets de prueba, sin valores reales en repo:
  - `WHATSAPP_ACCESS_TOKEN`
  - `WHATSAPP_SEND_ENABLED=false`
  - `WHATSAPP_VERIFY_TOKEN`
- Invocar `send-whatsapp-reminder` con un `reminderId`.
- Confirmar que responde en modo dry-run.
- Confirmar que no se envia ningun mensaje real.
- Confirmar que no hay tokens en frontend.

## Troubleshooting

### “Configura Supabase para iniciar sesión”

La app entra en modo demo cuando faltan `VITE_SUPABASE_URL` o
`VITE_SUPABASE_ANON_KEY`. Crea `.env` y reinicia:

```bash
npm run dev
```

### Login no funciona

Verifica que el usuario exista en Supabase Auth, que el password sea correcto y
que `.env` apunte al proyecto correcto.

### Usuario sin perfil

Crea un registro en `profiles` con `id = auth.users.id`.

### Usuario sin consultorio

Verifica que `profiles.clinic_id` tenga el UUID de un registro existente en
`clinics`.

### RLS bloquea datos

Confirma que ejecutaste `002_auth_profiles_policies.sql` y que el usuario tiene
perfil vinculado al consultorio. RLS separa datos por `clinic_id`.

### No aparecen pacientes

Verifica que los pacientes se hayan creado con el mismo `clinic_id` del perfil
del usuario autenticado.

### No aparecen citas

Verifica que las citas tengan `clinic_id` correcto y `patient_id` de un paciente
real del mismo consultorio.

### No se puede marcar una cita como atendida o no asistida

Confirma que ejecutaste `019_appointment_resolution_statuses.sql`. Esa
migración agrega `completed` y `no_show` al constraint de estados permitido.

### Edge Function no responde

Confirma que la funcion fue desplegada en Supabase, que el nombre coincide y que
las variables de Supabase Secrets existen. Por defecto debe operar en dry-run.

### Variables `.env` no se leen

Vite solo lee variables `VITE_` al iniciar. Reinicia `npm run dev`.

## Seguridad

- `.env` real no se sube al repositorio.
- `.env.example` si se versiona y no debe contener claves reales.
- `VITE_SUPABASE_ANON_KEY` puede estar en frontend.
- `service_role` nunca va en frontend.
- Tokens de WhatsApp nunca van en frontend.
- RLS protege los datos por consultorio usando `profiles.clinic_id`.
