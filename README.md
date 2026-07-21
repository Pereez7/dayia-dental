# DayIA Dental

Aplicación interna para consultorios dentales. El MVP organiza pacientes,
citas, historial clínico, odontograma y recordatorios manuales con aislamiento
por consultorio sobre Supabase.

## Estado actual

- Frontend con React, Vite y TypeScript.
- Layout base con sidebar, header y navegacion por estado local.
- Sidebar con marca, acciones rapidas y navegacion principal diferenciadas.
- Modulo de pacientes con listado, busqueda, formulario, validaciones, detalle
  de paciente y resumen clinico compacto.
- Dashboard operativo con KPIs diarios y mensuales reales, próximas citas
  activas, seguimiento y actividad reciente, siempre limitado al consultorio
  activo y con estados de carga explícitos.
- Modulo de citas con agenda diaria operativa y formulario de nueva cita.
- Citas con confirmacion, cancelacion y reprogramacion local, incluyendo
  motivos simples de cancelacion y reprogramacion, con validacion para exigir
  cambio real de fecha u hora al reprogramar.
- Historial simple de cambios de cita en memoria para creacion, confirmacion,
  cancelacion y reprogramacion.
- Nueva cita con seleccion real de paciente, horarios disponibles segun
  horarios del consultorio, duracion del tratamiento, bloqueo de rangos
  solapados y validaciones de campos.
- Excepciones del calendario en Configuracion para cerrar fechas puntuales o
  definir horarios especiales que afectan Nueva Cita y Reprogramar.
- Historial clinico inicial dentro del detalle de paciente, con registros
  asociados por paciente, normalizacion de textos y fechas con año.
- Historial clinico global con cards agrupadas por paciente, busqueda, filtros,
  KPIs y expansion controlada de ultimos registros.
- Odontograma inicial dentro del detalle de paciente, con piezas permanentes
  adultas, arcadas FDI, estados por pieza, resumen por estado, Toast de
  guardado, observaciones limitadas y piezas sin registro tratadas como sanas.
- Formato global de fechas con `formatAppDate`: muestra año solo cuando la
  fecha no pertenece al año actual y mantiene hora en formato 24 horas.
- Recordatorios WhatsApp con persistencia, reconciliación de vencidos, filtros,
  vista previa, resolución de citas pasadas y fallback manual mediante `wa.me`.
- Configuracion con horarios del consultorio y tratamientos locales.
- Tratamientos con alta, busqueda, edicion, activacion, desactivacion y Toast
  flotante de feedback.
- `ConfirmDialog` reutilizable para confirmaciones sensibles, usado al cancelar
  citas desde Agenda y al desactivar tratamientos desde Configuracion.
- Datos mock separados en `src/data`.
- Tipos compartidos en `src/types`.
- Componentes pequenos y reutilizables en `src/components`.
- Utilidades puras en `src/utils`.
- Pruebas unitarias con Vitest.
- Administración DayIA con listado real y alta de consultorios protegida por
  autorización `platform_admin` y un feature flag exclusivo del servidor.
- Suscripciones manuales con prueba de 15 días, gracia de 5 días, pagos por QR,
  tarifas normal, fundador o personalizada, periodos de 1, 6 y 12 meses, días
  personalizados, comprobante manual por WhatsApp, confirmación administrativa,
  anulación lógica, upgrades prorrateados, downgrades programados y vitalicio.

La guía funcional y de despliegue de cobros vive en
[docs/billing-and-subscriptions.md](docs/billing-and-subscriptions.md).

## Alta protegida de consultorios

`create-platform-clinic` solo escribe si el JWT pertenece a un perfil con
`is_platform_admin = true` y `DAYIA_PLATFORM_CREATE_ENABLED` es exactamente
`true`. La UI siempre envía el alta válida a la Function y muestra su resultado;
no replica ni expone ese secret. `SUPABASE_SERVICE_ROLE_KEY` nunca llega al
frontend y el flujo no consulta datos clínicos. Los pasos de despliegue están
en `docs/supabase-setup.md`.

## Modulos actuales

- **Dashboard:** operación de hoy sin citas canceladas, movimientos mensuales
  desde el historial real, próximas citas activas, seguimiento, actividad de
  citas y pacientes activos recientes.
- **Pacientes:** listado compacto, búsqueda normalizada por nombre completo,
  teléfono y email, alta persistente con control básico de duplicados, detalle
  con todas las citas relacionadas y accesos rápidos condicionados por rol.
- **Citas:** agenda diaria mobile-first con selector horizontal de dias, KPIs
  compactos, listado ordenado por hora, confirmacion, cancelacion con motivo en
  `ConfirmDialog`, reprogramacion inline con motivo, creacion local de citas,
  seleccion de paciente, horarios disponibles segun configuracion del
  consultorio, duracion del tratamiento, bloqueo de rangos solapados, bloqueo
  de horarios que exceden el cierre y bloqueo de doble cita activa del mismo
  paciente en el dia. Reprogramar exige cambiar fecha u hora, no solo el motivo,
  y tambien valida disponibilidad por duracion ignorando la cita actual. Mientras
  el panel de reprogramacion esta abierto, la card se enfoca en guardar o
  cancelar esa edicion y oculta acciones externas de la cita. Las cards separan
  rango horario, datos del paciente, estado y acciones para evitar solapamientos;
  muestran motivo y ultimo cambio como informacion secundaria. El evento interno
  de creacion no se muestra como ultimo cambio. Los errores de reprogramacion se
  muestran inline dentro del panel para evitar alertas duplicadas. Las citas
  canceladas no se reprograman directamente; si el paciente desea asistir
  nuevamente, se crea una nueva cita. La agenda vacía ofrece un CTA según
  permisos y el detalle del paciente puede abrir Nueva cita con preselección.
- **Historial clinico:** registros clinicos dentro del detalle de paciente,
  ordenados por fecha, con resumen temporal y formulario de evolucion basica.
  El modulo global muestra una card por paciente, resume el ultimo registro,
  permite buscar por paciente o contenido clinico, filtrar por periodo y
  expandir hasta los ultimos 3 registros.
- **Odontograma:** grilla inicial de piezas permanentes adultas dentro del
  detalle de paciente, con arcada superior e inferior, cuadrantes FDI, resumen
  por estado, edicion simple por pieza, observaciones normalizadas y fecha de
  ultima actualizacion con formato global. Usa siete estados canonicos:
  `healthy`, `caries`, `restored`, `missing`, `pending`, `watch` y `other`.
- **Recordatorios WhatsApp:** generacion local de recordatorios `24h`, `2h` y
  confirmacion inmediata solo para citas activas, con selector por fecha,
  filtros por estado, mensajes sugeridos segun cita pendiente, confirmada o
  reprogramada, formato corto 24h, vista previa y Toast de feedback.
- **Configuracion:** horarios semanales del consultorio, intervalo de atencion,
  excepciones del calendario para cierres y horarios especiales, y gestion
  local de tratamientos disponibles para Nueva Cita. Horarios, Excepciones y
  Tratamientos se presentan como bloques visuales diferenciados y coherentes.

La aplicación ya integra Supabase Auth, PostgreSQL, RLS, Edge Functions y
persistencia clínica. WhatsApp Cloud API real, webhooks completos,
multi-consultorio seleccionable y facturación todavía no están activos.

## Demo y preproducción

- `docs/production-readiness.md`: checklist de configuración, seguridad,
  despliegue y límites del MVP.
- `docs/demo-script.md`: recorrido comercial breve con datos ficticios.
- `docs/supabase-setup.md`: migraciones, Functions, secrets y Redirect URLs.

## Comandos

Instalar dependencias:

```bash
npm install
```

Levantar el servidor de desarrollo:

```bash
npm run dev
```

Ejecutar pruebas unitarias:

```bash
npm run test
```

Ejecutar pruebas en modo observacion:

```bash
npm run test:watch
```

Compilar para produccion:

```bash
npm run build
```

Revisar reglas de lint:

```bash
npm run lint
```

## Documentacion

Cuando se actualice la documentacion del proyecto, mantener alineados estos
archivos:

- [Contexto del proyecto](docs/project-context.md)
- [README](README.md)
- [Arquitectura](docs/architecture.md)
- [Decisiones tecnicas](docs/decisions.md)
- [Roadmap](docs/roadmap.md)
- [Changelog](CHANGELOG.md)
- [Producto](PRODUCT.md)
