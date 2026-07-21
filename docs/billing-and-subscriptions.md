# Suscripciones y cobros manuales

DayIA Dental usa validación manual de pagos por QR. No existe pasarela bancaria,
verificación automática ni QR dinámico.

## Ciclo de acceso

- Todo consultorio nuevo inicia en `trialing` durante 15 días.
- Al vencer el periodo pagado o la prueba, dispone de 5 días de gracia.
- Durante la gracia la sesión y los módulos clínicos siguen disponibles con un
  aviso visible.
- Después de la gracia, la sesión permanece abierta, pero el frontend no monta
  módulos ni loaders clínicos. Se muestra la pantalla de pago del plan actual.
- El bloqueo no elimina usuarios, pacientes, citas ni información clínica.
- `lifetime` no tiene vencimiento ni gracia. Solo un administrador de plataforma
  puede bloquearlo manualmente.

## Periodos y descuentos

| Periodo | Ciclo | Descuento sugerido |
| --- | --- | ---: |
| 1 mes | `monthly` | 0% |
| 6 meses | `six_months` | 10% |
| 12 meses | `annual` | 20% |
| Días personalizados | `custom_days` | 0% |
| Vitalicio | `lifetime` | Monto manual |

Los descuentos y el monto final son editables al registrar el pago. Cada
suscripción usa una condición comercial: `standard`, `founder` o `custom`.
`plans.monthly_price` guarda el precio normal y `plans.founder_monthly_price` el
precio fundador; `clinic_subscriptions.custom_monthly_price` solo se usa para
tarifas personalizadas. La condición no cambia el QR. El precio fundador puede
configurarse para Basic, Medium y Pro.

La tarifa fundador aplica únicamente a la renovación de 1 mes. El desglose
mantiene el precio estándar como base y muestra la diferencia como descuento
fundador. Los periodos de 6 y 12 meses se calculan desde el precio estándar y
aplican solo su descuento comercial de 10% o 20%, respectivamente.

Después de un bloqueo, la tarifa fundador se conserva durante un máximo de 24
horas. La comparación usa `clinic_subscriptions.blocked_at` y la fecha/hora real
del pago (`paid_at`). Hasta el límite inclusive se mantiene el beneficio; pasado
ese plazo, el registro usa la tarifa estándar y la suscripción deja de conservar
`price_tier = founder`.

Si se paga antes del vencimiento, el nuevo periodo empieza en
`current_period_ends_at`. Si ya venció o el consultorio está bloqueado, empieza
en la fecha y hora del pago. Los meses usan meses calendario; los días
personalizados usan días exactos.

## QR y comprobantes

Cada plan usa una imagen estática:

- `public/payment-qr/basic.png`
- `public/payment-qr/medium.png`
- `public/payment-qr/pro.png`

El periodo modifica el monto, no el QR. Si falta la imagen, la interfaz muestra
`QR pendiente de configurar` sin romper el flujo. El propietario paga y abre
WhatsApp con consultorio, plan, periodo y monto precargados para adjuntar el
comprobante. No escribe referencias ni activa la suscripción. Platform Admin
verifica el comprobante y registra el pago de forma explícita.

`VITE_DAYIA_BILLING_WHATSAPP` configura el número público que recibe los
comprobantes, con código de país y solo dígitos. Las filas históricas de
`subscription_payment_submissions` continúan visibles en Administración DayIA;
un aviso `pending_review` pasa a `approved` cuando se revisa y se confirma su
pago vinculado.

## Registro, historial y anulación

- Enter no envía el formulario administrativo. Los campos de notas sí admiten
  saltos de línea.
- El registro exige fecha, referencia, descuento entre 0 y 100 y monto mayor a
  cero. Un monto editado que difiere del cálculo muestra una advertencia.
- **Revisar registro** abre un resumen y **Confirmar registro** ejecuta la única
  escritura definitiva.
- `subscription_payments.status` distingue `registered` y `voided`. Una
  anulación conserva la fila, el motivo, la fecha y el administrador.
- Solo se puede anular el último pago vigente. Si hubo un ajuste administrativo
  posterior, la operación se detiene para evitar restaurar una vigencia obsoleta.
- La suscripción se restaura desde la instantánea previa guardada con el pago.

## Cambios de plan

- Un upgrade se aplica al registrar `upgrade_proration`. Cobra la diferencia
  mensual dividida entre 30 y multiplicada por los días restantes; conserva el
  vencimiento actual.
- Un downgrade guarda `scheduled_plan_id` y
  `scheduled_plan_starts_at`. Se aplica al cargar el contexto del consultorio
  una vez alcanzado el vencimiento, sin devolución automática.
- Una excepción inmediata exige una nota y queda en `subscription_events`.
- Vitalicio sigue siendo una acción exclusiva de Platform Admin y no aparece
  como plan comercial público.

## Seguridad y escritura

`register-subscription-payment`, `void-subscription-payment` y
`update-clinic-subscription` validan JWT y
`profiles.is_platform_admin = true` antes de crear un cliente con
`SUPABASE_SERVICE_ROLE_KEY`. Un usuario clínico no puede registrar pagos ni
reactivarse. El frontend nunca recibe esa clave.

El RPC `record_manual_subscription_payment` inserta el ledger y actualiza la
suscripción en una sola transacción. El RPC
`void_manual_subscription_payment` realiza la anulación lógica y restaura la
instantánea en otra transacción. Los usuarios autenticados no pueden modificar
el ledger; solo las Functions confiables pueden hacerlo. No contiene datos
clínicos.

`update-clinic-subscription` administra downgrades, excepciones inmediatas,
precios fundador/personalizado/normal, días extra, bloqueo, reactivación,
vitalicio y cancelación. Pagos y cambios administrativos quedan auditados en
`subscription_payments` y `subscription_events`.

## Despliegue

1. Ejecutar `supabase/migrations/020_manual_billing_subscriptions.sql` y luego
   `supabase/migrations/021_subscription_payment_workflow.sql`.
2. Configurar `monthly_price` y, cuando corresponda,
   `founder_monthly_price` de Basic, Medium y Pro en `public.plans`.
3. Colocar las tres imágenes QR en `public/payment-qr/`.
4. Desplegar `create-platform-clinic`, `list-platform-clinics`,
   `register-subscription-payment`, `void-subscription-payment` y
   `update-clinic-subscription`.
5. Validar trial, gracia, bloqueo, pago y vitalicio en un proyecto de pruebas.

Los pagos automáticos, la conciliación bancaria y el almacenamiento interno de
archivos quedan fuera del alcance actual. El comprobante se envía por WhatsApp.
