# Roadmap

Este roadmap resume la direccion funcional de DayIA Dental. No implica que todos
los modulos esten implementados hoy.

## Modulos principales

### Dashboard

Estado: iniciado.

Implementado:

- KPIs operativos de atenciones de hoy, atenciones del mes, pendientes por
  confirmar, pacientes registrados y reprogramadas del mes.
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
- Formulario de registro.
- Validaciones de datos principales.
- Telefono en formato internacional.
- Detalle de paciente como vista completa.
- Ficha con datos generales, edad, ultima visita y proxima cita.
- Citas asociadas al paciente.
- Navegacion local entre listado y detalle sin React Router.
- Pruebas unitarias para filtros, validaciones y utilidades de detalle.

Pendiente:

- Edicion de paciente.
- Eliminacion o desactivacion de paciente.
- Historial clinico dentro de la ficha.
- Odontograma dentro de la ficha.
- Recordatorios y evoluciones clinicas.

### Citas

Estado: parcialmente implementado.

Implementado:

- Agenda visual de proximas citas.
- Citas mock ordenadas por fecha y hora.
- Agrupacion por fecha.
- Resumen superior con KPIs.
- Estados visuales con badges semanticos.
- Formulario de nueva cita.
- Busqueda y seleccion de pacientes mock para agendar.
- Seleccion real de paciente separada del texto del buscador.
- Catalogo inicial tipado de tratamientos.
- Nueva Cita consume solo tratamientos activos definidos en Configuracion.
- Selector de hora con horarios exactos de 24 horas en intervalos de 15 minutos.
- Validaciones de paciente, fecha, hora, tratamiento y estado inicial.
- Validacion de hora contra el catalogo de intervalos de 15 minutos.
- Creacion local de citas en memoria.

Pendiente:

- Edicion de cita.
- Eliminacion o cancelacion real.
- Estados funcionales conectados a acciones.
- Persistencia.
- Integracion con WhatsApp.

### Historial clinico

Estado: placeholder.

Pendiente definir estructura clinica, evoluciones, notas, antecedentes y
relacion con pacientes.

### Odontograma

Estado: placeholder.

Pendiente definir representacion visual, piezas dentales, tratamientos y
observaciones.

### Recordatorios WhatsApp

Estado: placeholder.

Pendiente definir plantillas, programacion, estados de envio e integracion con
WhatsApp API.

### Configuracion

Estado: iniciado.

Implementado:

- Tratamientos del consultorio.
- Alta local de tratamientos.
- Normalizacion y capitalizacion de nombres.
- Validacion de duplicados ignorando acentos, mayusculas/minusculas y espacios
  extra.
- Busqueda de tratamientos.
- Edicion simple sin cambiar `id`.
- Activacion y desactivacion sin eliminacion fisica.
- Feedback visual por agregar, editar, activar y desactivar.
- Conexion con Nueva Cita para mostrar solo tratamientos activos.
- Pruebas unitarias para utilidades de tratamientos.

Pendiente:

- Datos del consultorio.
- Horarios.
- Usuarios.
- Preferencias y ajustes de notificaciones.
- Persistencia de tratamientos.

## Pendientes generales

- Mejorar navegacion a medida que crezcan los modulos.
- Mejorar diseno visual general.
- Implementar historial clinico.
- Implementar odontograma.
- Integrar WhatsApp.
- Integrar Supabase.
- Agregar autenticacion.
- Evaluar facturacion.
