# Diseño visual vigente

Actualizado el 26 de octubre de 2026. Dirección A «Mesa clara», elegida por el propietario tras revisar tres maquetas y el plan por pantallas. Conserva la identidad de «ficha de lectura», la marca, las fuentes y el color químico. [Auditoría y propuesta aprobada](usability-redesign-proposal-2026-10-26.md).

Ampliación aprobada del 23 oct: [Lectura de los resultados](assistant.md) al pie de Analizar y Laboratorio, sin icono ni color adicional. Prosa de 62 caracteres e interlineado 1,75 mediante tokens; cifras enviadas a la derecha en escritorio y debajo en móvil, separadas por un filete. Cabecera en rejilla en pantallas estrechas, foco conservado y estados bilingües. Implementada localmente; no cambia la dirección visual vigente.

## Principios

Ampliación SIFTS aprobada e implementada el 25–26 oct: [maqueta y plan de selección](references.md). Biblioteca conserva catálogo, consulta y visor; añade posición, cadena y estado. Analizar conserva lector/editor/perfiles y abre la vista Estructura con el visor general solo al recibir una referencia exacta de Biblioteca. Sin lector nuevo en Biblioteca, persistencia adicional o rediseño del laboratorio. Capturas a 360 y 1280 px, ambos temas, revisadas tras las pruebas combinadas.

1. **La pantalla muestra proteínas, no habla de sí misma.** Cada pantalla de trabajo abre con un ejemplo real que se puede reemplazar: la insulina humana (P01308) en Analizar e Inicio, humana frente a bovina (P01317) en Alinear, una búsqueda ya resuelta en Diseñar y la estructura 1TRZ en Biblioteca. No hay cajas vacías con explicaciones.
2. **Tarea y sujeto se distinguen.** Analizar abre con la tarea y una ficha de la proteína (nombre, procedencia, longitud y alcance). Comparar conserva la pareja de referencia como título y los nombres en las entradas. El resumen precede al detalle.
3. **La interfaz va en tinta; el color es química.** Botones, enlaces, líneas y texto usan tinta sobre papel frío. Los únicos tonos son las seis clases de residuo: hidrofóbico, polar, ácido, básico, Gly·Pro y cisteína. El perfil usa dos de ellos: hidrofóbico sobre cero, básico bajo cero.
4. **Sin plantilla.** No hay rótulos en mayúsculas sobre los bloques, tarjetas con icono, pasos numerados, barra flotante ni llamadas a crear cuenta. Los avisos de alcance van una sola vez, junto a la cifra o figura que los necesita.
5. **Texto de la consigna.** La interfaz habla de explorar, comparar y diseñar proteínas. No menciona servidor, base de datos, código ni detalles de implementación.

## Marco

- Navegación lateral persistente en escritorio: Inicio · Analizar · Comparar · Diseñar secuencias · Laboratorio 3D · Biblioteca; con sesión añade Proyectos. Marca hacia Inicio y acceso a Cuenta y preferencias. Barra superior con ubicación y acciones de cuenta.
- Preferencias globales con tema (sistema/claro/oscuro) e idioma, con y sin sesión. Escape cierra y devuelve foco; pulsar fuera cierra. Con sesión, avatar hacia Perfil; sin ella, entrar/crear cuenta.
- Por debajo de 64rem (tabletas y teléfonos): marca, «Iniciar sesión» y botón de menú. El menú es un panel superpuesto con los mismos destinos, apariencia, idioma, «Crear cuenta» e «Iniciar sesión»; se cierra con Escape, con el velo o al elegir destino, y devuelve el foco al botón.
- Pie: logo, consigna, Privacidad, Condiciones y, sin sesión, el selector de idioma.
- Cuenta: la app se usa completa sin sesión. La diferencia se dice donde importa: un tramo al final de Inicio compara «sin cuenta» y «con cuenta», y «Guardar» y la consulta de UniProt ofrecen crear cuenta o iniciar sesión.
- Ejemplo: la insulina es un ejemplo y se nombra como tal. Las acciones de Inicio son generales («Analizar proteínas», «Comparar proteínas») y la línea bajo el título de Analizar y Alinear dice «Ejemplo» mientras no se cambie.
- Cabecera de página: tarea o sujeto, contexto y acciones jerarquizadas. En Analizar, «Analizar mi secuencia» abre la entrada; Guardar/Exportar/Comparar son secundarios. Los controles se ajustan en móvil.
- Analizar: Resumen, Secuencia, Perfil y Estructura. Un único Worker de perfil permanece activo; revelar el perfil redibuja su canvas. Ventana y selección se comparten.
- Laboratorio: selector de variantes siempre antes de Estructura, Comparación y Archivos y procedencia. El borrador conserva protección/deshacer y retira la predicción incompatible.
- Biblioteca: catálogo y UniProt como vistas, con ficha seleccionada explícita. Proyectos: filas con acciones, longitud/procedencia y detalles científicos desplegables. Parámetros de comparación y reproducibilidad del generador se abren a demanda.
- Acceso: contexto del trabajo junto al formulario y salida sin cuenta. Perfil y documentos legales tienen índices de secciones.

## Color y tipografía

Valores en `src/design-tokens.css`, cada uno con su gemelo oscuro. No se definen colores en componentes.

- Superficies: papel frío, superficie elevada, superficie tenue para escenarios y controles.
- Tinta: texto principal, texto secundario, bordes fuerte y sutil, anillo de foco.
- Residuos: un tono fuerte y uno suave por clase (`--residue-*` y `--residue-*-soft`). Las celdas usan el suave con texto de tinta; barras, leyendas y la estructura usan el fuerte.
- Los tramos que se recortan al madurar la proteína conservan su química como subrayado, sin relleno.

Bricolage Grotesque 600 para titulares y marca, Atkinson Hyperlegible Next 400/600 para interfaz, IBM Plex Mono para residuos y cifras. Fuentes locales con manifiesto y licencia; ver [procedencia](font-provenance.md).

## Figuras propias

| Figura | Qué muestra | Origen de los datos |
|---|---|---|
| Estructura | Tubo sombreado por los Cα de las cadenas A y B y los tres puentes disulfuro | Coordenadas de PDB 1TRZ, extraídas del BinaryCIF sin modificar con `scripts/build-backbone.mjs` |
| Cinta de secuencia | Una celda por residuo, tramos con nombre y arcos de puentes | Secuencia del catálogo y anotaciones de UniProt en `features/editor/annotations.ts` |
| Lector de residuos | Secuencia en bloques de diez, celdas por química, selección y ventana | Mecanismo virtualizado existente |
| Perfil | Área coloreada sobre y bajo cero | Worker del perfil; el boceto de Inicio usa la misma función de cálculo |
| Tendencias | Tres tiras de opacidad: hélice, lámina, giro | Propensiones de Chou–Fasman ya calculadas |
| Mapa del alineamiento | Una celda por columna: idéntico, similar, distinto, hueco | Marcas del resultado de Gotoh |
| Bloques del alineamiento | Solo se colorean las columnas que cambian | Resultado de Gotoh; virtualizados |

La estructura de Inicio y de la columna lateral es un dibujo propio y ligero en canvas 2D. Biblioteca muestra ese mismo dibujo de inmediato y carga el visor completo (Mol*) por detrás; si la descarga falla, el estado de error y la ficha pública siguen disponibles.

Las anotaciones de tramos y puentes existen solo para las referencias incluidas. Una secuencia pegada o editada no las tiene, y las figuras que dependen de ellas no se muestran.

## Movimiento

- La estructura de Inicio gira despacio hasta la primera interacción. No gira con «reducir movimiento», fuera de pantalla ni con la pestaña oculta.
- Se arrastra para girar; con foco, las flechas la giran. Un clic elige el residuo más cercano y lo marca en la secuencia.
- Las páginas y paneles entran con un fundido corto. Ningún contenido depende de una animación para ser visible.
- No hay transiciones de color en elementos sensibles al tema ni transformaciones en contenedores de página.

## Fuentes de verdad y comprobación

- Tokens: `src/design-tokens.css`; estilos base: `src/index.css`; composición Mesa clara: `src/workbench.css`.
- Textos: `src/i18n/es.ts` y `src/i18n/en.ts`, siempre los dos en el mismo cambio; `en.ts` está tipado contra `es.ts`. Rutas y redirecciones: `src/shared/navigation.ts`.
- Opciones y medidas de comportamiento: `config.ts` de cada característica (`chemistry`, `structure`, `alignment`, `descriptors`, `generator`, `landing`).
- Química de residuos: `features/chemistry/config.ts`, compartida por celdas, leyendas, composición y estructura.
- Editor superpuesto, FASTA virtualizado, lector, bloques de alineamiento y Workers conservan sus mecanismos.
- Objetivos táctiles de 44 px, foco visible, teclado, contraste AA y ambos temas. Revisar a 360 y 1280 px.

La revisión automática de accesibilidad y geometría no demuestra por sí sola facilidad de uso con personas. Las páginas legales mantienen las menciones a proveedores de su contenido. El rediseño no amplía predicción, persistencia, contratos o pruebas experimentales.
