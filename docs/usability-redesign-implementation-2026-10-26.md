# Mesa clara — implementación del rediseño integral

26 de octubre de 2026. Aprobación explícita del propietario: «A · Mesa clara: navegación lateral, resumen primero y detalles por vistas». Se implementa el [plan aprobado y auditoría por sección](usability-redesign-proposal-2026-10-26.md) en React, dentro del frontend y en dev. No hay publicación remota.

## Resultado por sección

| Sección | Cambio aplicado | Propósito |
|---|---|---|
| Marco y navegación | Lateral persistente en escritorio; Laboratorio como destino; ubicación, preferencias globales y cuenta arriba; menú móvil con los mismos destinos | Saber dónde se está y llegar a una herramienta sin recorrer otra |
| Inicio | Marca explícita, consigna concreta, accesos por tarea y demostración con datos y estructura reales | Entender qué se puede hacer y empezar por una secuencia, comparación o variante |
| Analizar | Tarea y proteína separadas; acción principal de entrada; Resumen, Secuencia, Perfil y Estructura | Encontrar las propiedades antes del detalle y reconocer ejemplo frente a secuencia propia |
| Comparar | Entradas agrupadas, parámetros desplegables, explicación junto a identidad/similitud/puntuación | Distinguir coincidencia de sustitución favorable y evitar interpretar la puntuación como porcentaje |
| Diseñar secuencias | Longitud y objetivos visibles; presupuesto/semilla bajo opciones avanzadas | Reducir decisiones iniciales conservando reproducibilidad y comparación aleatoria |
| Laboratorio | Variantes antes del visor; Estructura, Comparación, Archivos y procedencia | Encontrar variantes y distinguir editar, comparar, guardar archivo y guardar proyecto |
| Biblioteca | Vistas de catálogo/UniProt y ficha seleccionada explícita | Separar referencias incluidas de búsqueda externa y conservar contexto de procedencia/estructura |
| Proyectos | Filas por nombre, longitud, procedencia, fecha y destinos; datos científicos desplegables | Explorar la colección sin dar el mismo peso a cada cifra |
| Cuenta | Índice a cuenta, apariencia y privacidad; preferencias también accesibles globalmente | Localizar ajustes sin depender del estado de sesión |
| Entrar, registro y recuperación | Contexto del trabajo, formulario y acceso sin cuenta; apilados en móvil | Explicar qué se recupera al entrar y ofrecer una salida clara |
| Privacidad y condiciones | Índice y ancho de lectura limitado | Encontrar un apartado concreto sin recorrer todo el documento |
| Dirección desconocida | Marco coherente, ubicación correcta y accesos de recuperación existentes | Volver a una tarea desde una dirección inválida |

Los cambios de comprensión son objetivos de diseño sustentados en la auditoría heurística. No se presentan como mejora medida con usuarios ni como nuevas capacidades biológicas.

## Conservación del trabajo y rigor

Las pestañas propias usan un único foco activo, flechas y Home/End. Los cálculos del perfil permanecen montados al cambiar de vista y su canvas se redibuja al revelarlo. Ventana y residuo seleccionado se comparten. El editor superpuesto, FASTA y lector virtualizados conservan sus mecanismos. Mol* sigue cargándose a demanda; el recorrido SIFTS conserva versión/hash, cadena, numeración y estados distintos de ambigüedad y fallo.

Laboratorio conserva importación validada en Worker, restricciones, borradores por variante, deshacer, archivo portable, PDB original y proyectos con conflictos. Editar una secuencia continúa retirando las coordenadas y métricas que ya no le corresponden. Proyectos conserva búsqueda, orden, paginación, destinos por contenido y confirmaciones al reemplazar; sin vista previa, dice que faltan datos y no ofrece un desplegable vacío. No añade filtros ficticios. El visor avanzado conserva el dibujo de referencia medido si falla la descarga, pero muestra el error y permite reintentar; no deja ese fallo oculto.

Todos los textos nuevos están en español e inglés. Se reutilizan marca, tipografías locales, colores químicos, tokens y primitivas existentes; se añade ViewTabs y composición en src/workbench.css, sin dependencias. Las propiedades de secuencia no demuestran plegamiento, función o estabilidad experimental; identidad, confianza y RMSD tienen su alcance junto al resultado.

## Verificación local

- Tipos y lint correctos durante la integración; build de producción correcto.
- 446 pruebas unitarias en 79 archivos correctas. Cobertura: líneas 90,19 %, sentencias 86,60 %, ramas 77,13 %, funciones 83,69 %. Mínimo existente de 70 % conservado.
- Matriz visual final: 15 pantallas × español/inglés × 360/1280 × claro/oscuro, 120 configuraciones sin desbordamiento ni controles visibles por debajo de 44 px; sin infracciones detectadas por axe WCAG 2.1 AA. Incluye proyectos y cuenta simulados, y coordenadas BinaryCIF reales incluidas localmente.
- PWA correcta en Chromium: recarga sin conexión, fuentes/Worker del perfil, cálculo de comparación, candidatos, edición/archivo del laboratorio, cuaderno idéntico y PDF; motor Mol* excluido del precache.
- Recorridos de Chromium: 110 casos distintos comprobados y 2 opcionales omitidos por no suministrar sus archivos Colab locales a la batería. La pasada completa dio 109 correctos, 2 omitidos y una aserción antigua que aún esperaba el error del visor oculto. Actualizada esa aserción al error visible/reintento, Biblioteca terminó 6/6 correcta, incluido el caso pendiente. No se relajaron cifras, objetivos táctiles ni contratos.
- Matriz final 30/30 correcta y sin errores de página observados en los recorridos que los capturan. Tras la simplificación final del detalle de Proyectos se repitió su módulo: 3/3 correcto. Build y PWA repetidos sobre los archivos finales, correctos.

Se corrigieron durante la comprobación: barra de acciones móvil que desbordaba, ancho de cifras de comparación, contraste de la acción primaria expandida y tamaño táctil de un enlace de cuenta. Los tests se adaptaron para abrir las vistas o parámetros que ahora se despliegan, conservando comprobaciones de cifras, archivo, cancelación, foco y conflictos. Se añadió regresión de teclado/estado de las pestañas y del redibujado del canvas al volver al perfil.

El primer arranque de la batería de recorridos quedó detenido en calentamiento y se canceló; una pasada posterior se solapó con cambios y tuvo fallos de localizadores antiguos y cierres de conexión. Se confirmó además que las trazas HTML bajo artifacts disparaban recargas del servidor de desarrollo y provocaban pérdidas aparentes de estado en las pruebas. Se excluyeron artifacts, temporales, cobertura y resultados del observador, y se limitó el escaneo de dependencias a las fuentes de la app. No cambia el build ni el precache. Esas pasadas no constituyen validación final. Las salidas y trazas locales conservan los intentos y sus correcciones. La revisión externa 21st de fuentes fue rechazada por la revisión automática, y se sustituyó por inspección local, pruebas y axe sin subir código.

## Evidencia y límites

Capturas y registros en artifacts/usability-redesign-2026-10-26/implementation y en los registros de esa misma carpeta, excluidos de Git/build. Las maquetas anteriores se conservan como evidencia de la elección, separadas del producto. La colección de la matriz visual usa identidad y documentos ilustrativos; no acredita datos ni escritura en la cuenta del propietario.

No se modifican backend, contratos, datos remotos, inferencia ni dependencias. Sin push, merge, despliegue o gasto. No se certifican Safari, teléfonos físicos, CI remoto, proveedor de lecturas, segunda cuenta o una investigación de usabilidad con personas por esta entrega. Los pendientes científicos y de servicio del relevo anterior se conservan.

## Cierre

Implementación completa del plan aprobado y comprobación local finalizada. La experiencia y los estados científicos permanecen bilingües, con ambas apariencias y navegación móvil. La facilidad de comprensión se ha revisado de forma heurística; se propone contrastarla con usuarios reales sin atribuir a las pruebas automáticas una medición de intuición.

Capturas locales del producto: [Analizar en escritorio](../artifacts/usability-redesign-2026-10-26/implementation/implemented-analyze-1280-light.png), [Analizar en móvil](../artifacts/usability-redesign-2026-10-26/implementation/implemented-analyze-360-light.png), [Laboratorio](../artifacts/usability-redesign-2026-10-26/implementation/implemented-laboratory-1280-light.png), [inglés y tema oscuro](../artifacts/usability-redesign-2026-10-26/implementation/implemented-en-analyze-1280-dark.png). Evidencia local excluida de Git.

Código y regresiones confirmados localmente en b23f386 y 9464ae7, con autor y committer exclusivos del propietario. Sin modificaciones remotas.
