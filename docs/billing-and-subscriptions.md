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
comprobante. En ese momento la app crea un aviso `pending_review`; no solicita
una referencia bancaria al doctor ni activa la suscripción. Platform Admin
verifica el comprobante, completa la referencia y registra el pago de forma
explícita.

`VITE_DAYIA_BILLING_WHATSAPP` configura el número público que recibe los
comprobantes, con código de país y solo dígitos. Un propietario activo puede
crear avisos únicamente para su consultorio mediante las políticas RLS de
`subscription_payment_submissions`. La app reutiliza el aviso pendiente
existente para no duplicarlo. Un aviso `pending_review` pasa a `approved` cuando
se revisa y se confirma su pago vinculado.

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

### Membresía vitalicia reversible

Platform Admin puede asignar una concesión vitalicia administrativa con motivo
obligatorio. El RPC `set_subscription_lifetime_membership` guarda una
instantánea de la condición de acceso anterior, elimina vencimiento y gracia, y
registra `lifetime_enabled` de forma atómica. Retirar la concesión restaura esa
instantánea y registra `lifetime_disabled`; si las fechas ya vencieron, vuelve
a `past_due` para que las reglas normales de gracia y bloqueo determinen el
acceso.

Una membresía vitalicia originada al registrar un pago no se retira como
concesión: se anula el pago vitalicio desde el historial para restaurar su
instantánea y mantener el ledger coherente. Mientras vitalicio esté activo, la
UI deshabilita días adicionales para evitar sustituirlo accidentalmente.

## Seguridad y escritura

`register-subscription-payment`, `reject-subscription-payment-submission`,
`void-subscription-payment` y `update-clinic-subscription` validan JWT y
`profiles.is_platform_admin = true` antes de crear un cliente con
`SUPABASE_SERVICE_ROLE_KEY`. Un usuario clínico no puede registrar pagos ni
reactivarse. El frontend nunca recibe esa clave.

El RPC `record_manual_subscription_payment` inserta el ledger y actualiza la
suscripción en una sola transacción. El RPC
`void_manual_subscription_payment` realiza la anulación lógica y restaura la
instantánea en otra transacción. Los usuarios autenticados no pueden modificar
el ledger; solo las Functions confiables pueden hacerlo. No contiene datos
clínicos.

Si después del último pago solo se concedieron días adicionales, la anulación
calcula la extensión acumulada comparando la fecha final del pago con la fecha
vigente, restaura la instantánea y vuelve a aplicar esa extensión. Los eventos
de días extra permanecen en la auditoría. Un cambio posterior de plan, precio,
bloqueo, reactivación, vitalicio o cancelación continúa bloqueando la
anulación para evitar sobrescribir estado comercial.

El propietario sí puede insertar un aviso `pending_review` para su propio
consultorio. RLS exige una membership `clinic_owner` activa y
`submitted_by = auth.uid()`. Este aviso es informativo y nunca concede acceso,
aprueba el cobro ni modifica `clinic_subscriptions`.

Platform Admin puede rechazar exclusivamente avisos que sigan en
`pending_review`. La Function exige un motivo de 5 a 500 caracteres y el RPC
`reject_subscription_payment_submission` cambia el aviso a `rejected` y crea
el evento `payment_submission_rejected` en una sola transacción. No inserta
filas en `subscription_payments` ni altera fechas, plan o acceso.

`update-clinic-subscription` administra downgrades, excepciones inmediatas,
precios fundador/personalizado/normal, días extra, bloqueo, reactivación,
vitalicio y cancelación. Pagos y cambios administrativos quedan auditados en
`subscription_payments` y `subscription_events`.

## Despliegue

1. Ejecutar las migraciones
   `020_manual_billing_subscriptions.sql`,
   `021_subscription_payment_workflow.sql`,
   `023_reject_subscription_payment_submissions.sql`,
   `024_preserve_extra_days_when_voiding_payment.sql` y
   `025_reversible_lifetime_memberships.sql`, en ese orden.
2. Configurar `monthly_price` y, cuando corresponda,
   `founder_monthly_price` de Basic, Medium y Pro en `public.plans`.
3. Colocar las tres imágenes QR en `public/payment-qr/`.
4. Desplegar `create-platform-clinic`, `list-platform-clinics`,
   `register-subscription-payment`,
   `reject-subscription-payment-submission`,
   `void-subscription-payment` y `update-clinic-subscription`.
5. Validar trial, gracia, bloqueo, pago y vitalicio en un proyecto de pruebas.

Los pagos automáticos, la conciliación bancaria y el almacenamiento interno de
archivos quedan fuera del alcance actual. El comprobante se envía por WhatsApp.
