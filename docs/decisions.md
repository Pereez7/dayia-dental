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

## Layout y vistas

Separamos `src/layout` para la estructura comun de la aplicacion y `src/views`
para pantallas completas. Esto mantiene `App.tsx` pequeno y evita que el layout
se mezcle con la logica de pacientes, citas u otros modulos.

## Navegacion con estado local

Por ahora la navegacion usa estado local en `App.tsx` en lugar de React Router.
Es suficiente mientras no necesitemos URLs reales, rutas con parametros,
historial del navegador o proteccion de rutas. Cuando esas necesidades aparezcan,
podremos introducir React Router con menos ruido.

La navegacion se define como un mapa en `src/layout/navigation.ts`. Por ahora el
sidebar muestra solo secciones principales. Las creaciones frecuentes viven como
acciones rapidas (`+ Paciente`, `+ Cita`) para evitar duplicar opciones y mantener
la interfaz limpia.

## Citas con datos mock por ahora

El modulo Citas se mantiene en frontend usando datos mock. Esto permite validar
la experiencia de agenda, estados y jerarquia visual antes de integrar base de
datos, permisos o flujos de edicion.

## Agenda visual antes de CRUD de citas

Primero se implemento una agenda visual de proximas citas. La creacion, edicion,
eliminacion y cancelacion real de citas quedan pendientes hasta que el modelo de
agenda sea claro y estable.

## Estados con badges semanticos

Los estados de cita usan badges con colores suaves para facilitar lectura rapida
sin saturar la interfaz. `Recordatorio` no se usa como estado de cita; los
recordatorios pertenecen al modulo futuro de WhatsApp.

## Sin iconos por ahora

No se agregan iconos todavia. Se evaluaran cuando la UI global este mas estable
y exista una necesidad clara de mejorar escaneo visual sin aumentar ruido.

## Utilidades separadas

Separamos funciones de formato en `src/utils` para evitar mezclar logica dentro
de componentes. Esto hace que la UI sea mas simple y que la logica sea mas facil
de probar.

## Filtros como funciones puras

La busqueda de pacientes usa `filterPatients` en `src/utils`. El componente solo
guarda el texto ingresado por el usuario, mientras la funcion decide que
pacientes coinciden. Esto permite probar el filtro sin renderizar componentes.

## Validaciones como funciones puras

Las validaciones del formulario de pacientes viven en `src/utils`. El formulario
solo maneja estado local y muestra errores; las reglas obligatorias se prueban
sin depender de React.

Los nombres y apellidos aceptan letras, espacios, tildes y `ñ`. El telefono se
captura como prefijo de pais y numero local. El numero local solo acepta digitos
y debe tener mas de 5 digitos. El email es opcional, pero si existe debe tener
formato valido. La fecha de
nacimiento es opcional, pero no puede ser futura ni representar una edad mayor a
120 años. Estas reglas evitan datos claramente invalidos antes de integrar
backend.

## Registro local de pacientes

El alta de pacientes se maneja en frontend con estado local dentro de
`PatientsView`. Esto permite validar el flujo de interfaz antes de introducir
backend, base de datos o autenticacion.

## Telefonos en formato internacional

El formulario separa prefijo de pais y numero local, pero guarda `Patient.phone`
como un string internacional compacto, por ejemplo `+59170000000`. Esto prepara
el dato para futura integracion con WhatsApp API. Por ahora usamos una lista
manual corta de prefijos regionales; mas adelante puede reemplazarse por una
libreria especializada sin cambiar el modelo principal.

## Sin backend por ahora

El proyecto se mantiene solo en frontend mientras se define bien el modulo de
citas. Backend, base de datos y autenticacion se agregaran mas adelante cuando
la interfaz y el flujo principal esten mas claros.

## Funcionalidad antes que diseno visual final

La prioridad actual es construir flujos correctos, tipados y testeables antes de
invertir en un sistema visual definitivo. El diseno se mantiene limpio y
responsive, pero todavia puede evolucionar cuando el producto tenga mas modulos.

## Backend fuera temporalmente

No se agrega backend hasta validar los flujos principales en frontend. Supabase,
autenticacion, permisos, persistencia y despliegue se evaluaran cuando pacientes
y citas tengan una forma mas estable.
