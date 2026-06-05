# Arquitectura

DayIA Dental empieza como una aplicacion frontend interna para clinicas
dentales. Por ahora no incluye backend, base de datos ni autenticacion.

## Estructura de carpetas

```text
src/
  components/
  data/
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

Contiene datos de ejemplo y tipos relacionados con esos datos. Actualmente
guarda las citas odontologicas iniciales.

`src/utils`

Contiene funciones puras para transformar o formatear datos. Estas funciones no
dependen de React y son buenas candidatas para pruebas unitarias.

`src/App.tsx`

Compone la pantalla principal de la aplicacion. Debe mantenerse simple y evitar
mezclar demasiada logica de UI o datos.

`src/App.css`

Contiene estilos de la pantalla principal y sus componentes actuales.

`src/index.css`

Contiene estilos globales, variables de color, reset basico y reglas generales.

## Flujo general

1. `src/main.tsx` monta la aplicacion React.
2. `src/App.tsx` importa los datos de citas desde `src/data`.
3. `App.tsx` renderiza el encabezado y el resumen de citas.
4. `AppointmentsOverview` recibe las citas y renderiza tarjetas individuales.
5. `AppointmentCard` usa funciones de `src/utils` para mostrar fecha, hora y
   estado en formato legible.
