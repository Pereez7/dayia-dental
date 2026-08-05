# Production readiness

Checklist de DayIA Dental para demo comercial y revisión preproducción.
Última revisión documental: 27 de julio de 2026.

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

- Cerrar los hitos obligatorios del
  [plan de rendimiento y escalabilidad](performance-and-scalability-plan.md),
  comenzando por la medición del alta, el listado administrativo paginado y las
  colecciones clínicas acotadas. `PERF-005B1` ya cerró su validación técnica,
  autenticada y móvil en staging; `PERF-005B2` sigue pendiente.
- Preparar respaldo y ventana controlada antes de aplicar
  `027_membership_rls_hardening.sql` y
  `028_clinic_membership_lifecycle.sql` y
  `029_transactional_business_hours.sql` y
  `030_platform_owner_email_correction.sql` y
  `031_platform_admin_server_pagination.sql` en producción. Staging ya pasó las
  pruebas de aislamiento, ciclo reversible de usuarios, guardado semanal
  transaccional, corrección del propietario y paginación administrativa.
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
| `list-platform-clinics` | Sí para Platform Admin | Resumen paginado y contadores; no incluye historiales |
| `get-platform-clinic-billing` | Sí para Platform Admin | Detalle comercial bajo demanda con pagos y solicitudes paginados |
| `register-subscription-payment` | Sí para cobros | Registro confirmado por Platform Admin |
| `reject-subscription-payment-submission` | Sí para rechazos | Motivo obligatorio y auditoría sin modificar vigencia |
| `void-subscription-payment` | Sí para anulaciones | Anulación lógica con motivo |
| `update-clinic-subscription` | Sí para gestión comercial | Plan, precio y acceso |
| `create-platform-clinic` | Desplegable, bloqueada | Mantener flag en `false` |
| `resend-platform-clinic-invitation` | Sí para altas pendientes | Solo Platform Admin; valida owner pendiente y aplica cooldown |
| `correct-platform-clinic-owner-email` | Sí para corregir altas pendientes | Reemplaza la membership, reenvía y audita sin mutar la identidad anterior |
| `invite-clinic-member` | Sí para Usuarios | Owner/admin Medium o Pro |
| `manage-clinic-member` | Sí para Usuarios | Desactivación y reactivación reversible con motivo y auditoría |
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

La CLI muestra únicamente hashes. El 20 de julio de 2026 se restableció
`DAYIA_PLATFORM_CREATE_ENABLED=false` en el proyecto que estaba enlazado en
ese momento. El 30 de julio se habilitó explícitamente en staging
`zjsnfgxvaimddmchrwre` para validar PERF-004. Esto no confirma ni modifica el
valor de producción: debe verificarse por entorno antes de cada despliegue. La
ausencia de `WHATSAPP_SEND_ENABLED` mantiene el dry-run por defecto.

## Migraciones

Aplicar y verificar `001` a `034` en orden. `003_initial_clinic_setup_template`
es una plantilla de referencia. La lista completa está en
`docs/supabase-setup.md`.

El 28 de julio de 2026 se verificó el staging
`zjsnfgxvaimddmchrwre`: los historiales local y remoto están alineados de
`001` a `029`, `supabase db lint --linked --level warning` no encontró errores,
`027_membership_rls_hardening.sql` superó 38 pruebas pgTAP y
`028_clinic_membership_lifecycle.sql` superó 16 y
`029_transactional_business_hours.sql` superó 9. Las ejecuciones de prueba se
revirtieron sin dejar datos auxiliares persistentes. Esta validación no implica
que `027`, `028` o `029` ya estén desplegadas en producción.

El 30 de julio de 2026 se aplicó y verificó `030` en ese mismo staging. La
tabla de auditoría y la RPC existen, `service_role` puede ejecutarla,
`authenticated` no puede hacerlo y el historial remoto quedó alineado de
`001` a `030`. También quedaron activas `create-platform-clinic` versión 7 y
`correct-platform-clinic-owner-email` versión 1, ambas con JWT obligatorio.

Ese mismo día se aplicó `031` únicamente en staging y el historial remoto quedó
alineado de `001` a `031`. Su prueba pgTAP remota supera 10 controles con
rollback. `list-platform-clinics` fue reemplazada por la versión paginada y
`get-platform-clinic-billing` quedó desplegada para cargar el detalle comercial
bajo demanda. El humo autenticado devolvió `200` y confirmó transferencias
acotadas; la latencia observada de 1.03–2.38 s continúa como deuda explícita
antes de producción.

También el 30 de julio se aplicó `032` únicamente en staging y el historial
remoto quedó alineado de `001` a `032`. La migración incorpora el ledger
idempotente, la unicidad global del email normalizado y la escritura atómica de
clínica, perfil, membership y suscripción. El pgTAP específico superó 31
controles localmente y contra staging con rollback; la suite completa alcanzó
732 pruebas de aplicación y 105 SQL. La validación autenticada confirmó una
alta nueva de 3,472.2 ms internos y un reintento seguro de 721.6 ms sin
duplicados. En staging quedaron activas `create-platform-clinic` v8,
`invite-clinic-member` v3 y `correct-platform-clinic-owner-email` v2 con JWT.
La Function legacy `migrate-owner-email` no permanece desplegada. Ninguno de
estos cambios debe darse por aplicado en producción hasta ejecutar su propio
respaldo, despliegue y verificación posterior.

El 4 de agosto de 2026 se aplicó `033` únicamente en staging y el historial
remoto quedó alineado de `001` a `033`. Su RPC entrega un snapshot clínico de
tamaño fijo, exige acceso clínico vigente y no se concede a `anon`. El pgTAP
específico superó 13 controles localmente y contra staging con rollback;
`db lint` remoto no encontró errores. La navegación móvil autenticada confirmó
una única RPC de 1.1 kB en 273 ms, sin lecturas completas de pacientes, citas o
logs. `PERF-005A` está cerrado técnicamente en staging, pero todavía no se
promueve a producción porque `PERF-005` continúa con Agenda.

El 5 de agosto se aplicó `034` únicamente en staging y el historial remoto
quedó alineado de `001` a `034`. Sus 15 controles pasan con rollback y
`db lint --linked --schema public` está limpio. En 415 × 725, la carga inicial
y el cambio a Mañana devolvieron `200`, 0.9–1.0 kB y 313–464 ms; el preflight
inicial tardó 236 ms. La vista no presentó overflow. Estas muestras cierran
`PERF-005B1` en staging, pero no autorizan producción mientras `PERF-005B2`
siga pendiente.

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

- [x] Confirmar migraciones `001`–`034` en staging.
- [x] Ejecutar las 38 pruebas RLS de `027` y `db lint` en staging.
- [x] Ejecutar las 16 pruebas de ciclo de usuarios de `028` en staging.
- [x] Ejecutar las 9 pruebas de guardado de horarios de `029` en staging.
- [x] Verificar tabla, RPC, permisos e historial de `030` en staging.
- [x] Ejecutar los 10 controles de paginación y lote de `031` en staging.
- [x] Ejecutar los 13 controles del Dashboard acotado de `033` en staging.
- [ ] Medir Agenda autenticada y revisar móvil tras desplegar y probar `034`.
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
- `027_membership_rls_hardening.sql` aplica RLS basada en membership activa,
  rol, estado del consultorio y vigencia comercial; ya fue validada en staging
  y continúa pendiente de un despliegue productivo controlado.
- `028_clinic_membership_lifecycle.sql` conserva usuarios y memberships,
  registra cada desactivación o reactivación y está pendiente del mismo
  despliegue productivo controlado.
- `029_transactional_business_hours.sql` valida y guarda la semana completa en
  una transacción autorizada, sin exponer las columnas protegidas del
  consultorio al cliente.
