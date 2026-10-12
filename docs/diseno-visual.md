# Diseño visual vigente

Actualizado el 11 de octubre de 2026. Dirección actual: laboratorio cercano, por petición de hacer la app más amigable y animada. Conserva la identidad y los recursos Figma 30:70. La web pública explica el producto y conduce a una app con herramientas de trabajo, cuenta y preferencias. La misma identidad se aplica a todas las pantallas existentes.

## Composición e identidad

- Web pública: marca y acceso/registro visibles, presentación del producto, dos herramientas disponibles, capacidades futuras en un desplegable, recorrido de tres pasos, criterio científico y llamada a entrar o crear cuenta.
- Héroe: mensaje y acciones a la izquierda; cadena ornamental y un único bloque de ejemplo a la derecha. Sin auroras, letras de fondo, regla lateral, órbitas, lente ni tarjetas flotantes. Adaptación a una columna en móvil.
- La acción principal abre Mi espacio (/app) sin cuenta; allí se elige una tarea o el ejemplo guiado. El ejemplo carga la secuencia de insulina en el borrador. El registro no promete guardado de proyectos antes de su implementación.
- App: navegación Mi espacio, Analizar, Alinear y Ajustes en el encabezado en escritorio y pestañas inferiores en móvil; encabezados, controles y estados coherentes. Se conserva la densidad necesaria para comparar datos científicos y las responsabilidades del editor, lector y Workers.
- Navegación pública: Inicio, Qué es, Cómo funciona y Entrar a la app. Dock inferior flotante en escritorio y barra inferior en móvil. Tema y cuenta permanecen accesibles.

## Color y tipografía

Fondos marfil en claro y azul profundo en oscuro, con acento verde y superficies suaves. Valores claro/oscuro y estados en src/design-tokens.css; no definir colores dentro de componentes. Los valores vigentes están en los tokens; no duplicarlos como constantes de componentes o documentación. Selecciones y controles usan el acento; los colores de la cadena se reservan a residuos.

Bricolage Grotesque 600 para titulares y marca; Atkinson Hyperlegible Next 400/600 para interfaz; IBM Plex Mono para residuos y etiquetas de datos. Las cuatro fuentes WOFF2 son locales, tienen manifiesto, licencia y pruebas de integridad. Ver [procedencia](font-provenance.md). No cambiar la fuente del editor superpuesto ni del Worker por la fuente de titulares.

Superficies con borde fino y radio contenido; una sola tarjeta agrupa el ejemplo de la portada. No usar gradientes, resplandores ni vidrio decorativo. Las herramientas previstas muestran su estado y no tienen enlaces ficticios.

## Datos y recursos

La cadena de portada es el SVG editable exportado del diseño aprobado. Sus 110 residuos y colores corresponden al ejemplo P01308, pero su geometría es ornamental. La leyenda lo explica: no es una estructura científica. El perfil de referencia exportado usa Kyte–Doolittle, ventana 9. Los cuatro descriptores visibles se calculan en el mismo Worker del análisis; no se copian sus cifras a componentes.

Marca, glifos, cadena y perfil exportados de Figma están en public/design. Las rutas se centralizan en src/shared/designAssets.ts; no se conservan URLs temporales. Los glifos monocromos se presentan con máscara y currentColor para funcionar en ambos temas. La ilustración mantiene proporciones.

La sección de criterio conserva la hélice α ideal con referencia explícita: geometría de Pauling/Corey, no estructura experimental. Los resultados científicos se presentan con sus métodos y alcance; ver [definición](definicion-proyecto.md).

## Movimiento

Giro CSS discreto de la ilustración ornamental, sin trayectoria científica. Se pausa fuera de pantalla y cuando la pestaña no está visible; con movimiento reducido la ilustración queda fija. Entradas escalonadas, respuesta al pasar el cursor e inclinación ornamental limitada a 5 grados con ratón. Con movimiento reducido se elimina también esa inclinación. La guía refleja el cálculo real; no simula progreso. La hélice mantiene su pausa por visibilidad y preferencia de movimiento.

Duraciones y medidas en tokens; comportamiento ajustable en configuración por característica. El cálculo continúa en Workers/WASM, sin una biblioteca de animación ni dependencias de ejecución nuevas.

## Fuentes de verdad y comprobación

- Tokens: src/design-tokens.css; estilos: src/index.css.
- Textos: src/i18n/es.ts; rutas/anclajes: src/shared/navigation.ts.
- Opciones: configuración por característica, i18n y preferencias; fuentes: public/fonts/provenance.json.
- Reutilizar Icon, BrandMark, PageHeading, SegmentedControl y los controles de cuenta/editor existentes.
- Editor superpuesto: misma geometría, fuente y scroll en textarea y resaltado.
- FASTA y alineamiento: preservar virtualización, alturas, cancelación y progreso.
- Perfil y lector: paleta desde tokens, fuente del manifiesto y selección sincronizada.
- Objetivos táctiles de 44 px, foco visible, navegación por teclado, contraste AA y ambos temas.
- Revisar pantallas afectadas a 360/1280 px, tamaños intermedios cuando cambie el marco y recursos PWA si cambian fuentes o vectores.

El [plan de desarrollo](plan-desarrollo.md) ordena las capacidades pendientes y separa lo implementado de la configuración externa todavía sin comprobar. Los cambios se desarrollan en dev; no se publican por esta revisión.
# Refinamiento del 12 de octubre de 2026

Se conserva la identidad marfil/azul profundo/verde y las tres familias locales. Inicio adelanta el ejemplo científico a una franja completa y coloca la navegación pública en cabecera en escritorio. Mi espacio usa tareas con separadores; análisis y alineamiento agrupan sus métricas en una superficie. Ajustes organiza títulos y controles en columnas. Los formularios de cuenta ganan ancho y omiten la ilustración secundaria en móvil. Movimiento, foco, editor superpuesto y cálculo existentes se conservan.
