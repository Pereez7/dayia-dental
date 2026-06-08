# Contexto del proyecto

DayIA Dental es una aplicacion interna para consultorios dentales. El objetivo
es ayudar a registrar pacientes, organizar citas y preparar recordatorios,
especialmente pensando en una futura integracion con WhatsApp.

## Estado actual

- Frontend con React, TypeScript y Vite.
- Pruebas unitarias configuradas con Vitest.
- Git inicializado y remoto GitHub configurado.
- Layout base con sidebar, header superior y navegacion por estado local.
- Dashboard operativo con KPIs, proximas atenciones, pacientes recientes y
  resumen operativo.
- Configuracion de tratamientos del consultorio conectada con Nueva Cita.
- Componentes separados en `src/components`.
- Vistas completas en `src/views`.
- Datos mock separados en `src/data`.
- Tipos compartidos en `src/types`.
- Utilidades puras en `src/utils`.
- Pruebas unitarias para formatters, filtros y validaciones.

## Dashboard

Actualmente existe una pantalla principal operativa:

- Muestra KPIs de atenciones de hoy, atenciones del mes, pendientes por
  confirmar, pacientes registrados y reprogramadas del mes.
- Muestra maximo 5 proximas atenciones con fecha, hora, paciente, tratamiento y
  estado.
- Muestra pacientes recientes usando el estado local actual de pacientes.
- Muestra un resumen operativo con mensajes derivados de citas actuales.
- No muestra nuevos pacientes del mes porque los pacientes mock no tienen fecha
  real de registro.
- Los calculos viven en `src/utils/dashboardMetrics.ts` y tienen pruebas
  unitarias.

## Modulo pacientes

Actualmente existe:

- Listado de pacientes.
- Busqueda por nombre, apellido o telefono.
- Formulario de registro de paciente.
- Vista completa de detalle de paciente.
- Validaciones de nombre, apellido, telefono, email y fecha de nacimiento.
- Selector manual de prefijo telefonico.
- Guardado del telefono en formato internacional compacto, por ejemplo
  `+59170000000`.
- Ficha de paciente con telefono, email, fecha de nacimiento, edad, ultima
  visita y proxima cita.
- Citas asociadas al paciente usando `patientId` cuando existe y nombre exacto
  como fallback para citas mock antiguas.

Este modulo esta preparado para una futura integracion con WhatsApp, pero aun no
envia mensajes ni consume APIs externas.

El detalle de paciente se mantiene como vista completa, no como popup ni drawer,
porque mas adelante debe alojar secciones clinicas con mas contexto, como
historial clinico, odontograma, recordatorios y evoluciones.

## Modulo citas

Actualmente existe una primera version funcional en frontend:

- Usa citas mock desde `src/data/appointments.ts`.
- Mantiene las citas en estado local dentro de `src/App.tsx`.
- Muestra proximas citas agrupadas por fecha.
- Ordena las citas por fecha y hora.
- Muestra resumen superior con total de proximas citas, confirmadas, pendientes
  y reprogramadas.
- Cada cita muestra hora, paciente, tratamiento o motivo y estado.
- Los estados usan badges con colores semanticos suaves.
- Permite registrar una nueva cita desde la accion rapida `+ Cita`.
- El formulario de nueva cita permite buscar y seleccionar pacientes mock.
- La seleccion de paciente distingue el texto del buscador del paciente
  realmente seleccionado mediante un identificador interno.
- El formulario valida paciente, fecha, hora, tratamiento y estado inicial.
- La hora se elige desde un catalogo de 24 horas en intervalos de 15 minutos,
  por ejemplo `08:15`, `08:30` o `08:45`.
- Los mensajes de ayuda, seleccion y error del formulario usan espacios
  consistentes para no desalinear la grilla.
- El formulario muestra solo tratamientos activos configurados localmente.

Todavia no existe edicion, eliminacion, cancelacion real ni persistencia de
citas. Las citas nuevas solo viven en memoria durante la sesion actual.

## Configuracion

Actualmente existe una primera version de tratamientos del consultorio:

- Usa el tipo `Treatment` con `id`, `name` e `isActive`.
- Permite agregar tratamientos.
- Normaliza nombres antes de guardarlos, por ejemplo `LIMPIEZA DentaL` pasa a
  `Limpieza dental`.
- Evita duplicados ignorando acentos, mayusculas/minusculas y espacios extra.
- Permite buscar tratamientos ignorando acentos y mayusculas.
- Permite editar el nombre sin cambiar el `id`.
- Permite activar y desactivar tratamientos.
- No permite eliminar tratamientos fisicamente para evitar problemas con citas
  relacionadas.
- Muestra feedback visual por agregar, editar, activar y desactivar.
- Nueva Cita consume solo tratamientos activos desde el estado local compartido.

## Navegacion

La app usa `AppLayout` con:

- Sidebar principal.
- Acciones rapidas: `+ Paciente` y `+ Cita`.
- Header superior por seccion.
- Navegacion controlada con estado local en `App.tsx`.
- Seccion interna de detalle de paciente controlada tambien por estado local.

No se usa React Router todavia.

## Fuera de alcance actual

Todavia no existe:

- Backend.
- Base de datos.
- Supabase.
- Autenticacion.
- Integracion real con WhatsApp.
- Facturacion.
- Persistencia de datos.
