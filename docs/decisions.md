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

## Estado local compartido

`App.tsx` mantiene el estado local de citas y pacientes mientras no existe
backend. Esto permite que Dashboard, Pacientes, Agenda y Nueva Cita usen la
misma fuente de datos sin duplicar estado.

Los pacientes creados localmente se agregan al estado compartido y pueden ser
usados por el Dashboard y por el formulario de nueva cita durante la sesion
actual.

## Dashboard operativo

El Dashboard muestra indicadores accionables para el consultorio en lugar de
duplicar la agenda completa. Sus KPIs actuales son atenciones de hoy,
atenciones del mes, pendientes por confirmar, pacientes registrados y
reprogramadas del mes.

No se muestra `N/D` como KPI principal. El indicador de nuevos pacientes del mes
queda fuera temporalmente porque los pacientes mock no tienen una fecha real de
registro. Es mejor ocultar ese dato hasta tener un campo confiable que mostrar
un indicador incompleto.

Los calculos del Dashboard viven en `src/utils/dashboardMetrics.ts` para poder
probarlos con Vitest y mantener la vista enfocada en composicion visual.

## Citas con datos mock por ahora

El modulo Citas se mantiene en frontend usando datos mock. Esto permite validar
la experiencia de agenda, estados y jerarquia visual antes de integrar base de
datos, permisos o flujos de edicion.

## Agenda visual antes de acciones completas de citas

Primero se implemento una agenda visual de proximas citas. Luego se agrego la
creacion local de citas para validar el flujo de registro. La edicion,
eliminacion y cancelacion real de citas quedan pendientes hasta que el modelo de
agenda sea mas claro y estable.

## Creacion local de citas antes de persistencia

El formulario de nueva cita se implementa primero en frontend con estado local.
Esto permite validar seleccion de paciente, fecha, hora, tratamiento y estado
inicial antes de introducir base de datos o reglas de negocio mas complejas.

Las citas creadas en esta etapa se agregan en memoria desde `App.tsx` y se
reflejan en Dashboard y Agenda durante la sesion actual. La persistencia,
edicion, eliminacion y cancelacion real siguen fuera del alcance inmediato.

## Seleccion real de paciente en citas

El formulario de nueva cita separa el texto escrito en el buscador del paciente
realmente seleccionado. El texto permite filtrar resultados, pero la validacion
usa un identificador de paciente seleccionado. Esto evita estados visuales
contradictorios, como mostrar un paciente seleccionado y al mismo tiempo pedir
que se seleccione uno.

## Catalogo mock de tratamientos

Los tratamientos de una cita viven temporalmente en `src/data/treatments.ts`.
El formulario usa ese catalogo para evitar texto libre inconsistente y las
validaciones verifican que el tratamiento seleccionado pertenezca a la lista.
Mas adelante este catalogo puede venir de backend o configuracion del
consultorio.

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

Las validaciones de citas tambien viven en `src/utils`. El formulario de nueva
cita exige paciente, fecha no anterior a hoy, hora, tratamiento valido y estado
inicial permitido. Por ahora solo `Pendiente` y `Confirmada` son estados
iniciales validos; estados como `Cancelada`, `Completada` o `Reprogramada`
pertenecen a acciones posteriores sobre una cita existente.

La hora de una cita debe pertenecer al catalogo de horarios exactos generado en
intervalos de 15 minutos. Se usa un selector en lugar del picker nativo de hora
para evitar seleccion minuto a minuto y mantener valores consistentes como
`08:15`, `08:30` o `08:45` durante las 24 horas del dia.

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
