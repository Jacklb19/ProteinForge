# Decisiones vigentes

La [definición](definicion-proyecto.md) es la fuente de requisitos. Esta tabla explica las decisiones actuales; los documentos de `archive/` son historia. Previsto no significa implementado.

| Decisión | Estado y consecuencia |
|---|---|
| Dos repositorios: frontend React/Vite y backend FastAPI | Organización local realizada. Remotos `ProteinForge` y `Protein_Back`; dos despliegues Vercel previstos |
| Ramas `main` y `dev` | Desarrollo en dev, versiones verificadas en main; el usuario controla push, merge y despliegue |
| Costo cero, sin tarjeta | Vercel Hobby y Supabase Free; no instalar modelos estructurales pesados en funciones ni depender del computador personal |
| Cálculo en navegador | Descriptores y alineamiento implementados; futura búsqueda de candidatos en Worker. El backend coordina servicios/persistencia |
| Gotoh, BLOSUM45/62/80 y huecos afines | Rust/WASM integrado; apertura 10, extensión 0,5 y extremos globales gratuitos. Mantener límite 5.000 |
| Paquete WASM versionado | `rust/alignment/pkg/` generado, sin edición manual; CI reconstruye y compara |
| Alfabeto ampliado y antirrebote 45 ms | Implementados. U/O/B/Z/X con avisos y tratamiento definido en especificación |
| BinaryCIF directo y Mol* bajo demanda | Aprobado, integración pendiente. Origen RCSB ya permitido en CSP |
| Catálogo JSON estático 30–50 fragmentos | Previsto; origen InterPro/Pfam/UniProt y trazabilidad de fragmentos |
| Generación de candidatos RF-17 | Alcance aprobado; criterios, estrategia concreta y presupuestos pendientes de diseño |
| Predicción externa RF-18 | API ESM Atlas respondió a una prueba puntual. Integración y límites pendientes; consentimiento para enviar secuencia, caché y errores visibles |
| Asistente de interpretación | Groq/modelo previsto según especificación; no calcula ni genera secuencias. Configuración real y retención cero pendientes |
| UUIDv7 Python 3.14 | API futura; `profiles.id` sigue Supabase Auth. Función SQL inicial aún provisional |
| Concurrencia optimista | PUT con fecha conocida, conflicto 409. Pendiente |
| Auth y TOTP opcional | Correo/contraseña, recuperación y Google previstos; hasta dos TOTP, exigir aal2 cuando se active. Pendiente |
| PDF local y CSV | Cliente genera PDF, URL firmada para Storage y API registra. Pendiente |
| Temas, traducciones y PWA | Base implementada; inglés y sincronización completos pendientes. Metadatos, icono y fuentes se conservan |
| UI | Sistema actual permanece; nueva dirección visual se revisa en una tarea posterior |

Cambios rutinarios siguen la autorización del usuario. Nuevos contratos, límites científicos, costos o cambios de stack requieren una decisión concreta antes de implementarse.
