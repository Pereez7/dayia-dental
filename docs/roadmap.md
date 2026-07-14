# Roadmap

Este roadmap resume la direccion funcional de DayIA Dental. No implica que todos
los modulos esten implementados hoy.

## Modulos principales

### Dashboard

Estado: iniciado.

Implementado:

- KPIs operativos actuales de citas de hoy, pendientes de hoy, confirmadas de
  hoy, reprogramadas del mes, canceladas del mes y pacientes registrados.
- Panel visual de KPIs equilibrado para desktop y mobile.
- Proximas citas futuras activas, con maximo 5 citas y sin incluir canceladas.
- Citas que requieren atencion: pendientes proximas, reprogramaciones recientes
  y pacientes sin telefono cuando el dato existe.
- Actividad reciente basada en `changeLog`, ignorando eventos `created`.
- Resumen del mes con total, confirmadas, canceladas y reprogramadas.
- Pacientes recientes.
- Calculos puros en `src/utils/dashboardMetrics.ts`.
- Pruebas unitarias para metricas del Dashboard.

Pendiente:

- Nuevos pacientes del mes cuando exista una fecha real de registro.
- Comparativas con periodos anteriores.
- Graficos o reportes avanzados.

### Pacientes

Estado: iniciado.

Implementado:

- Listado de pacientes.
- Busqueda por nombre, apellido o telefono.
- Cards de pacientes como fichas clinicas escaneables.
- Cards de pacientes compactas con jerarquia clara: nombre principal y datos de
  contacto como secundarios.
- Formulario de registro.
- Validaciones de datos principales.
- Telefono en formato internacional.
- Detalle de paciente como vista completa.
- Ficha con datos generales, edad, ultima visita, citas activas y proxima cita
  activa.
- Resumen superior del paciente con citas activas, ultima atencion y proxima
  cita.
- Citas activas asociadas al paciente, mostradas con fecha, hora, tratamiento y
  estado.
- Historial clinico inicial dentro del detalle del paciente.
- Odontograma inicial dentro del detalle del paciente.
- Formato de fechas mediante utilidades compartidas, evitando valores ISO
  crudos y agregando año solo cuando corresponde.
- Navegacion local entre listado y detalle sin React Router.
- Pruebas unitarias para filtros, validaciones, utilidades de detalle e
  historial clinico, incluyendo citas activas y fechas opcionales.

Pendiente:

- Edicion de paciente.
- Eliminacion o desactivacion de paciente.
- Edicion y eliminacion de registros clinicos.
- Edicion avanzada del odontograma.
- Antecedentes, recetas, archivos adjuntos y evoluciones clinicas avanzadas.
- Recordatorios asociados al paciente.

### Citas

Estado: parcialmente implementado.

Implementado:

- Agenda diaria operativa enfocada en el dia seleccionado.
- Selector horizontal de dias con hoy, mañana y proximos dias con citas.
- Citas mock ordenadas por fecha y hora.
- Filtrado de citas por dia seleccionado.
- Ordenamiento de citas del dia por hora ascendente.
- Resumen diario con KPIs de total, pendientes, confirmadas, reprogramadas y
  canceladas.
- Estado vacio para dias sin citas.
- Estados visuales con badges semanticos.
- Pulido visual de Agenda diaria alineado con Recordatorios y Configuracion:
  KPIs compactos, selector de dias, cards, botones, estado vacio y panel de
  reprogramacion.
- Cards de agenda separadas en bloques de rango horario, datos del paciente,
  estado y acciones, con lectura completa de rangos como `13:00 - 13:30`.
- Confirmacion local de citas pendientes.
- Cancelacion local de citas pendientes, confirmadas o reprogramadas, sin
  eliminacion fisica y con confirmacion previa.
- Motivo obligatorio al cancelar una cita, con detalle breve si se elige
  `Otro`.
- Reprogramacion local inline de citas pendientes, confirmadas o reprogramadas.
- Motivo obligatorio al reprogramar una cita, con detalle breve si se elige
  `Otro`.
- Validacion de reprogramacion real: no permite guardar si la fecha y la hora
  nuevas son iguales a las actuales.
- Error de reprogramacion mostrado una sola vez dentro del panel, sin Toast
  duplicado.
- Detalle `Otro` limitado a 120 caracteres con contador visual y textarea
  estable.
- Cierre del panel de reprogramacion al cambiar de dia, al repetir la accion
  `Reprogramar`, al cancelar el formulario o al cancelar la cita.
- Limpieza de fecha, hora, motivo, detalle de `Otro` y errores inline al cerrar
  el panel de reprogramacion.
- Ocultamiento de acciones externas de la cita mientras el panel de
  reprogramacion esta abierto.
- Bloqueo de reprogramacion para citas canceladas desde UI, validacion y estado
  principal.
- `ConfirmDialog` reutilizable para confirmar cancelacion de citas sin usar la
  confirmacion nativa del navegador.
- Toast flotante de exito al confirmar y de aviso al cancelar.
- Motivos de cancelacion y reprogramacion guardados en la cita y mostrados como
  texto secundario compacto en la card cuando corresponde.
- Historial simple de cambios de cita con eventos de creacion, confirmacion,
  cancelacion y reprogramacion.
- Ultimo cambio visible en la card solo para confirmacion, cancelacion o
  reprogramacion; el evento `created` se conserva internamente.
- Citas canceladas visibles en agenda y sin bloqueo de horarios en Nueva Cita.
- Citas canceladas no reprogramables directamente; si el paciente desea volver,
  se crea una nueva cita.
- Recordatorios no generados para citas canceladas.
- Formulario de nueva cita.
- Busqueda y seleccion de pacientes mock para agendar.
- Seleccion real de paciente separada del texto del buscador.
- Catalogo inicial tipado de tratamientos.
- Nueva Cita consume solo tratamientos activos definidos en Configuracion.
- Selector de hora con horarios exactos de 24 horas en intervalos de 15 minutos.
- Horas disponibles calculadas desde horarios del consultorio, intervalo de
  atencion, excepciones del calendario, duracion del tratamiento y citas
  existentes.
- Ocultamiento de horas cuyo rango completo se solaparia con citas pendientes,
  confirmadas o reprogramadas.
- Validacion final de solapamiento por rango horario, permitiendo citas
  consecutivas cuando una empieza exactamente al terminar otra.
- Reprogramacion con disponibilidad por duracion e ignorando la cita actual al
  validar rangos.
- Nueva Cita y Reprogramar respetan fechas cerradas por excepcion.
- Nueva Cita y Reprogramar respetan horarios especiales configurados para una
  fecha puntual.
- Fallback seguro de 30 minutos para citas antiguas sin duracion resoluble.
- Bloqueo de doble cita activa del mismo paciente en el mismo dia.
- Mensaje cuando una fecha no tiene horarios disponibles.
- Autocompletado nativo del navegador desactivado en el buscador de pacientes
  de Nueva Cita.
- Validaciones de paciente, fecha, hora, tratamiento y estado inicial.
- Validacion de hora contra el catalogo de intervalos de 15 minutos.
- Creacion local de citas en memoria.

Pendiente:

- Edicion de cita.
- Eliminacion real.
- Auditoria completa de cambios por cita, con usuario, fecha y hora del cambio.
- Vista dedicada para historial avanzado de cambios por cita.
- Mas estados funcionales conectados a acciones.
- Estados intermedios como `Solicitud de cancelacion` cuando exista integracion
  real con WhatsApp.
- Calendario mensual.
- Multiples doctores o sillones.
- Feriados recurrentes o reglas avanzadas de calendario.
- Persistencia.
- Integracion con WhatsApp.

### Historial clinico

Estado: parcialmente implementado.

Implementado:

- Tipo compartido `ClinicalRecord`.
- Datos mock asociados a pacientes existentes.
- Estado local compartido en `App.tsx`.
- Visualizacion dentro del detalle de paciente.
- Vista global desde el modulo lateral `Historial clinico`.
- Filtrado por `patientId`.
- Ordenamiento del mas reciente al mas antiguo.
- Formulario para agregar evolucion clinica basica.
- Validacion de campos obligatorios y fecha no futura.
- Normalizacion de textos clinicos antes de guardar.
- Fechas del historial con año.
- Resumen temporal de cantidad y rango de registros.
- Agrupacion global de registros por paciente para evitar repetir una card por
  cada evolucion clinica.
- Cards globales con nombre, telefono, total de registros, fecha del ultimo
  registro, ultimo motivo, ultimo diagnostico y ultimo tratamiento.
- Expansion controlada para mostrar hasta los ultimos 3 registros del paciente.
- Busqueda global por paciente, motivo, diagnostico, tratamiento y
  observaciones.
- Filtros globales: todos, este mes y ultimos 30 dias.
- KPIs globales de registros visibles, registros del mes y pacientes con
  historial.
- Fechas globales cortas como `18 may`, con año solo cuando corresponde.
- Formatter de presentacion para textos clinicos visibles, sin modificar el
  dato original.
- Pulido visual mobile-first con acentos clinicos suaves, badges compactos y
  botones secundarios.
- Pruebas unitarias para filtrado, ordenamiento, validacion, normalizacion,
  resumen temporal, agrupacion global, busqueda global, fechas y textos de
  presentacion.

Pendiente:

- Edicion de registros clinicos.
- Eliminacion de registros clinicos.
- Antecedentes clinicos estructurados.
- Recetas.
- Impresion PDF.
- Archivos adjuntos.
- Firma digital.

### Odontograma

Estado: iniciado dentro del detalle de paciente.

Implementado:

- Tipo compartido `OdontogramEntry`.
- Datos mock asociados a pacientes existentes.
- Estado local compartido en `App.tsx`.
- Visualizacion dentro del detalle de paciente.
- Piezas permanentes adultas con numeracion FDI.
- Arcada superior e inferior con cuadrantes FDI identificados por derecha e
  izquierda del paciente.
- Grilla simple y responsive de piezas dentales.
- Estados iniciales: sano, caries, restaurado, ausente, tratamiento pendiente,
  en observacion y otro.
- Estado `Sano` por defecto para piezas sin entrada guardada.
- Colores suaves por estado.
- Resumen de cantidad de piezas por estado.
- Seleccion de pieza y panel simple de actualizacion.
- Estado actual mostrado como badge con color semantico.
- Actualizacion o creacion de entrada por `patientId` y `toothNumber`.
- Lectura por pieza sobre entradas ya filtradas del paciente.
- Observaciones con limite de 160 caracteres, contador discreto, textarea
  estable y normalizacion antes de guardar.
- Fecha de ultima actualizacion con `formatAppDate`, mostrando año solo cuando
  corresponde.
- Toast flotante de confirmacion al guardar.
- Pruebas unitarias para generacion de piezas, filtrado, resumen, validacion y
  actualizacion de entradas.

Pendiente:

- Odontograma grafico avanzado.
- Superficies dentales.
- Denticion temporal infantil.
- Historial de cambios por pieza.
- Edicion avanzada.
- Eliminacion de entradas.
- Impresion PDF.
- Imagenes o radiografias.

### Recordatorios WhatsApp

Estado: iniciado.

Implementado:

- Vista inicial de Recordatorios WhatsApp con datos locales.
- Generacion de recordatorios desde citas futuras activas.
- Exclusion de citas canceladas en generacion, KPIs y cola visible.
- Soporte de citas pendientes, confirmadas y reprogramadas.
- Recordatorios de `24h` y `2h` cuando su horario programado queda en el
  futuro.
- Omision de recordatorios que ya quedaron en el pasado por registro tardio.
- Confirmacion inmediata para citas muy cercanas, cuando ya no aplica `24h` ni
  `2h`.
- Agrupacion por fecha y cita.
- Selector horizontal por fecha.
- Filtros compactos por estado.
- KPIs de todos, pendientes, programados, enviados simulados y fallidos.
- KPIs calculados solo desde recordatorios validos de citas activas.
- Vista previa del mensaje sugerido.
- Mensajes sugeridos diferenciados por estado de cita:
  pendiente, confirmada y reprogramada.
- Uso de fecha y hora vigente para recordatorios de citas reprogramadas.
- Formato visible corto 24 horas en filas de recordatorio, por ejemplo
  `15 jun, 10:00`.
- Priorizacion de recordatorios pendientes de citas pendientes.
- Marcado local como enviado o fallido.
- Manejo visual y defensivo de pacientes sin telefono: no permite marcar
  enviado si falta telefono.
- Estado vacio para cuando no existen recordatorios de citas activas.
- Toast flotante reutilizable para feedback sin mover el layout.
- Pruebas unitarias para generacion, omisiones, confirmacion inmediata,
  agrupacion, filtros, estados, mensajes por estado, formato visible 24h y
  bloqueo de enviado sin telefono.

Pendiente:

- Envio real por WhatsApp API.
- Persistencia de estados de recordatorio.
- Plantillas configurables.
- Programacion real de jobs o tareas.
- Historial de intentos de envio.
- Edicion de telefono desde el flujo de recordatorios.
- Preferencias de notificacion por paciente o consultorio.

### Configuracion

Estado: iniciado.

Implementado:

- Horarios del consultorio.
- Horario semanal base.
- Estado abierto/cerrado por dia.
- Intervalo de atencion configurable.
- Validacion local de horarios.
- Toast flotante al guardar horarios.
- Separacion visual entre Horarios del consultorio, Excepciones del calendario
  y Tratamientos.
- Fondo suave compartido entre los bloques principales de Configuracion.
- Boton `Guardar horarios` asociado visualmente a la tabla semanal.
- Excepciones del calendario para cerrar fechas puntuales.
- Excepciones del calendario con horario especial para una fecha puntual.
- Validacion de excepciones para evitar fechas duplicadas y rangos invalidos.
- Eliminacion de excepciones con `ConfirmDialog`.
- Toast flotante al agregar o eliminar excepciones.
- Tratamientos del consultorio.
- Alta local de tratamientos.
- Normalizacion y capitalizacion de nombres.
- Validacion de duplicados ignorando acentos, mayusculas/minusculas y espacios
  extra.
- Busqueda de tratamientos.
- Edicion simple sin cambiar `id`.
- Activacion y desactivacion sin eliminacion fisica.
- Confirmacion previa con `ConfirmDialog` antes de desactivar tratamientos.
- Toast flotante por agregar, editar, activar y desactivar sin mover el layout.
- Botones compactos y coherentes con Recordatorios.
- Conexion con Nueva Cita para mostrar solo tratamientos activos.
- Pruebas unitarias para utilidades de tratamientos y horarios.

Pendiente:

- Datos del consultorio.
- Usuarios.
- Preferencias y ajustes de notificaciones.
- Persistencia de tratamientos.
- Persistencia de horarios.
- Edicion directa de excepciones existentes.
- Feriados recurrentes.

## Pendientes generales

- Mejorar navegacion a medida que crezcan los modulos.
- Seguir refinando diseno visual general sin romper flujos existentes.
- Evaluar mas adelante iconos, graficos o una navegacion movil mas avanzada.
- Ampliar historial clinico.
- Ampliar odontograma.
- Integrar WhatsApp.
- Integrar Supabase.
- Agregar autenticacion.
- Evaluar facturacion.
- Desplegar y probar manualmente `create-platform-clinic` en un entorno
  controlado, administrando su feature flag exclusivamente desde Supabase.
- Verificar invitación y activación del owner antes de habilitar altas reales.
