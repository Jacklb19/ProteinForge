# Propuesta del laboratorio con datos reales

Preparada el 20 oct 2026 tras comprobar [tres variantes en Colab](design-lab-three-variants.md). **El propietario aprobó A · Mesa de estructura y el plan por pantallas.** Implementada el 21 oct en `/generate/lab`; [alcance, formato y límites](laboratory.md). Se conserva abajo la propuesta y su verificación histórica. El guardado de esta entrega es un archivo local versionado; contratos de nube y migraciones se presentan por separado.

## Dos direcciones

| | A · Mesa de estructura (recomendada) | B · Cuaderno de variantes |
|---|---|---|
| Idea | Explorar una proteína y entender cada posición | Revisar primero la evidencia de una entrega |
| Jerarquía | Estructura amplia e inspector juntos; secuencia y comparación debajo | Procedencia y tabla comparativa primero; detalle de la variante debajo |
| Densidad | Una variante ocupa la primera pantalla | Las tres variantes se comparan antes de abrir su detalle |
| Interacción principal | Elegir un residuo, protegerlo o preparar una sustitución | Cambiar de muestra y revisar su estructura, secuencia y confianza |
| Móvil | Estructura → inspector → secuencia → comparación | Comparación → estructura → inspector → secuencia |
| Riesgo | La secuencia extensa necesita lector acotado/virtualizado al integrar | El detalle queda más abajo; mantener acceso explícito a la muestra activa |
| Mejor uso | Aprendizaje, exploración y edición cotidiana | Revisión de pocas variantes y presentación de resultados |

Las dos conservan «ficha de lectura»: marca y tres fuentes locales, tokens vigentes, navegación plana, tinta sobre papel frío y color únicamente para química de residuos. No introducen un sistema visual nuevo. No hay tarjetas decorativas, iconos por paso ni puntuación inventada de utilidad.

Referencias 21st consultadas: [Resizable, sean0205](https://21st.dev/@sean0205/components/resizable), por la división entre contenido y detalle y la consideración del teclado; [Table with Row Selection, felipemenezes098](https://21st.dev/@felipemenezes098/components/table-07), por la asociación explícita entre fila activa y detalle. Se consultó el código; se adaptaron las ideas a controles HTML y estilos propios, sin instalar dependencias ni usar generación alojada. `BackboneView`, lector de residuos, química, `PageHeading` y tokens del proyecto son las referencias principales. Se consideró una tercera composición de galería, descartada porque duplica la colección de Proyectos y dificulta comparar cifras; se presentan únicamente las dos propuestas requeridas.

## Maquetas y alcance comprobado

Salida local: `C:/Users/josel/.codex/visualizations/2026/10/19/01a152b8-83cd-7033-bd5f-864e92b56b3f/lab/`. `index.html` permite abrir ambas direcciones; `screen.html?direction=a` o `b` elige la composición. PNG `a/b-360/1280-light/dark.png`: capturas reales del navegador, ocho combinaciones. HTML/CSS/scripts y datos descargados permanecen fuera de ambos repositorios. Servidor de revisión local en `http://127.0.0.1:5197/lab/`, solo mientras esté activo.

Datos: muestras reales 1, 2 y 3 del ensayo, 76 residuos cada una, PDB predicho propio y comparación recalculada. El dibujo representa la **traza de Cα**; no es una superficie ni una simulación de fuerzas. La referencia experimental se dibuja en tinta tenue y la predicción en química de residuos, con superposición rígida de Kabsch registrada. Se conserva el PDB original al exportar; la rotación de visualización no modifica los archivos.

Funcionan dentro de la maqueta: cambio de variante, giro por arrastre/flechas, superposición, selección secuencia/estructura, navegación por teclado entre residuos, protección local, sustitución como borrador, retorno al resultado, español/inglés, tema y descarga del PDB asociado. Proteger no cambia la ejecución histórica. Editar elimina la figura y métricas de la nueva secuencia, desactiva la exportación estructural y solicita una predicción nueva. No se interpola una predicción desde la estructura anterior. Cambiar de variante en la maqueta descarta su borrador local; la integración debe conservar borradores o confirmar su reemplazo.

No se implementan todavía importación de ZIP, persistencia, inferencia desde la app, restricciones ejecutadas por ProteinMPNN ni guardado de borradores. Los controles de protección representan la propuesta de edición; los resultados guardados siguen siendo los ensayos sin restricciones. En producción se deberá comprobar que las posiciones protegidas se conservan en la configuración y en las secuencias generadas.

Verificación: 360/1280, ambos temas, fuentes locales cargadas, sin desbordamiento horizontal y controles de al menos 44×44 px, incluidos residuos. Se probaron protección/desbloqueo, cambio a muestra 3 con su secuencia exacta y cifras, movimiento del foco entre residuos, inglés y sustitución que retira predicción. La matriz `checks.json` conserva dimensiones y controles. Esta revisión de maquetas no sustituye E2E, accesibilidad completa o integración de producción.

## Plan por pantallas tras la elección

1. **Diseñar / Laboratorio:** acceso desde Diseñar conservando el generador actual. Abrir el ejemplo comprobado y distinguir referencia experimental, secuencia rediseñada y predicción asociada. Navegación y textos en los dos catálogos de idioma; sin modelo pesado en el navegador.
2. **Abrir resultado:** importación local validada del paquete; esquema y límites de tamaño/cantidad antes de descomprimir, rechazo de rutas ambiguas/duplicadas y archivos incompatibles, hashes, procedencia, secuencia exacta, cadena y coordenadas finitas. Error concreto e importación atómica: un paquete inválido conserva el trabajo anterior. Descompresión y validación costosa en Worker.
3. **Estructura y secuencia:** integrar el visor existente con la estructura de la muestra, carga/error/cancelación y mapeo explícito por cadena/número/inserción. Selección bidireccional, teclado y lector virtualizado. La correspondencia posicional de este ensayo no sustituye un mapeo SIFTS general.
4. **Borrador y restricciones:** sustituir/deshacer, proteger/liberar posiciones, advertencia antes de reemplazar un borrador. Conservar asociación al candidato original. Cualquier cambio de secuencia invalida la predicción derivada; la referencia sigue etiquetada. Exportar secuencia/restricciones para el recorrido manual Colab; comprobarlas en el ejecutor antes de ofrecer generación condicionada.
5. **Variantes y comparación:** cambiar entre los tres resultados, cifras con sus unidades/alcance, diferencias de secuencia, RMSD y confianza por posición. Sin ordenar como si confianza significara función. Reabrir/exportar archivos asociados y estados sin predicción/incompleto.
6. **Guardar y reabrir:** definir representación versionada de ejecución/candidato/estructura y política de borradores/tamaño. Presentar por separado cualquier cambio compatible de contratos y migración antes de implementarlos; conservar propiedad/RLS y evitar modelos/pesos en payloads. No declarar persistencia resuelta por guardar solo la secuencia.
7. **Cierre:** pruebas de paquetes corruptos/desproporcionados y asociaciones incorrectas, edición/selección y conservación de borrador; lint/tipos/build y E2E del recorrido elegido; 360/1280 en ambos temas, teclado/contraste/movimiento reducido, cancelación/errores y PWA afectada. Ciencia en Workers, datos/modelos excluidos de Git. No autoriza publicar, desplegar ni migrar servicios.

Se recomienda **A** por la prioridad acordada de modificar y comprender la proteína en 3D. B favorece revisar resultados, pero retrasa la exploración de un residuo. La aprobación elige la composición y este plan; no convierte el ensayo de rediseño en generación de una forma nueva.
