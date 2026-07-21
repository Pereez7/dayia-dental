# Administración de plataforma

## Billing manual

Platform Admin administra suscripciones sin consultar ni modificar información
clínica. `list-platform-clinics` entrega resumen, precio configurable e historial
de pagos. `register-subscription-payment` registra el pago y actualiza la
suscripción de forma transaccional; `update-clinic-subscription` concentra
cambio de plan, días extra, bloqueo, reactivación, cancelación y vitalicio.
`void-subscription-payment` anula lógicamente el último pago vigente y restaura
la instantánea anterior solo cuando no existen cambios administrativos
posteriores.

La interfaz separa resumen, calculadora, confirmación final e historial. Enter
no registra pagos, la referencia es obligatoria y toda escritura definitiva se
confirma en un modal. Los avisos enviados por propietarios aparecen pendientes
para su revisión, pero nunca activan una suscripción por sí mismos.

Todas las escrituras exigen JWT de un perfil con `is_platform_admin = true`.
`service_role` se inicializa únicamente dentro de las Functions después de esa
validación. Los usuarios clínicos no reciben acciones de billing.

`Administración DayIA` es una superficie interna separada de los módulos
clínicos. Solo un perfil autenticado con `profiles.is_platform_admin = true`
puede consultar su listado de consultorios.

## Listado administrativo

React invoca `list-platform-clinics` mediante
`src/services/platformAdminService.ts`. El frontend envía el JWT de la sesión y
no consulta directamente tablas administrativas ni usa `service_role`.

La Edge Function valida el JWT, obtiene el usuario actual y comprueba
`profiles.is_platform_admin` antes de realizar cualquier lectura privilegiada.
Después consulta únicamente:

- `clinics` para identidad, estado administrativo y fecha de alta;
- `clinic_subscriptions` y `plans` para plan y estado comercial;
- `clinic_memberships` para contar miembros activos y ubicar al
  `clinic_owner` activo;
- `profiles` solo para nombre y email del propietario encontrado.

La respuesta estable es `{ clinics: [...] }` y contiene exclusivamente el
resumen administrativo definido por `PlatformClinicSummary`. No consulta ni
devuelve pacientes, citas, historiales, odontogramas, recordatorios,
configuración clínica o WhatsApp.

Los campos visibles son: consultorio, estado administrativo, plan, estado de
suscripción, propietario, email del propietario, miembros activos y fecha de
creación. La migración `012_clinics_status.sql` agrega `clinics.status` como
campo nullable sin modificar filas existentes.

Si `clinics.status` es null o vacío, la Function usa `active` cuando la
suscripción está activa y `pending_activation` en los demás casos. Un valor no
vacío fuera del contrato se devuelve como `unknown` y la UI muestra
`Estado no definido`. No se infiere estado desde actividad o datos clínicos.

El propietario principal siempre sale de una membresía `clinic_owner` activa.
Si hay varios owners activos, se prioriza un perfil con email no temporal;
después se ordena por `activated_at DESC NULLS LAST`, `created_at DESC` y
`user_id` como desempate estable. Si no hay owner activo, nombre y email son
null y la UI muestra `Sin propietario`.

Los owners creados desde Administración pueden conservar temporalmente
`profiles.role = clinic_admin` por compatibilidad legacy. Al iniciar sesión, el
frontend usa `clinic_memberships.role` como fuente principal, por lo que una
membership activa `clinic_owner` se muestra y autoriza como propietario. No se
modifican perfiles automáticamente para corregir el campo legacy.

## Auditoría manual de owners

Los owners duplicados son una inconsistencia de datos y deben revisarse
manualmente antes de producción. El listado no modifica membresías ni perfiles.

Consulta para detectar clínicas con más de un owner activo:

```sql
select
  m.clinic_id,
  c.name as clinic_name,
  count(*) filter (where m.role = 'clinic_owner' and m.status = 'active') as active_owners
from public.clinic_memberships m
join public.clinics c on c.id = m.clinic_id
group by m.clinic_id, c.name
having count(*) filter (where m.role = 'clinic_owner' and m.status = 'active') > 1;
```

Consulta para revisar los owners del consultorio demo:

```sql
select
  c.name as clinic_name,
  p.full_name,
  p.email,
  m.role,
  m.status,
  m.activated_at,
  m.created_at
from public.clinic_memberships m
join public.profiles p on p.id = m.user_id
join public.clinics c on c.id = m.clinic_id
where c.name = 'DayIA Dental Demo'
  and m.role = 'clinic_owner'
order by m.activated_at desc nulls last, m.created_at desc;
```

## Defensa de acceso

La navegación se muestra con `canAccessPlatformAdministration`, la vista vuelve
a comprobar ese permiso antes de cargar y la Function aplica la autorización
definitiva en servidor. Un usuario no autorizado recibe `403` y no obtiene el
listado aunque fuerce la sección desde el cliente.

La navegación de un `platform_admin` puro contiene únicamente Administración
DayIA. Sus acciones rápidas y loaders clínicos permanecen desactivados. El rol
de plataforma no concede por sí mismo acceso a pacientes, citas, historial,
odontograma, recordatorios o configuración clínica.

La cuenta interna principal debe conservarse como `platform_admin` puro. El
consultorio DayIA Dental Demo usa otra cuenta con `is_platform_admin = false` y
membership `clinic_owner` activa, evitando mezclar administración comercial con
datos clínicos durante una demostración.

## Alta de consultorios

## Alta protegida de consultorios

`create-platform-clinic` prepara el consultorio, owner, membresía y suscripción
solo con JWT válido, `profiles.is_platform_admin = true` y
`DAYIA_PLATFORM_CREATE_ENABLED === "true"`. El perfil se consulta con el JWT y
RLS. La Function no lee ni inicializa `service_role` antes de superar esas
barreras.

El payload contiene `clinicName`, `ownerName`, `ownerEmail`, `planId` y
`priceTier`. Los
nombres se recortan y compactan, el email se normaliza a minúsculas y el plan
solo admite `basic`, `medium` o `pro`. La tarifa inicial solo admite `standard`
o `founder`; fundador exige que el plan tenga `founder_monthly_price`
configurado. La respuesta nunca incluye tokens ni datos clínicos.

El owner existente se reutiliza y su nombre solo se completa si está vacío. Un
owner nuevo usa `inviteUserByEmail`, sin contraseña manual, y su membresía queda
`pending_activation`; uno existente y confirmado puede quedar `active`. La
suscripción comienza con 15 días en `trialing`, seguidos por 5 días de gracia,
y el consultorio queda `pending_activation`. El plan y la tarifa elegidos
definen la condición comercial que se usará al terminar la prueba.

No existe una transacción Auth + Postgres única. Ante un fallo, la compensación
elimina el consultorio, cuyas membresías y suscripción caen por cascada, y
elimina el usuario Auth solo si nació en la misma petición. La migración `013`
evita nombres duplicados normalizados.

La UI no replica el feature flag. Un submit válido siempre invoca
`create-platform-clinic`; la Function responde si la creación está habilitada.
El frontend muestra ese resultado, evita dobles envíos y refresca
`list-platform-clinics` únicamente tras una respuesta exitosa. El secret del
servidor sigue siendo la única barrera autoritativa.

## Despliegue

Las Functions requieren `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY`. `create-platform-clinic` requiere además
`DAYIA_PLATFORM_CREATE_ENABLED`, que debe permanecer distinto de `true` hasta
la prueba manual, y opcionalmente `DAYIA_APP_URL`. `service_role` nunca se copia
a React.

```bash
npx supabase db push
npx supabase functions deploy list-platform-clinics
npx supabase functions deploy create-platform-clinic
```

La gestión de usuarios clínicos no forma parte de Administración DayIA.
`invite-clinic-member` se autoriza exclusivamente con una membership clínica
activa `clinic_owner` o `clinic_admin` y un plan Medium/Pro; el flag de
plataforma por sí solo no concede acceso a ese endpoint.

Verificar el secret sin habilitarlo:

```bash
npx supabase secrets list
```
