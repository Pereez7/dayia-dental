# Changelog

Registro breve de cambios relevantes en DayIA Dental.

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
- Se actualizo la documentacion para reflejar el estado real del proyecto.

### Motivo del cambio

Avanzar el modulo de citas desde una agenda solamente visual hacia un flujo
frontend funcional de registro local, manteniendo la logica testeable, una
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
