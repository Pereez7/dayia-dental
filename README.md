# DayIA Dental

Aplicacion interna para consultorios dentales. El objetivo inicial es organizar
citas odontologicas y preparar una base clara para crecer hacia recordatorios,
historiales y otros modulos clinicos.

## Estado actual

- Frontend con React, Vite y TypeScript.
- Layout base con sidebar, header y navegacion por estado local.
- Modulo de pacientes con listado, busqueda, formulario, validaciones y detalle
  de paciente.
- Dashboard operativo con KPIs, proximas atenciones, pacientes recientes y
  resumen de actividad.
- Modulo de citas con agenda agrupada y formulario de nueva cita.
- Nueva cita con seleccion real de paciente, horarios exactos cada 15 minutos y
  validaciones de campos.
- Configuracion de tratamientos con alta, busqueda, edicion, activacion y
  desactivacion local.
- Datos mock separados en `src/data`.
- Tipos compartidos en `src/types`.
- Componentes pequenos y reutilizables en `src/components`.
- Utilidades puras en `src/utils`.
- Pruebas unitarias con Vitest.

## Modulos actuales

- **Dashboard:** KPIs operativos, proximas atenciones, pacientes recientes y
  resumen operativo.
- **Pacientes:** listado, busqueda, alta local, validaciones, detalle de
  paciente y citas asociadas.
- **Citas:** agenda mobile-first, KPIs por estado, creacion local de citas,
  seleccion de paciente y horarios de 24 horas en intervalos de 15 minutos.
- **Configuracion:** gestion local de tratamientos disponibles para Nueva Cita.
- **Historial clinico, Odontograma y Recordatorios:** vistas iniciales o
  placeholders para el crecimiento futuro.

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
- [Arquitectura](docs/architecture.md)
- [Decisiones tecnicas](docs/decisions.md)
- [Roadmap](docs/roadmap.md)
- [Changelog](CHANGELOG.md)
