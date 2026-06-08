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
- Seleccion real de paciente separada del texto del buscador.
- Catalogo mock de tratamientos.
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
