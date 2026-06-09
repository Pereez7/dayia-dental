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

El Sidebar se mejora visualmente con bloque de marca, seccion de acciones y
seccion de modulos, pero sigue usando el mismo estado local y el mismo mapa de
navegacion. En mobile se mantiene como navegacion horizontal desplazable; no se
introducen drawer, bottom navigation ni React Router.

## Estado local compartido

`App.tsx` mantiene el estado local de citas, pacientes, tratamientos, registros
clinicos y odontograma mientras no existe backend. Esto permite que Dashboard,
Pacientes, Agenda, Nueva Cita, Configuracion y Detalle de paciente usen la
misma fuente de datos sin duplicar estado.

Los pacientes creados localmente se agregan al estado compartido y pueden ser
usados por el Dashboard y por el formulario de nueva cita durante la sesion
actual.

Los tratamientos tambien se mantienen en ese estado compartido para que los
cambios hechos en Configuracion se reflejen inmediatamente en Nueva Cita.

Los registros clinicos tambien viven en ese estado compartido y se asocian a
pacientes mediante `patientId`. Esto evita duplicar historial dentro del
paciente y prepara una futura persistencia relacional.

Las entradas del odontograma viven en ese mismo estado compartido y se asocian a
pacientes mediante `patientId` y a piezas mediante `toothNumber`.

## Detalle de paciente como vista completa

El detalle de paciente se mantiene como vista completa en lugar de popup, modal
o drawer. La ficha necesita espacio para mostrar datos generales, citas
asociadas y, mas adelante, modulos clinicos como historial, odontograma,
recordatorios y evoluciones.

La navegacion hacia esta vista sigue usando estado local en `App.tsx`, sin React
Router. Esto mantiene la arquitectura actual mientras todavia no se necesitan
URLs reales ni rutas con parametros.

## Historial clinico dentro del paciente

El historial clinico inicial se implementa dentro del detalle del paciente, no
como pantalla global. En esta etapa cada registro necesita el contexto del
paciente seleccionado y no se requieren busquedas globales, filtros por doctor
ni rutas con parametros.

El item lateral `Historial clinico` se mantiene como placeholder hasta que exista
una experiencia clara para consultar historiales entre pacientes.

## Odontograma dentro del paciente

El odontograma inicial se implementa dentro del detalle del paciente, no como
pantalla global. En esta etapa cada odontograma necesita el contexto del
paciente seleccionado y una vista global requeriria busqueda de pacientes,
filtros y posiblemente rutas con parametros.

El item lateral `Odontograma` se mantiene como placeholder global hasta definir
una experiencia visual mas completa.

## Odontograma funcional antes que grafico complejo

La primera version del odontograma usa una grilla simple de piezas permanentes
adultas con numeracion FDI. Esto permite validar el modelo de datos, estados por
pieza, resumen y actualizacion antes de invertir en SVG, superficies dentales,
denticion temporal infantil o una libreria especializada.

Los estados actuales son sano, caries, restaurado, ausente, tratamiento
pendiente, en observacion y otro. Cada estado usa colores suaves para mantener
lectura rapida sin saturar la ficha del paciente.

Las observaciones del odontograma se normalizan con la utilidad global
`textNormalizers` para mantener consistencia con historial clinico y futuros
formularios.

## Normalizacion de textos clinicos

Los textos escritos por el doctor en historial clinico se normalizan antes de
guardarse: se recortan espacios, se colapsan espacios internos y se capitalizan
como oracion. Esto evita registros inconsistentes como `CARIES`,
`dolor   dental` o textos con espacios sobrantes.

La logica vive en `src/utils/textNormalizers.ts` para poder reutilizarla en
futuros formularios y probarla sin depender de React.

## Fechas clinicas con año

Las fechas del historial clinico se muestran con año, por ejemplo
`09-jun-2026`, porque los registros clinicos pueden consultarse mucho tiempo
despues. La agenda puede usar formatos mas cortos, pero el historial necesita
mayor claridad temporal.

El formateo compacto vive en `src/utils/dateFormatters.ts`.

## Asociacion de citas en detalle de paciente

Las citas se relacionan con pacientes usando `patientId` cuando el dato existe.
Como algunas citas mock antiguas todavia pueden no tener ese identificador, el
detalle acepta una coincidencia por nombre exacto como fallback temporal.

La decision evita perder citas visibles durante la transicion del modelo mock.
Mas adelante, con backend o persistencia real, la relacion principal deberia ser
por identificador.

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

## Botones reutilizables

Se unifican clases globales de botones para evitar estilos aislados por modulo.
Las acciones principales, secundarias, suaves, de exito, advertencia y peligro
comparten base visual y solo cambian el color semantico necesario.

## Pulido visual controlado

Las mejoras visuales recientes se concentran en composicion, jerarquia y ritmo,
sin alterar logica funcional. Se priorizan Dashboard, Detalle de paciente,
Odontograma, Sidebar y fichas de pacientes porque son las superficies mas
visibles del producto.

La direccion visual es clinica, limpia y operativa. No se agregan iconos,
graficos, librerias, animaciones complejas ni cambios de arquitectura todavia.
Los ajustes viven principalmente en `src/App.css` y `src/index.css`, con cambios
JSX solo para wrappers o clases visuales.

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

Los tratamientos iniciales viven en `src/data/treatments.ts` como datos mock
tipados, pero se gestionan localmente desde Configuracion. El formulario de
Nueva Cita usa solo tratamientos activos para evitar texto libre inconsistente.

Los tratamientos no se eliminan fisicamente en esta etapa. Se activan o
desactivan para evitar perder referencias si ya existen citas relacionadas.
Mas adelante este catalogo puede venir de backend o configuracion persistente
del consultorio.

## Normalizacion de tratamientos

Los nombres de tratamientos se normalizan antes de guardarse: se recortan
espacios, se colapsan espacios internos y se capitalizan de forma consistente.
Las comparaciones para duplicados y busqueda ignoran acentos, mayusculas y
espacios extra. Esto evita registros duplicados como `Evaluacion inicial` y
`EVALUACIÓN   INICIAL`.

La logica vive en `src/utils/treatmentUtils.ts` para poder probarla sin montar
componentes visuales.

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
