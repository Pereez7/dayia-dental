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
duplicar la agenda completa. Sus KPIs actuales son citas de hoy, pendientes de
hoy, confirmadas de hoy, reprogramadas del mes, canceladas del mes y pacientes
registrados.

No se muestra `N/D` como KPI principal. El indicador de nuevos pacientes del mes
queda fuera temporalmente porque los pacientes mock no tienen una fecha real de
registro. Es mejor ocultar ese dato hasta tener un campo confiable que mostrar
un indicador incompleto.

Las proximas citas del Dashboard muestran solo citas futuras activas y excluyen
canceladas. Las citas canceladas conservan trazabilidad en Agenda, pero no
deben competir como proxima atencion operativa.

La seccion de actividad reciente usa `changeLog` y omite eventos `created`.
Crear una cita se conserva internamente, pero el Dashboard prioriza cambios
operativos relevantes: confirmacion, cancelacion y reprogramacion.

Las citas que requieren atencion se calculan desde datos existentes sin inventar
informacion: pendientes proximas, reprogramaciones recientes y telefono faltante
solo cuando existe el paciente relacionado.

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
creacion local de citas para validar el flujo de registro. Despues se agregaron
confirmacion, cancelacion con motivo y reprogramacion inline con motivo. La
edicion general, eliminacion fisica, historial completo de cambios y
persistencia quedan pendientes hasta que el modelo de agenda sea mas claro y
estable.

## Agenda diaria antes que calendario mensual

La vista Citas se orienta primero como agenda diaria operativa. El consultorio
necesita revisar que ocurre hoy, mañana o en proximos dias con citas antes de
necesitar un calendario mensual completo.

El selector horizontal de dias evita una tabla rigida en mobile y mantiene una
experiencia cercana a Recordatorios. Los KPIs se calculan por dia seleccionado
para que recepcion pueda entender rapidamente carga, pendientes, confirmadas,
reprogramadas y canceladas.

El calendario mensual, la reprogramacion visual y acciones mas avanzadas por
estado quedan pendientes hasta que la agenda diaria este estable.

## Confirmar y cancelar antes que editar citas

La agenda diaria permite primero dos acciones operativas simples: confirmar una
cita pendiente y cancelar una cita pendiente, confirmada o reprogramada. Estas
acciones solo cambian el estado de la cita en memoria y no modifican fecha,
hora, paciente ni tratamiento.

Cancelar una cita no elimina el registro. La cita sigue visible como
`Cancelada`, deja de bloquear horarios en Nueva Cita y no genera recordatorios
WhatsApp. Esta decision conserva contexto operativo sin introducir edicion,
eliminacion fisica ni persistencia todavia.

El feedback usa Toast flotante: confirmar usa tono de exito y cancelar usa tono
de aviso, porque cancelar es una accion administrativa valida, no un error.

## Motivos simples antes que historial completo

La cancelacion y la reprogramacion guardan un motivo simple dentro de la cita.
Esto aporta trazabilidad operativa suficiente para la etapa actual sin
implementar todavia historial completo de cambios, usuario responsable ni fecha
exacta de modificacion.

Los motivos se seleccionan desde listas cerradas para mantener datos
consistentes. Si el usuario elige `Otro`, se solicita un detalle breve, se
normaliza con `textNormalizers` y se guarda junto al motivo.

El detalle `Otro` se limita a 120 caracteres y se acompaña con un contador
discreto. La UI usa un textarea fijo con scroll interno para evitar que textos
largos deformen la agenda.

Los errores de motivo se muestran inline porque son errores de campo. El Toast
se reserva para confirmar que la accion se completo correctamente.

Por ahora, si una cita se reprograma mas de una vez, se sobrescribe el ultimo
motivo. El historial acumulado queda pendiente para una etapa posterior con
persistencia.

Cambiar solo el motivo no cuenta como reprogramacion. La accion `Reprogramar`
debe modificar fecha u hora; si ambos valores son iguales a los actuales, se
muestra error inline y no se cambia el estado. Editar solamente el motivo queda
como una accion futura separada.

## Historial simple de cambios de cita

Las citas tienen un `changeLog` opcional para registrar eventos basicos:
creacion, confirmacion, cancelacion y reprogramacion. Es una trazabilidad simple
en memoria, sin backend, usuario responsable, auditoria avanzada ni pantalla de
historial.

Los eventos se agregan de forma inmutable y no se pueden editar ni borrar desde
la UI. El evento de creacion se guarda internamente, pero no se muestra como
`Ultimo cambio` para evitar ruido visual en citas recien creadas. La card solo
muestra ultimo cambio cuando el evento relevante es confirmacion, cancelacion o
reprogramacion.

El historial no debe duplicar datos sensibles ni informacion clinica. Las
descripciones se mantienen operativas y se renderizan como texto normal de
React.

## Citas canceladas no se reprograman directamente

Las citas canceladas no se reprograman directamente. Si el paciente desea
asistir nuevamente, se crea una nueva cita.

Esta decision evita mezclar dos intenciones operativas distintas: cancelar una
cita ya cerrada y agendar una nueva atencion. La cita cancelada conserva su
trazabilidad en la agenda, libera el horario y no genera recordatorios, pero no
se reactiva mediante reprogramacion directa.

Mas adelante, cuando exista integracion real con WhatsApp, se evaluaran estados
intermedios como `Solicitud de cancelacion` para evitar cancelaciones
accidentales antes de aplicar una cancelacion definitiva.

La UI y las utilidades refuerzan esta regla: una cita cancelada no expone
acciones, no permite guardar una reprogramacion y el handler principal de
`App.tsx` tampoco aplica reprogramaciones si el estado actual ya no lo permite.

## Reprogramacion inline contextual

La reprogramacion se implementa como panel inline dentro de la card de la cita,
no como modal. Esto mantiene el flujo de recepcion en la agenda diaria y evita
introducir una superficie nueva antes de tener historial de cambios completo o
persistencia.

El panel es contextual al dia y a la cita visible. Por eso se cierra al cambiar
de dia, al volver a pulsar `Reprogramar`, al cancelar el formulario o al
cancelar la cita. Esta decision evita estados pegajosos donde un formulario
queda abierto al volver a un dia anterior.

Al cerrar el panel se limpian fecha, hora, motivo, detalle de `Otro` y errores
inline temporales. Mientras el panel esta abierto, la card oculta acciones
externas como confirmar o cancelar cita para mantener una sola decision activa:
guardar la reprogramacion o cancelar esa edicion.

Antes de cancelar se usa `ConfirmDialog` en lugar de `window.confirm`. El
dialogo evita la alerta nativa del navegador, mantiene la identidad visual de
DayIA Dental y queda listo para futuras acciones sensibles sin introducir una
arquitectura global de modales todavia.

`ConfirmDialog` no cierra por clic fuera. La decision reduce acciones
accidentales y obliga a elegir explicitamente entre volver o confirmar. Escape
equivale a cancelar.

`ConfirmDialog` acepta contenido adicional opcional para casos como motivo de
cancelacion. Se mantiene reutilizable porque los consumidores que no necesitan
campos extra, como Tratamientos, lo siguen usando solo con titulo, mensaje y
acciones.

## Creacion local de citas antes de persistencia

El formulario de nueva cita se implementa primero en frontend con estado local.
Esto permite validar seleccion de paciente, fecha, hora, tratamiento y estado
inicial antes de introducir base de datos o reglas de negocio mas complejas.

Las citas creadas en esta etapa se agregan en memoria desde `App.tsx` y se
reflejan en Dashboard y Agenda durante la sesion actual. La persistencia,
edicion, eliminacion e historial completo de cambios siguen fuera del alcance
inmediato.

## Disponibilidad de horarios en Nueva Cita

Nueva Cita calcula las opciones de hora a partir de los horarios del
consultorio, el intervalo configurado y las citas existentes. Las citas
pendientes, confirmadas y reprogramadas bloquean el horario; las canceladas no
lo bloquean.

El selector oculta horas ocupadas para reducir errores operativos, pero la
validacion final al guardar se mantiene. Esta doble proteccion evita
sobreagendamiento si el estado local cambia o si una hora seleccionada deja de
estar disponible antes del envio del formulario.

Por ahora no se consideran duracion del tratamiento, doctores, sillones ni
excepciones de calendario. Esas reglas quedan pendientes hasta que el modelo de
agenda sea mas completo.

## Una cita activa por paciente y dia

El formulario de Nueva Cita no permite registrar mas de una cita activa del
mismo paciente en la misma fecha. Para esta regla cuentan las citas pendientes,
confirmadas y reprogramadas; las canceladas no bloquean.

La regla vive como funcion pura en `src/utils/appointmentConflicts.ts` para
poder probarla con Vitest y dejar preparado un `appointmentIdToIgnore` para una
futura edicion de citas.

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
recordatorios pertenecen al modulo Recordatorios WhatsApp.

## Recordatorios WhatsApp como simulacion local

El modulo Recordatorios WhatsApp se implementa primero como simulacion local en
frontend. No envia mensajes reales, no programa jobs y no persiste estados.
Esto permite validar generacion, agrupacion, mensajes sugeridos y acciones de
seguimiento antes de integrar WhatsApp API.

## Recordatorios solo para citas activas

Recordatorios trabaja solo con citas futuras activas: pendientes, confirmadas y
reprogramadas. Las citas canceladas conservan trazabilidad en Agenda, pero no
deben generar mensajes ni ocupar espacio en la cola de WhatsApp.

Esta decision evita preparar comunicaciones para atenciones que ya no
corresponden. Tambien mantiene los KPIs de Recordatorios enfocados en trabajo
operativo real y no en historial administrativo.

Las citas reprogramadas usan siempre su fecha y hora vigentes. Si existe motivo
de reprogramacion, puede mostrarse como contexto secundario, pero el recordatorio
no debe basarse en la fecha anterior.

## Mensajes segun estado de cita

El mensaje sugerido cambia segun el estado de la cita:

- Pendiente: pide confirmar asistencia.
- Confirmada: recuerda que la cita ya esta confirmada y no vuelve a pedir
  confirmacion.
- Reprogramada: indica que la cita fue reprogramada y pide confirmar
  asistencia.

La decision mantiene el tono profesional del consultorio y evita mensajes
contradictorios, por ejemplo pedir confirmacion a una cita que ya esta
confirmada.

## Formato 24 horas en recordatorios visibles

Las filas visibles de recordatorio usan formato corto 24 horas, por ejemplo
`15 jun, 10:00`. Se evita `a. m.` y `p. m.` para mantener coherencia con la
agenda y con el contexto operativo del consultorio.

El formateo vive en `src/utils/reminders.ts` como funcion pura para probarlo sin
renderizar componentes.

## Pacientes sin telefono en Recordatorios

Una cita activa sin telefono puede aparecer en Recordatorios para que el equipo
detecte el dato faltante. Sin embargo, no se permite marcar el recordatorio como
enviado porque no existe un destino valido para la simulacion.

La UI deshabilita `Marcar enviado` y la funcion pura
`canMarkReminderAsSent` refuerza la regla por defensa de presentacion. `Ver
mensaje` sigue disponible porque puede ayudar al equipo a revisar el texto
sugerido.

## No generar recordatorios en el pasado

Los recordatorios de `24h` y `2h` solo se crean si su `scheduledFor` queda
despues de la fecha/hora actual de referencia. Si una cita se registra con poca
anticipacion, el sistema omite los recordatorios que ya no aplican y muestra una
nota discreta en la card.

Cuando una cita esta demasiado cerca y ya no aplican `24h` ni `2h`, se genera
una `Confirmacion inmediata` con estado pendiente. Esto evita mostrar horarios
irreales en el pasado y mantiene una accion clara para recepcion o el doctor:
revisar el mensaje y confirmar manualmente.

## Toast para feedback no bloqueante

El feedback de Recordatorios y Configuracion usa un componente `Toast` flotante
en lugar de alertas dentro del flujo del layout. La decision evita saltos
visuales cuando se marca un recordatorio como enviado o fallido, cuando se
guardan horarios o cuando se agrega, edita, activa o desactiva un tratamiento.
El Toast no roba foco, usa `aria-live`, tiene colores suaves por tipo y queda
preparado para reutilizarse mas adelante en Pacientes, Citas, Historial clinico
y Odontograma.

Desactivar un tratamiento no se trata como error. Es una accion administrativa
valida, por eso usa tono de aviso.

Antes de desactivar un tratamiento se pide confirmacion con `ConfirmDialog`.
Esto evita cambios accidentales en el catalogo sin convertir la accion en un
error. El boton de confirmacion usa rojo suave para ser coherente con el boton
`Desactivar`, mientras el Toast posterior conserva tono de aviso.

## Horarios semanales antes que calendario completo

Configuracion incluye primero un panel semanal de horarios del consultorio con
intervalo de atencion y dias abiertos o cerrados. Esta version permite validar
la estructura basica sin construir todavia calendario mensual, feriados,
excepciones reales ni persistencia.

El bloque `Excepciones del calendario` se deja como comunicacion de producto:
prepara la evolucion futura hacia feriados, cierres especiales o dias con
horario distinto, pero no agrega logica nueva.

## Botones de Configuracion alineados con Recordatorios

Las acciones de Configuracion usan el mismo criterio visual compacto de
Recordatorios. Los botones de fila son neutros y comunican el tipo de accion con
el color del texto: ambar para editar o guardar cambios, verde para activar y
rojo suave para desactivar.

Esto reduce ruido visual y evita que acciones secundarias compitan con acciones
primarias como guardar horarios o agregar tratamiento.

## Documentacion ampliada con PRODUCT.md

Cuando se pida actualizar la documentacion, `PRODUCT.md` forma parte del mismo
paquete que README, CHANGELOG y los documentos de `docs/`. Esto mantiene
alineados criterios de producto, accesibilidad, arquitectura, decisiones,
roadmap y estado funcional.

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

Cuando existen horarios del consultorio configurados, el catalogo visible se
reduce a los horarios disponibles de la fecha seleccionada. Si no hay opciones
libres, se muestra un mensaje inline en el formulario.

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
