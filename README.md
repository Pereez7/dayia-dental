# DayIA Dental

Aplicacion interna para consultorios dentales. El objetivo inicial es organizar
citas odontologicas y preparar una base clara para crecer hacia recordatorios,
historiales y otros modulos clinicos.

## Estado actual

- Frontend con React, Vite y TypeScript.
- Layout base con sidebar, header y navegacion por estado local.
- Modulo de pacientes con listado, busqueda, formulario y validaciones.
- Datos mock separados en `src/data`.
- Tipos compartidos en `src/types`.
- Componentes pequenos y reutilizables en `src/components`.
- Utilidades puras en `src/utils`.
- Pruebas unitarias con Vitest.

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

- [Contexto del proyecto](docs/project-context.md)
- [Arquitectura](docs/architecture.md)
- [Decisiones tecnicas](docs/decisions.md)
- [Roadmap](docs/roadmap.md)
- [Changelog](CHANGELOG.md)
