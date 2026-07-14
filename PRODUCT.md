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
- Orientar el Dashboard a operacion real del consultorio: carga del dia,
  estados relevantes del mes, proximas citas activas, atenciones que requieren
  seguimiento y cambios recientes.
- Priorizar foco diario en agenda: Citas debe ayudar a operar el dia
  seleccionado antes de incorporar vistas mensuales o flujos avanzados.
- Mantener trazabilidad operativa: cancelar una cita debe cambiar su estado y
  conservarla visible con un motivo simple, no eliminarla del flujo.
- No reprogramar citas canceladas directamente: si el paciente desea asistir
  nuevamente, se crea una nueva cita para conservar trazabilidad y evitar
  ambiguedad operativa.
- Mantener la reprogramacion como accion contextual: el panel debe cerrarse al
  cambiar de dia, al repetir la accion, al cancelar el formulario o al cancelar
  la cita.
- Mantener foco de tarea en Agenda: mientras una cita esta en modo
  reprogramacion, la card debe priorizar guardar o cancelar esa edicion y evitar
  acciones externas que puedan confundirse con cancelar la cita completa.
- Mantener la card de Agenda escaneable: rango horario, datos del paciente,
  estado y acciones deben vivir en bloques separados para evitar solapamientos,
  especialmente cuando se muestran rangos como `13:00 - 13:30`.
- Reprogramar debe mover la cita: cambiar solo el motivo no cuenta como
  reprogramacion y debera resolverse mas adelante con una accion especifica de
  edicion de motivo.
- Pedir motivo en acciones que cambian la operacion de agenda, como cancelar o
  reprogramar, sin convertirlo todavia en historial completo de auditoria.
- Registrar trazabilidad simple de cambios de cita sin saturar la agenda: la
  creacion puede conservarse internamente, pero la card solo debe mostrar
  cambios operativos relevantes para el usuario.
- Usar confirmaciones propias y consistentes para acciones sensibles; evitar
  alertas nativas del navegador cuando rompan la experiencia visual del
  producto.
- Mantener continuidad operativa: los modulos deben sentirse parte de la misma
  app y conservar navegacion, espaciado y estados consistentes.
- Reutilizar feedback no bloqueante cuando una accion no necesita interrumpir
  el flujo, por ejemplo Toast flotante para confirmaciones de Configuracion y
  Recordatorios.
- Usar tonos semanticos coherentes: confirmar es exito; cancelar o desactivar
  son avisos administrativos, no errores. Las acciones sensibles pueden usar
  rojo suave en botones o dialogos para comunicar cautela sin etiquetarlas como
  fallos.
- Confirmar acciones sensibles antes de aplicarlas cuando puedan afectar el
  flujo operativo, como cancelar una cita o desactivar un tratamiento.
- Mantener botones compactos y consistentes: la jerarquia debe venir del rol de
  la accion, no de exceso de tamaño, negrita o fondos saturados.
- En Configuracion, separar visualmente Horarios, Excepciones y Tratamientos
  para que cada accion pertenezca claramente a su bloque, especialmente
  `Guardar horarios`.
- Validar primero en frontend: construir flujos locales, tipados y testeables
  antes de agregar persistencia o integraciones externas.
- Prevenir sobreagendamiento desde la experiencia: mostrar solo horarios
  disponibles cuando sea posible y mantener validaciones finales antes de
  guardar.
- La disponibilidad de Agenda debe considerar rangos completos segun duracion
  del tratamiento. Una cita activa bloquea desde su inicio hasta su fin, pero se
  permite que otra cita empiece exactamente cuando la anterior termina.
- Las excepciones del calendario tienen prioridad sobre el horario semanal:
  una fecha cerrada no permite agendar ni reprogramar, y una fecha con horario
  especial calcula disponibilidad solo dentro de ese rango.
- Hacer visible solo lo confiable: no mostrar indicadores incompletos ni datos
  inventados para cubrir vacios del modelo mock.
- En fichas de paciente, priorizar datos clinicos utiles sobre textos de
  preparacion interna. El detalle debe mostrar resumen operativo con citas
  activas, ultima atencion y proxima cita cuando esos datos existan.
- En el historial clinico global, agrupar por paciente para evitar listas
  repetitivas. La vista debe resumir el ultimo registro, permitir escaneo rapido
  y abrir el detalle cuando se necesite mas contexto.
- Mantener formato de fechas coherente y humano: usar `14 jun` para fechas del
  año actual, `14 jun 2025` para otros años y hora en 24 horas cuando
  corresponda, por ejemplo `14 jun, 15:16`.
- En odontograma, priorizar claridad clinica antes que grafico avanzado:
  arcadas y cuadrantes FDI deben identificarse con facilidad, el estado actual
  debe verse como badge semantico y las observaciones no deben deformar el
  layout.
- En odontograma, una pieza sin entrada explicita debe leerse como sana para
  mantener el resumen completo de 32 piezas adultas sin obligar a guardar datos
  vacios.
- No tratar citas canceladas como proximas atenciones activas en el Dashboard,
  aunque sigan visibles y trazables en Agenda.
- No generar recordatorios para citas canceladas. Recordatorios debe trabajar
  solo con citas activas y usar siempre la fecha y hora vigentes de la cita.
- Adaptar el mensaje sugerido al estado real de la cita: las pendientes piden
  confirmacion, las confirmadas no la vuelven a pedir y las reprogramadas
  explican que la cita fue movida.
- Usar formato horario claro y operativo en recordatorios, por ejemplo
  `15 jun, 10:00`, evitando `a. m.` y `p. m.` en la cola visible.
- Disenar mobile-first: cada flujo importante debe ser usable en pantallas
  pequenas sin perder legibilidad ni area tactil.
- Mantener las altas de plataforma detrás de autorización y feature flag de
  servidor; el frontend debe mostrar la respuesta real y nunca simular que creó
  un consultorio.

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
- El panel de reprogramacion debe mostrar errores de validacion una sola vez,
  junto al formulario, sin duplicarlos en Toast.
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
