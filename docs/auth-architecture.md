# Arquitectura de Auth, Consultorios, Roles y Planes

DayIA Dental separa identidad personal, pertenencia a consultorios y permisos
comerciales. Esta base permite que el MVP funcione bien para un doctor dueño
solo y tambien prepara consultorios con equipo sin mezclar conceptos.

## Roles

- `platform_admin`: rol interno de DayIA Dental para soporte, clientes y planes.
  No es un doctor dueño y no debe aparecer como opcion en la UI clinica.
- `clinic_owner`: doctor dueño del consultorio. Es el caso principal del plan
  Basic y tiene control completo del consultorio.
- `clinic_admin`: administrador delegado del consultorio.
- `doctor`: usuario clinico.
- `receptionist`: recepcion/asistente.

La normalizacion de roles usa denegacion por defecto. `clinic_owner` solo se
asigna cuando el perfil contiene ese rol de forma explicita o cuando un valor
legacy controlado contiene `owner`. `admin` se convierte en `clinic_admin`.
Valores nulos, vacios, desconocidos o mal escritos se normalizan como
`unknown`, no reciben permisos y bloquean el acceso con un mensaje controlado.
`super_admin` solo se convierte en `platform_admin` cuando Auth o un adaptador
de perfiles habilita explicitamente el contexto legacy; fuera de ese contexto
tambien se trata como `unknown`.

En UI clinica, un rol historico como `super_admin` no debe mostrarse como
"Super administrador". Para evitar confundir plataforma con consultorio, se
muestra como administrador del consultorio mientras se completa la migracion.

## Identidad vs membresia

`profiles` queda como identidad personal:

- `id`
- `full_name`
- `email`
- `is_platform_admin`
- timestamps

`profiles.clinic_id` y `profiles.role` se mantienen como campos legacy para no
romper login ni policies existentes, pero están deprecados como fuente de
contexto clínico en frontend. Auth consulta primero `clinic_memberships` activas
y usa su `clinic_id` y `role`. Los campos de `profiles` solo funcionan como
fallback temporal cuando la consulta termina correctamente sin memberships
activas.

`clinic_memberships` modela pertenencia a consultorios:

- `clinic_id`
- `user_id`
- `role`
- `status`
- `invited_at`
- `activated_at`

Esto permite que un usuario pertenezca a mas de un consultorio en fases futuras.
Mientras no exista selector multi-consultorio, Auth elige de forma estable la
membership activa con `activated_at` más reciente, después `created_at` y el ID
de membership como desempate.

## Acceso a Administración DayIA

La administración interna usa `profiles.is_platform_admin` como autorización
de servidor. La UI aplica `canAccessPlatformAdministration` para navegación y
defensa de la vista, pero la decisión final vive en la Edge Function
`list-platform-clinics`, que vuelve a validar JWT y perfil antes de usar
`service_role`.

`create-platform-clinic` agrega la barrera
`DAYIA_PLATFORM_CREATE_ENABLED === "true"`. Consulta primero el perfil propio
con el JWT y RLS, exige `is_platform_admin = true` y solo después inicializa el
cliente con `service_role`. Si una condición falla, no escribe datos.

El listado devuelve solo identidad del consultorio, plan, suscripción,
propietario activo, cantidad de miembros activos y fecha de creación. No accede
a módulos ni tablas clínicas. Un `clinic_owner`, `clinic_admin`, `doctor`,
`receptionist` o rol desconocido sin la bandera de plataforma recibe `403`.

`profiles.is_platform_admin` permanece independiente del rol clínico resuelto.
Un administrador DayIA sin membership entra a Administración sin exigir
consultorio. Si también tiene una membership activa, Auth conserva ambos datos
en el contexto de sesión; un cambio explícito entre plataforma y consultorio
queda pendiente junto con la navegación multi-contexto.

En el alta, un email existente reutiliza Auth y profile sin sobrescribir datos
sensibles. Un email nuevo usa invitación de Supabase Auth, nunca una contraseña
manual. Hasta activar la cuenta, la membresía usa `pending_activation`; un
usuario confirmado puede recibir membresía `active` de forma explícita.

## Planes

Los planes internos iniciales son:

- `basic`: un owner, sin gestion de equipo.
- `medium`: equipo pequeno, hasta 4 usuarios, gestion de usuarios.
- `pro`: hasta 10 usuarios, gestion de usuarios, WhatsApp automatizado y
  reportes avanzados futuros.

`plans` guarda capacidades. `clinic_subscriptions` asigna el plan real a cada
consultorio. Auth carga `clinic_subscriptions.plan_id` para el consultorio
resuelto y la UI obtiene las capacidades Basic, Medium o Pro desde ese valor;
ya no fuerza Basic para todas las sesiones reales.

## Caso doctor dueño con Basic

El doctor dueño trabaja solo:

- registra pacientes;
- agenda citas;
- gestiona recordatorios manuales;
- configura horarios, tratamientos y WhatsApp;
- no ve gestion de usuarios.

La UI oculta "Usuarios del consultorio" mientras el plan no permita equipo.

## Caso consultorio con equipo

Un consultorio con plan `medium` o `pro` podra agregar equipo. Esa invitacion
debe pasar por una Edge Function futura que valide:

- rol `clinic_owner` o `clinic_admin`;
- plan con `can_manage_team = true`;
- limite de usuarios;
- membership activa;
- que no se acepte `platform_admin` desde UI clinica;
- que `clinic_id` no venga como dato confiable desde React.

## Invitaciones

La Function actual `create-clinic-user` queda como flujo transitorio. La nueva
Function futura recomendada es `invite-clinic-member`.

Reglas esperadas:

- no usar `service_role` en React;
- crear o actualizar `profiles`;
- crear `clinic_memberships` en estado `pending`;
- enviar invitacion segura;
- activar membership cuando el usuario complete acceso.

## Migracion temporal

La migracion `011_memberships_plans_architecture.sql` crea:

- `clinic_memberships`;
- `plans`;
- `clinic_subscriptions`;
- funciones SQL de consulta de consultorio activo, rol, plan y permisos de
  equipo;
- RLS base para las tablas nuevas;
- seed idempotente de planes.

Tambien migra perfiles existentes con `profiles.clinic_id` a memberships sin
borrar usuarios ni datos clinicos. Un `clinic_admin` legacy se convierte en
`clinic_owner` dentro de `clinic_memberships`; `doctor` y `receptionist` se
mantienen como roles clinicos.

Las policies de pacientes, citas, configuracion y recordatorios todavia usan
`current_clinic_id()` basado en `profiles.clinic_id`. Esa migracion completa se
hara en un paso posterior para reducir riesgo.
