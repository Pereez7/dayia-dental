# WhatsApp Plan

DayIA Dental debe enviar recordatorios reales desde backend, no desde React. El
frontend solo puede guardar configuracion no secreta del consultorio y ofrecer
el fallback manual "Abrir WhatsApp".

## Configuracion por consultorio

La tabla `whatsapp_settings` guarda datos no secretos:

- `clinic_id`
- `provider`
- `phone_number`
- `phone_number_id`
- `business_account_id`
- `is_connected`

No se guarda `access_token` en la base accesible desde frontend. El token debe
vivir como Supabase Secret:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_SEND_ENABLED`
- `WHATSAPP_VERIFY_TOKEN`

`WHATSAPP_SEND_ENABLED` debe quedar desactivado por defecto. Sin
`WHATSAPP_SEND_ENABLED=true`, las funciones trabajan en modo dry-run.

## Edge Functions

### send-whatsapp-reminder

Recibe `reminderId`, busca el recordatorio y valida:

- El recordatorio existe.
- Su estado es `pending` o `scheduled`.
- La cita asociada no esta cancelada ni ha pasado en `America/La_Paz`.
- El paciente tiene telefono.
- El consultorio tiene `whatsapp_settings` conectado.
- Existe `phone_number_id`.

Por ahora devuelve lo que se enviaria. La llamada real a WhatsApp Cloud API debe
quedar detras de `WHATSAPP_SEND_ENABLED=true` y usar `WHATSAPP_ACCESS_TOKEN`
desde Supabase Secrets.

### process-due-reminders

Prepara el futuro job programado. Busca recordatorios:

- `channel = whatsapp`
- `status in ('pending', 'scheduled')`
- `scheduled_at <= now()`

Procesa una tanda limitada y reutiliza la preparacion de envio. No procesa
recordatorios `cancelled`, `skipped`, `sent` o `failed`. Antes de preparar una
entrega compara la fecha y hora real de la cita en `America/La_Paz`: las citas
pasadas cambian a `skipped` con motivo `appointment_passed`, y las canceladas a
`cancelled`. `scheduled_at <= now()` solo identifica recordatorios cuyo intento
ya corresponde; no significa que la cita haya vencido.

## Estados de la cola

- `pending`: espera su ventana de procesamiento.
- `scheduled`: esta programado para un intento posterior.
- `sent`: fue enviado.
- `failed`: un intento termino con error.
- `cancelled`: dejo de aplicar porque la cita fue cancelada.
- `skipped`: se omitio sin envio, por ejemplo porque la cita ya paso.

Al abrir Recordatorios, el frontend aplica la misma reconciliacion antes de
mostrar la lista. Los omitidos no cuentan como pendientes ni ofrecen "Abrir
WhatsApp", pero permanecen visibles en Todos y Omitido para conservar trazabilidad.

### whatsapp-webhook

Prepara verificacion de webhook con `WHATSAPP_VERIFY_TOKEN` y recepcion de
eventos. En la siguiente fase debe actualizar `provider_message_id`,
`delivered_at`, `read_at`, `failed_reason` y `metadata` segun los eventos de
WhatsApp.

## Fallback manual

El boton "Abrir WhatsApp" sigue activo en Recordatorios. Usa `wa.me` con el
telefono normalizado y el mensaje precargado. Esto no es envio automatico ni
usa tokens.

## Pendiente

- Embedded Signup u OAuth de Meta.
- Templates oficiales aprobados.
- Envio automatico real.
- Cron/scheduler productivo.
- Webhooks completos de estado.
- Auditoria avanzada por consultorio.
