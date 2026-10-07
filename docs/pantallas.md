# Mapa vigente de pantallas

Solo `/`, `/alignment` y `/settings` están implementadas. Las rutas previstas conservan el mapa aprobado; no son endpoints de API ni enlaces que deban mostrarse antes de existir.

| Pantalla o panel | Ruta | Estado | Requisitos |
|---|---|---|---|
| Editor, FASTA, descriptores y perfil | `/` | Implementados | RF-01–05 |
| Catálogo y ensamblado | Panel en `/` | Previsto | RF-01, RF-16 |
| Alineamiento | `/alignment` | Rust/WASM, progreso, cancelación y bloques implementados | RF-06, RF-07, RF-16 |
| Ajustes | `/settings` | Tema/idioma locales implementados; inglés completo pendiente | RNF-08, RNF-09 |
| UniProt | `/uniprot` | Previsto; acceso según contrato backend | RF-08 |
| Visor experimental | `/structures/:id` | Previsto; descarga RCSB directa y Mol* | RF-09, RF-10 |
| Acceso, registro, recuperación | `/sign-in`, `/sign-up`, `/recover` | Previstos; incluye desafío TOTP si se activa | RF-12 |
| Proyectos | `/projects`, `/projects/:id` | Previstos | RF-13, RF-16 |
| Informe e interpretación | `/projects/:id/report` | Previsto | RF-11, RF-14 |
| Privacidad | `/privacy` | Previsto; incorpora consentimiento de predicción | RNF-07 |
| Generación y comparación de candidatos | Por definir antes de implementar | Alcance aprobado, ubicación pendiente | RF-17, RF-16 |
| Predicción de candidato y visor | Por definir; reutilizar visor cuando corresponda | Alcance aprobado, ubicación pendiente | RF-18, RF-10 |

La generación debe llevar un candidato al editor y a la comparación; la predicción debe mostrar estado, error y procedencia. No añadir rutas nuevas por iniciativa propia durante esta limpieza.

Al ampliar pantallas: usar marco/PageHeading, textos del catálogo, tokens, estados reales, foco/teclado y objetivos de 44 px. Revisar únicamente pantallas afectadas a 360/1280 px en ambos temas; consultar [diseño](diseno-visual.md).
