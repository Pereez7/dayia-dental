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
- `reminder_type != immediate`

Procesa una tanda limitada y reutiliza la preparacion de envio. No procesa
recordatorios `cancelled`, `skipped`, `sent` o `failed`. Antes de preparar una
entrega compara la fecha y hora real de la cita en `America/La_Paz`: las citas
pasadas cambian a `skipped` con motivo `appointment_passed`, y las canceladas a
`cancelled`. `scheduled_at <= now()` solo identifica recordatorios cuyo intento
ya corresponde; no significa que la cita haya vencido.

Las citas creadas con menos de dos horas de anticipacion no generan ventanas
automaticas de 24 h o 2 h. Se conserva una accion `immediate` exclusivamente
manual para abrir WhatsApp, pero `process-due-reminders` la excluye siempre. La
interfaz la identifica como "Accion manual" y no muestra una hora programada.
Los timestamps de los recordatorios automaticos se persisten en ISO 8601 con
zona horaria para evitar desplazamientos entre Bolivia y UTC.

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

Un recordatorio omitido y una cita pasada sin cierre son conceptos distintos.
El omitido es historico y nunca vuelve a `pending`. La cita asociada se resuelve
como `completed`, `no_show`, `rescheduled` o `cancelled`. Si se reprograma, la
ocurrencia anterior conserva su omitido y la nueva fecha genera recordatorios
nuevos.

El modal Resolver cita pasada permite cerrar como atendida o no asistida,
cancelar con motivo o reprogramar con fecha, motivo y un horario disponible.
Su selector reutiliza las reglas de Nueva cita y evita horarios cerrados,
ocupados o vencidos. Las fechas se muestran con el formato humano global y la
retroalimentacion distingue advertencias de errores operativos.

### whatsapp-webhook

Prepara verificacion de webhook con `WHATSAPP_VERIFY_TOKEN` y recepcion de
eventos. En la siguiente fase debe actualizar `provider_message_id`,
`delivered_at`, `read_at`, `failed_reason` y `metadata` segun los eventos de
WhatsApp.

## Fallback manual

El boton "Abrir WhatsApp" sigue activo en Recordatorios. Usa `wa.me` con el
telefono normalizado y el mensaje precargado. Esto no es envio automatico ni
usa tokens. Solo se ofrece para recordatorios `pending` o `scheduled` con
telefono valido. El operador abre WhatsApp y luego registra el resultado con
`Marcar enviado` o `Marcar fallido`; estas acciones son independientes para no
confundir abrir el enlace con confirmar una entrega.

La vista previa se abre al elegir un recordatorio y muestra paciente, fecha y
hora de cita, tipo, tratamiento y mensaje final. Los filtros conservan la fecha
activa y los estados vacios explican cuando no existen resultados para esa
combinacion.

La cola agrupa recordatorios por ocurrencia de cita, ordena las citas por hora
y permite buscar por paciente, telefono o tratamiento. El estado de
recordatorio y el estado de cita tienen filtros separados; `Pasada sin cierre`
solo identifica citas activas cuya fecha y hora ya terminaron.

En Basic y Medium la interfaz muestra `Modo manual`. En Pro muestra `Automatico
pendiente de configuracion` mientras WhatsApp Cloud API siga desactivado. El
plan no bloquea el fallback manual para los roles que ya pueden operar
Recordatorios.

La pantalla de Configuración puede guardar identificadores preparatorios en
Pro, pero no presenta ese estado como envío activo. Incluso con datos completos,
la UI aclara que WhatsApp Cloud API continúa deshabilitado. El fallback `wa.me`
y el registro manual de resultados siguen siendo el único flujo operativo.

## Pendiente

- Embedded Signup u OAuth de Meta.
- Templates oficiales aprobados.
- Envio automatico real.
- Cron/scheduler productivo.
- Webhooks completos de estado.
- Auditoria avanzada por consultorio.
