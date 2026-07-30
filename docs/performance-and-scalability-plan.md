# Plan de rendimiento y escalabilidad

Este documento dirige la optimización de DayIA Dental antes de producción.
El objetivo no es mejorar tiempos de forma aislada, sino impedir que el costo
de las operaciones crezca sin control cuando aumenten los consultorios,
usuarios, pacientes, citas, pagos y recordatorios.

Última actualización: 30 de julio de 2026.

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

Objetivo: mostrar el éxito cuando la Function confirme la creación, sin esperar
la reconstrucción completa del listado.

Trabajo:

- Separar el resultado de creación del refresco.
- Mantener el refresco en segundo plano.
- Informar si el consultorio fue creado pero el listado no pudo actualizarse.
- Conservar el bloqueo contra doble envío.
- No adelantar el éxito al envío real de la invitación.

Criterio de cierre:

- El tiempo hasta la confirmación ya no incluye `list-platform-clinics`.
- El nuevo consultorio aparece al finalizar el refresco.
- Un fallo de refresco no transforma una creación exitosa en un falso error.
- Pruebas de éxito, error, doble envío y refresco pasan.

### PERF-003: listado administrativo liviano y paginado

Objetivo: que Administración DayIA no cargue más información por tener más
pagos históricos.

Trabajo:

- Separar resumen de consultorios y detalle comercial.
- Paginar consultorios en el servidor con orden estable.
- Cargar pagos y solicitudes únicamente al abrir la gestión de un consultorio.
- Paginar pagos y solicitudes en el servidor.
- Devolver contadores agregados en lugar de colecciones completas.
- Reemplazar el RPC por consultorio por una operación por lote o un proceso
  programado.

Criterio de cierre:

- El peso y la cantidad de filas del resumen permanecen acotados.
- Agregar pagos históricos no aumenta el payload del listado.
- No existe una consulta o RPC por cada consultorio.
- Se prueban primera página, página intermedia, última página y datos nuevos
  durante la navegación.

### PERF-004: alta atómica y búsquedas escalables

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

### PERF-005: colecciones clínicas acotadas

Objetivo: que el rendimiento de un consultorio no dependa de toda su historia.

Orden de revisión:

1. Citas y Dashboard: ventana temporal, agregados y próximas citas limitadas.
2. Pacientes: búsqueda y paginación de servidor.
3. Historial clínico: paginación por paciente y global.
4. Recordatorios: ventana de ejecución, estado y cursor.
5. Odontograma y configuración: carga bajo demanda y columnas explícitas.

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

## Fuera de alcance

- No se usarán datos clínicos reales para pruebas de carga.
- No se expondrá `service_role`, JWT, emails ni nombres en telemetría.
- No se relajará RLS.
- No se eliminará auditoría para reducir escrituras.
- No se habilitará WhatsApp productivo como parte de una optimización.
- No se modificará producción mientras el hito correspondiente siga abierto.
