# Sistema visual de DayIA Dental

Esta guía es la referencia obligatoria para crear o modificar interfaces. Su
objetivo es evitar controles aislados, estilos nativos inconsistentes y
correcciones repetidas entre módulos.

## Principio base

Antes de agregar CSS nuevo, revisar si el patrón ya existe en `src/App.css` o
en un componente compartido. Un flujo nuevo debe heredar tipografía, color,
radio, foco, estados y espaciado; no debe recrearlos dentro del componente.

Las variables visuales viven en `src/index.css`. Los patrones y modificadores
compartidos viven en `src/App.css`. El JSX solo agrega clases semánticas.

## Campos de formulario

El control base es `.field-control`:

```tsx
<input className="field-control" />
<select className="field-control" />
<textarea className="field-control field-control--textarea" />
<textarea className="field-control field-control--textarea field-control--fixed-textarea" />
```

Reglas:

- usar siempre la fuente global; nunca depender de la fuente nativa del
  navegador;
- conservar borde, radio, fondo, placeholder y foco del control base;
- usar `aria-invalid="true"` y un mensaje cercano para errores;
- no mostrar errores técnicos de Supabase o PostgreSQL;
- no impedir que un campo numérico quede temporalmente vacío mientras se edita;
- usar modificadores compartidos en vez de duplicar selectores por pantalla;
- los motivos, confirmaciones y otros textareas sensibles usan
  `.field-control--fixed-textarea`; su tamaño es fijo y no muestran el tirador
  nativo de redimensionado.

## Acciones

- La acción principal de una pantalla puede ser prominente.
- Las acciones repetidas dentro de cards o filas deben ser compactas y
  contextuales.
- Cuando el contexto ya explica el objeto, usar una sola palabra:
  `Desactivar`, `Reactivar`, `Editar`, `Reenviar`.
- Las acciones compactas pueden abreviar el texto visible, pero deben conservar
  un `aria-label` que nombre el objeto completo.
- Un formulario que aumente la altura de una fila o card repetida debe abrirse
  en el `ConfirmDialog` compartido. La tabla conserva únicamente el contexto y
  la acción; el resultado final se comunica con el `Toast` compartido.
- Si el diálogo corrige una identidad o un dato de contacto, debe mostrar el
  valor actual, enfocar el campo nuevo y explicar la consecuencia antes de
  confirmar.
- Desactivar o anular usa el estilo de cautela; no debe parecer un error hasta
  que la operación falle.
- Toda acción sensible requiere revisión, motivo cuando corresponda, bloqueo de
  doble envío y feedback cercano.
- Los botones compactos usan una altura aproximada de 32–36 px en escritorio y
  un área táctil más cómoda en móvil.

## Feedback

- Los errores de validación o guardado se muestran junto al formulario o
  acción que los originó.
- Los éxitos que confirman una mutación terminada, como invitar, activar o
  desactivar un usuario, usan el `Toast` compartido y no crean alertas dentro de
  cards o tablas.
- No colocar el único resultado de una acción lejos del punto de interacción.
- Nunca usar `alert`, `confirm` o `prompt` nativos si existe un patrón interno.

## Responsive obligatorio

Cada cambio visual debe revisarse como mínimo en:

- 360 px;
- 390 px;
- 430 px;
- escritorio.

Los campos deben ocupar el ancho disponible sin overflow. Las cards pueden
apilar sus columnas, pero deben mantener visible primero identidad, estado y
acción. Los botones contextuales no deben convertirse automáticamente en
botones de ancho completo.

## Checklist antes de cerrar una pantalla

- Reutiliza tokens y patrones existentes.
- Fuente, borde, foco, placeholder y disabled son coherentes.
- Error y éxito aparecen cerca de la acción.
- El texto del botón es breve y específico.
- No hay doble envío.
- Teclado y foco visible funcionan.
- 360 px no tiene overflow ni texto cortado.
- Los tests, lint y build siguen pasando.
