# Plan de rendimiento y escalabilidad

Este documento dirige la optimización de DayIA Dental antes de producción.
El objetivo no es mejorar tiempos de forma aislada, sino impedir que el costo
de las operaciones crezca sin control cuando aumenten los consultorios,
usuarios, pacientes, citas, pagos y recordatorios.

Última actualización: 5 de agosto de 2026.

## Principios de trabajo

1. Medir antes y después. Una sospecha no se considera un cuello de botella
   hasta separar sus tiempos.
2. Corregir un hito por vez. No se inicia el siguiente hasta cerrar pruebas,
   medición en staging y documentación del anterior.
3. Paginar en el servidor. Ocultar filas en React no reduce datos transferidos
   ni trabajo de PostgreSQL.
4. Solicitar únicamente las columnas y relaciones necesarias para cada
   pantalla.
5. Evitar operaciones por registro. Los listados no deben ejecutar una RPC o
   consulta adicional por cada consultorio, usuario o paciente.
6. Mantener respuestas honestas. No se muestra éxito si una operación crítica,
   como crear la invitación, todavía puede fallar.
7. No sacrificar seguridad, auditoría, accesibilidad ni aislamiento entre
   consultorios para ganar velocidad.
8. Staging es la puerta obligatoria. Ninguna optimización de datos o Functions
   pasa directamente a producción.

## Presupuesto inicial

Estos valores son objetivos operativos y se revisarán con mediciones reales.
No son pruebas unitarias rígidas porque la red y los proveedores externos
introducen variación.

| Superficie | Objetivo |
| --- | --- |
| Respuesta visual al pulsar una acción | Menos de 100 ms |
| Lectura normal sin proveedor externo | p50 menor a 500 ms; p95 menor a 1.5 s |
| Escritura normal sin proveedor externo | p50 menor a 800 ms; p95 menor a 2 s |
| Alta con Supabase Auth e invitación | p50 menor a 3 s; p95 menor a 6 s |
| INP | Menor a 200 ms |
| LCP | Menor a 2.5 s en el percentil 75 |
| CLS | Menor a 0.1 |
| Tablas administrativas | Paginación de servidor; nunca historial completo |

Una acción que dependa del correo puede superar ocasionalmente el objetivo. La
interfaz debe mostrar carga inmediata, impedir duplicados y explicar el estado
sin quedar silenciosa.

## Hallazgos confirmados

### Alta de consultorios

- La confirmación espera primero a `create-platform-clinic` y luego a una
  segunda llamada completa a `list-platform-clinics`.
- `list-platform-clinics` carga todos los consultorios, suscripciones,
  memberships, pagos y solicitudes de pago, aunque el primer bloque de la
  pantalla solo necesita un resumen.
- El historial de pagos se pagina visualmente de cinco en cinco, pero el
  backend ya transfirió el historial completo.
- El listado ejecuta `apply_due_scheduled_plan` una vez por consultorio. Es un
  patrón N+1 que crecerá linealmente.
- Para un propietario nuevo, la creación encadena validación, varias lecturas y
  escrituras, búsqueda en Auth, creación de invitación y envío del correo.
- La búsqueda alternativa en Auth recorre `listUsers` por páginas. Su costo
  aumentará con la cantidad total de identidades.
- Ya existe un índice único para el nombre normalizado del consultorio. La
  lectura previa de duplicados puede reemplazarse por el control atómico del
  índice y su error `23505`.
- La búsqueda global `profiles.email = ...` no cuenta actualmente con un índice
  global equivalente; el índice existente comienza por `clinic_id`.

### Aplicación general

- Varios servicios usan `select('*')`; deben revisarse por pantalla para evitar
  columnas innecesarias, no reemplazarse mecánicamente.
- Pacientes, citas, recordatorios y parte del historial se cargan como
  colecciones completas del consultorio. Esto requiere límites, ventanas de
  fecha y paginación antes de trabajar con volúmenes productivos.
- Las vistas ya usan carga diferida por módulo, pero el tamaño del bundle y los
  Core Web Vitals necesitan una medición actualizada.
- No existe todavía una línea base común que separe tiempo de navegador, Edge
  Function, Auth, PostgreSQL y proveedor de correo.

## Orden de ejecución

### PERF-001: medición del alta de consultorios

Estado: cerrado el 30 de julio de 2026 con una alta autenticada controlada y
correlacionada en staging.

Objetivo: conocer cuánto tarda cada fase sin registrar emails, nombres, JWT ni
otros datos sensibles.

Trabajo:

- [x] Crear un identificador de operación no sensible.
- [x] Medir en frontend por separado la Function y el refresco del listado.
- [x] Medir en la Function autorización, validación, duplicado, propietario,
  invitación y persistencia.
- [x] Emitir logs estructurados y `Server-Timing`.
- [x] Documentar una línea base con un alta controlada en staging.

Criterio de cierre:

- Se puede explicar la duración total como suma de fases.
- Las mediciones no contienen datos personales ni secretos.
- Existen pruebas para el formateo de métricas.
- Lint, tests y build pasan.
- La Function instrumentada está comprobada en staging.

Implementación:

- El navegador escribe dos eventos `[dayia-performance]` con el mismo
  `operationId`: `create_platform_clinic_request` separa sesión e invocación, y
  `create_platform_clinic_flow` separa creación y refresco.
- `create-platform-clinic` escribe un evento JSON `dayia.performance` con fases
  internas y devuelve `Server-Timing` y `X-Dayia-Operation-Id`.
- La cabecera recibida se acepta únicamente si tiene formato UUID v4. Cualquier
  texto libre se reemplaza por un UUID generado en el servidor.
- Ningún evento contiene nombre del consultorio, email, nombre del owner, JWT
  ni payload.
- La versión 5 de `create-platform-clinic` está `ACTIVE` en staging
  `zjsnfgxvaimddmchrwre`.

Prueba técnica de humo:

- Una solicitud sin usuario, que no realizó escrituras, devolvió `401`.
- El encabezado conservó un UUID v4 controlado.
- `Server-Timing` informó `auth_user=697.6 ms` y `total=700.4 ms`.
- Este dato confirma que la instrumentación atraviesa el gateway, pero no es la
  línea base de una creación y no debe compararse como tal.

Línea base autenticada:

- Fecha: 30 de julio de 2026.
- Entorno: staging `zjsnfgxvaimddmchrwre`.
- Escenario: una alta exitosa desde el frontend local conectado a staging, con
  datos de prueba controlados.
- Correlación: `operationId`
  `95e6a21c-d8e9-4fa3-851e-95d86d7f53d4` en los dos eventos del navegador y
  en el evento de la Function.
- Resultado: `success`, respuesta HTTP `201`.

| Capa | Fase | Duración |
| --- | --- | ---: |
| Frontend | Sesión | 10.0 ms |
| Frontend | Invocación de la Function | 3,751.1 ms |
| Frontend | Solicitud de creación | 3,762.1 ms |
| Frontend | Refresco de `list-platform-clinics` | 2,380.7 ms |
| Frontend | Flujo completo | 6,143.0 ms |
| Function | Usuario autenticado | 712.5 ms |
| Function | Autorización de plataforma | 349.9 ms |
| Function | Validación del payload | 0.3 ms |
| Function | Comprobación de duplicado | 276.0 ms |
| Function | Inserción del consultorio | 273.9 ms |
| Function | Búsqueda del propietario | 504.9 ms |
| Function | Actualización del perfil | 267.1 ms |
| Function | Inserción de membership | 281.4 ms |
| Function | Inserción de suscripción | 482.0 ms |
| Function | Total | 3,153.0 ms |

Las fases internas suman 3,148.0 ms; los 5.0 ms restantes son sobrecarga no
asignada dentro de la Function. La invocación observada por el navegador supera
el total interno en 598.1 ms, que incluye gateway, red, serialización y retorno
al cliente. El refresco bloqueante agrega 2,380.7 ms y representa el 38.8 % del
flujo completo; este es el cuello que aborda `PERF-002`.

Esta ejecución es una muestra controlada, no un p50/p95. Los percentiles se
calcularán cuando exista una serie repetible con suficiente volumen.

### PERF-002: confirmación sin refresco bloqueante

Estado: cerrado el 30 de julio de 2026 con una alta autenticada controlada en
staging.

Objetivo: mostrar el éxito cuando la Function confirme la creación, sin esperar
la reconstrucción completa del listado.

Trabajo:

- [x] Separar el resultado de creación del refresco.
- [x] Mantener el refresco en segundo plano.
- [x] Informar si el consultorio fue creado pero el listado no pudo
  actualizarse.
- [x] Conservar el bloqueo contra doble envío.
- [x] No adelantar el éxito al envío real de la invitación.

Criterio de cierre:

- [x] El tiempo hasta la confirmación ya no incluye
  `list-platform-clinics`.
- [x] El nuevo consultorio aparece al finalizar el refresco.
- [x] Un fallo de refresco no transforma una creación exitosa en un falso
  error.
- [x] Pruebas de éxito, error, doble envío y refresco pasan.

Implementación:

- El formulario resuelve y confirma el alta cuando
  `create-platform-clinic` devuelve éxito. La llamada a
  `list-platform-clinics` se inicia después sin formar parte de la promesa que
  espera el formulario.
- El listado conserva sus datos actuales mientras se actualiza. Al completar
  el refresco reemplaza el resumen con la respuesta nueva.
- Un fallo del refresco muestra un aviso junto al resultado exitoso y ofrece
  `Actualizar listado`; no cambia el alta a error ni restaura los datos del
  formulario.
- El bloqueo contra doble envío cubre toda la solicitud de creación y se
  libera únicamente después de recibir su respuesta.
- La telemetría agrega
  `create_platform_clinic_confirmation` para el tiempo hasta el éxito visible
  y `create_platform_clinic_refresh` para el trabajo en segundo plano. El
  evento `create_platform_clinic_flow` conserva la duración total para
  comparación con `PERF-001`.

Resultado en staging:

- Fecha: 30 de julio de 2026.
- Entorno: staging `zjsnfgxvaimddmchrwre`.
- Escenario: una alta autenticada exitosa con la versión de `PERF-002`.
- Correlación: `operationId`
  `09a43054-0294-4000-9633-8318a77fa07a` en los cuatro eventos del navegador.
- Sesión: 6.2 ms.
- Invocación de `create-platform-clinic`: 4,483.5 ms.
- Confirmación visible: 4,490.5 ms.
- Refresco en segundo plano: 2,041.7 ms.
- Flujo completo: 6,532.9 ms.

La línea base de `PERF-001` confirmaba después del flujo completo, a los
6,143.0 ms. Con `PERF-002`, la confirmación llegó a los 4,490.5 ms: 1,652.5 ms
antes, una reducción del 26.9 % en el tiempo visible. El refresco terminó
2,041.7 ms después sin bloquear el resultado.

El flujo completo de esta muestra fue 389.9 ms más lento que la línea base por
variación en la creación. `PERF-002` no reduce ese trabajo total: desacopla la
confirmación para que la variación del listado no retrase el éxito. Ambas
mediciones son muestras únicas y no representan p50/p95.

### PERF-003: listado administrativo liviano y paginado

Estado: cerrado el 30 de julio de 2026 después de la prueba técnica y visual
autenticada en staging.

Objetivo: que Administración DayIA no cargue más información por tener más
pagos históricos.

Trabajo:

- [x] Separar resumen de consultorios y detalle comercial.
- [x] Paginar consultorios en el servidor con orden estable.
- [x] Cargar pagos y solicitudes únicamente al abrir la gestión de un
  consultorio.
- [x] Paginar pagos y solicitudes en el servidor.
- [x] Devolver contadores agregados en lugar de colecciones completas.
- [x] Reemplazar el RPC por consultorio por una operación por lote o un proceso
  programado.

Criterio de cierre:

- [x] El peso y la cantidad de filas del resumen permanecen acotados.
- [x] Agregar pagos históricos no aumenta el payload del listado.
- [x] No existe una consulta o RPC por cada consultorio.
- [x] Se prueban primera página, página intermedia, última página y datos nuevos
  durante la navegación.

Implementación:

- `list-platform-clinics` devuelve como máximo 10 resúmenes por defecto y un
  cursor compuesto por `created_at` e `id`. Ya no consulta ni devuelve pagos o
  solicitudes individuales.
- `get-platform-clinic-billing` carga únicamente el consultorio seleccionado.
  Pagos y solicitudes pendientes usan páginas independientes de cinco filas,
  cursores estables y un máximo validado de 25.
- Los contadores de miembros y solicitudes pendientes se calculan en el
  servidor. El historial completo no se reconstruye en React.
- `apply_due_scheduled_plans(uuid[])` reemplaza la llamada RPC por cada
  consultorio y conserva un evento de auditoría por cambio aplicado.
- Los índices de `clinics`, `subscription_payments` y
  `subscription_payment_submissions` cubren el orden de los cursores.
- Las respuestas tardías de un detalle anterior se descartan y las excepciones
  de red dejan un mensaje visible en lugar de un estado de carga permanente.

Validación técnica:

- La migración `031_platform_admin_server_pagination.sql` fue recreada desde
  una base local vacía y aplicada únicamente al staging
  `zjsnfgxvaimddmchrwre`.
- `list-platform-clinics` y `get-platform-clinic-billing` fueron compiladas por
  el runtime local y desplegadas en staging.
- El pgTAP de `031` supera 10 controles tanto localmente como contra staging,
  dentro de una transacción con rollback. Cubre primera página, página
  intermedia, último tramo del conjunto, inserción concurrente, total,
  aplicación por lote y auditoría.
- La suite completa supera 714 pruebas; lint y build también pasan.

Resultado autenticado en staging:

- Administración DayIA cargó el listado y la gestión comercial con respuestas
  HTTP `200`.
- Chrome informó transferencias de 1.6–1.7 kB para
  `list-platform-clinics` y 1.5 kB para
  `get-platform-clinic-billing`.
- Diez lecturas visibles del listado estuvieron entre 1.03 y 2.38 s, con una
  mediana aproximada de 1.45 s. La única muestra visible del detalle tardó
  1.95 s.
- La muestra es demasiado pequeña para declarar p50/p95 operativos y no usó un
  volumen suficiente para mostrar el paginador de consultorios. La prueba
  transaccional de 12 filas cubre primera, intermedia, último tramo e inserción
  concurrente.

Deuda observada:

- El objetivo de escalabilidad de `PERF-003` queda cerrado: filas, consultas y
  payload ya no crecen con todo el historial.
- La latencia de lectura todavía supera el presupuesto inicial de 500 ms p50 y
  1.5 s p95. Debe separarse entre arranque de Function, validación Auth,
  consulta de perfil y RPC antes de producción. No se atribuye a tamaño del
  payload sin una medición por fases.

### PERF-004: alta atómica y búsquedas escalables

Estado: cerrado el 30 de julio de 2026 después de una creación autenticada, un
reintento idempotente y la verificación remota de invariantes en staging.

Objetivo: reducir viajes de red y evitar búsquedas que recorran todos los
usuarios.

Trabajo:

- Validar plan y tarifa antes de crear recursos.
- Usar el índice normalizado como control autoritativo de duplicados.
- Diseñar un índice global seguro para el email normalizado de perfiles.
- Eliminar la dependencia de `auth.admin.listUsers`.
- Agrupar clínica, perfil, membership y suscripción en la menor cantidad
  posible de operaciones transaccionales.
- Mantener compensación explícita porque Auth y PostgreSQL no comparten una
  transacción.
- Incorporar idempotencia para reintentos del mismo submit.

Criterio de cierre:

- No existe recorrido paginado de todos los usuarios.
- Los duplicados concurrentes producen un único consultorio.
- Una falla intermedia no deja recursos incoherentes.
- Repetir una solicitud segura no duplica clínica, owner ni suscripción.

Estado técnico al 30 de julio de 2026:

- La migración `032_atomic_platform_clinic_creation.sql` está aplicada
  únicamente en staging `zjsnfgxvaimddmchrwre`.
- Plan y tarifa se validan antes de reservar la operación o invitar en Auth.
- El payload normalizado y el administrador forman una clave idempotente. La
  reserva protege nombre y email también frente a solicitudes concurrentes.
- Clínica, perfil, membership propietaria y suscripción se confirman dentro de
  `complete_platform_clinic_creation`, una sola transacción PostgreSQL.
- Auth conserva compensación explícita. Ante un timeout del commit se consulta
  primero el ledger; solo se borra el usuario invitado si el estado
  `reserved` confirma que PostgreSQL no completó y los metadatos prueban que
  pertenece a esa solicitud.
- `lookup_auth_user_by_email` usa el predicado exacto
  `email = normalized_email and is_sso_user = false`. Localmente,
  `EXPLAIN` confirmó `Index Scan using users_email_partial_key`.
- No queda ninguna llamada a `auth.admin.listUsers` en las Edge Functions.
- El pgTAP de `032` pasa 31 controles localmente y contra staging con rollback.
  La prevalidación remota confirmó que no había emails de perfil duplicados.
- La regresión completa pasa 732 pruebas de aplicación y 105 SQL; lint, build
  y `db lint --linked --level warning` también finalizan sin errores.
- La creación autenticada controlada respondió `201`. El navegador registró
  3,700 ms y la Function 3,472.2 ms con este desglose:

  | Fase | Duración |
  | --- | ---: |
  | Usuario autenticado | 272.2 ms |
  | Autorización de plataforma | 210.6 ms |
  | Validación del payload | 0.3 ms |
  | Reserva y preflight | 648.5 ms |
  | Búsqueda exacta del owner | 612.0 ms |
  | Invitación Auth | 1,481.4 ms |
  | Persistencia PostgreSQL atómica | 241.6 ms |
  | Total interno | 3,472.2 ms |

- La invitación externa de Auth representó el 42.7 % del total interno. La
  escritura atómica de los cuatro recursos públicos representó 241.6 ms. Esta
  única muestra fresca no reduce el total frente a los 3,153.0 ms internos de
  `PERF-001`; el beneficio confirmado de este hito es escalabilidad,
  consistencia e idempotencia, no ocultar la latencia variable de Auth.
- El primer intento manual de repetición cambió la tarifa de fundador a
  estándar y recibió correctamente `409`: una solicitud comercial distinta no
  puede reutilizar el nombre de una clínica existente.
- El reintento con el payload verdaderamente idéntico terminó en 721.6 ms:

  | Fase idempotente | Duración |
  | --- | ---: |
  | Usuario autenticado | 245.8 ms |
  | Autorización de plataforma | 243.9 ms |
  | Validación del payload | 0.3 ms |
  | Recuperación en preflight | 225.8 ms |
  | Total interno | 721.6 ms |

- El reintento redujo el total interno en 2,750.6 ms, un 79.2 %, y no ejecutó
  `owner_lookup`, `owner_invitation` ni `atomic_persistence`.
- Una consulta remota de solo lectura confirmó una única solicitud, clínica,
  cuenta Auth, perfil, membership y suscripción para el alta. No se tocó
  producción.

### PERF-005: colecciones clínicas acotadas

Objetivo: que el rendimiento de un consultorio no dependa de toda su historia.

Estado: en curso desde el 4 de agosto de 2026. El subhito `PERF-005A`
(Dashboard acotado) cerró técnicamente en staging el 5 de agosto;
`PERF-005B1` y `PERF-005B2` cerraron la lectura diaria y las escrituras atómicas
de Agenda en staging. El siguiente subhito es `PERF-005C`. El hito principal
`PERF-005` solo se considerará cerrado cuando terminen A–F; después se podrá
iniciar `PERF-006`. Producción permanece intacta.

Mapa oficial de subhitos:

| Subhito | Superficie | Alcance | Estado |
| --- | --- | --- | --- |
| PERF-005A | Dashboard | Snapshot agregado y de tamaño fijo | Cerrado en staging |
| PERF-005B1 | Agenda | Lectura diaria, cursor y payload acotado | Cerrado en staging |
| PERF-005B2 | Agenda | Disponibilidad y escrituras atómicas | Cerrado en staging |
| PERF-005C | Pacientes | Búsqueda y paginación de servidor | Siguiente |
| PERF-005D | Historial clínico | Paginación por paciente y vista global | Pendiente |
| PERF-005E | Recordatorios | Ventana de ejecución, estado y cursor | Pendiente |
| PERF-005F | Odontograma y Configuración | Carga bajo demanda y columnas explícitas | Pendiente |

Las letras no reemplazan los hitos principales `PERF-001`–`PERF-008`. Son
unidades verificables dentro de `PERF-005`; B1 y B2 separan lectura y escritura
porque tienen riesgos, contratos y pruebas diferentes.

#### PERF-005A: Dashboard acotado

- La migración `033_bounded_clinic_dashboard.sql` agrega
  `get_clinic_dashboard_snapshot`, autorizada mediante
  `can_access_clinic_data`. La RPC devuelve seis agregados y límites fijos: 5
  próximas citas, 5 casos que requieren atención, 5 eventos recientes y 4
  pacientes recientes.
- El Dashboard real dejó de descargar las colecciones completas de pacientes,
  citas y `appointment_change_logs`. `App.tsx` carga pacientes y citas solo al
  entrar a módulos que realmente las consumen. El modo demo conserva los
  cálculos locales de `dashboardMetrics.ts`.
- Los índices ordenados cubren próximas citas activas, actividad reciente y
  pacientes recientes. El benchmark reproducible
  `supabase/benchmarks/033_bounded_clinic_dashboard.sql` crea 2.000 pacientes,
  20.000 citas y 20.000 eventos ficticios dentro de una transacción; los tres
  planes usan sus índices y el snapshot queda por debajo del presupuesto local
  de 1.500 ms. Todos los datos se revierten.
- La migración se recreó desde una base local vacía, pasó 13 controles pgTAP
  localmente y contra staging con rollback, y `db lint` no reportó errores en
  ambos entornos. La suite actual pasa 741 pruebas de aplicación y 118 pruebas
  SQL, además de lint y build.
Medición autenticada y móvil del 5 de agosto de 2026:

- En viewport móvil de 415 × 725, cuatro respuestas autenticadas observadas de
  `get_clinic_dashboard_snapshot` devolvieron `200`, aproximadamente 1.1 kB y
  tiempos entre 240 y 373 ms.
- La composición móvil del Dashboard mantuvo lectura y ancho correctos.
- Después de limpiar Network y entrar una sola vez al Dashboard, se observó
  exactamente una RPC: `200`, 1.1 kB y 273 ms.
- No aparecieron lecturas de `patients`, `appointments` ni
  `appointment_change_logs`. La entrada `invite-clinic-member` visible tenía
  como iniciador `clinicMembersService` y pertenecía a una operación
  independiente, no al Dashboard.
- Los estados vacío y móvil conservaron una composición legible; carga y error
  permanecen cubiertos por las pruebas de `DashboardView` y del servicio.

#### PERF-005B1: lectura diaria acotada de Agenda

Estado: cerrado técnicamente en staging el 5 de agosto de 2026 después de la
medición autenticada y la revisión móvil.

- La migración `034_bounded_clinic_agenda.sql` agrega
  `get_clinic_agenda_snapshot`, autorizada mediante
  `can_access_clinic_data`. Recibe una fecha y un cursor compuesto por hora e
  identificador; devuelve como máximo 20 filas por defecto y acepta hasta 50.
- Los KPIs cuentan el día completo aunque la lista visible esté paginada. El
  payload incluye únicamente el último evento relevante por cita y el teléfono
  necesario para su card; Agenda ya no carga toda la tabla de pacientes.
- La disponibilidad se limita a estados activos del día seleccionado. Si el
  usuario elige otra fecha para reprogramar, se solicita solo esa fecha con
  columnas explícitas. Las respuestas tardías se descartan.
- El selector conserva Hoy, Mañana, la fecha elegida y hasta ocho próximas
  fechas con actividad. Un campo de fecha permite navegar a cualquier día sin
  descargar todo el historial.
- El pgTAP local supera 15 controles de límite, cursor, conteos, auditoría,
  argumentos y aislamiento. El benchmark reversible usa 1.000 pacientes,
  20.000 citas y más de 20.000 logs; confirma ambos índices y mantiene el
  snapshot por debajo del presupuesto local de 1.500 ms.
- La migración está aplicada únicamente en staging
  `zjsnfgxvaimddmchrwre`. El historial remoto quedó alineado `001–034`, los 15
  controles pasan contra el remoto con rollback y `db lint` no reporta errores
  en `public`.
- La regresión actual supera 751 pruebas de aplicación y 133 controles SQL;
  lint, build y `git diff --check` también pasan.
- La prueba autenticada en viewport 415 × 725 observó una primera respuesta
  `200` de 0.9 kB en 464 ms y una segunda respuesta `200` de 1.0 kB en 313 ms
  al cambiar de la fecha inicial a Mañana. El preflight inicial tardó 236 ms.
  Son muestras individuales y no deben interpretarse como p50 o p95.
- La interfaz mantuvo el selector de fecha, los accesos Hoy/Mañana y los KPIs
  legibles, sin overflow horizontal ni texto cortado. El contrato estático y
  las pruebas del servicio verifican que la rama real de Agenda no recurre a
  la carga histórica completa de pacientes, citas o logs.
- La creación y reprogramación ya no dependen de esta lectura para autorizar el
  guardado; `PERF-005B2` vuelve a validar dentro de PostgreSQL.

#### PERF-005B2: disponibilidad y escritura atómicas

Estado: cerrado técnicamente en staging el 5 de agosto de 2026 después de la
prueba transaccional, autenticada y móvil.

- La migración `035_atomic_appointment_scheduling.sql` agrega
  `create_clinic_appointment` y `reschedule_clinic_appointment`.
- Ambas RPC autorizan el consultorio, adquieren un bloqueo transaccional por
  consultorio y fecha y validan horario semanal o excepción, intervalo,
  duración completa, tratamiento activo, solapamientos y una cita activa por
  paciente y día.
- El servidor resuelve `treatment_id`, nombre y duración; no confía en una
  duración enviada por React. Crear o reprogramar guarda la cita y su evento de
  auditoría en la misma transacción.
- Reprogramar compara la fecha y hora esperadas por el cliente y rechaza una
  vista desactualizada, evitando sobrescribir cambios concurrentes.
- Se revocó a `authenticated` la inserción directa de citas y la actualización
  directa de paciente, tratamiento, fecha, hora, duración y motivo de
  reprogramación. Las transiciones de estado mantienen temporalmente el flujo
  existente.
- Dos índices parciales cubren citas activas por paciente/día y rangos activos
  por consultorio/fecha. El benchmark reversible usa 1.000 pacientes y 20.000
  citas, confirma ambos planes y mantiene creación y reprogramación por debajo
  del presupuesto local de 1.500 ms.
- Los 31 controles pgTAP pasan localmente y contra staging con rollback. La
  migración remota está alineada `001–035` y `db lint` de `public` está limpio.
- La regresión completa alcanza 760 pruebas de aplicación y 164 controles SQL;
  lint, build y `git diff --check` pasan.
- El frontend traduce conflictos, horario cerrado, tratamiento inválido y
  vistas desactualizadas a mensajes seguros; nunca muestra el error técnico de
  PostgreSQL.
- En viewport 415 × 725, la creación respondió `200`, 1.1 kB y 287 ms; su
  preflight tardó 66 ms. La reprogramación respondió `200`, 1.2 kB y 418 ms;
  su preflight tardó 64 ms. Son muestras individuales, no percentiles.
- Dos pestañas conservaron el mismo horario libre con pacientes diferentes. La
  primera creación fue aceptada y la segunda fue rechazada de forma controlada
  por PostgreSQL; la Agenda conservó una sola reserva. La interfaz no presentó
  overflow durante las pruebas.

#### PERF-005C: Pacientes paginados y búsqueda de servidor

Estado: siguiente subhito; todavía no iniciado.

- Paginar el listado en servidor con límite y cursor estable.
- Ejecutar la búsqueda normalizada en PostgreSQL sin descargar todos los
  pacientes del consultorio.
- Pedir únicamente las columnas necesarias para la lista y cargar el detalle
  completo bajo demanda.
- Conservar alta, edición, resaltado del registro confirmado, estados vacío,
  carga y error, permisos por rol y composición móvil.
- Verificar índices y planes con datos ficticios, aislamiento RLS, pruebas de
  contrato y medición autenticada en staging.

#### PERF-005D: Historial clínico paginado

Estado: pendiente; comienza únicamente después de cerrar `PERF-005C`.

- Paginar registros por paciente y la vista global mediante cursor estable.
- Resolver búsqueda y filtros temporales en servidor.
- Evitar descargar el historial completo o todos los pacientes para construir
  resúmenes.
- Mantener aislamiento clínico, permisos, estados de interfaz y validación
  móvil.

#### PERF-005E: Recordatorios acotados

Estado: pendiente; comienza únicamente después de cerrar `PERF-005D`.

- Consultar una ventana operativa y estados relevantes mediante cursor.
- Evitar reconstruir la cola desde todo el historial de citas y recordatorios.
- Mantener reconciliación, trazabilidad, fallback manual y aislamiento por
  consultorio.

#### PERF-005F: Odontograma y Configuración bajo demanda

Estado: pendiente; último subhito de `PERF-005`.

- Cargar odontograma únicamente para el paciente abierto.
- Seleccionar columnas explícitas en horarios, excepciones, tratamientos y
  configuración asociada.
- Revisar índices, evitar consultas duplicadas y conservar permisos y estados
  responsive.
- Al cerrar este subhito, ejecutar la regresión conjunta A–F y decidir el cierre
  de `PERF-005` antes de iniciar `PERF-006`.

Criterio de cierre por módulo:

- Consulta limitada por `clinic_id` y por cursor, rango o paciente.
- Índices verificados con `EXPLAIN (ANALYZE, BUFFERS)` sobre datos ficticios.
- No se usa `select('*')` cuando la pantalla necesita un subconjunto estable.
- Búsqueda y filtros no obligan a descargar toda la tabla.
- Estado vacío, carga, error y móvil siguen funcionando.

### PERF-006: frontend, caché y renderizado

Objetivo: mantener interacción fluida en equipos y teléfonos modestos.

Trabajo:

- Medir chunks y dependencias compartidas con el build actual.
- Perfilar renders antes de agregar memoización.
- Cancelar o ignorar respuestas obsoletas al cambiar rápidamente de vista.
- Evitar recargas duplicadas de contexto y catálogos estables.
- Evaluar caché con invalidación explícita para planes y configuración.
- Al limpiar un formulario después de una escritura, mostrar un resumen de lo
  enviado o hacer explícitos los valores reiniciados. La prueba de `PERF-004`
  demostró que volver silenciosamente a la tarifa estándar puede confundirse
  con el payload que realmente se creó.
- Aplicar virtualización solo si una lista paginada todavía lo necesita.
- Medir móvil con red y CPU limitadas.

Criterio de cierre:

- LCP, INP y CLS cumplen el presupuesto en la prueba acordada.
- No hay peticiones duplicadas evitables al montar una vista.
- No se agregan dependencias sin justificar su costo.

### PERF-007: preparación para WhatsApp automático

Objetivo: que el envío automático no bloquee la aplicación ni duplique
mensajes.

Trabajo:

- Cola o tabla de trabajos con estados y bloqueo concurrente.
- Idempotencia por cita, tipo de recordatorio y ventana.
- Procesamiento por lotes con límites configurables.
- Reintentos con espera progresiva y límite máximo.
- Separación entre preparado, enviado, entregado y fallido.
- Límites por proveedor, trazabilidad y reanudación segura.
- Alertas por acumulación, error sostenido y credenciales inválidas.

Este hito empieza únicamente después de cerrar las rutas de datos que alimentan
los recordatorios.

### PERF-008: observabilidad y capacidad

Objetivo: detectar degradación antes de que la reporte un cliente.

Trabajo:

- Panel mínimo de latencia p50/p95, errores y volumen por operación.
- Alertas por tasa de error y latencia sostenida.
- Revisión periódica de consultas lentas e índices no utilizados.
- Registro de tamaño de tablas y crecimiento mensual.
- Prueba documentada de backup y restauración.
- Umbrales para decidir cuándo aumentar recursos de Supabase.

## Protocolo de cada hito

1. Registrar comportamiento y línea base.
2. Definir el cambio mínimo que ataca el cuello medido.
3. Agregar o ajustar pruebas funcionales y de seguridad.
4. Ejecutar `npm run lint`, `npm run test` y `npm run build`.
5. Desplegar únicamente en staging.
6. Medir de nuevo con el mismo escenario y volumen.
7. Revisar funcionamiento móvil y estados de error.
8. Documentar resultado, diferencia y riesgos restantes.
9. Marcar el hito como cerrado.
10. Preparar despliegue productivo independiente con respaldo y rollback.

## Registro de resultados

Cada hito cerrado debe agregar una fila. Los valores pendientes no deben
reemplazarse por estimaciones.

| Hito | Escenario | Antes p50/p95 | Después p50/p95 | Resultado | Fecha |
| --- | --- | --- | --- | --- | --- |
| PERF-001 | Alta autenticada de consultorio nuevo | Muestra única: 6,143 ms; sin p50/p95 | No aplica | Cerrado; Function 3,751.1 ms y refresco bloqueante 2,380.7 ms | 30 jul 2026 |
| PERF-002 | Confirmación de alta sin refresco bloqueante | Muestra única: 6,143.0 ms hasta confirmar | Muestra única: 4,490.5 ms hasta confirmar | Cerrado; confirmación 1,652.5 ms antes (26.9 %), refresco de 2,041.7 ms en segundo plano | 30 jul 2026 |
| PERF-003 | Resumen y detalle administrativo paginados | Listado anterior: 2,041.7 ms en una muestra; payload completo sin límite | Listado: 1.03–2.38 s y 1.6–1.7 kB en 10 muestras; detalle: 1.95 s y 1.5 kB en una muestra | Cerrado en escalabilidad; payload acotado, sin N+1 y con deuda de latencia registrada | 30 jul 2026 |
| PERF-004 | Alta idempotente y escritura pública atómica | Function anterior: 3,153.0 ms internos en una muestra; múltiples viajes PostgreSQL y búsqueda Auth paginada | Alta nueva: 3,472.2 ms internos; reintento idempotente: 721.6 ms | Cerrado; sin recorrido de Auth, escritura pública atómica y reintento 79.2 % más rápido sin duplicados. La invitación Auth sigue siendo el principal costo externo | 30 jul 2026 |
| PERF-005A | Snapshot acotado del Dashboard clínico | Colecciones completas de pacientes, citas y logs en el navegador; sin límite estable | Benchmark local con 2.000 pacientes, 20.000 citas y 20.000 logs: índices verificados y snapshot menor a 1.500 ms. Staging autenticado: 273 ms y 1.1 kB en una navegación limpia | Cerrado técnicamente en staging; una RPC, sin colecciones completas y con producción intacta | 5 ago 2026 |
| PERF-005B1 | Lectura diaria acotada de Agenda | Colección histórica completa de citas y pacientes | Staging móvil: 0.9–1.0 kB en 313–464 ms | Cerrado; fecha y cursor estables, KPIs completos y sin descarga histórica | 5 ago 2026 |
| PERF-005B2 | Escritura atómica de Agenda | Validación local vulnerable a reservas concurrentes | Creación 287 ms; reprogramación 418 ms; segunda reserva concurrente rechazada | Cerrado; disponibilidad autoritativa y auditoría atómica en PostgreSQL | 5 ago 2026 |

## Fuera de alcance

- No se usarán datos clínicos reales para pruebas de carga.
- No se expondrá `service_role`, JWT, emails ni nombres en telemetría.
- No se relajará RLS.
- No se eliminará auditoría para reducir escrituras.
- No se habilitará WhatsApp productivo como parte de una optimización.
- No se modificará producción mientras el hito correspondiente siga abierto.
