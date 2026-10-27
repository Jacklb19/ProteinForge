# Diseño visual vigente

Actualizado el 26 de octubre de 2026. Dirección A «Mesa clara», elegida por el propietario tras revisar tres maquetas y el plan por pantallas. Conserva la identidad de «ficha de lectura», la marca, las fuentes y el color químico. [Auditoría y propuesta aprobada](usability-redesign-proposal-2026-10-26.md).

Ampliación aprobada el 26 oct con «Me gusta» y una condición: [presentación pública y laboratorio](public-laboratory-proposal-2026-10-26.md). Separa un sitio público de una sola página del entorno de trabajo con barra lateral. Cada control vive en su sección: tema e idioma en Preferencias, identidad y sesión en Cuenta, guardar/exportar/importar junto a su herramienta. Iconos de trazo y animaciones de entrada están autorizados por esa petición y sustituyen la restricción anterior que los limitaba. Implementada localmente; sin publicar.

Ampliación aprobada del 23 oct: [Lectura de los resultados](assistant.md) al pie de Analizar y Laboratorio, sin icono ni color adicional. Prosa de 62 caracteres e interlineado 1,75 mediante tokens; cifras enviadas a la derecha en escritorio y debajo en móvil, separadas por un filete. Cabecera en rejilla en pantallas estrechas, foco conservado y estados bilingües. Implementada localmente; no cambia la dirección visual vigente.

## Principios

Ampliación SIFTS aprobada e implementada el 25–26 oct: [maqueta y plan de selección](references.md). Biblioteca conserva catálogo, consulta y visor; añade posición, cadena y estado. Analizar conserva lector/editor/perfiles y abre la vista Estructura con el visor general solo al recibir una referencia exacta de Biblioteca. Sin lector nuevo en Biblioteca, persistencia adicional o rediseño del laboratorio. Capturas a 360 y 1280 px, ambos temas, revisadas tras las pruebas combinadas.

1. **La pantalla muestra proteínas, no habla de sí misma.** Cada pantalla de trabajo abre con un ejemplo real que se puede reemplazar: la insulina humana (P01308) en Analizar y la presentación, humana frente a bovina (P01317) en Alinear, una búsqueda ya resuelta en Diseñar y la estructura 1TRZ en Biblioteca. No hay cajas vacías con explicaciones.
2. **Tarea y sujeto se distinguen.** Analizar abre con la tarea y una ficha de la proteína (nombre, procedencia, longitud y alcance). Comparar conserva la pareja de referencia como título y los nombres en las entradas. El resumen precede al detalle.
3. **La interfaz va en tinta; el color es química.** Botones, enlaces, líneas y texto usan tinta sobre papel frío. Los únicos tonos son las seis clases de residuo: hidrofóbico, polar, ácido, básico, Gly·Pro y cisteína. El perfil usa dos de ellos: hidrofóbico sobre cero, básico bajo cero.
4. **Sin plantilla.** No hay rótulos en mayúsculas, pasos numerados ni barra flotante. Los iconos de trazo acompañan destinos de la barra lateral y puntos de la presentación; no sustituyen un texto. Las llamadas a crear cuenta o entrar solo aparecen en la presentación pública (cabecera, portada y cierre) y en las acciones que de verdad requieren sesión. Los avisos de alcance van una sola vez, junto a la cifra o figura que los necesita.
5. **Texto de la consigna.** La interfaz habla de explorar, comparar y diseñar proteínas. No menciona servidor, base de datos, código ni detalles de implementación.

## Marco

Dos composiciones con la misma marca, fuentes y química. Los borradores, la sesión, el laboratorio y los proyectos viven por encima de ambas; pasar de una a otra no descarta trabajo.

### Sitio público

- Cabecera fija con marca, enlaces a Qué es, Herramientas y Cómo funciona, Preferencias (apariencia e idioma) y, a la derecha, Iniciar sesión y Crear cuenta. Con sesión, «Ir al laboratorio» sustituye a ambos. Sin servicio de identidad no se ofrece crear cuenta.
- Presentación: propósito, estructura experimental 1TRZ que gira hasta la primera interacción y su secuencia con tramos y puentes. Acción principal «Crear cuenta»; secundaria «Explorar el ejemplo», identificada como ejemplo público sin cuenta.
- Secciones: qué es (tres puntos), herramientas (pestañas con un ejemplo real por herramienta), recorrido, tipos de evidencia, cierre con la llamada a la cuenta y preguntas. Los ejemplos se calculan en su Worker solo cuando la sección se acerca a la pantalla y la pestaña está elegida; Diseñar muestra condiciones sin ejecutar una búsqueda.
- Acceso, registro, recuperación, legales y dirección desconocida usan este marco: sin barra lateral.
- Por debajo de 64rem, los enlaces de sección, Preferencias y la cuenta pasan a un menú modal; en teléfonos la cabecera conserva marca, Iniciar sesión y menú.
- Pie: marca, consigna, Laboratorio, Privacidad y Condiciones. No hay selectores de tema o idioma en el pie ni en el contenido.

### Laboratorio

- Barra lateral fija con desplazamiento propio: cabecera (marca y contraer/expandir), grupos Investigar (Analizar, Comparar, Biblioteca), Diseñar (Diseñar secuencias, Laboratorio 3D) y Organizar (Proyectos, solo con sesión; el grupo no aparece vacío). Al pie: Guía y métodos, Preferencias y la cuenta.
- Cuenta con sesión: un menú con Cuenta y preferencias, Sitio de ProteinForge y Cerrar sesión. Sin sesión: nota de que el trabajo dura la visita, Iniciar sesión y Crear cuenta.
- Modo compacto: solo iconos de 44 px; cada nombre sigue siendo el nombre accesible y aparece junto al icono al pasar el puntero o con foco de teclado. El ancho elegido se guarda en el navegador como única preferencia de este marco; no se guardan secuencias ni proyectos.
- Por debajo de 64rem, la barra lateral es un panel modal con el mismo contenido; Escape cierra primero Preferencias o el menú de cuenta y después el panel; el velo y cada destino también lo cierran, y el foco vuelve al botón.
- No hay franja de ubicación: cada herramienta abre con su título, propósito y acciones. Comparar y Laboratorio 3D muestran el nombre de la herramienta sobre el título del sujeto.
- Pie discreto con Privacidad y Condiciones.

### Herramientas

- Cabecera de página: tarea o sujeto, propósito explicado y acciones jerarquizadas. En Analizar, «Analizar mi secuencia» abre la entrada; Guardar/Exportar/Comparar son secundarios. Los controles se ajustan en móvil.
- Analizar: Resumen, Secuencia, Perfil y Estructura. Un único Worker de perfil permanece activo; revelar el perfil redibuja su canvas. Ventana y selección se comparten.
- Laboratorio: selector de variantes siempre antes de Estructura, Comparación y Archivos y procedencia. El borrador conserva protección/deshacer y retira la predicción incompatible. Abrir y guardar archivo y guardar en Proyectos están en su cabecera.
- Biblioteca: catálogo y UniProt como vistas, con ficha seleccionada explícita. Proyectos: filas con acciones, longitud/procedencia y detalles científicos desplegables. Parámetros de comparación y reproducibilidad del generador se abren a demanda.
- Guía y métodos: propiedades, perfil y propensiones, comparación, diseño, estructuras y tipos de evidencia, con los métodos y criterios ya usados por cada herramienta y un enlace de vuelta a ella.
- Cuenta y preferencias: identidad, contraseña, apariencia, idioma, privacidad y enlace a Proyectos.

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
| Perfil | Área coloreada sobre y bajo cero | Worker del perfil; el boceto de la presentación usa la misma función de cálculo |
| Tendencias | Tres tiras de opacidad: hélice, lámina, giro | Propensiones de Chou–Fasman ya calculadas |
| Mapa del alineamiento | Una celda por columna: idéntico, similar, distinto, hueco | Marcas del resultado de Gotoh |
| Bloques del alineamiento | Solo se colorean las columnas que cambian | Resultado de Gotoh; virtualizados |

La estructura de la presentación y de la columna lateral es un dibujo propio y ligero en canvas 2D. Biblioteca muestra ese mismo dibujo de inmediato y carga el visor completo (Mol*) por detrás; si la descarga falla, el estado de error y la ficha pública siguen disponibles.

Las anotaciones de tramos y puentes existen solo para las referencias incluidas. Una secuencia pegada o editada no las tiene, y las figuras que dependen de ellas no se muestran.

## Movimiento

- La estructura de la presentación gira despacio hasta la primera interacción. No gira con «reducir movimiento», fuera de pantalla ni con la pestaña oculta.
- Las secciones de la presentación entran una vez con fundido y un desplazamiento corto, justo antes de llegar a la pantalla. El contenido es visible aunque la animación no ocurra; con «reducir movimiento» no hay entrada ni desplazamiento.
- Se arrastra para girar; con foco, las flechas la giran. Un clic elige el residuo más cercano y lo marca en la secuencia.
- Las páginas y paneles entran con un fundido corto. Ningún contenido depende de una animación para ser visible.
- No hay transiciones de color en elementos sensibles al tema ni transformaciones en contenedores de página de las herramientas. Los destinos de la barra lateral cambian su fondo con una transición corta de retroalimentación.

## Fuentes de verdad y comprobación

- Tokens: `src/design-tokens.css`; estilos base: `src/index.css`; composición de herramientas: `src/workbench.css`; marcos público y de laboratorio: `src/frames.css`; componentes de marco: `src/shell/`.
- Textos: `src/i18n/es.ts` y `src/i18n/en.ts`, siempre los dos en el mismo cambio; `en.ts` está tipado contra `es.ts`. Rutas y redirecciones: `src/shared/navigation.ts`.
- Opciones y medidas de comportamiento: `config.ts` de cada característica (`chemistry`, `structure`, `alignment`, `descriptors`, `generator`, `landing`).
- Química de residuos: `features/chemistry/config.ts`, compartida por celdas, leyendas, composición y estructura.
- Editor superpuesto, FASTA virtualizado, lector, bloques de alineamiento y Workers conservan sus mecanismos.
- Objetivos táctiles de 44 px, foco visible, teclado, contraste AA y ambos temas. Revisar a 360 y 1280 px.

La revisión automática de accesibilidad y geometría no demuestra por sí sola facilidad de uso con personas. Las páginas legales mantienen las menciones a proveedores de su contenido. El rediseño no amplía predicción, persistencia, contratos o pruebas experimentales.
