# Production readiness

Checklist de DayIA Dental para demo comercial y revisión preproducción.
Última revisión documental: 21 de julio de 2026.

## Estado del MVP

El MVP usa React, TypeScript, Vite y Supabase. Auth, datos clínicos, roles,
planes y administración de plataforma tienen persistencia real. La navegación
continúa por estado local, sin React Router, y las vistas principales usan
`React.lazy` y `Suspense`.

El bundle principal bajó desde aproximadamente `616.91 kB`. Después del flujo
de suscripciones queda en `501.94 kB` minificado y la experiencia completa de
renovación se entrega en un chunk separado de `7.32 kB`. Vite mantiene una
advertencia marginal sobre el chunk inicial, pendiente de una segunda ronda de
separación de dependencias compartidas.

## Listo para demo

- Login y cierre de sesión con Supabase Auth.
- Contexto clínico desde membership activa y plan desde subscription.
- Dashboard, pacientes, edición de pacientes y teléfonos flexibles.
- Agenda, creación, confirmación, cancelación y resolución de citas pasadas.
- Historial clínico y odontograma persistentes.
- Recordatorios persistentes con operación manual mediante `wa.me`.
- Usuarios del consultorio para owner/admin con plan Medium o Pro.
- Listado administrativo para `platform_admin`, separado de datos clínicos.
- Estados de carga, error, vacío y acceso restringido.

## Pendiente antes de vender

- Definir alcance contractual del MVP y no ofrecer WhatsApp automático.
- Preparar términos, privacidad, consentimiento y tratamiento de datos de salud.
- Definir soporte, respaldo, recuperación y canal de incidentes.
- Acordar onboarding, facturación y límites comerciales de Basic/Medium/Pro.
- Realizar una prueba guiada con un odontólogo usando datos totalmente ficticios.
- Validar responsive y accesibilidad en los dispositivos que se usarán en demo.

## Pendiente antes de producción real

- Auditoría independiente de RLS y migración de policies legacy a memberships.
- Backups probados, restauración, monitoreo, alertas y trazabilidad de incidentes.
- Revisión legal y de seguridad para datos clínicos del país de operación.
- Dominio productivo con TLS, headers de seguridad y fallback SPA configurado.
- Pruebas de aislamiento entre al menos dos consultorios reales de staging.
- Resolver selección multi-consultorio y estrategia de cambio de contexto.
- Revisar la compensación de altas de consultorio, ya que Auth + Postgres no
  forman una única transacción.
- Implementar, revisar y habilitar WhatsApp Cloud API, templates, scheduler y
  webhooks completos antes de ofrecer envío automático.

## Variables del frontend

Crear `.env` local o variables equivalentes en el hosting. Nunca versionar el
archivo real.

| Variable | Uso | Preproducción |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | URL pública del proyecto Supabase | Obligatoria |
| `VITE_SUPABASE_ANON_KEY` | Anon key protegida por RLS | Obligatoria |
| `VITE_APP_URL` | Origen público usado en recuperación | Obligatoria |
| `VITE_DAYIA_BILLING_WHATSAPP` | Número público para comprobantes QR | Obligatoria para cobros |
| `VITE_ENABLE_DEMO_MODE` | Habilita mocks sin Supabase | `false` |

`SUPABASE_SERVICE_ROLE_KEY`, flags de plataforma y tokens de WhatsApp nunca
deben usar el prefijo `VITE_` ni llegar a React.

## Secrets de Supabase

Supabase proporciona a las Functions `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY`. Secrets personalizados:

| Secret | Estado seguro para demo |
| --- | --- |
| `DAYIA_APP_URL` | URL pública sin barra final |
| `DAYIA_PLATFORM_CREATE_ENABLED` | `false` o ausente |
| `WHATSAPP_SEND_ENABLED` | `false` o ausente |
| `WHATSAPP_VERIFY_TOKEN` | Solo para probar verificación del webhook |
| `WHATSAPP_ACCESS_TOKEN` | No necesario: el envío real no está implementado |
| `OWNER_EMAIL_MIGRATION_TOKEN` | Solo para migración legacy controlada |

Incluso con `WHATSAPP_SEND_ENABLED=true`, el código actual no llama a Meta: la
Function devuelve un resultado `prepared`. No configurar tokens productivos.

## Edge Functions

| Function | Requerida | Observación |
| --- | --- | --- |
| `list-platform-clinics` | Sí para Platform Admin | Solo resumen administrativo |
| `register-subscription-payment` | Sí para cobros | Registro confirmado por Platform Admin |
| `void-subscription-payment` | Sí para anulaciones | Anulación lógica con motivo |
| `update-clinic-subscription` | Sí para gestión comercial | Plan, precio y acceso |
| `create-platform-clinic` | Desplegable, bloqueada | Mantener flag en `false` |
| `invite-clinic-member` | Sí para Usuarios | Owner/admin Medium o Pro |
| `complete-account-activation` | Sí para invitaciones | Activa membership pendiente |
| `process-due-reminders` | Opcional en demo | No existe scheduler productivo |
| `send-whatsapp-reminder` | Solo dry-run | No envía a Meta |
| `whatsapp-webhook` | Opcional | Recepción de estados es placeholder |

`create-clinic-user` es legacy/deprecated. `migrate-owner-email` es una utilidad
de transición y no forma parte de un despliegue limpio.

### Estado remoto observado

Consulta de solo lectura realizada el 20 de julio de 2026:

- Activas: `create-clinic-user`, `migrate-owner-email`,
  `list-platform-clinics`, `create-platform-clinic`,
  `complete-account-activation`, `invite-clinic-member`,
  `process-due-reminders` y `send-whatsapp-reminder`.
- No desplegada: `whatsapp-webhook`.
- Los ocho despliegues activos verifican JWT.
- Secrets personalizados presentes: `DAYIA_APP_URL`,
  `DAYIA_PLATFORM_CREATE_ENABLED` y `OWNER_EMAIL_MIGRATION_TOKEN`.
- Secrets de WhatsApp ausentes: `WHATSAPP_SEND_ENABLED`,
  `WHATSAPP_VERIFY_TOKEN` y `WHATSAPP_ACCESS_TOKEN`.

La CLI muestra únicamente hashes, pero el 20 de julio de 2026 se restableció
explícitamente `DAYIA_PLATFORM_CREATE_ENABLED=false` en el proyecto enlazado.
La ausencia de `WHATSAPP_SEND_ENABLED` mantiene el dry-run por defecto.

## Migraciones

Aplicar y verificar `001` a `021` en orden. `003_initial_clinic_setup_template`
es una plantilla de referencia. La lista completa está en
`docs/supabase-setup.md`. El repositorio no demuestra qué migraciones están
aplicadas en un proyecto remoto. Dos consultas con `supabase migration list`
fallaron porque el pooler remoto cerró la conexión; comprobarlo antes de la
demo desde una red con acceso estable o desde Supabase Dashboard.

## Redirect URLs

Registrar en Supabase Auth:

```text
https://TU_DOMINIO/activar-cuenta
http://localhost:5173/activar-cuenta
```

Configurar el Site URL con el origen público y hacer que el hosting entregue
`index.html` para `/activar-cuenta`. La misma ruta recibe invitaciones y
recuperaciones de contraseña.

## Cuentas de prueba sugeridas

Usar emails internos controlados y contraseñas fuera del repositorio.

| Cuenta | Configuración |
| --- | --- |
| Owner demo | Membership `clinic_owner` activa, plan Pro |
| Doctor demo | Membership `doctor` activa en el mismo consultorio |
| Recepción demo | Membership `receptionist` activa en el mismo consultorio |
| Platform admin | `is_platform_admin=true`, sin membership clínica activa |

Clinic Admin es opcional para una segunda ronda. Verificar que Recepción no vea
Historial, Odontograma ni Configuración y que Platform Admin no cargue módulos
clínicos.

La identidad del administrador interno y la del propietario demo deben ser
cuentas distintas. Para un buzón Gmail controlado pueden utilizarse aliases
`+demo`, `+doctor` y `+recepcion`; Supabase los registra como identidades
separadas. Las contraseñas y enlaces de activación nunca se documentan ni se
guardan en el repositorio.

## Datos ficticios sugeridos

- Consultorio: `DayIA Dental Demo`.
- Paciente: `María Fernanda Rojas`, email de dominio controlado y teléfono de
  prueba que no pertenezca a un tercero.
- Cita futura: tratamiento, duración y horario configurados para la demo.
- Cita pasada sin cierre: preparada para mostrar el flujo de resolución.
- Doctor y recepción: perfiles ficticios con memberships activas.

No crear, corregir ni eliminar estos datos automáticamente desde el frontend.

## Checklist de despliegue

- [ ] Confirmar migraciones `001`–`019` en staging.
- [ ] Desplegar únicamente las Functions necesarias.
- [ ] Decidir si se despliega `whatsapp-webhook`; no es necesario para el flujo
  manual y actualmente falta en el remoto.
- [ ] Mantener creación de consultorios y WhatsApp real desactivados.
- [x] Restablecer `DAYIA_PLATFORM_CREATE_ENABLED=false` en el proyecto enlazado.
- [ ] Configurar variables frontend y secrets backend en ámbitos separados.
- [ ] Registrar Site URL y Redirect URLs.
- [ ] Confirmar fallback SPA para `/activar-cuenta`.
- [ ] Ejecutar login/logout y recuperación con una cuenta controlada.
- [ ] Probar owner, doctor, recepción y platform admin.
- [ ] Probar aislamiento con dos `clinic_id` diferentes.
- [ ] Ejecutar `npm run lint`, `npm run test` y `npm run build`.
- [ ] Confirmar que `.env`, `supabase/.temp/` y `supabase/.branches/` no se
  versionan.
- [ ] Seguir el guion de `docs/demo-script.md` con datos ficticios.

## Seguridad verificada en repositorio

- `.env` está ignorado y no aparece en el historial de Git.
- `.env.example` solo contiene nombres y valores no sensibles.
- No se encontraron claves, passwords ni JWT reales versionados; los valores
  literales de contraseña existentes pertenecen únicamente a pruebas unitarias.
- React usa anon key; `service_role` aparece solo en Functions/documentación.
- La creación real requiere autorización de plataforma y flag exclusivo del
  servidor, desactivado por defecto.
- Los loaders clínicos se bloquean por permiso antes de llamar servicios.
- RLS sigue siendo la barrera autoritativa por consultorio.
