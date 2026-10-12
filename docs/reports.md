# Informes locales reproducibles

Exportar informe en Analizar/Alinear: PDF, JSON, perfil/propensiones CSV y alineamiento CSV. Se conserva el CSV de propiedades existente. Worker independiente creado solo al solicitarlo; cancelación, timeout de 20 s y descarte si cambian entradas. Ningún dato se envía al servidor.

El snapshot normaliza/valida entradas; recomputa descriptores sobre los veinte residuos estándar, perfil completo con ventanas 9/19 y propensiones clásicas. Registra secuencia exacta, exclusiones, fuente/versiones conocidas, SHA-256, fecha UTC, versión del método y referencias. Comparación solo si tiene resultInput asociado a las entradas vigentes. Los hashes identifican contenido; no certifican la fuente.

JSON schemaVersion 1 conserva valores completos, todos los puntos (null cuando no hay ventana válida), columnas de alineamiento, matriz, modo y huecos. CSV de perfil incluye cada residuo y distingue extremos sin ventana de ventanas con símbolos no estándar; CSV de alineamiento incluye posiciones/columnas y parámetros. CSV usa punto decimal y comillas; no redondea valores crudos.

PDF con jsPDF 4.2.1, A4, fuentes estándar locales Helvetica/Courier y texto/gráficos vectoriales. Pagina toda la secuencia y comparación; incluye métodos y procedencia. El gráfico puede muestrear hasta 600 puntos para el dibujo, sin unir huecos: el JSON conserva todos. El PDF actual no está etiquetado para lectores de pantalla; JSON/CSV y la interfaz son alternativas. No incorpora estructura 3D ni interpreta resultados mediante IA. No sube/registra informes ni guarda una búsqueda completa de candidatos: esa búsqueda tiene su JSON propio.

Evidencia: pruebas de exactitud, exclusiones/null, asociación de comparación y hashes; E2E de descargas PDF/JSON/ambos CSV sin solicitudes externas. PDF real de insulina generado y renderizado con Poppler, dos páginas A4 revisadas visualmente. No se reduce tolerancia ni se sustituye una comparación desactualizada por datos ficticios.
