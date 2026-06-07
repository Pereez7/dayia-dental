# Changelog

Registro breve de cambios relevantes en DayIA Dental.

## 2026-06-07

### Cambios realizados

- Se agrego el tipo `Patient` en `src/types`.
- Se agregaron pacientes mock en `src/data/patients.ts`.
- Se crearon los componentes `PatientsList` y `PatientCard`.
- Se integro un listado simple de pacientes en la pantalla principal.
- Se agrego busqueda frontend por nombre, apellido o telefono.
- Se agrego `filterPatients` como funcion pura testeable.
- Se agregaron pruebas unitarias para el filtro de pacientes.
- Se agregaron estilos responsive para tarjetas de pacientes.
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
