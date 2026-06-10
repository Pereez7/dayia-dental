# Roadmap

Este roadmap resume la direccion funcional de DayIA Dental. No implica que todos
los modulos esten implementados hoy.

## Modulos principales

### Dashboard

Estado: iniciado.

Implementado:

- KPIs operativos de atenciones de hoy, atenciones del mes, pendientes por
  confirmar, pacientes registrados y reprogramadas del mes.
- Panel visual de KPIs equilibrado para desktop y mobile.
- Proximas atenciones, con maximo 5 citas.
- Pacientes recientes.
- Resumen operativo con mensajes derivados de los datos actuales.
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
- Formulario de registro.
- Validaciones de datos principales.
- Telefono en formato internacional.
- Detalle de paciente como vista completa.
- Ficha con datos generales, edad, ultima visita y proxima cita.
- Citas asociadas al paciente.
- Historial clinico inicial dentro del detalle del paciente.
- Odontograma inicial dentro del detalle del paciente.
- Navegacion local entre listado y detalle sin React Router.
- Pruebas unitarias para filtros, validaciones, utilidades de detalle e
  historial clinico.

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
- Formulario de nueva cita.
- Busqueda y seleccion de pacientes mock para agendar.
- Seleccion real de paciente separada del texto del buscador.
- Catalogo inicial tipado de tratamientos.
- Nueva Cita consume solo tratamientos activos definidos en Configuracion.
- Selector de hora con horarios exactos de 24 horas en intervalos de 15 minutos.
- Horas disponibles calculadas desde horarios del consultorio, intervalo de
  atencion y citas existentes.
- Ocultamiento de horas ocupadas por citas pendientes, confirmadas o
  reprogramadas.
- Validacion final de choque exacto por fecha y hora.
- Bloqueo de doble cita activa del mismo paciente en el mismo dia.
- Mensaje cuando una fecha no tiene horarios disponibles.
- Autocompletado nativo del navegador desactivado en el buscador de pacientes
  de Nueva Cita.
- Validaciones de paciente, fecha, hora, tratamiento y estado inicial.
- Validacion de hora contra el catalogo de intervalos de 15 minutos.
- Creacion local de citas en memoria.

Pendiente:

- Edicion de cita.
- Eliminacion o cancelacion real.
- Estados funcionales conectados a acciones.
- Calendario mensual.
- Duracion real por tratamiento.
- Multiples doctores o sillones.
- Excepciones de calendario, feriados y cierres especiales.
- Persistencia.
- Integracion con WhatsApp.

### Historial clinico

Estado: iniciado dentro del detalle de paciente.

Implementado:

- Tipo compartido `ClinicalRecord`.
- Datos mock asociados a pacientes existentes.
- Estado local compartido en `App.tsx`.
- Visualizacion dentro del detalle de paciente.
- Filtrado por `patientId`.
- Ordenamiento del mas reciente al mas antiguo.
- Formulario para agregar evolucion clinica basica.
- Validacion de campos obligatorios y fecha no futura.
- Normalizacion de textos clinicos antes de guardar.
- Fechas del historial con año.
- Resumen temporal de cantidad y rango de registros.
- Pruebas unitarias para filtrado, ordenamiento, validacion, normalizacion y
  resumen temporal.

Pendiente:

- Pantalla global de historial clinico.
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
- Grilla simple y responsive de piezas dentales.
- Estados iniciales: sano, caries, restaurado, ausente, tratamiento pendiente,
  en observacion y otro.
- Colores suaves por estado.
- Resumen de cantidad de piezas por estado.
- Seleccion de pieza y panel simple de actualizacion.
- Actualizacion o creacion de entrada por `patientId` y `toothNumber`.
- Normalizacion de observaciones antes de guardar.
- Fecha de ultima actualizacion con formato compacto con año.
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
- Generacion de recordatorios desde citas futuras.
- Recordatorios de `24h` y `2h` cuando su horario programado queda en el
  futuro.
- Omision de recordatorios que ya quedaron en el pasado por registro tardio.
- Confirmacion inmediata para citas muy cercanas, cuando ya no aplica `24h` ni
  `2h`.
- Agrupacion por fecha y cita.
- Selector horizontal por fecha.
- Filtros compactos por estado.
- KPIs de todos, pendientes, programados, enviados simulados y fallidos.
- Vista previa del mensaje sugerido.
- Marcado local como enviado o fallido.
- Manejo visual de pacientes sin telefono.
- Toast flotante reutilizable para feedback sin mover el layout.
- Pruebas unitarias para generacion, omisiones, confirmacion inmediata,
  agrupacion, filtros y estados.

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
- Bloque informativo de futuras excepciones del calendario.
- Tratamientos del consultorio.
- Alta local de tratamientos.
- Normalizacion y capitalizacion de nombres.
- Validacion de duplicados ignorando acentos, mayusculas/minusculas y espacios
  extra.
- Busqueda de tratamientos.
- Edicion simple sin cambiar `id`.
- Activacion y desactivacion sin eliminacion fisica.
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
- Excepciones reales de calendario.

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
