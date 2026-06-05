# DayIA Dental

Aplicacion interna para consultorios dentales. El objetivo inicial es organizar
citas odontologicas y preparar una base clara para crecer hacia recordatorios,
historiales y otros modulos clinicos.

## Estado actual

- Frontend con React, Vite y TypeScript.
- Dashboard inicial responsive.
- Datos de citas separados en `src/data`.
- Componentes pequenos y reutilizables en `src/components`.
- Utilidades de formato en `src/utils`.
- Pruebas unitarias basicas con Vitest.

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

- [Arquitectura](docs/architecture.md)
- [Decisiones tecnicas](docs/decisions.md)
- [Changelog](CHANGELOG.md)
