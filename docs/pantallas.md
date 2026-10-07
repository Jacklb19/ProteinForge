# Mapa vigente de pantallas

Están implementadas `/` (Analizar), `/alignment` (Alinear), `/settings` (Ajustes) y una página de recuperación para cualquier otra dirección. La navegación es una barra superior flotante en escritorio y una barra inferior en móvil. El texto del editor y las entradas y el resultado del alineamiento se conservan en memoria al cambiar de pantalla; al recargar se descartan. Las rutas previstas conservan el mapa aprobado. No son endpoints de API ni enlaces que deban mostrarse antes de existir.

| Pantalla o panel | Ruta | Estado | Requisitos |
|---|---|---|---|
| Analizar: editor, FASTA, ejemplo P01308, descriptores, perfil y lector de residuos | `/` | Implementados | RF-01–05 |
| Catálogo y ensamblado | Panel en `/` | Previsto | RF-01, RF-16 |
| Alinear | `/alignment` | Rust/WASM, progreso, cancelación, bloques, resumen con huecos y aviso de resultado desactualizado | RF-06, RF-07, RF-16 |
| Ajustes | `/settings` | Tema, idioma y privacidad local implementados; inglés completo pendiente | RNF-08, RNF-09 |
| Dirección desconocida | Cualquier otra | Página de recuperación con regreso a Analizar | — |
| UniProt | `/uniprot` | Previsto; acceso según contrato backend | RF-08 |
| Visor experimental | `/structures/:id` | Previsto; descarga RCSB directa y Mol* | RF-09, RF-10 |
| Acceso, registro, recuperación | `/sign-in`, `/sign-up`, `/recover` | Previstos; incluye desafío TOTP si se activa | RF-12 |
| Proyectos | `/projects`, `/projects/:id` | Previstos | RF-13, RF-16 |
| Informe e interpretación | `/projects/:id/report` | Previsto | RF-11, RF-14 |
| Privacidad | `/privacy` | Previsto; incorpora consentimiento de predicción | RNF-07 |
| Generación y comparación de candidatos | Por definir antes de implementar | Alcance aprobado, ubicación pendiente | RF-17, RF-16 |
| Predicción de candidato y visor | Por definir; reutilizar visor cuando corresponda | Alcance aprobado, ubicación pendiente | RF-18, RF-10 |

La generación debe llevar un candidato al editor y a la comparación; la predicción debe mostrar estado, error y procedencia. No añadir rutas nuevas por iniciativa propia durante esta limpieza.

Al ampliar pantallas: usar el marco, `PageHeading`, `SegmentedControl`, textos del catálogo, tokens, opciones desde la configuración de la característica, estados reales, foco y teclado, y objetivos de 44 px. Revisar únicamente pantallas afectadas a 360/1280 px en ambos temas; consultar [diseño](diseno-visual.md).
