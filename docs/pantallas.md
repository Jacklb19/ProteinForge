# Mapa de pantallas

La aplicación tiene un sitio público y un laboratorio con sesión, sobre la base visual «Mesa clara» ([diseño visual](diseno-visual.md)). Sin sesión solo existen la portada informativa, la Guía, Privacidad, Términos y las páginas de acceso; el resto exige cuenta ([decisiones](decisiones.md)). La interfaz está en español e inglés y las rutas se definen en `src/shared/navigation.ts`.

El laboratorio tiene barra lateral agrupada: **Investigar** (Analizar, Comparar, Biblioteca, Explorar), **Diseñar** (Diseñar secuencias, Laboratorio 3D) y **Organizar** (Proyectos). Al pie están Guía y métodos y la cuenta.

| Pantalla | Ruta | Qué muestra al abrir | Detalles |
|---|---|---|---|
| Presentación | `/` | Propósito, estructura real de la insulina (1TRZ) con su secuencia y «Qué haces con una secuencia», con cuatro figuras reales (perfil y propiedades, alineamiento humana/bovina, condiciones de diseño, variante 3D), procedencia, preguntas y cierre | Marco público. Sin sesión solo ofrece Crear cuenta e Iniciar sesión. Cada figura se calcula en su Worker al acercarse a la pantalla. Con sesión ofrece «Ir al laboratorio» |
| Analizar | `/analyze` | Tarea, ficha de insulina humana y Resumen; vistas Secuencia, Perfil y Estructura | «Introducir secuencia» llega abierta con el ejemplo y el texto se selecciona al enfocarlo. La ficha muestra el estado de guardado (Ejemplo, Sin guardar, Guardado en «X», Cambios sin guardar en «X»). Con una secuencia no válida, las propiedades se tapan con «—» y se ofrece «Ir a la posición n». «Pedir una lectura» no envía la secuencia. Tramos, puentes y estructura solo para referencias anotadas |
| Comparar | `/alignment` | Humana frente a bovina ya alineadas: conclusión, cifras, mapa y bloques | Gotoh/BLOSUM en WASM con cancelación. La nota sobre la proteína madura solo aparece si la primera secuencia está anotada |
| Diseñar | `/generate` | Búsqueda con las condiciones iniciales ya resuelta | Método plegado. Con `VITE_GENERATOR_HISTORY=enabled`: selector «Proyecto» en la cabecera, «Guardar en proyecto» y «Búsquedas guardadas en «X»» (abrir, descargar, comprobar reproducibilidad, quitar con confirmación). Cada campo muestra su error debajo y en teléfono la tabla de métodos se apila. Ver [candidatos](candidates.md) |
| Laboratorio 3D | `/generate/lab` | Tres variantes reales de ubiquitina, selector visible y vistas Estructura, Comparación y Archivos y procedencia | Importación ZIP validada en Worker, selección, sustitución, protección y deshacer, y archivo local. Guardado explícito de archivo y en Proyectos. Con la predicción activada, la vista Predicción muestra la estructura de ESM Atlas con «Superponer referencia» y «Distancia a la referencia». Ver [laboratorio](laboratory.md) y [predicción](prediccion.md) |
| Biblioteca | `/library` | Catálogo, UniProt y Dominios en vistas separadas, ficha seleccionada y estructura 1TRZ | El visor completo se carga detrás de un dibujo ligero. Dominios: 48 piezas con procedencia, filtros por tipo y texto, y panel de ensamblado (orden, secuencia unida, análisis, FASTA, guardado en Analizar). Ver [referencias](references.md) |
| Explorar | `/explore` | Lisozima de gallina (P00698) con su modelo de AlphaFold, coloreado por química, y el recorrido de sus paradas | La ficha y sus anotaciones posicionales llegan de UniProt por la API; el modelo se pide a AlphaFold DB desde el navegador solo con el identificador. Cada parada (sitio activo, unión, dominio, señal, puente disulfuro, variante…) lleva la cámara a sus residuos, dibuja las cadenas laterales si son doce o menos y explica el tipo de sitio. `?protein=` nombra la proteína. Solo se aceptan modelos de la cadena completa y de la misma secuencia; sin modelo, el recorrido sigue como texto. Es una predicción, no una estructura medida |
| Proyectos | `/projects` | Filas con nombre, procedencia, fecha y destinos; resultados guardados desplegables; búsqueda, orden y paginación | Con historial activado: recuento de búsquedas y «Ver búsquedas». Con guardado de informes activado: «Ver informes guardados (n)» por proyecto e «Informes sin proyecto». Ver [proyectos](projects.md) |
| Enlace compartido | `/shared#…` | Vista de solo lectura de un proyecto compartido | Marco público; el token viaja tras `#` |
| Cuenta y preferencias | `/profile` | Cabecera con avatar, correo y Cerrar sesión; cuenta, apariencia (Sistema, Claro, Oscuro), idioma y privacidad | Requiere sesión. Eliminar la cuenta se solicita por correo |
| Guía y métodos | `/guide` | Métodos y criterios de propiedades, perfil, comparación, diseño, estructuras y evidencia, con índice | Reutiliza los textos de método de cada herramienta; no añade ciencia ni servicios |
| Iniciar sesión, registro, recuperación, confirmar correo | `/sign-in`, `/sign-up`, `/recover`, `/confirm` | Estructura 1TRZ girando junto al formulario (en teléfono, la tira química de la insulina encima) | REST de Supabase Auth; Google por redirección. Desde una herramienta, nota «Para abrir … necesitas entrar» y vuelta a esa página. `/confirm` pide el código de 6 cifras o el enlace, con reenvío tras 60 s |
| Privacidad, condiciones | `/privacy`, `/terms` | Texto legal con índice | Marco público, enlazadas desde ambos pies |
| Dirección desconocida | Cualquier otra | Regreso a Analizar o a la presentación | Marco público |

Cada pantalla distinta de la presentación, Analizar y Comparar llega en su propio archivo: mientras tanto se ve un «Cargando…» con `role="status"` y, si el archivo no llega (sin conexión o tras reemplazar la versión desplegada), la pantalla lo dice y ofrece recargar. El trabajo sin guardar de la pestaña se conserva.

Direcciones anteriores: `/app` redirige a Analizar y `/settings` a Perfil. `/app` sigue siendo la dirección de retorno registrada para Google.

## Acciones

| Acción | Dónde | Comportamiento |
|---|---|---|
| Introducir secuencia | Analizar | Despliega el editor con validación, FASTA, acceso a Biblioteca, Vaciar y volver al ejemplo |
| Guardar | Analizar, Comparar | Despliega el guardado de proyecto |
| Exportar | Analizar, Comparar | Menú con PDF, JSON y CSV generados en el dispositivo. Con `VITE_REPORT_STORAGE` activado, dos grupos: «Descargar en este dispositivo» y «Guardar en mi cuenta». Ver [informes](reports.md) |
| Alinear | Analizar | Lleva la secuencia a la primera caja de Comparar |

## Recorridos

- **Sin cuenta:** presentación, Guía y métodos, Privacidad, Condiciones y páginas de acceso. Cualquier herramienta lleva a Iniciar sesión, que dice adónde volverá y vuelve allí al entrar; los borradores se conservan porque viven por encima de las rutas. Idioma y tema se cambian en la cabecera pública y su menú.
- **Con cuenta:** tras iniciar sesión se abre Analizar o la pantalla que pidió la sesión. Proyectos permite abrir, renombrar, duplicar y eliminar; las comparaciones tienen acceso a Comparar y los proyectos mixtos ofrecen los dos destinos. Abrir reemplaza el borrador solo tras confirmación; duplicar conserva el borrador y el proyecto activos.
- **Sin conexión (RF-15):** el pie lateral, entre Guía y métodos y la cuenta, dice «Sin conexión» y cuántos cambios esperan, «Guardando n de m…», «n cambios necesitan tu atención», «Tu sesión terminó» o el aviso de otra cuenta con Descartar. En teléfono la barra superior muestra la forma corta y el detalle está en el menú. En Proyectos se conserva la lista abierta y Buscar, Ordenar y el menú ⋯ se desactivan; cada fila cambia la fecha por su estado (Por guardar, Guardando…, En espera, Guardado, Cambió en tu cuenta, No se pudo guardar). «Elegir versión» abre en la fila la comparación «Tu versión / En tu cuenta» con Conservar las dos, la mía o la de la cuenta.

Los borradores viven en memoria durante la visita. El último proyecto guardado se recupera por un identificador local de la cuenta; no se guardan secuencias en el almacenamiento del navegador. El laboratorio conserva sus variantes al navegar y ofrece descarga y reapertura de archivo; tras recargar se abre el archivo o «Abrir laboratorio» del proyecto guardado.

Ver también: [diseño visual](diseno-visual.md), [proyectos](projects.md), [referencias](references.md), [informes](reports.md), [candidatos](candidates.md).
