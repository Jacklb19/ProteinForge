# Revisión integral de experiencia y propuesta visual

26 de octubre de 2026. **Propuesta para elegir y aprobar; no sustituye todavía la interfaz React.** Petición: revisar todas las secciones, hacer comprensible lo que muestran y dar al producto una presentación organizada, coherente y con calidad comercial, respetando su alcance académico.

## Diagnóstico

La base visual tiene identidad y hay capacidad científica real. El problema principal es cómo se reparte la atención: el usuario ve resultados antes de identificar su tarea, encuentra acciones de igual peso y necesita conocer la organización para descubrir algunas herramientas. En móvil, la lectura lineal agrava esa distancia.

No propongo llenar las pantallas de instrucciones. Cada vista debe responder con su propia composición: qué estoy haciendo, con qué proteína, qué resultado tengo y qué puedo hacer ahora. La explicación científica breve permanece junto a la medida; métodos, parámetros y trazabilidad completos siguen disponibles.

Se conservan marca, Bricolage Grotesque, Atkinson Hyperlegible Next, IBM Plex Mono, temas claro/oscuro y colores químicos. Las superficies elevadas, el espaciado y los filetes organizan contenido; el color no se convierte en decoración ni en una valoración de éxito biológico.

## Qué se revisó y qué significa la valoración

Inspección del código y navegación local de Inicio, Analizar, Alinear, Diseñar, Laboratorio, Biblioteca, Proyectos con/sin sesión, Perfil, inicio de sesión, registro, recuperación, privacidad, condiciones y dirección desconocida. Capturas a 360 y 1280 px, ambos temas. Editor abierto/entrada inválida inspeccionados. Sesión y colección de Proyectos simuladas; coordenadas BinaryCIF reales desde fixture local. Peticiones externas bloqueadas. No cuentas ni datos del propietario.

Las notas siguientes son **valoraciones heurísticas propias**, no resultados de un estudio de usuarios ni porcentajes medidos. Escala de 1 a 5: 1 exige explicación constante; 3 se puede usar con aprendizaje; 5 permite reconocer tarea, datos y siguiente acción con muy poca ayuda. «Lectura visual» valora jerarquía y orden, no una medida objetiva de belleza.

| Sección | Usabilidad | Intuitividad | Lectura visual | Problema principal y propuesta |
|---|---:|---:|---:|---|
| Marco y navegación | 3 | 2 | 3 | Laboratorio no tiene destino principal; preferencias cambian de lugar al iniciar sesión. Destinos estables, Laboratorio visible, preferencias predecibles. |
| Inicio | 3 | 3 | 4 | La insulina ocupa buena parte de la explicación del producto. Presentar primero las tareas y conservar la estructura real como demostración identificada. |
| Analizar | 3 | 2 | 3 | El título solo nombra la proteína; «Alinear» es la acción más fuerte y la entrada está detrás de «Cambiar». Identificar la tarea y destacar «Analizar mi secuencia»; resumen primero, detalle por vistas. |
| Alinear / Comparar | 3 | 3 | 3 | Modo y matriz compiten con las entradas; puntuación sin significado inmediato. Entradas claras, parámetros secundarios y definiciones junto a identidad/similitud/puntuación. |
| Diseñar secuencias | 2 | 2 | 3 | Semilla y presupuesto aparecen al mismo nivel que longitud y condiciones. Separar objetivo de búsqueda, controles avanzados, progreso y comparación con azar. |
| Laboratorio 3D | 3 | 2 | 3 | Cambiar variante requiere llegar después del visor/inspector/secuencia. Selector de variantes antes del visor; edición al lado del residuo; archivos agrupados. |
| Biblioteca | 3 | 2 | 3 | Catálogo, consulta UniProt y estructura de ejemplo forman una página larga con contextos distintos. Separar origen de búsqueda y ficha seleccionada; asociar estructura, cadena y posición explícitamente. |
| Proyectos | 3 | 3 | 4 | Cada tarjeta concentra mucha evidencia; el destino se multiplica en proyectos mixtos. Lectura compacta por nombre/contenido, detalles desplegables y destinos explícitos. |
| Perfil | 4 | 3 | 3 | Cuenta, preferencias, proyectos y privacidad comparten una columna extensa. Agrupación predecible y enlace de retorno al trabajo. |
| Iniciar sesión | 4 | 4 | 3 | Formulario claro, pero le falta contexto sobre qué se conserva y cómo seguir sin cuenta. Mantener formulario breve, retorno al destino y opción anónima. |
| Registro | 4 | 4 | 3 | Conviene vincular el beneficio concreto al formulario, sin prometer funciones nuevas. Guardar y retomar trabajo; confirmación y errores próximos a su campo. |
| Recuperación | 4 | 4 | 3 | Conservar simplicidad; diferenciar envío, espera, fallo y vuelta al acceso. |
| Lectura de resultados | 3 | 3 | 3 | Aparece muy abajo; explicación opcional, cifras de origen y vigencia necesitan verse como una unidad. Acceso desde resumen, con consentimiento y procedencia conservados. |
| Guardar y exportar | 3 | 3 | 3 | Varias formas de conservar trabajo se parecen por su nombre. Distinguir Proyecto, archivo del laboratorio e informe; explicar contenido/formato al elegir. |
| Privacidad y condiciones | 3 | 3 | 3 | Lectura larga. Índice, anchura de lectura y secciones; preservar íntegro el texto vigente y sus límites. |
| Página inexistente | 4 | 4 | 3 | Ya ofrece retorno. Ajustar el marco y conservar acciones claras de recuperación. |

## Hallazgos con evidencia

### Prioridad alta: descubrir la herramienta y entender el objeto

- El Laboratorio existe en las rutas, pero no en `NAVIGATION_ITEMS`. Se alcanza desde el botón principal de Diseñar: [navegación](../src/shared/navigation.ts), [generador](../src/features/generator/GeneratorPage.tsx). Propuesta: destino visible e independiente, conservando `/generate/lab` y la navegación entre herramientas.
- En Analizar, la entrada se monta al abrir un panel; la acción primaria envía a Alinear. A 360 px, el texto visible se acorta a «Cambiar»: [cabecera y editor](../src/features/editor/EditorPage.tsx). No es un botón roto: es una recomendación de jerarquía y vocabulario para quien entra por primera vez.
- En las capturas locales de 360×900, el encabezado de Propiedades quedó aproximadamente a 1685 px del inicio; en Laboratorio, la tabla de variantes a 2357 px. Son observaciones de ese estado, **no mediciones de rendimiento ni evidencia de que todos los usuarios se pierdan**. El orden se confirma en [Analizar](../src/features/editor/EditorPage.tsx) y [Laboratorio](../src/features/design-lab/DesignLabPage.tsx).

### Prioridad media: reducir decisiones iniciales y conservar contexto

- Semilla y evaluaciones ocupan la primera fila del formulario de búsqueda: [generador](../src/features/generator/GeneratorPage.tsx). La propuesta los mantiene bajo «Reproducibilidad y método»; longitud/rangos siguen visibles. No cambia el algoritmo ni su comparación obligatoria con azar.
- Biblioteca presenta catálogo, consulta y visor como secciones consecutivas; la estructura inicial es insulina, independientemente de que el visitante venga a buscar otra referencia: [Biblioteca](../src/features/library/LibraryPage.tsx). Dar una ficha seleccionada inequívoca, sin inventar correspondencias o estructuras ausentes.
- Idioma/tema se ofrecen en lugares distintos según sesión: [marco](../src/App.tsx), [Perfil](../src/features/profile/ProfilePage.tsx). Hacer su ubicación predecible; el selector de dirección de la maqueta es una herramienta de revisión, no una función prevista del producto.
- Las tarjetas de proyectos ya protegen borradores y tienen destinos por tipo. Conservar esas garantías y hacer más ligera la lectura inicial: [colección](../src/features/projects/ProjectLibrary.tsx), [tarjeta](../src/features/projects/ProjectCard.tsx).

No se ha demostrado un defecto crítico de cálculo, pérdida de datos o autorización en esta revisión. Las recomendaciones de navegación y composición no deben presentarse como fallos de seguridad o de ciencia. Tampoco una comprobación automática AA demuestra por sí sola que la aplicación sea intuitiva.

## Referencias consultadas y aplicación al proyecto

- [Benchling Molecular Biology](https://www.benchling.com/molecular-biology): presenta visualización con contexto y agrupa tareas de diseño/análisis. Tomar la claridad del objeto y el recorrido; no copiar su alcance de biología molecular, colaboración o inferencia.
- [UniProt: información de la entrada](https://www.uniprot.org/help/entry_information_section): identificador, estado y versiones definen la procedencia. Se usa para organizar la ficha. La búsqueda recuperó el contenido; la apertura posterior devolvió el fallback de JavaScript, por lo que no se afirma haber inspeccionado su interfaz autenticada.
- [RCSB: página de resumen estructural](https://www2.rcsb.org/docs/exploring-a-3d-structure/structure-summary-page): separa resumen, composición y datos experimentales o confianza del modelo. Aplicar esa distinción entre secuencia completa, estructura medida, predicción y borrador.
- [Linear: revisión del diseño de interfaz](https://linear.app/now/behind-the-latest-design-refresh): acciones predecibles, menor competencia visual de la navegación y jerarquía entre ubicación y tarea. Se adapta la idea de consistencia; no su paleta ni un tablero de gestión ajeno al proyecto.
- 21st: búsquedas de navegación y tablas; referencia de [pestañas con foco móvil por teclado](https://21st.dev/@haassiib/components/tabs-roving-focus), [navegación agrupada](https://21st.dev/@uiable/components/uiable-sidebar-1) y [tabla con filtros](https://21st.dev/@felipemenezes098/components/table-12). Recuperada una referencia de pestañas dentro del cupo gratuito; no se instaló código ni dependencias. Sin generación alojada, créditos o costos. La maqueta está escrita localmente.

La revisión automática rechazó ejecutar `21st review src`: no se pudo garantizar que los archivos permanecieran locales y no hay autorización para enviarlos al servicio. No se eludió el rechazo ni se subió código. La revisión continúa con lectura local, capturas, geometría de pantalla y controles de accesibilidad en el navegador.

## Tres alternativas comparables

La [maqueta navegable](../artifacts/usability-redesign-2026-10-26/prototype/index.html) permite cambiar dirección, idioma y tema. Abrir con servidor local: `http://127.0.0.1:5331/artifacts/usability-redesign-2026-10-26/prototype/index.html?page=analyze&direction=a`. El nombre completo `index.html` es necesario en el servidor Vite; la dirección de carpeta cae en la ruta desconocida de la aplicación. Los archivos están excluidos de Git y fuera de `public/`: no entran en el build ni en la caché de la aplicación.

| Dirección | Organización | Densidad e interacción | Ventaja y riesgo |
|---|---|---|---|
| **A · Mesa clara — recomendada** | Herramientas en lateral en escritorio; tarea y proteína distinguidas; selector de sección en móvil | Resumen primero, entrada deliberada con acción primaria explícita, detalle por vistas | Mejora orientación y consulta frecuente. El lateral ocupa anchura; no debe restar espacio al visor/lector ni convertir el móvil en una lista infinita. |
| B · Ficha continua | Navegación superior, lectura vertical, menos contenedores | Secuencia, métricas, perfil y estructura en un mismo documento | Se aproxima a la identidad actual y facilita leer todo seguido. Mantiene más desplazamiento y exige disciplina con duplicaciones. |
| C · Enfoque por tarea | Navegación superior y entrada como centro de la vista | Formulario abierto, resultados después, vistas acotadas | Favorece una primera tarea con secuencia propia. Hace más largo llegar a los resultados del ejemplo y puede ralentizar la consulta repetida. |

Las tres conservan datos, marca, fuentes, colores químicos, temas, nombres científicos y capacidades reales. Difieren en navegación y jerarquía/densidad; no son cambios de color. La barra «Propuesta de experiencia» solo pertenece al artefacto de revisión.

## Plan por pantallas para A

1. **Marco e Inicio.** Destinos constantes, Laboratorio visible, cuenta/preferencias accesibles. Inicio presenta el propósito con acciones de tarea y una estructura real identificada. Mantener invitación a probar sin cuenta y explicar dónde se necesita sesión. Móvil: menú accesible con destino actual; decidir en implementación entre selector compacto mostrado y menú existente mejorado, sin navegación por iconos solos.
2. **Analizar.** Título de tarea y sujeto científico separados. «Analizar mi secuencia» abre el único editor existente, con pegado/FASTA/validación. Ejemplo claramente marcado. Resumen con las cinco propiedades y explicaciones breves; Secuencia, Perfil y Estructura en vistas accesibles. Conservar tramos/puentes, propensiones, ventanas 9/19, tabla alternativa, selección, virtualización, descriptores en Worker y contexto SIFTS. Sin duplicar cálculos ni dejar resultados antiguos junto a entrada modificada.
3. **Comparar.** Mantener `/alignment`, Gotoh, WASM, matrices, modos, huecos, progreso/cancelación y exportaciones. Entrada por secuencia, parámetros secundarios, resumen de identidad/similitud/huecos/puntuación con significado. Resultado separado de datos en edición; advertencia de vigencia y selección conservadas. El cambio de etiqueta «Alinear» a «Comparar» se decide como parte de esta propuesta; el término técnico sigue en métodos/resultados.
4. **Diseñar secuencias.** Longitud y objetivos visibles; semilla/presupuesto/metodología en nivel avanzado. Resultados con candidatos y comparación guiada/aleatoria completa. Mantener límites, diversidad, cancelación, semilla y descarga reproducible. La maqueta presenta el estado previo a buscar y no calcula candidatos nuevos. Laboratorio visible como herramienta distinta, sin sugerir que buscar masa/GRAVY genera una estructura.
5. **Laboratorio.** Elegir variante antes del visor. Inspector con residuo/posición y edición relacionada; comparación y archivos en vistas claras. Guardar Proyecto, archivo portable, borrador y PDB conservan su contenido y sus protecciones, aunque se agrupen sus accesos. Al editar, retirar métricas y mostrar la referencia experimental identificada; nunca la predicción anterior como si fuera del borrador. Mantener importador, hash, restricciones, deshacer, selección y reapertura.
6. **Biblioteca.** Separar referencias incluidas de búsqueda UniProt. La ficha seleccionada reúne procedencia, secuencia y estructuras disponibles. Cadena y numeración quedan cerca del visor, con estados explícitos de ambigüedad/cobertura/fallo. Conservar versión/hash completos, autor textual/inserción/modelo y confirmación al reemplazar. No añadir un segundo editor ni interpretar intervalos ausentes. El ejemplo de la maqueta usa solo las posiciones 90→A:1 y 110→A:21 ya verificadas.
7. **Proyectos.** Mejorar escaneo por nombre, contenido y destino; detalles científicos secundarios. Conservar búsqueda/orden/paginación reales, acciones deliberadas, concurrencia, propietarios y confirmaciones. Un proyecto mixto sigue ofreciendo destinos distintos. No anunciar nuevos filtros globales o fechas sin soporte del contrato. El selector de vacío de la maqueta es solo una herramienta para revisar estados.
8. **Cuenta y acceso.** Perfil agrupado en Cuenta, Apariencia y Privacidad; idioma/tema con ubicación estable. Inicio de sesión/registro/recuperación claros, retorno al trabajo y contexto sobre guardado; mantener protección de borradores ante OAuth y exportación del laboratorio. No enviar correos ni cambiar credenciales por probar el diseño.
9. **Lectura, guardado e informes.** Lectura opcional desde el resumen, ligada a cifras vigentes y proveedor/fecha; estados de sesión, cuota y fallo. Mantener consentimiento y omisión de secuencia. Diferenciar Proyecto / archivo de laboratorio / PDF / JSON / CSV sin quitar formatos o trazabilidad. El diagnóstico pendiente de Groq no se resuelve con una apariencia nueva.
10. **Legal y recuperación.** Índice y columna legible para el texto legal íntegro; sin reescribir compromisos de privacidad o retención como parte del cambio visual. Página desconocida y límites de carga/offline con acciones para recuperar el trabajo.

## Límites de la maqueta

Es una composición navegable, no un reemplazo funcional. Usa descriptores y alineamiento recalculados con módulos actuales y coordenadas incluidas de 1TRZ/1UBQ. Las curvas del visor solo suavizan la presentación de la traza Cα; no son átomos nuevos ni predicciones. No representa el visor Mol* completo.

Permite recorrer secciones, comparar direcciones, cambiar idioma/tema, abrir vistas, usar teclado, inspeccionar posiciones, cambiar/proteger un residuo ilustrativo, consultar guardado/exportación y buscar en una colección ilustrativa. Una secuencia propia no recibe métricas ficticias: retira las del ejemplo y declara que aquí no se recalcula. Formularios, lectura, importación y guardado abren una explicación de vista previa; no hacen solicitudes reales. La recuperación legal no sustituye al texto completo vigente. No contiene inferencia desde la app, forma de novo, historial RF-18 ni nuevas funciones científicas.

## Comprobación y criterio de implementación

Evidencia en `artifacts/usability-redesign-2026-10-26/`, excluida de Git. La revisión actual y la de maquetas se distinguen en sus nombres. No se atribuyen resultados de producción, hardware físico o usuarios nuevos.

- Interfaz actual: 15 casos de inspección correctos inicialmente; el fixture de Proyectos tenía un prefijo de 30 caracteres frente a los 40 exigidos por el contrato. Corregido el fixture y repetida esa vista correctamente, sin modificar el producto. En total, 16 escenarios distintos inspeccionados, incluido editor/entrada inválida. La colección es ilustrativa; no acredita persistencia remota ni datos científicos de proyectos del propietario.
- Maqueta: batería final **16/16 correcta**, con **14 pantallas × 2 idiomas × 2 anchuras × 2 temas = 112 configuraciones** sin desbordamiento de documento ni infracciones detectadas por axe en sus reglas WCAG 2.1 AA. Comprobación final adicional **4/4 correcta** para Analizar/Laboratorio, alternativas, secuencia propia y conservación de borrador. Sin errores de página capturados.
- Teclado: pestañas con flechas, foco al cerrar diálogo, navegación y cambio de idioma; edición ilustrativa retira métricas y muestra referencia experimental. Controles de residuo ampliados a 44 px. Sintaxis de JavaScript y 12 enlaces relativos del informe comprobados. Capturas de las vistas principales inspeccionadas visualmente.
- Iteración: el primer enlace de carpeta llegó al fallback de React; se corrigió a `index.html` y se exigió la barra propia de la maqueta en la comprobación. Una pasada de resultados temporales se solapó con otra y falló al cerrar su traza; se separaron salidas y las pasadas finales terminaron correctamente. Se corrigió la semántica de la lista de medidas detectada por axe. Ninguno de esos resultados iniciales se cuenta como verificación correcta de la maqueta.
- Los archivos quedaron en la carpeta de evidencia independiente, fuera de `public/`, del build y del precache. No hay cambios de React, contratos o dependencias. No se repiten las baterías de aplicación por un documento y una maqueta aislada; no se afirma nueva comprobación de PWA, Groq, RLS, producción, CI, Safari, dispositivos físicos o usuarios reales.

Antes de integrar el rediseño elegido: tipos/lint/build, pruebas de módulos compartidos y recorridos afectados; 360/1280, claro/oscuro, es/en, teclado, foco, objetivos de 44 px y AA. Revisar especialmente FASTA/editor superpuesto, lector virtualizado, canvas/Workers/WASM, SIFTS, estado antiguo, archivos/proyectos y conflictos. Verificar PWA cuando cambien recursos o su navegación. No reducir aserciones ni umbrales.

Criterios de aceptación de la experiencia: identificar ejemplo frente a trabajo propio; encontrar cómo introducir secuencia; localizar las propiedades sin recorrer todo el perfil; llegar al Laboratorio desde navegación; elegir variante sin buscar al final; distinguir predicción/borrador; guardar y reconocer qué se conserva. Son objetivos de la propuesta. La mejora de comprensión y éxito de tarea debe comprobarse después con personas, no darse por medida mediante esta auditoría.

La implementación no requiere nuevas tablas, servicios, gastos, contratos o publicación remota. Backend no cambia por esta propuesta. Trabajar en `dev`, conservar ambas lenguas y mantener las capacidades existentes. La aprobación visual y del plan es la decisión pendiente; cualquier push/merge/despliegue futuro conserva su autorización separada.
