# Diseño visual vigente

Actualizado el 13 de octubre de 2026. Dirección «ficha de lectura», elegida por el usuario entre dos propuestas maquetadas. Sustituye a «la forja» y a «laboratorio cercano». Se conservan el nombre, el logo y las tres tipografías; todo lo demás cambió.

## Principios

1. **La pantalla muestra proteínas, no habla de sí misma.** Cada pantalla de trabajo abre con un ejemplo real que se puede reemplazar: la insulina humana (P01308) en Analizar e Inicio, humana frente a bovina (P01317) en Alinear, una búsqueda ya resuelta en Diseñar y la estructura 1TRZ en Biblioteca. No hay cajas vacías con explicaciones.
2. **El título es el sujeto.** Analizar se titula con el nombre de la proteína; Alinear, con las dos que compara. El nombre de la herramienta ya está en la barra.
3. **La interfaz va en tinta; el color es química.** Botones, enlaces, líneas y texto usan tinta sobre papel frío. Los únicos tonos son las seis clases de residuo: hidrofóbico, polar, ácido, básico, Gly·Pro y cisteína. El perfil usa dos de ellos: hidrofóbico sobre cero, básico bajo cero.
4. **Sin plantilla.** No hay rótulos en mayúsculas sobre los bloques, tarjetas con icono, pasos numerados, barra flotante ni llamadas a crear cuenta. Los avisos de alcance van una sola vez, junto a la cifra o figura que los necesita.
5. **Texto de la consigna.** La interfaz habla de explorar, comparar y diseñar proteínas. No menciona servidor, base de datos, código ni detalles de implementación.

## Marco

- Una sola barra plana en todo el sitio: logo (lleva a Inicio), Inicio · Analizar · Alinear · Diseñar · Biblioteca. Arriba se funde con el fondo; al desplazarse toma un velo y un filete.
- Sin sesión: icono de tema claro/oscuro, «Iniciar sesión» y «Crear cuenta» como acción principal. Con sesión: avatar con la inicial, que lleva a Perfil; tema e idioma pasan a Perfil.
- Por debajo de 64rem (tabletas y teléfonos): marca, «Iniciar sesión» y botón de menú. El menú es un panel superpuesto con los cinco destinos, apariencia, idioma, «Crear cuenta» e «Iniciar sesión»; se cierra con Escape, con el velo o al elegir destino, y devuelve el foco al botón.
- Pie: logo, consigna, Privacidad, Condiciones y, sin sesión, el selector de idioma.
- Cuenta: la app se usa completa sin sesión. La diferencia se dice donde importa: un tramo al final de Inicio compara «sin cuenta» y «con cuenta», y «Guardar» y la consulta de UniProt ofrecen crear cuenta o iniciar sesión.
- Ejemplo: la insulina es un ejemplo y se nombra como tal. Las acciones de Inicio son generales («Analizar proteínas», «Comparar proteínas») y la línea bajo el título de Analizar y Alinear dice «Ejemplo» mientras no se cambie.
- Cabecera de página: título, una línea de datos del sujeto y una sola línea de acciones. Los paneles de «Cambiar secuencia» y «Guardar» se despliegan bajo la cabecera; «Exportar» es un menú.

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

La estructura de Inicio y de la columna lateral es un dibujo propio y ligero en canvas 2D. Biblioteca muestra ese mismo dibujo de inmediato y carga el visor completo (Mol*) por detrás; si la descarga falla, se queda el dibujo sin mensaje de error.

Las anotaciones de tramos y puentes existen solo para las referencias incluidas. Una secuencia pegada o editada no las tiene, y las figuras que dependen de ellas no se muestran.

## Movimiento

- La estructura de Inicio gira despacio hasta la primera interacción. No gira con «reducir movimiento», fuera de pantalla ni con la pestaña oculta.
- Se arrastra para girar; con foco, las flechas la giran. Un clic elige el residuo más cercano y lo marca en la secuencia.
- Las páginas y paneles entran con un fundido corto. Ningún contenido depende de una animación para ser visible.
- No hay transiciones de color en elementos sensibles al tema ni transformaciones en contenedores de página.

## Fuentes de verdad y comprobación

- Tokens: `src/design-tokens.css`; estilos: `src/index.css`.
- Textos: `src/i18n/es.ts` y `src/i18n/en.ts`, siempre los dos en el mismo cambio; `en.ts` está tipado contra `es.ts`. Rutas y redirecciones: `src/shared/navigation.ts`.
- Opciones y medidas de comportamiento: `config.ts` de cada característica (`chemistry`, `structure`, `alignment`, `descriptors`, `generator`, `landing`).
- Química de residuos: `features/chemistry/config.ts`, compartida por celdas, leyendas, composición y estructura.
- Editor superpuesto, FASTA virtualizado, lector, bloques de alineamiento y Workers conservan sus mecanismos.
- Objetivos táctiles de 44 px, foco visible, teclado, contraste AA y ambos temas. Revisar a 360 y 1280 px.

Límites conocidos: los mensajes que producen los Workers (errores de FASTA, descriptores y perfil) salen en español también con la interfaz en inglés, porque los Workers usan el idioma predeterminado; las páginas legales conservan las menciones a proveedores que exige su contenido.
