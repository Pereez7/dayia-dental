# Changelog

Registro breve de cambios relevantes en DayIA Dental.

## 2026-06-09

### Cambios realizados

- Se agrego el tipo `ClinicalRecord` para representar registros clinicos por
  paciente.
- Se agregaron datos mock de historial clinico en `src/data/clinicalRecords.ts`.
- Se agrego estado local de registros clinicos en `src/App.tsx`.
- Se integro el historial clinico dentro del detalle de paciente.
- Se agrego formulario para registrar evoluciones clinicas basicas.
- Se agrego listado de registros clinicos asociados por `patientId`.
- Se ordenan los registros clinicos del mas reciente al mas antiguo.
- Se agrego validacion de campos obligatorios y fecha no futura.
- Se agrego mensaje de exito al guardar un registro clinico.
- Se agrego normalizacion reutilizable de textos en `src/utils/textNormalizers.ts`.
- Se normalizan motivo, diagnostico, tratamiento y observaciones antes de
  guardar.
- Se agrego formateo de fechas clinicas con año en
  `src/utils/dateFormatters.ts`.
- Se agrego resumen temporal del historial clinico, con cantidad de registros y
  rango de fechas.
- Se agregaron pruebas unitarias para historial clinico, normalizacion de texto
  y formateo de fechas.
- Se actualizo la documentacion del proyecto para reflejar el historial clinico
  inicial.

### Motivo del cambio

Preparar DayIA Dental para seguimiento odontologico por paciente, manteniendo el
historial dentro del detalle del paciente y sin introducir backend,
persistencia, odontograma ni pantalla global de historial clinico todavia.

## 2026-06-08

### Cambios realizados

- Se agrego el tipo `AppointmentFormValues` y errores de formulario de citas.
- Se agrego `patientId` al formulario de citas para distinguir texto de busqueda
  de paciente realmente seleccionado.
- Se corrigio la validacion de paciente para evitar mostrar seleccion positiva y
  error al mismo tiempo.
- Se estabilizo la grilla del formulario de nueva cita con zonas de mensaje
  consistentes.
- Se agrego el catalogo mock de tratamientos en `src/data/treatments.ts`.
- Se creo `AppointmentForm` para registrar nuevas citas desde el frontend.
- Se agrego busqueda y seleccion de pacientes dentro del formulario de citas.
- Se agregaron validaciones puras para paciente, fecha, hora, tratamiento y
  estado inicial de citas.
- Se agrego un catalogo de horarios exactos de 24 horas en intervalos de 15
  minutos.
- Se cambio el selector de hora para elegir valores como `08:15`, `08:30` o
  `08:45`, evitando seleccion minuto a minuto.
- Se valido que la hora seleccionada pertenezca al catalogo de intervalos de 15
  minutos.
- Se agregaron pruebas unitarias para validaciones de citas.
- Se agregaron pruebas unitarias para el catalogo de horarios.
- Se conecto la accion rapida `+ Cita` con el formulario de nueva cita.
- Se agrego creacion local de citas en memoria desde `App.tsx`.
- Se hizo que Dashboard y Agenda usen el estado local actualizado de citas.
- Se levanto el estado local de pacientes a `src/App.tsx` para compartirlo con
  Dashboard, Pacientes y Nueva Cita.
- Se mejoro el Dashboard con KPIs operativos, proximas atenciones, pacientes
  recientes y resumen operativo.
- Se agregaron componentes visuales especificos para el Dashboard.
- Se agrego `dashboardMetrics` como utilidad pura para calcular indicadores,
  citas de hoy, citas del mes, proximas citas, pacientes recientes y mensajes
  operativos.
- Se agregaron pruebas unitarias para las metricas del Dashboard.
- Se ajustaron los KPIs del Dashboard a: atenciones de hoy, atenciones del mes,
  pendientes por confirmar, pacientes registrados y reprogramadas del mes.
- Se elimino temporalmente el KPI de nuevos pacientes del mes porque no existe
  una fecha real de registro en los pacientes mock.
- Se agrego el tipo `Treatment` con `id`, `name` e `isActive`.
- Se convirtio `src/data/treatments.ts` en un catalogo tipado de tratamientos.
- Se levanto el estado local de tratamientos a `src/App.tsx` para compartirlo
  entre Configuracion y Nueva Cita.
- Se implemento Configuracion > Tratamientos del consultorio.
- Se agrego alta local de tratamientos con normalizacion de nombres.
- Se agrego busqueda de tratamientos ignorando acentos y mayusculas.
- Se agrego edicion simple de tratamientos conservando el mismo `id`.
- Se agrego activacion y desactivacion de tratamientos sin eliminacion fisica.
- Se agregaron mensajes de exito por agregar, editar, activar y desactivar.
- Se ajustaron colores de feedback y botones: verde para agregar/activar,
  ambar para editar y rojo suave para desactivar.
- Se conecto Nueva Cita para mostrar solo tratamientos activos.
- Se agregaron utilidades puras para tratamientos y pruebas unitarias.
- Se redujo repeticion visual de encabezados manteniendo la marca en el sidebar.
- Se agrego la vista completa de detalle de paciente desde el modulo Pacientes.
- Se agrego navegacion local hacia detalle de paciente sin React Router.
- Se agrego una ficha de paciente con nombre, telefono, email, fecha de
  nacimiento, edad, ultima visita y proxima cita.
- Se agrego listado de citas asociadas al paciente con fecha, hora, tratamiento
  y estado.
- Se agrego asociacion de citas por `patientId` y fallback por nombre exacto
  para citas mock antiguas.
- Se agregaron utilidades puras para detalle de paciente y pruebas unitarias.
- Se unificaron clases globales de botones para acciones primarias,
  secundarias, suaves, de advertencia, exito y peligro.
- Se dejo la estructura visual del detalle preparada para futuros modulos
  clinicos como historial, odontograma, recordatorios y evoluciones.
- Se actualizo la documentacion para reflejar el estado real del proyecto.

### Motivo del cambio

Avanzar los modulos principales desde vistas solamente visuales hacia flujos
frontend funcionales, con estado local compartido, logica testeable, una
interfaz estable y sin introducir backend ni persistencia todavia.

## 2026-06-07

### Cambios realizados

- Se agrego el tipo `Patient` en `src/types`.
- Se agregaron pacientes mock en `src/data/patients.ts`.
- Se crearon los componentes `PatientsList` y `PatientCard`.
- Se integro un listado simple de pacientes en la pantalla principal.
- Se agrego busqueda frontend por nombre, apellido o telefono.
- Se agrego `filterPatients` como funcion pura testeable.
- Se agregaron pruebas unitarias para el filtro de pacientes.
- Se agrego formulario frontend para registrar pacientes.
- Se agregaron validaciones puras para campos obligatorios del paciente.
- Se mejoraron validaciones de nombre, apellido, telefono y email.
- Se agrego validacion de fecha de nacimiento opcional.
- Se corrigio la visualizacion de errores de email y fecha de nacimiento.
- Se agrego validacion de longitud minima para telefono.
- Se separo el telefono del formulario en prefijo de pais y numero local.
- Se guarda el telefono del paciente en formato internacional compacto.
- Se agrego mensaje visual de exito al registrar pacientes.
- Se agregaron pruebas unitarias para validaciones de pacientes.
- Se agrego layout base con sidebar, header superior y navegacion local.
- Se rediseño la navegacion principal con mapa futuro de modulos.
- Se agregaron subitems simples para Pacientes y Citas.
- Se agregaron acciones rapidas para nuevo paciente y nueva cita.
- Se simplifico el sidebar eliminando submenus visibles duplicados.
- Se agregaron placeholders para Historial clinico, Odontograma y Recordatorios WhatsApp.
- Se crearon vistas iniciales para Dashboard, Pacientes, Citas y Configuracion.
- Se movio el flujo de pacientes a `PatientsView`.
- Se agrego primera agenda mobile-first de citas.
- Se agrego ordenamiento puro de citas por fecha y hora.
- Se agregaron pruebas unitarias para ordenamiento de citas.
- Se agregaron estilos responsive para tarjetas de pacientes.
- Se agrego documentacion de contexto del proyecto.
- Se agrego roadmap funcional.
- Se actualizo la documentacion tecnica.

### Motivo del cambio

Iniciar el modulo de pacientes con una estructura simple, tipada y preparada
para crecer sin introducir backend, autenticacion ni arquitectura innecesaria.

## 2026-06-05

### Cambios realizados

- Se inicio el proyecto con React, Vite y TypeScript.
- Se limpio la plantilla inicial de Vite.
- Se creo una pantalla base tipo dashboard para citas odontologicas.
- Se agrego responsive basico para celular, tablet y escritorio.
- Se separaron datos de ejemplo en `src/data`.
- Se separo la interfaz en componentes pequenos.
- Se creo una capa de utilidades en `src/utils`.
- Se agregaron pruebas unitarias basicas con Vitest.
- Se agrego documentacion tecnica minima.

### Motivo del cambio

Crear una base ordenada, entendible y preparada para crecer paso a paso sin
mezclar UI, datos, formateo y pruebas en los mismos archivos.
