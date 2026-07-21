# Guion de demo comercial

Guion sugerido de 12 a 15 minutos para mostrar DayIA Dental a un odontólogo.
Usar exclusivamente datos ficticios y una cuenta owner de un consultorio Pro.

La cuenta interna de Charles Pérez se reserva para Administración DayIA y no
se usa como propietario durante el recorrido clínico. La demo debe ejecutarse
con una identidad separada, por ejemplo un alias controlado `+demo`, con
`is_platform_admin = false` y membership `clinic_owner` activa en DayIA Dental
Demo.

## Antes de empezar

- Confirmar que el consultorio, horarios y tratamientos de prueba existen.
- Preparar un paciente ficticio, una cita futura y una cita pasada sin cierre.
- Mantener `DAYIA_PLATFORM_CREATE_ENABLED=false` y
  `WHATSAPP_SEND_ENABLED=false`.
- Cerrar notificaciones, ocultar credenciales y no mostrar Supabase Dashboard.
- Confirmar que la cuenta owner demo es distinta de la cuenta `platform_admin`.
- Verificar que el navegador abre `wa.me` con una cuenta controlada o evitar
  completar esa navegación.

## Recorrido

### 1. Ingreso y contexto

Iniciar sesión como owner. Señalar el consultorio activo, el rol Propietario y
el plan real. Explicar que cada usuario opera dentro de su membership activa.
No iniciar este recorrido con la cuenta interna de Charles Pérez.

### 2. Dashboard

Mostrar citas del día, próximas citas, actividad y pacientes recientes. Enfatizar
que el objetivo es ver la operación del consultorio sin recorrer varias hojas.

### 3. Crear y editar paciente

Registrar un paciente ficticio con teléfono internacional. Abrir su ficha,
editar un dato y guardar. Mostrar que listado, búsqueda y detalle se actualizan
sin duplicar al paciente.

### 4. Crear y confirmar cita

Crear una cita desde el paciente. Elegir tratamiento y un horario permitido por
la configuración. Volver a Agenda y confirmar la cita.

### 5. Recordatorio manual

Abrir Recordatorios, localizar la cita y revisar el mensaje sugerido. Explicar:
“Actualmente el envío es manual desde WhatsApp. El envío automático está
preparado para una etapa posterior.”

Mostrar `Abrir WhatsApp` sin afirmar que la aplicación envió el mensaje. El
operador registra después el resultado como enviado o fallido.

### 6. Resolver una cita pasada

Usar la cita pasada preparada y abrir `Resolver cita pasada`. Mostrar las
opciones atendida, no asistida, reprogramada o cancelada y cómo el recordatorio
queda separado del cierre clínico de la cita.

### 7. Historial clínico

Entrar al paciente y registrar una evolución breve, sin datos reales. Mostrar
que el registro queda asociado al paciente y al consultorio.

### 8. Odontograma

Seleccionar una pieza, asignar un estado y una observación breve. Cambiar de
paciente o volver al detalle para remarcar que los odontogramas no se mezclan.

### 9. Usuarios del consultorio

En Configuración, mostrar Usuarios con el plan Pro. Explicar roles y límites de
plan. No enviar invitaciones durante una demo pública salvo que exista una
cuenta controlada preparada para esa prueba.

### 10. Separación de roles

Si hay tiempo, iniciar sesión como Recepción y mostrar que solo ve Dashboard,
Pacientes, Citas y Recordatorios. Administración DayIA se muestra únicamente en
la cuenta interna de plataforma y no expone datos clínicos.

## Cierre comercial

Propuesta de valor sugerida:

“DayIA Dental reúne agenda, pacientes, seguimiento clínico y recordatorios en
un solo flujo por consultorio. El equipo trabaja con permisos claros y conserva
el contexto del paciente, mientras la automatización de WhatsApp queda como una
etapa posterior que requiere activación y revisión productiva.”

Cerrar preguntando qué tarea diaria consume más tiempo hoy y qué parte del
recorrido debería validarse primero en una prueba piloto.

## No prometer durante la demo

- Envío automático real por WhatsApp o confirmación de entrega desde Meta.
- Facturación, pagos o contratación automática de planes.
- Selector multi-consultorio.
- Cumplimiento legal certificado o disponibilidad productiva sin la revisión
  descrita en `docs/production-readiness.md`.
