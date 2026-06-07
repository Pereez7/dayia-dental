# Arquitectura

DayIA Dental empieza como una aplicacion frontend interna para clinicas
dentales. Por ahora no incluye backend, base de datos ni autenticacion.

## Base tecnica

- React + TypeScript + Vite.
- Vitest para pruebas unitarias de logica pura.
- Git inicializado y remoto GitHub configurado.
- Navegacion por estado local, sin React Router por ahora.

## Estructura de carpetas

```text
src/
  components/
  data/
  layout/
  types/
  utils/
  views/
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

`src/layout`

Contiene la estructura principal de la aplicacion: layout base, navegacion,
sidebar y header superior.

`src/types`

Contiene tipos compartidos del dominio. Por ejemplo, `Patient` describe la
forma minima que debe tener un paciente dentro del frontend.

`src/utils`

Contiene funciones puras para transformar, formatear o filtrar datos. Estas
funciones no dependen de React y son buenas candidatas para pruebas unitarias.

`src/views`

Contiene vistas completas de la aplicacion. Una vista puede componer varios
componentes y manejar estado local propio de esa pantalla.

`src/App.tsx`

Controla la seccion activa y renderiza la vista correspondiente dentro de
`AppLayout`. Debe mantenerse simple y evitar mezclar logica propia de cada
pantalla.

`src/App.css`

Contiene estilos globales de layout y de los componentes actuales. Todavia no
hay sistema de diseno separado.

`src/index.css`

Contiene estilos globales, variables de color, reset basico y reglas generales.

## Flujo general

1. `src/main.tsx` monta la aplicacion React.
2. `src/App.tsx` mantiene la seccion activa con estado local.
3. `AppLayout` muestra `Sidebar`, `Header` superior y el contenido de la vista
   activa.
4. `Sidebar` usa el mapa de `src/layout/navigation.ts` para renderizar
   secciones principales y acciones rapidas.
5. `PatientsView` mantiene el listado local de pacientes y compone
   `PatientForm` con `PatientsList`.
6. Las vistas de modulos futuros muestran placeholders simples hasta que se
   implemente su flujo real.
7. `AppointmentsOverview` recibe las citas y renderiza tarjetas individuales.
8. `AppointmentCard` usa funciones de `src/utils` para mostrar fecha, hora y
   estado en formato legible.
9. `PatientForm` maneja los campos del formulario con estado local, valida con
   funciones de `src/utils` y avisa a `PatientsView` cuando hay un nuevo
   paciente.
10. `PatientsList` recibe pacientes, maneja el texto de busqueda local y usa
   `filterPatients` para decidir que registros mostrar.
11. `PatientCard` muestra cada paciente filtrado.

## Modulos actuales

`Pacientes`

Incluye listado, busqueda, formulario de registro, validaciones y telefono en
formato internacional compacto.

`Citas`

Incluye datos mock y resumen visual de proximas atenciones. La agenda real y el
formulario de nueva cita siguen pendientes.

`Dashboard`, `Historial clinico`, `Odontograma`, `Recordatorios` y
`Configuracion`

Existen como vistas iniciales o placeholders para sostener la navegacion y el
mapa futuro de la aplicacion.
