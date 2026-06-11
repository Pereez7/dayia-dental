# Product

## Register

product

## Users

DayIA Dental esta pensado para consultorios dentales y equipos operativos
clinicos que necesitan registrar pacientes, organizar citas, consultar una ficha
basica, revisar seguimiento clinico inicial y preparar recordatorios.

El usuario trabaja en un contexto de atencion diaria, con necesidad de escanear
informacion rapido, registrar datos sin friccion y mantener una agenda clara en
desktop y mobile.

## Product Purpose

DayIA Dental organiza pacientes, citas odontologicas, seguimiento clinico,
odontograma inicial y recordatorios simulados mientras se valida el flujo
frontend antes de integrar backend, persistencia, autenticacion o WhatsApp real.

El producto tiene exito cuando el consultorio puede entender su operacion del
dia, registrar informacion confiable y preparar comunicaciones de seguimiento
sin interfaces saturadas ni datos inventados.

## Brand Personality

Clinica, moderna y profesional.

La experiencia debe sentirse calmada, clara y operativa. La interfaz debe dar
confianza sin parecer pesada, generica o excesivamente decorativa.

## Anti-references

DayIA Dental no debe parecer una landing page de marketing, un dashboard
generico recargado, una app medica oscura y dramatica, ni una interfaz con
iconos, graficos o animaciones agregados antes de que aporten valor real.

Tambien debe evitar redisenos radicales, decoracion visual sin funcion,
interfaces saturadas, formularios que saltan visualmente y flujos que dependen
de backend antes de validar la experiencia local.

## Design Principles

- Priorizar claridad clinica: cada pantalla debe ayudar a escanear, decidir y
  actuar sin ruido.
- Priorizar foco diario en agenda: Citas debe ayudar a operar el dia
  seleccionado antes de incorporar vistas mensuales o flujos avanzados.
- Mantener trazabilidad operativa: cancelar una cita debe cambiar su estado y
  conservarla visible, no eliminarla del flujo.
- No reprogramar citas canceladas directamente: si el paciente desea asistir
  nuevamente, se crea una nueva cita para conservar trazabilidad y evitar
  ambiguedad operativa.
- Mantener la reprogramacion como accion contextual: el panel debe cerrarse al
  cambiar de dia, al repetir la accion, al cancelar el formulario o al cancelar
  la cita.
- Mantener continuidad operativa: los modulos deben sentirse parte de la misma
  app y conservar navegacion, espaciado y estados consistentes.
- Reutilizar feedback no bloqueante cuando una accion no necesita interrumpir
  el flujo, por ejemplo Toast flotante para confirmaciones de Configuracion y
  Recordatorios.
- Usar tonos semanticos coherentes: confirmar es exito; cancelar o desactivar
  son avisos administrativos, no errores.
- Mantener botones compactos y consistentes: la jerarquia debe venir del rol de
  la accion, no de exceso de tamaño, negrita o fondos saturados.
- Validar primero en frontend: construir flujos locales, tipados y testeables
  antes de agregar persistencia o integraciones externas.
- Prevenir sobreagendamiento desde la experiencia: mostrar solo horarios
  disponibles cuando sea posible y mantener validaciones finales antes de
  guardar.
- Hacer visible solo lo confiable: no mostrar indicadores incompletos ni datos
  inventados para cubrir vacios del modelo mock.
- Disenar mobile-first: cada flujo importante debe ser usable en pantallas
  pequenas sin perder legibilidad ni area tactil.

Cuando exista integracion real con WhatsApp, se evaluaran estados intermedios
como `Solicitud de cancelacion` para evitar cancelaciones accidentales antes de
cancelar una cita definitivamente.

## Accessibility & Inclusion

DayIA Dental adopta accesibilidad basica alineada a WCAG AA como criterio de
producto.

- Buen contraste entre texto, fondos, botones, badges y estados.
- Navegacion usable con teclado.
- Estados de foco visibles en botones, inputs, selects, textareas y elementos
  interactivos.
- Los estados no deben depender unicamente del color.
- Mensajes de error y exito claros, cercanos al campo o accion correspondiente.
- Formularios de agenda con errores inline para conflictos de horario o doble
  cita activa del paciente, sin depender de Toast para errores de validacion.
- Tamanos tactiles comodos en mobile.
- Interfaz mobile-first.
- Respetar `prefers-reduced-motion` si se agregan animaciones.
- Lenguaje claro y profesional.
- Evitar interfaces saturadas o dificiles de escanear.
- Formularios estables, sin saltos visuales innecesarios.

## Alcance de documentacion

Cuando el usuario pida actualizar la documentacion de DayIA Dental, se deben
mantener sincronizados estos 7 archivos:

- `README.md`
- `CHANGELOG.md`
- `docs/project-context.md`
- `docs/architecture.md`
- `docs/decisions.md`
- `docs/roadmap.md`
- `PRODUCT.md`
