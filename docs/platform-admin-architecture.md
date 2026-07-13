# Administración de plataforma

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

## Alta de consultorios

El formulario `Alta segura de consultorios` continúa en modo de validación. No
existe `create-platform-clinic`, no se realizan escrituras y no se habilita
`DAYIA_PLATFORM_CREATE_ENABLED`.

## Despliegue

La Function requiere las variables estándar del entorno de Supabase Functions:
`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. No requiere un
secret personalizado ni una clave nueva en React.

```bash
npx supabase db push
npx supabase functions deploy list-platform-clinics
```
