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

Los descuentos son editables al registrar el pago. Los precios mensuales se
guardan en `plans.monthly_price` y la moneda en `plans.currency`. La migración no
inventa precios comerciales: deben configurarse manualmente. Si falta el precio,
Platform Admin solicita un monto base manual.

Si se paga antes del vencimiento, el nuevo periodo empieza en
`current_period_ends_at`. Si ya venció, empieza en la fecha del pago. Los meses
usan meses calendario; los días personalizados usan días exactos.

## QR y comprobantes

Cada plan usa una imagen estática:

- `public/payment-qr/basic.png`
- `public/payment-qr/medium.png`
- `public/payment-qr/pro.png`

El periodo modifica el monto, no el QR. Si falta la imagen, la interfaz muestra
`QR pendiente de configurar` sin romper el flujo. El cliente envía el
comprobante por un canal externo y Platform Admin lo valida antes de registrar.

## Seguridad y escritura

`register-subscription-payment` y `update-clinic-subscription` validan JWT y
`profiles.is_platform_admin = true` antes de crear un cliente con
`SUPABASE_SERVICE_ROLE_KEY`. Un usuario clínico no puede registrar pagos ni
reactivarse. El frontend nunca recibe esa clave.

El RPC `record_manual_subscription_payment` inserta el ledger y actualiza la
suscripción en una sola transacción. `subscription_payments` es inmutable para
usuarios autenticados y no contiene datos clínicos.

`update-clinic-subscription` admite `change_plan`, `grant_extra_days`, `block`,
`reactivate`, `mark_lifetime` y `cancel`. Las notas de días extra se reciben,
pero queda pendiente una tabla general de auditoría administrativa para
conservar acciones que no crean pagos.

## Despliegue

1. Ejecutar `supabase/migrations/020_manual_billing_subscriptions.sql`.
2. Configurar `monthly_price` de Basic, Medium y Pro en `public.plans`.
3. Colocar las tres imágenes QR en `public/payment-qr/`.
4. Desplegar `create-platform-clinic`, `list-platform-clinics`,
   `register-subscription-payment` y `update-clinic-subscription`.
5. Validar trial, gracia, bloqueo, pago y vitalicio en un proyecto de pruebas.

Los pagos automáticos y la conciliación bancaria quedan fuera del alcance.
