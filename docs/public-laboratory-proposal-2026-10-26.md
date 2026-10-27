# Presentación pública y laboratorio — propuesta revisada

26 de octubre de 2026. Dirección solicitada por el propietario después de revisar Mesa clara. **Propuesta aprobada por el propietario con el ajuste de ubicar cada control en su sección. Implementada localmente en `dev`; sin publicar.**

## Qué cambia

El sitio público presenta ProteinForge y explica sus usos. El entorno de trabajo contiene las herramientas. Son dos composiciones distintas, con la misma marca, fuentes y lenguaje científico. La petición actual autoriza iconos y animaciones, y actualiza las restricciones visuales anteriores que los limitaban. No cambia algoritmos, contratos, servicios, inferencia o publicación.

Se propone una sola dirección coherente con la indicación concreta del propietario. No se vuelven a abrir tres alternativas generales que ya no necesita elegir.

### Página pública

Sin sidebar. Navegación superior a Qué es, Herramientas y Cómo funciona, con Iniciar sesión y Crear cuenta a la derecha. La acción principal se repite con moderación en la presentación y al final del recorrido.

- Presentación: categoría y propósito explícitos, estructura experimental real de insulina, referencia y método visibles. No sustituir evidencia por una ilustración de una proteína inventada.
- Qué es: relacionar secuencia, propiedades y estructuras, explicando qué pregunta puede abordar el visitante.
- Herramientas: ejemplos interactivos de Analizar, Comparar, Diseñar secuencias y Laboratorio 3D. Resultados ya incluidos y calculados, sin insinuar nuevas predicciones desde la web.
- Recorrido: traer una secuencia, explorar resultados y guardar/retomar. Sin necesitar conocer antes la organización interna.
- Evidencia: distinguir estructura experimental, predicción guardada y borrador editado.
- Cuenta y dudas: explicar qué añade una cuenta y los límites científicos reales. Sin cifras de usuarios, testimonios o capacidades ficticias.
- Movimiento: entrada suave al recorrer secciones, giro ligero de una estructura real hasta la primera interacción, transiciones cortas de controles. Sin secuestrar el desplazamiento; contenido accesible con movimiento reducido.

La maqueta incluye el acceso secundario **Explorar el ejemplo**. El ejemplo se identifica como público y sin cuenta; no presenta una sesión ni una colección privada ficticias. Es la recomendación conservadora para preservar las herramientas locales que ya podían usarse sin cuenta. Registrarse o iniciar sesión sigue siendo el recorrido principal para guardar y retomar trabajo. No se propone imponer una barrera de identidad nueva a todos los cálculos locales.

### Acceso

Entrar, registro y recuperación pertenecen al sitio público y no muestran sidebar. Una sesión válida conduce al entorno de trabajo; se conserva el destino solicitado si se venía de una herramienta o de una acción protegida. El registro respeta la confirmación de correo real: no promete sesión inmediata si el proveedor exige confirmación. OAuth, recuperación y avisos de trabajo sin guardar conservan sus protecciones.

La maqueta usa campos de solo lectura y un botón expresamente ilustrativo. No inicia sesiones, solicita credenciales reales ni escribe en cuentas.

### Sidebar del laboratorio

- Marca y control de contraer/expandir en una cabecera propia.
- Investigar: Analizar, Comparar y Biblioteca.
- Diseñar: Diseñar secuencias y Laboratorio 3D.
- Organizar: Mis proyectos.
- Ayuda y cuenta: Guía y métodos, Cuenta y preferencias y menú de la sesión. El menú reúne acceso a la cuenta, regreso al sitio público y cierre de sesión.

Todos los destinos llevan iconos de trazo consistente, estado activo y nombre accesible. En modo compacto quedan iconos con etiquetas accesibles y ayuda al pasar el puntero o enfocar. La navegación tiene desplazamiento independiente si la altura es pequeña; cabecera y cuenta permanecen utilizables. Contraerla conserva herramienta, entrada, selección y resultados. En móvil se convierte en un panel modal con cierre, Escape, foco contenido y regreso al botón.

La preferencia de ancho puede guardarse localmente como un ajuste visual. No se guardan secuencias o datos de proyectos nuevos en el navegador por esta función.

### Cabecera y explicaciones de las herramientas

Se retira la franja superior «Espacio de trabajo / Analizar». Cada herramienta abre directamente con título, propósito concreto y acciones relacionadas. La proteína o pareja conserva su ficha de procedencia. Las explicaciones no se limitan a renombrar la sección: dicen qué se puede investigar y qué significa el resultado.

| Pantalla | Revisión prevista |
|---|---|
| Analizar | Resumen primero, cinco propiedades con alcance y método, entrada visible, acciones de guardar/exportar, vistas de secuencia/perfil/estructura y procedencia diferenciadas |
| Comparar | Explicar coincidencias, sustituciones y huecos; entradas identificadas; parámetros desplegables y significado de identidad, similitud y puntuación |
| Diseñar secuencias | Presentar condiciones y comparación con azar; límites y reproducibilidad accesibles; no llamar a los candidatos una estructura o función validada |
| Laboratorio 3D | Explicar inspección y preparación de cambios, variantes accesibles y vistas de estructura/comparación/archivos. Editar retira predicción y métricas incompatibles |
| Biblioteca | Explicar referencia incluida frente a consulta UniProt; ficha seleccionada y correspondencia secuencia/estructura identificables, con estados SIFTS completos |
| Proyectos | Explicar qué se conserva; destinos por contenido, detalles científicos, búsqueda/orden/paginación y acciones deliberadas intactos |
| Guía y métodos | Organizar métodos y criterios ya presentes, con acceso contextual. No añadir promesas científicas o servicios no existentes |
| Cuenta | Preferencias, identidad y privacidad agrupadas. Menú de cuenta vinculado al estado real; cierre de sesión conserva los avisos de trabajo sin guardar |
| Privacidad, condiciones y dirección desconocida | Marco público con acceso a presentación y laboratorio; índice y recuperación de navegación, sin obligar a entrar |

## Plan de implementación tras aprobar

1. Separar las composiciones pública y de trabajo por familia de rutas. Conservar las direcciones existentes, `/app` y el retorno OAuth; no introducir una migración de enlaces innecesaria. `/` sigue siendo presentación, incluso si quien la visita tiene sesión; entonces la cabecera ofrece volver al laboratorio.
2. Mantener identidad y borradores en proveedores estables por encima del cambio de composición. Navegar entre presentación, acceso y herramientas no debe desmontar ni descartar el trabajo. La nueva página pública no inicia una búsqueda de candidatos o cálculos de herramienta por defecto; los ejemplos ligeros y el trabajo completo se cargan cuando corresponde.
3. Integrar la página pública con textos es/en y figuras reales. Aplicar animación progresiva, pausa fuera de pantalla y movimiento reducido. Reutilizar marca y fuentes locales.
4. Construir la sidebar agrupada con las primitivas del proyecto, iconos coherentes, modo compacto, etiquetas, foco y menú de cuenta. Eliminar el encabezado redundante del marco anterior. Mantener acceso global al idioma y tema desde cuenta/preferencias y desde el sitio público.
5. Revisar título, introducción, ficha, acciones y jerarquía de todas las herramientas según la tabla. No retirar controles ni datos que la maqueta resuma: conservar los cinco descriptores, tendencias, FASTA, tablas, exportaciones y métodos completos.
6. Integrar correctamente sesión, ejemplo sin cuenta y destino tras acceso. Proyectos, UniProt y lecturas conservan sus requisitos reales de identidad. No inventar autorización mediante una variable visual.
7. Verificar tipos/lint/build, módulos compartidos y recorridos afectados: estado de borradores al cambiar de marco, acceso/OAuth, sidebar y menú móvil, teclado/foco, canvas y fuentes, Workers/WASM, selección SIFTS, importación/guardado/conflictos, es/en y ambos temas. Mantener cobertura mínima. Comprobar PWA por el cambio de composición y carga de recursos.
8. Actualizar diseño, mapa de pantallas, decisión visual y relevo. Cambios locales en dev, sin push/merge/despliegue por esta aprobación visual.

## Maqueta y referencias

Vista pública: `http://127.0.0.1:5341/artifacts/public-laboratory-2026-10-26/index.html?screen=home`.

Vista del laboratorio: `http://127.0.0.1:5341/artifacts/public-laboratory-2026-10-26/index.html?screen=workspace&page=analyze`.

La barra de revisión permite pasar entre ambas, y cambiar idioma. La sidebar se contrae y permite recorrer las ocho secciones. Maqueta aislada en `artifacts/public-laboratory-2026-10-26/`, fuera de Git/build/PWA. Reutiliza BackboneView, SequenceRibbon, ProfileSketch y AlignmentMap con los datos incluidos de P01308/P01317/1TRZ y las tres variantes verificadas de 1UBQ. No modifica el producto ni añade dependencias.

Referencias 21st: [Sidebar Nav Group](https://21st.dev/@felipemenezes098/components/collapsible-05), consultado y recuperado dentro del cupo gratuito para la agrupación; [Settings Sidebar Accordion](https://21st.dev/@cnippet-dev/components/settings-sidebar-accordion), organización de preferencias; [Scroll Reveal Content A](https://21st.dev/@abui/components/scroll-reveal-content-a), referencia de progresión al recorrer. No se instala su stack. Se descarta la referencia Motion Footer por efectos y dependencias que no ayudan a explicar proteínas. Generación alojada deshabilitada y no utilizada; sin gasto ni subida de fuentes.

## Comprobación de la propuesta

La evidencia de navegador y capturas está en la carpeta local de la maqueta. Batería de 26 comprobaciones correcta: 11 composiciones (página pública, acceso, registro y ocho secciones del laboratorio) × español/inglés × 360/1280 × claro/oscuro = 88 configuraciones, más recorridos de acceso, contracción/expansión, cuenta, menú móvil, borrador y ejemplo sin cuenta. Sin desbordamiento del documento, controles visibles menores de 44 px ni infracciones detectadas por axe WCAG 2.1 AA. La edición ilustrativa conserva la sustitución por variante y retira coordenadas/confianza/RMSD incompatibles. Capturas principales revisadas visualmente. Se comprueban la geometría y accesibilidad de esta propuesta; no se atribuyen a la aplicación ni se presenta como estudio con usuarios.

La aprobación necesaria procede de [AGENTS.md](../AGENTS.md), que exige: «En trabajo de interfaz no se programa hasta que el usuario apruebe una propuesta maquetada y un plan por pantallas». La dirección anterior aprobada sigue implementada; esta separación y composición nuevas quedan listas para decidir sobre un resultado concreto.

Capturas locales: [presentación](../artifacts/public-laboratory-2026-10-26/es-home-analyze-1280-light.png), [laboratorio](../artifacts/public-laboratory-2026-10-26/es-workspace-lab-1280-light.png), [barra compacta](../artifacts/public-laboratory-2026-10-26/es-compact-1280.png), [móvil](../artifacts/public-laboratory-2026-10-26/es-home-analyze-360-light.png). Los archivos de maqueta y evidencia son locales y no se incluyen en el producto.

Durante la revisión se corrigieron anchuras táctiles, campos, el nombre accesible de la marca contraída y el ajuste de acciones de la ficha. No se relajan umbrales. Una última pasada conserva el menú de cuenta dentro de la altura de la vista previa. No se repiten baterías de aplicación por una propuesta aislada ni se atribuye certificación de producción/PWA/servicios a esta revisión.

Cierre de entrega de la propuesta: última pasada26/26correcta después de ajustar la altura de la barra de revisión. Menú de cuenta comprobado dentro de la altura visible y animación nativa view() activa sin movimiento reducido; con movimiento reducido se suprimen transiciones/entradas y giro. La barra superior de revisión pertenece solo a la maqueta. Servidor5341 conservado, sesión96901.

## Aprobación posterior y relevo

El propietario respondió «Me gusta» a la pregunta de implementar esta maqueta y el plan, con una condición: cada sección y cada control deben estar correctamente ubicados, delimitados y estructurados. Señaló el botón de tema en mitad de una página como ejemplo a corregir. Se acepta como aprobación con ese ajuste, sin pedir otra maqueta ni confirmación rutinaria. Tema e idioma van en Preferencias; acciones científicas junto a su herramienta; identidad y sesión en Cuenta.

La integración se interrumpió por fin de sesión. Estado exacto y siguiente trabajo en [relevo del rediseño](redesign-handoff-2026-10-26.md). Los avisos anteriores de aprobación pendiente se conservan como historia de la propuesta, no como una decisión actual que haya que volver a solicitar.
