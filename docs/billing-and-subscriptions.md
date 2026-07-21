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
tarifas personalizadas. La condición no cambia el QR. El beneficio fundador se
conserva durante el periodo activo y la gracia hasta que Platform Admin lo
retire explícitamente.

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

`register-subscription-payment` y `update-clinic-subscription` validan JWT y
`profiles.is_platform_admin = true` antes de crear un cliente con
`SUPABASE_SERVICE_ROLE_KEY`. Un usuario clínico no puede registrar pagos ni
reactivarse. El frontend nunca recibe esa clave.

El RPC `record_manual_subscription_payment` inserta el ledger y actualiza la
suscripción en una sola transacción. `subscription_payments` es inmutable para
usuarios autenticados y no contiene datos clínicos.

`update-clinic-subscription` administra downgrades, excepciones inmediatas,
precios fundador/personalizado/normal, días extra, bloqueo, reactivación,
vitalicio y cancelación. Pagos y cambios administrativos quedan auditados en
`subscription_payments` y `subscription_events`.

## Despliegue

1. Ejecutar `supabase/migrations/020_manual_billing_subscriptions.sql`.
2. Configurar `monthly_price` y, cuando corresponda,
   `founder_monthly_price` de Basic, Medium y Pro en `public.plans`.
3. Colocar las tres imágenes QR en `public/payment-qr/`.
4. Desplegar `create-platform-clinic`, `list-platform-clinics`,
   `register-subscription-payment` y `update-clinic-subscription`.
5. Validar trial, gracia, bloqueo, pago y vitalicio en un proyecto de pruebas.

Los pagos automáticos y la conciliación bancaria quedan fuera del alcance.
