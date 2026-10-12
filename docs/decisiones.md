# Decisiones vigentes

La [definición](definicion-proyecto.md) es la fuente de requisitos. Esta tabla explica las decisiones actuales; los documentos de `archive/` son historia. Previsto no significa implementado.

| Decisión | Estado y consecuencia |
|---|---|
| Dos repositorios: frontend React/Vite y backend FastAPI | Organización local realizada. Remotos `ProteinForge` y `Protein_Back`; dos despliegues Vercel previstos |
| Ramas `main` y `dev` | Desarrollo en dev, versiones verificadas en main; el usuario controla push, merge y despliegue |
| Costo cero, sin tarjeta | Vercel Hobby y Supabase Free; no instalar modelos estructurales pesados en funciones ni depender del computador personal |
| Cálculo en navegador | Descriptores, alineamiento, candidatos e informes en Workers; backend coordina identidad/servicios/persistencia |
| Gotoh, BLOSUM45/62/80 y huecos afines | Rust/WASM integrado; apertura 10, extensión 0,5 y extremos globales gratuitos. Mantener límite 5.000 |
| Paquete WASM versionado | `rust/alignment/pkg/` generado, sin edición manual; CI reconstruye y compara |
| Alfabeto ampliado y antirrebote 45 ms | Implementados. U/O/B/Z/X con avisos y tratamiento definido en especificación |
| BinaryCIF directo y Mol* bajo demanda | Implementado, versión 5.13.1 fija; primer modelo/unidad asimétrica experimental, no precache del motor. [Evidencia y cobertura anotada](references.md) |
| Catálogo de fragmentos | 30–50 dominios/ensamblado pendientes. Inicio conservador con tres secuencias completas ya incluidas y SV conocido; no se llaman dominios |
| Generación de candidatos RF-17 | Implementada: masa/GRAVY, longitud 5–300, 100–5.000 evaluaciones por brazo, semilla, recocido y referencia aleatoria. Límites revisables y [comparación medida](candidates.md), sin garantía biológica |
| Predicción externa RF-18 | API ESM Atlas respondió a una prueba puntual. Integración y límites pendientes; consentimiento para enviar secuencia, caché y errores visibles |
| Asistente de interpretación | Groq/modelo previsto según especificación; no calcula ni genera secuencias. Configuración real y retención cero pendientes |
| UUIDv7 | Nueva migración reemplaza helper provisional con timestamp/bits/aleatoriedad gen_random_uuid SQL; evita dependencia Python local 3.13/3.14. profiles.id sigue Auth |
| Concurrencia optimista | PUT/DELETE con timestamp completo, bloqueo SQL y 409. Snapshots transaccionales en analyses workspace-v1, SECURITY INVOKER/JWT/RLS. Seis tests PostgreSQL reales; activación remota pendiente |
| Auth y TOTP opcional | Correo/contraseña, recuperación y Google por redirección implementados en el frontend contra la API REST de Supabase Auth, sin SDK; sesión en `localStorage` con refresco previo a la caducidad. Requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; sin ellos las pantallas lo dicen. Verificado con la API simulada, no contra un proyecto remoto. TOTP y aal2 pendientes |
| PDF local y CSV | jsPDF 4.2.1 en Worker; PDF/JSON/perfil/alineamiento CSV y CSV anterior, asociación/métodos/hash. PDF renderizado, sin etiquetas; subida/registro pendientes. [Contrato](reports.md) |
| Temas, traducciones y PWA | Base implementada; inglés y sincronización completos pendientes. Metadatos, icono y fuentes se conservan |
| UI | Identidad/fuentes conservadas; ejemplo completo, métricas agrupadas y tareas con divisores. Cabecera pública escritorio/dock móvil; banco mantiene navegación. Nuevos módulos usan tokens/primitivas existentes. [Diseño](diseno-visual.md) |
| Configuración | Opciones elegibles y valores ajustables en módulos de configuración por característica; textos en i18n, estilos en tokens y fuentes en un manifiesto. Sin valores fijos en componentes |

La autorización del 12 oct permite decisiones técnicas/contratos compatibles revisables y documentados. No autoriza gastos, cambios remotos ni promesas científicas. [Estado y límites](plan-desarrollo.md).
