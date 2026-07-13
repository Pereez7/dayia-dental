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

- `clinics` para identidad y fecha de alta;
- `clinic_subscriptions` y `plans` para plan y estado comercial;
- `clinic_memberships` para contar miembros activos y ubicar al
  `clinic_owner` activo;
- `profiles` solo para nombre y email del propietario encontrado.

La respuesta estable es `{ clinics: [...] }` y contiene exclusivamente el
resumen administrativo definido por `PlatformClinicSummary`. No consulta ni
devuelve pacientes, citas, historiales, odontogramas, recordatorios,
configuración clínica o WhatsApp.

El esquema actual no contiene `clinics.status`. Por esa razón
`clinicStatus` se devuelve como `unknown` y la interfaz muestra `Sin estado`.
No se infiere estado clínico a partir de actividad o datos asistenciales.

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
npx supabase functions deploy list-platform-clinics
```
