# Roadmap

Este roadmap resume la direccion funcional de DayIA Dental. No implica que todos
los modulos esten implementados hoy.

## Modulos principales

### Dashboard

Estado: iniciado.

Muestra un resumen inicial de citas y proximas atenciones usando el estado local
actual. Debe crecer hacia citas del dia, pacientes recientes, pendientes y
actividad relevante del consultorio.

### Pacientes

Estado: iniciado.

Incluye listado, busqueda, formulario de registro, validaciones y telefono en
formato internacional.

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
- Catalogo mock de tratamientos.
- Validaciones de paciente, fecha, hora, tratamiento y estado inicial.
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

Estado: placeholder.

Pendiente datos del consultorio, horarios, usuarios, preferencias y ajustes de
notificaciones.

## Pendientes generales

- Mejorar navegacion a medida que crezcan los modulos.
- Mejorar diseno visual general.
- Implementar historial clinico.
- Implementar odontograma.
- Integrar WhatsApp.
- Integrar Supabase.
- Agregar autenticacion.
- Evaluar facturacion.
