# Dominios documentados y ensamblado — propuesta de interfaz

Preparada el **28 oct 2026**. **Aprobada por el propietario el 28 oct 2026** con una condición: «Sí, pero con los colores de toda la app y así». Es decir, la pantalla usa solo los tokens y las clases que ya existen (colores, espacios, radios, bordes y tipografías de `src/design-tokens.css`), sin valores propios. La maqueta se rehízo así antes de implementar. Implementación en `parallel/domains`, sin publicar. El catálogo de datos sí está confirmado en `parallel/domains` (`b23110f`), sin ruta visible y sin que ninguna pantalla lo use todavía.

Maqueta: `artifacts/domains-2026-10-28/index.html`, servida en el puerto 5327 desde la raíz del worktree. Capturas en `artifacts/domains-2026-10-28/capturas/` a 1280 y 360 px, en español e inglés y en ambos temas. La maqueta enlaza las hojas de estilo reales de la app (`src/design-tokens.css`, `src/index.css`, `src/frames.css`, `src/workbench.css`) y lee el catálogo real, así que no puede alejarse del diseño publicado.

## Qué se propone

Un tercer apartado dentro de **Biblioteca**, junto a «Referencias» y «UniProt», con las mismas pestañas que ya existen (`ViewTabs`). No se añade entrada al lateral ni al sitio público: el marco no cambia. La razón es que Biblioteca ya es el lugar de donde se traen secuencias documentadas a Analizar, y estas piezas son exactamente eso, en menor tamaño.

### Pantalla 1 · Dominios documentados

- **Cabecera de la sección** con una frase que explica qué es cada pieza y una nota prudente: las descripciones resumen la función descrita de cada familia, y unir piezas no demuestra que la secuencia resultante se pliegue ni que funcione. Esa nota es permanente, no un aviso que se cierre.
- **Dos filtros** en una fila: tipo de pieza (lista desplegable con los 25 tipos del catálogo) y búsqueda por nombre, proteína u organismo. Debajo, el recuento «N de 48 piezas».
- **Tarjeta por pieza**, con lo que la hace citable:
  - acceso de UniProt, nombre de entrada y versión de entrada;
  - el tramo exacto, por ejemplo «SH3 · 84-145»;
  - proteína, organismo y número de residuos;
  - el resumen de función en el idioma activo;
  - etiquetas: familia Pfam con su nombre, estructura del PDB con método y resolución —o «sin estructura que cubra el tramo»—, y cada fuente con su licencia;
  - la secuencia del tramo en la tipografía de secuencia;
  - dos acciones: «Añadir al ensamblado» y «Analizar esta pieza».
- La pieza ya añadida se marca con el fondo de selección existente y su botón pasa a «Añadida», con `aria-pressed`.

### Pantalla 2 · Ensamblado

Es el mismo apartado con el panel lateral poblado, no otra ruta.

- **Panel «Ensamblado»**, pegajoso en escritorio y debajo de la lista en móvil, con el recuento de piezas y residuos.
- **Lista ordenada** de las piezas elegidas; cada una con sus residuos y tres acciones con nombre accesible: subir, bajar y quitar.
- **Secuencia unida** en tipografía de secuencia, precedida de una barra que marca dónde empieza y acaba cada pieza.
- **Acciones:** «Analizar el ensamblado», que lleva la secuencia a Analizar por el mismo camino que usa hoy Biblioteca; «Descargar FASTA»; y «Guardar en proyecto», que necesita sesión y reutiliza el guardado existente.

## Estados

| Estado | Qué se ve |
|---|---|
| Sin piezas elegidas | El panel explica que todavía no hay ninguna y sus tres acciones quedan desactivadas |
| Filtro sin resultados | El recuento dice 0 y se ofrece limpiar el filtro; el panel no cambia |
| Sin sesión | Todo funciona salvo «Guardar en proyecto», que explica que necesita la sesión, como ya hace Proyectos |
| Borrador con texto en Analizar | «Analizar el ensamblado» pide confirmación antes de reemplazarlo, con el diálogo que ya existe en Biblioteca |

## Diseño

Solo tokens y clases existentes: ningún color, espacio, radio, borde ni tamaño de letra nuevo. Tarjetas con `--radius-surface` y `--bg-raised`, la pieza elegida con `--bg-selected`, etiquetas con `--radius-pill`, el panel con `--bg-subtle`, la nota con `--border-width-residue`. Los nombres de las fuentes (UniProtKB, InterPro, PDB) se muestran traducidos desde i18n, no tal como vienen en el archivo de datos, que hoy guarda «PDB (vía SIFTS en UniProt)» en español.

## Accesibilidad y formas

Las pestañas conservan el patrón de `ViewTabs`, con flechas, Inicio y Fin. Cada acción de la lista ordenada tiene nombre propio, porque «↑» no se lee solo. Las etiquetas de familia, estructura y licencia son texto, no color. Se comprueba a 360 y 1280 px, en ambos idiomas y temas, con la matriz de accesibilidad que ya existe. Todo texto visible se escribe en español e inglés en el mismo cambio.

## Verificación del catálogo ya hecha

El archivo confirmado se verificó antes de aceptarlo, sin fiarse de la sesión que lo generó:

- **Las 48 entradas**, rederivadas desde las descargas guardadas: cada secuencia es el tramo exacto de la secuencia completa de su entrada; su SHA-256 coincide; el alfabeto y la longitud concuerdan con el intervalo; la versión de entrada y la de secuencia coinciden con la descarga; el solapamiento con la familia cumple los márgenes que el propio archivo declara; la estructura citada está en las referencias cruzadas de la entrada, su resolución no supera 3,5 Å y su cadena cubre el tramo. Cero discrepancias.
- **El SHA-256 que cada entrada declara de su fuente** coincide con la descarga guardada.
- **Ocho entradas de ocho tipos distintos** se volvieron a pedir a UniProt el 28 oct: secuencia, intervalo, versión de entrada y versión de secuencia idénticas en las ocho.
- `src/features/domains/catalog.test.ts` deja esas invariantes como prueba: 101 comprobaciones, que corren en integración continua y fallan si el archivo se edita a mano.

Límites: la verificación en línea es de una muestra, no de las 48; el SHA-256 de cada fuente certifica la descarga de aquel día, no que la entrada no cambie después; y que una estructura cubra el tramo no significa que todos sus residuos estén observados.

## Fuera del alcance

Nada de inferencia de estructura ni de predicción sobre la secuencia unida: el ensamblado se analiza con las herramientas que ya existen. No se añaden rutas, entradas de navegación ni cambios del marco. No se tocan Proyectos ni el historial del generador más allá de reutilizar su guardado.

## Si se aprueba

1. Módulo tipado del catálogo y lógica de ensamblado, con sus pruebas, sin interfaz.
2. La pestaña y las tarjetas, con sus textos en los dos idiomas.
3. El panel de ensamblado y los enlaces con Analizar, descarga y guardado.
4. Recorridos de navegador a 360 y 1280 px con la comprobación de accesibilidad, y entrada en la documentación.
