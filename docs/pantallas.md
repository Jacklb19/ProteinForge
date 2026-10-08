# Mapa vigente de pantallas

Actualizado el 8 de octubre de 2026. La navegación es una barra superior flotante en escritorio y una barra inferior en móvil con Inicio · Analizar · Alinear · Ajustes; la barra superior lleva además el cambio rápido de tema y el acceso a la cuenta. Las rutas se leen de `src/shared/navigation.ts`; ningún enlace ni prueba escribe una ruta a mano. El texto del editor y las entradas y el resultado del alineamiento se conservan en memoria al cambiar de pantalla; al recargar se descartan.

| Pantalla o panel | Ruta | Estado | Requisitos |
|---|---|---|---|
| Inicio: qué es ProteinForge, perfil de insulina calculado al cargar, herramientas con su estado, recorrido, criterio científico con hélice α ideal y llamada a crear cuenta | `/` | Implementada | — |
| Analizar: editor, FASTA, ejemplo P01308, descriptores, perfil y lector de residuos; vaciar y enviar al alineamiento | `/analyze` | Implementados | RF-01–05 |
| Catálogo y ensamblado | Panel en `/analyze` | Previsto | RF-01, RF-16 |
| Alinear | `/alignment` | Rust/WASM, progreso, cancelación, bloques, resumen con huecos y aviso de resultado desactualizado | RF-06, RF-07, RF-16 |
| Ajustes: cuenta, tema, idioma y privacidad | `/settings` | Tema, idioma y privacidad local implementados; cuenta muestra sesión, cierre o la ausencia de configuración; inglés completo pendiente | RF-12, RNF-08, RNF-09 |
| Acceso, registro, recuperación | `/sign-in`, `/sign-up`, `/recover` | Implementados sobre Supabase Auth (correo/contraseña, enlace de recuperación, Google por redirección). Sin `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` la pantalla lo explica y desactiva el formulario. TOTP pendiente | RF-12 |
| Privacidad | `/privacy` | Implementada; recoge el consentimiento previsto para predicción | RNF-07 |
| Dirección desconocida | Cualquier otra | Página de recuperación con regreso a Analizar o Inicio | — |
| UniProt | `/uniprot` | Previsto; acceso según contrato backend | RF-08 |
| Visor experimental | `/structures/:id` | Previsto; descarga RCSB directa y Mol* | RF-09, RF-10 |
| Proyectos | `/projects`, `/projects/:id` | Previstos; la portada los anuncia «en preparación» | RF-13, RF-16 |
| Informe e interpretación | `/projects/:id/report` | Previsto | RF-11, RF-14 |
| Generación y comparación de candidatos | Por definir antes de implementar | Alcance aprobado, ubicación pendiente | RF-17, RF-16 |
| Predicción de candidato y visor | Por definir; reutilizar visor cuando corresponda | Alcance aprobado, ubicación pendiente | RF-18, RF-10 |

La portada enlaza solo las herramientas disponibles; las tarjetas previstas no tienen destino. El botón «Ver con insulina humana» carga el ejemplo en el borrador y abre Analizar. Tras iniciar sesión se vuelve a Analizar, o a la página protegida que envió al visitante.

Al ampliar pantallas: usar el marco, `PageHeading`, `SegmentedControl`, textos del catálogo, tokens, opciones desde la configuración de la característica, estados reales, foco y teclado, y objetivos de 44 px. Revisar únicamente pantallas afectadas a 360/1280 px en ambos temas; consultar [diseño](diseno-visual.md).
