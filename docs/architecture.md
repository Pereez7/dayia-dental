# Arquitectura

DayIA Dental empieza como una aplicacion frontend interna para clinicas
dentales. Por ahora no incluye backend, base de datos ni autenticacion.

## Estructura de carpetas

```text
src/
  components/
  data/
  types/
  utils/
  App.tsx
  App.css
  index.css
  main.tsx
```

## Responsabilidades

`src/components`

Contiene componentes visuales reutilizables. Un componente debe enfocarse en
renderizar UI y recibir datos por props cuando sea posible.

`src/data`

Contiene datos de ejemplo usados por la interfaz mientras no existe backend.
Actualmente guarda citas y pacientes mock.

`src/types`

Contiene tipos compartidos del dominio. Por ejemplo, `Patient` describe la
forma minima que debe tener un paciente dentro del frontend.

`src/utils`

Contiene funciones puras para transformar, formatear o filtrar datos. Estas
funciones no dependen de React y son buenas candidatas para pruebas unitarias.

`src/App.tsx`

Compone la pantalla principal de la aplicacion. Debe mantenerse simple y evitar
mezclar demasiada logica de UI o datos.

`src/App.css`

Contiene estilos de la pantalla principal y sus componentes actuales.

`src/index.css`

Contiene estilos globales, variables de color, reset basico y reglas generales.

## Flujo general

1. `src/main.tsx` monta la aplicacion React.
2. `src/App.tsx` importa datos mock desde `src/data`.
3. `App.tsx` renderiza el encabezado, el resumen de citas y el listado de
   pacientes.
4. `AppointmentsOverview` recibe las citas y renderiza tarjetas individuales.
5. `AppointmentCard` usa funciones de `src/utils` para mostrar fecha, hora y
   estado en formato legible.
6. `PatientsList` recibe pacientes, maneja el texto de busqueda local y usa
   `filterPatients` para decidir que registros mostrar.
7. `PatientCard` muestra cada paciente filtrado.
