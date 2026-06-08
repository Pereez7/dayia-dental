# Contexto del proyecto

DayIA Dental es una aplicacion interna para consultorios dentales. El objetivo
es ayudar a registrar pacientes, organizar citas y preparar recordatorios,
especialmente pensando en una futura integracion con WhatsApp.

## Estado actual

- Frontend con React, TypeScript y Vite.
- Pruebas unitarias configuradas con Vitest.
- Git inicializado y remoto GitHub configurado.
- Layout base con sidebar, header superior y navegacion por estado local.
- Componentes separados en `src/components`.
- Vistas completas en `src/views`.
- Datos mock separados en `src/data`.
- Tipos compartidos en `src/types`.
- Utilidades puras en `src/utils`.
- Pruebas unitarias para formatters, filtros y validaciones.

## Modulo pacientes

Actualmente existe:

- Listado de pacientes.
- Busqueda por nombre, apellido o telefono.
- Formulario de registro de paciente.
- Validaciones de nombre, apellido, telefono, email y fecha de nacimiento.
- Selector manual de prefijo telefonico.
- Guardado del telefono en formato internacional compacto, por ejemplo
  `+59170000000`.

Este modulo esta preparado para una futura integracion con WhatsApp, pero aun no
envia mensajes ni consume APIs externas.

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
- El formulario valida paciente, fecha, hora, tratamiento y estado inicial.
- Los tratamientos disponibles viven en `src/data/treatments.ts`.

Todavia no existe edicion, eliminacion, cancelacion real ni persistencia de
citas. Las citas nuevas solo viven en memoria durante la sesion actual.

## Navegacion

La app usa `AppLayout` con:

- Sidebar principal.
- Acciones rapidas: `+ Paciente` y `+ Cita`.
- Header superior por seccion.
- Navegacion controlada con estado local en `App.tsx`.

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
