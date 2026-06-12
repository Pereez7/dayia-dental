# DayIA Dental

Aplicacion interna para consultorios dentales. El objetivo inicial es organizar
citas odontologicas y preparar una base clara para crecer hacia recordatorios,
historiales y otros modulos clinicos.

## Estado actual

- Frontend con React, Vite y TypeScript.
- Layout base con sidebar, header y navegacion por estado local.
- Sidebar con marca, acciones rapidas y navegacion principal diferenciadas.
- Modulo de pacientes con listado, busqueda, formulario, validaciones y detalle
  de paciente.
- Dashboard operativo con KPIs, proximas atenciones, pacientes recientes y
  resumen de actividad, con composicion visual refinada.
- Modulo de citas con agenda diaria operativa y formulario de nueva cita.
- Citas con confirmacion, cancelacion y reprogramacion local, incluyendo
  motivos simples de cancelacion y reprogramacion.
- Nueva cita con seleccion real de paciente, horarios disponibles segun
  horarios del consultorio, bloqueo de horas ocupadas y validaciones de campos.
- Historial clinico inicial dentro del detalle de paciente, con registros
  asociados por paciente, normalizacion de textos y fechas con año.
- Odontograma inicial dentro del detalle de paciente, con piezas permanentes
  adultas, estados por pieza y resumen por estado.
- Recordatorios WhatsApp iniciado con generacion local, filtros, vista previa y
  estados simulados.
- Configuracion con horarios del consultorio y tratamientos locales.
- Tratamientos con alta, busqueda, edicion, activacion, desactivacion y Toast
  flotante de feedback.
- `ConfirmDialog` reutilizable para confirmaciones sensibles, usado al cancelar
  citas desde Agenda y al desactivar tratamientos desde Configuracion.
- Datos mock separados en `src/data`.
- Tipos compartidos en `src/types`.
- Componentes pequenos y reutilizables en `src/components`.
- Utilidades puras en `src/utils`.
- Pruebas unitarias con Vitest.

## Modulos actuales

- **Dashboard:** KPIs operativos, proximas atenciones, pacientes recientes y
  resumen operativo con jerarquia visual mejorada.
- **Pacientes:** listado, busqueda, alta local, validaciones, detalle de
  paciente, fichas escaneables, citas asociadas e historial clinico inicial.
- **Citas:** agenda diaria mobile-first con selector horizontal de dias, KPIs
  compactos, listado ordenado por hora, confirmacion, cancelacion con motivo en
  `ConfirmDialog`, reprogramacion inline con motivo, creacion local de citas,
  seleccion de paciente, horarios disponibles segun configuracion del
  consultorio, bloqueo de choques de horario y bloqueo de doble cita activa del
  mismo paciente en el dia. Las citas canceladas no se reprograman
  directamente; si el paciente desea asistir nuevamente, se crea una nueva
  cita.
- **Historial clinico:** registros clinicos dentro del detalle de paciente,
  ordenados por fecha, con resumen temporal y formulario de evolucion basica.
- **Odontograma:** grilla inicial de piezas permanentes adultas dentro del
  detalle de paciente, con actualizacion simple por pieza.
- **Recordatorios WhatsApp:** generacion local de recordatorios `24h`, `2h` y
  confirmacion inmediata, con selector por fecha, filtros por estado, vista
  previa y Toast de feedback.
- **Configuracion:** horarios semanales del consultorio, intervalo de atencion,
  bloque informativo de futuras excepciones del calendario y gestion local de
  tratamientos disponibles para Nueva Cita.

La aplicacion todavia no tiene backend, base de datos, autenticacion,
persistencia ni integracion real con WhatsApp.

## Comandos

Instalar dependencias:

```bash
npm install
```

Levantar el servidor de desarrollo:

```bash
npm run dev
```

Ejecutar pruebas unitarias:

```bash
npm run test
```

Ejecutar pruebas en modo observacion:

```bash
npm run test:watch
```

Compilar para produccion:

```bash
npm run build
```

Revisar reglas de lint:

```bash
npm run lint
```

## Documentacion

Cuando se actualice la documentacion del proyecto, mantener alineados estos
archivos:

- [Contexto del proyecto](docs/project-context.md)
- [README](README.md)
- [Arquitectura](docs/architecture.md)
- [Decisiones tecnicas](docs/decisions.md)
- [Roadmap](docs/roadmap.md)
- [Changelog](CHANGELOG.md)
- [Producto](PRODUCT.md)
