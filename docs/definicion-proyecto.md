# Definición vigente de ProteinForge

Estado del 28 oct 2026: publicados frontend `main` `84f9da5` y backend `main` `18d9444`, con CI y Vercel correctos. Están publicados el rediseño «Mesa clara», la presentación pública separada del laboratorio, la selección SIFTS, el asistente, Proyectos, el laboratorio y el historial del generador, este último oculto hasta activar `VITE_GENERATOR_HISTORY` en Vercel. En `dev` del frontend está integrada además la pasada de rendimiento y accesibilidad (`0b22b4a`), sin publicar. Por decisión del propietario de esta fecha, el modelado se queda en el cuaderno manual de Colab, la inferencia desde la app queda aplazada, la forma de novo fuera del alcance y el catálogo de dominios, verificado y con su pestaña en Biblioteca, quedó integrado en `dev` el 29 oct (`a3acf37`), sin publicar. La verificación se limita a lo necesario: Safari en dispositivo real, lector de pantalla e INP de campo son límites documentados, no pendientes. El [plan](plan-desarrollo.md), las [decisiones](decisiones.md) y el [relevo](prompt-siguiente-entrega.md) recogen evidencia y límites; las capturas fechadas inferiores conservan la evolución anterior.

Estado del 26 oct 2026: laboratorio, guardado en Proyectos y RF-11/Groq publicados; [recorrido del laboratorio registrado](laboratory-activation.md), lectura autenticada del asistente en producción por comprobar. Selección SIFTS Biblioteca/Analizar y suministro autenticado integrados y verificados localmente, pendientes de publicación. La prueba manual ZeroGPU produjo un rediseño fragmentario; siguen abiertas forma de novo, inferencia estructural desde la app y persistencia de predicciones. El [plan actualizado](plan-desarrollo.md) recoge evidencia y límites; las capturas de estado fechadas inferiores conservan la evolución anterior.

Actualización de implementación del 21 oct 2026: Proyectos, migraciones, publicación y confirmación de correo ya resueltos según las verificaciones posteriores; inglés implementado. El [laboratorio A](laboratory.md) añade tres resultados reales de Colab, importación, selección secuencia/3D, edición/restricciones y guardar/reabrir archivo local. El [recorrido condicionado manual](design-lab-constraints.md) también está ejecutado y comprobado. El [guardado completo en Proyectos](laboratory-projects.md) está implementado y comprobado localmente. Quedan su activación remota, predicción nueva desde la app y forma de novo. La tabla del 12 oct de abajo conserva la captura anterior; el [plan actualizado](plan-desarrollo.md) determina lo restante.

Actualizada el 12 de octubre de 2026. Sustituye la [definición original](archive/definicion-original.md), conservada por trazabilidad. [Decisiones](decisiones.md), [pantallas](pantallas.md) y [plan](plan-desarrollo.md) concretan implementación y límites. Evidencia local no equivale a despliegue ni garantía externa.

## Problema y objetivo

Explorar secuencias que satisfagan condiciones específicas exige buscar en un espacio combinatorio grande. ProteinForge permitirá generar candidatos bajo condiciones fisicoquímicas, analizarlos, compararlos y consultar estructuras experimentales o predichas en un recorrido académico reproducible.

El producto conserva el editor, importación FASTA, descriptores, alineamiento, catálogo, UniProt, visor 3D, cuentas, proyectos, interpretación e informes. Se añaden generación de candidatos y predicción estructural externa. Próxima prioridad: laboratorio didáctico para crear/modificar candidatos y explorar/comparar sus modelos 3D, con parámetros avanzados secundarios. Basta demostrar dos o tres diseños computacionales útiles; validación experimental posterior por otros. [Alcance, primera prueba y alojamiento](design-lab-roadmap.md). Demo académica con costo cero y sin tarjeta.

Un candidato que cumple intervalos de descriptores no queda validado como proteína funcional o estable. Una predicción 3D tampoco demuestra actividad experimental ni novedad en la naturaleza. La búsqueda guiada sigue evaluando alternativas: su mejora debe medirse frente a una referencia, sin afirmar que elimina la complejidad combinatoria.

## Alcance y estado

| Capacidad | Estado actual |
|---|---|
| Editor, FASTA, validación ampliada | Implementados y publicados; catálogo inicial de tres referencias completas. Catálogo de 48 dominios verificado y pestaña «Dominios» con ensamblado integrados en `dev` (`a3acf37`), sin publicar |
| Descriptores, hidropatía y propensiones clásicas | Implementados en Workers y publicados |
| Alineamiento global/local | Implementado en Rust/WASM y Workers, publicado |
| Preferencias, temas y recursos locales sin conexión | Implementados y publicados, con inglés completo. La sincronización diferida al recuperar red sigue pendiente |
| Backend y base de datos | Health/identidad/CRUD/UniProt/SIFTS/asistente implementados y publicados; seis pruebas RLS PostgreSQL reales y migraciones aplicadas por el propietario. Recorrido con JWT real y aislamiento por ID con segunda cuenta pendientes |
| UniProt, catálogo, visor 3D y selección sincronizada | Implementados y publicados, incluida la selección SIFTS bidireccional comprobada en producción con P01308/1TRZ; cobertura anotada. Mol* experimental, sin predicción |
| Cuentas, persistencia, asistente y PDF/CSV | Cuenta, proyectos, laboratorio guardado, asistente e informes PDF/JSON/CSV implementados y publicados. Entrega SMTP, flujo Google completo, TOTP y la comprobación de la prosa del asistente siguen pendientes |
| Generación y comparación de candidatos | RF17 implementado y publicado, con límites/configuración y evidencia en [candidatos](candidates.md). El historial de búsquedas en Proyectos está implementado y publicado, oculto hasta activar `VITE_GENERATOR_HISTORY` |
| Predicción externa de candidatos | Aplazada por decisión del 28 oct: sin ejecutor gratuito cuyos términos permitan este uso. El modelado se hace con el cuaderno manual de Colab y sus resultados se importan |

No se incluyen entrenamiento de modelos, cómputo estructural pesado en Vercel, simulación molecular, validación clínica, alineamiento múltiple, búsqueda BLAST completa ni colaboración simultánea. La generación se hará mediante un algoritmo específico, separado del asistente conversacional.

## Requisitos funcionales

Se conservan RF-01 a RF-16 para mantener trazabilidad; RF-17 y RF-18 identifican la ampliación aprobada. Sus detalles se definirán antes de implementar, sin inventar límites o contratos.

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Entrada manual, pegado, FASTA y ensamblado de catálogo | Alta |
| RF-02 | Validación incremental y posiciones inválidas | Alta |
| RF-03 | Masa, pI, inestabilidad, índice alifático y GRAVY | Alta |
| RF-04 | Perfil de hidrofobicidad por ventana y representación gráfica | Alta |
| RF-05 | Propensiones clásicas por residuo, con advertencia de alcance | Media |
| RF-06 | Alineamiento global/local con matriz y huecos afines | Alta |
| RF-07 | Identidad, similitud y conservación del resultado | Alta |
| RF-08 | Búsqueda y anotación funcional de UniProt | Alta |
| RF-09 | Recuperación y visualización 3D de estructuras experimentales PDB | Alta |
| RF-10 | Selección sincronizada entre secuencia y estructura | Media |
| RF-11 | Interpretación automática de resultados ya calculados | Media |
| RF-12 | Autenticación y asociación de proyectos a cuentas | Alta |
| RF-13 | Crear, guardar, listar, abrir, renombrar y eliminar proyectos | Alta |
| RF-14 | Exportar informe PDF y datos CSV | Media |
| RF-15 | Cálculo local sin conexión y sincronización al recuperar red | Media |
| RF-16 | Parámetros, fuentes y trazabilidad reproducibles | Alta |
| RF-17 | Generar y comparar candidatos sujetos a condiciones definidas por el usuario | Alta |
| RF-18 | Solicitar predicción externa de un candidato seleccionado y visualizar su resultado 3D | Alta |

RF-17 conserva parámetros/semilla/versiones en JSON, cancelación y condiciones/diversidad medidas. Implementación revisable autorizada: longitud fija 5–300, masa/GRAVY, 100–5.000 evaluaciones por brazo, recocido simulado y referencia aleatoria. [Método, límites y cinco semillas](candidates.md). No garantiza óptimo, función ni estabilidad. Historial completo de búsquedas en proyectos pendiente.

RF-18 enviará la secuencia únicamente tras una acción y consentimiento explícitos. El resultado debe validarse y etiquetarse como predicción, con proveedor y confianza cuando exista. Guardar estructuras previas permite una demostración de respaldo, siempre identificadas como resultados guardados. Un fallo externo debe ser visible, no sustituirse por coordenadas ficticias.

## Criterios y requisitos de calidad

Las historias originales HU-01 a HU-10 permanecen en el archivo histórico; sus decisiones corregidas se aplican aquí: alfabeto ampliado, catálogo estático, PDF local y backend separado. Nuevos recorridos: definir condiciones y comparar candidatos; seleccionar uno y visualizar una predicción.

| ID | Criterio vigente |
|---|---|
| RNF-01 | Cómputo pesado fuera del hilo principal; objetivo tareas menores de 50 ms e INP p75 menor de 200 ms. Auditado el 27 oct y cumplido solo en parte: interacciones sintéticas con CPU ×4 en p75 de 48 ms, pero persisten tareas de más de 50 ms al cargar. El INP de campo exigiría telemetría con consentimiento y queda fuera del alcance |
| RNF-02 | Dos secuencias de 2.000 residuos en menos de 5 s en equipo medio de cuatro núcleos. Medición local disponible, certificación de equipo pendiente |
| RNF-03 | Objetivo LCP menor de 2,5 s en 4G simulada. Cumplido en medición local del 27 oct con `vite preview`, 4G lenta y CPU ×4: 2.150 ms en Inicio y 2.449 ms en Analizar, este último con 43 ms de margen en p75. No acredita producción ni dispositivos físicos |
| RNF-04 | Objetivo API: 100 peticiones/minuto durante 5 minutos; medir al existir backend, no aplicar carga al proveedor de predicción |
| RNF-05 | Objetivo de disponibilidad de aplicación 99 % mensual, sin garantizar disponibilidad de APIs públicas; degradación explícita |
| RNF-06 | TLS, secretos de servicios exclusivamente en servidor y autorización por recurso |
| RNF-07 | Procesamiento local; guardado y envíos externos deliberados. Predicción envía secuencia con consentimiento |
| RNF-08 | Accesibilidad WCAG 2.1 AA; contraste, foco y teclado desde el diseño |
| RNF-09 | Compatibilidad objetivo en últimas dos versiones de Chrome, Firefox, Edge y Safari. Alcance real verificado: Chromium 156, Firefox 155 y WebKit 26.6 en Windows, con la batería sin conexión completa en Chromium y WebKit. Safari en dispositivo real y lectores de pantalla quedan como límite documentado por decisión del 28 oct, no como pendiente |
| RNF-10 | Cobertura mínima 70 % en cálculo y análisis estático sin errores. V8 no mide cobertura interna de Rust |
| RNF-11 | Errores del backend con identificador de correlación sin exponer secretos ni secuencias |
| RNF-12 | Costo cero, sin tarjeta ni recursos de pago; confirmar límites oficiales al implementar |

## Organización y arquitectura

```text
ProteinForge/              # carpeta local sin Git
├── frontend/              # React/Vite; Git y despliegue propios
└── backend/               # base FastAPI; Git y despliegue propios
```

- Frontend: repositorio `Jacklb19/ProteinForge`, React/TypeScript/Vite por características. Descriptores, alineamiento, búsqueda e informes corren en Workers; WASM se mantiene aquí.
- Backend: repositorio `Jacklb19/Protein_Back`, FastAPI implementado, Python 3.14 objetivo (3.13 local). Custodia secretos, valida identidad, autoriza proyectos y coordina UniProt. Migraciones/pruebas RLS en este repositorio.
- Supabase: Auth, PostgreSQL y Storage. La migración inicial define `profiles`, `projects`, `analyses`, `alignments`, `external_cache`; no describe todavía persistencia de candidatos/predicciones.
- Despliegues independientes en Vercel: URL frontend y URL API. La carpeta contenedora no se importa a Vercel. `main` es producción y `dev` desarrollo; su conexión efectiva al proveedor la configura el usuario.
- API propia con CORS para orígenes configurados y validación JWT. Frontend conoce URL API mediante `VITE_API_BASE_URL`. Contratos REST/OpenAPI se mantienen en el backend al implementarlos.
- UniProt, PDBe/SIFTS, interpretación y predicción se coordinan desde la API. BinaryCIF público se descarga directamente de RCSB; catálogo es JSON estático. Las excepciones a la intermediación quedan explícitas.
- Mol* se carga bajo demanda. Estructuras experimentales, referencias y predicciones se distinguen en el visor; el mapeo secuencia/estructura no se supone por igualdad de posiciones.

## Contratos científicos y concurrencia existentes

- FASTA UTF-8 por flujo en Worker, máximo 5.000.000 bytes; virtualización de entradas.
- Validación incremental con antirrebote 45 ms. Se aceptan veinte residuos estándar más U/O/B/Z/X con aviso; se retira asterisco terminal. Los descriptores excluyen residuos no estándar y anuncian cantidad.
- Masa promedio más agua, pK de Bjellqvist, inestabilidad Guruprasad, índice alifático Ikai y GRAVY Kyte–Doolittle. Referencias publicadas y tolerancias en fixtures/pruebas.
- Hidropatía: ventanas completas centradas 9/19; sin valores extremos. Chou–Fasman son propensiones clásicas, no estructura predicha.
- Gotoh con BLOSUM45/62/80; BLOSUM62 predeterminada, apertura 10 y extensión 0,5. Coste de hueco `10 + 0,5 × (n − 1)`, extremos globales gratuitos. U se puntúa como C y O como K con aviso; B/Z/X directamente.
- Alineamiento por bloques de 256, máximo 5.000 residuos por secuencia. Instancia WASM privada por Worker y traza compartida por regiones disjuntas; alternativa en Worker único si falta aislamiento. Progreso y cancelación entre antidiagonales.
- COOP/COEP en Vite y Vercel; canvas en Worker, paleta resuelta desde tokens. No bloquear el hilo principal con el cálculo ni recargar la PWA durante edición.
- `rust/alignment/pkg/` generado se versiona y se reconstruye/compara en CI; `target/` no se versiona.

## Datos, privacidad y servicios previstos

Supabase RLS separa propietarios y bloquea acceso de usuarios a `external_cache`. El UUIDv7 PL/pgSQL inicial es provisional; la API usará `uuid.uuid7()` de Python 3.14 para entidades que crea. `profiles.id` conserva el UUID de Supabase Auth. No cambiar migraciones remotas durante esta limpieza.

Persistencia con fecha conocida en PUT/DELETE y 409, transacciones/RLS locales comprobados; activación remota pendiente. Cuenta/recuperación/Google por redirección; entrega SMTP/flujo Google completo sin verificar, TOTP/MFA pendientes.

Asistente previsto con Groq y `openai/gpt-oss-120b`, consentimiento, contexto delimitado, caché/límites y plantilla ante cuota agotada. No enviar secuencia completa al asistente. Retención cero debe comprobarse en la cuenta; la prueba de predicción sí envía la secuencia al proveedor elegido. PDF se genera en cliente, se sube mediante URL firmada y la API registra el informe; también se exporta CSV.

ESM Atlas/ESMFold queda como alternativa histórica, no proveedor obligatorio. Una prueba con ubiquitina devolvió HTTP 200 y un PDB de 50.181 bytes con 601 registros ATOM; no acredita disponibilidad futura, calidad biológica, caché ni visor integrado. El acuerdo posterior prioriza ensayar forma → secuencia → predicción con Foundry o RFdiffusion/MPNN/ColabFold en entorno separado, midiendo recursos antes de ampliar la interfaz. No probar carga sobre proveedores compartidos. Límites, condiciones, consentimiento y almacenamiento se concretarán con la opción comprobada.

Referencias de proveedor: [API de ESM Atlas](https://esmatlas.com/about), [ESMFold](https://github.com/facebookresearch/esm), [FastAPI en Vercel](https://vercel.com/docs/frameworks/backend/fastapi). Los límites se consultan cuando condicionen implementación; no se copian como garantías permanentes.

## Plan vigente por entregables

El cronograma antiguo se conserva como historial, no como bloqueo por conversación. Se trabaja en `dev` en ambos repositorios.

1. Organización, documentos, responsabilidades y verificación de la base existente: esta intervención.
2. API/proyectos/UniProt implementados con versiones fijas y RLS PostgreSQL real; activar migraciones/publicación y comprobar JWT real/runtime objetivo.
3. Nueva dirección visual aprobada y recorrido integrado de catálogo/UniProt/visor experimental; conservar los mecanismos de accesibilidad y cálculo existentes.
4. RF17 implementado con comparación reproducible; ampliar solo con evidencia de propiedades/estrategias admitidas.
5. RF-18: aplazado el 28 oct. El laboratorio importa y compara resultados del cuaderno manual de Colab, que sirve de respaldo para la presentación; la predicción desde la app espera un ejecutor gratuito admisible.
6. Interpretación, selección sincronizada, inglés y rendimiento ya están implementados y publicados, y el historial de generación también, pendiente de activarlo en Vercel. Quedan la sincronización diferida, publicar el catálogo de dominios con ensamblado, ya integrado en `dev`, y los pendientes de identidad: SMTP, flujo Google completo y TOTP.

La petición del 11 de octubre autoriza continuar el desarrollo completo con dirección visual v3 aprobada. El [plan actualizado](plan-desarrollo.md) ordena la web pública/app, conexión de identidad, proyectos, datos/visor, informes, generación y predicción. No se impone una fecha ni un sprint; las rutas/payloads nuevos y el esquema de candidatos se concretan al abordar cada entregable.

## Verificación proporcional y terminado

Pruebas afectadas durante desarrollo; lint, tipos y build al cerrar código. Ejecutar batería completa cuando cambien contratos compartidos o se prepare una integración importante. E2E para recorridos afectados y PWA para recursos/Workers/caché. Documentación sola: coherencia, enlaces y diff.

Para la entrega: requisitos de la tabla implementados con evidencia o pendientes explícitamente acordados, dos repositorios y URLs operativas, demostración reproducible y resultados 3D identificados correctamente. Las comprobaciones externas no realizadas se declaran; ni Chrome local ni una respuesta de API certifican todos los navegadores, hardware o disponibilidad.
