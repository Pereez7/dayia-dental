# Decisiones tecnicas

Este documento registra decisiones iniciales para que el proyecto sea mas facil
de entender cuando crezca.

## React

Usamos React porque permite construir interfaces por componentes. Esto encaja
bien con DayIA Dental, donde habra pantallas con piezas reutilizables como
tarjetas de citas, paneles, formularios y resumenes.

## Vite

Usamos Vite porque ofrece una experiencia de desarrollo rapida y simple para
proyectos frontend modernos. Tambien reduce configuracion inicial y funciona
bien con React y TypeScript.

## TypeScript

Usamos TypeScript para describir la forma de los datos y detectar errores antes
de ejecutar la app. En el modulo de citas, por ejemplo, `Appointment` define que
campos debe tener una cita.

## Tipos de dominio separados

Creamos `src/types` para tipos que representan entidades del producto, como
`Patient`. Esto evita duplicar estructuras entre datos mock, componentes y
futura logica de negocio.

## Vitest

Usamos Vitest para probar logica simple sin montar componentes visuales. Es una
buena opcion en proyectos Vite y permite probar funciones puras como
formatters, validaciones y reglas de negocio.

## Componentes separados

Separamos componentes para mantener cada archivo con una responsabilidad clara.
`AppointmentCard` muestra una cita, `StatsCard` muestra una metrica y
`Header` muestra el encabezado. Para pacientes, `PatientsList` compone el
listado y `PatientCard` muestra un registro individual. Esto facilita leer,
cambiar y reutilizar codigo.

## Utilidades separadas

Separamos funciones de formato en `src/utils` para evitar mezclar logica dentro
de componentes. Esto hace que la UI sea mas simple y que la logica sea mas facil
de probar.

## Sin backend por ahora

El proyecto se mantiene solo en frontend mientras se define bien el modulo de
citas. Backend, base de datos y autenticacion se agregaran mas adelante cuando
la interfaz y el flujo principal esten mas claros.
