# Requisitos de ProteinForge

Este documento reúne el problema, el alcance, los requisitos funcionales y de calidad y los contratos científicos de la aplicación. Sustituye a la [definición académica original](archive/definicion-original.md), que se conserva como anexo. Las [decisiones](decisiones.md), las [pantallas](pantallas.md) y el resto de documentos de `docs/` concretan cada parte.

## Problema y objetivo

Explorar secuencias que satisfagan condiciones específicas exige buscar en un espacio combinatorio grande. ProteinForge permite analizar secuencias de proteínas, compararlas, generar candidatos bajo condiciones fisicoquímicas y consultar estructuras experimentales o predichas en un recorrido académico reproducible.

El producto reúne editor e importación FASTA, descriptores, alineamiento, catálogo de referencias, UniProt, visor 3D, cuentas, proyectos, interpretación de resultados e informes, además de un laboratorio didáctico para modificar candidatos y comparar sus modelos 3D.

Un candidato que cumple intervalos de descriptores no queda validado como proteína funcional o estable. Una predicción 3D tampoco demuestra actividad experimental ni novedad en la naturaleza. La búsqueda guiada evalúa alternativas: su mejora debe medirse frente a una referencia, sin afirmar que elimina la complejidad combinatoria.

## Alcance

| Capacidad | Descripción |
|---|---|
| Editor, FASTA y validación | Entrada manual, pegado, FASTA y ensamblado de fragmentos del catálogo; catálogo de referencias completas y de 48 dominios con procedencia |
| Descriptores, hidropatía y propensiones | Masa, pI, inestabilidad, índice alifático, GRAVY, perfil por ventana y propensiones clásicas, calculados en Workers |
| Alineamiento | Global y local con Gotoh en Rust/WASM y Workers |
| Preferencias y uso sin conexión | Temas claro/oscuro, español e inglés, PWA con recursos locales y cola de guardado diferido |
| Backend y base de datos | Identidad, proyectos, UniProt, SIFTS, asistente, informes y predicción con RLS en PostgreSQL |
| UniProt, catálogo y visor 3D | Búsqueda y detalle de UniProt, estructuras PDB con Mol* y selección sincronizada secuencia/estructura mediante SIFTS |
| Cuentas, proyectos, asistente e informes | Cuenta, proyectos, laboratorio guardado, lectura de resultados e informes PDF/JSON/CSV |
| Generación y comparación de candidatos | Búsqueda reproducible con referencia aleatoria; historial en proyectos detrás de una bandera |
| Predicción estructural | Desde el laboratorio, con consentimiento por solicitud y servidor público de ESM Atlas, detrás de una bandera; el cuaderno de Colab es la vía de respaldo |

Quedan fuera: entrenamiento de modelos, cómputo estructural pesado en Vercel, simulación molecular, validación clínica, alineamiento múltiple, búsqueda BLAST completa, colaboración simultánea y diseño de formas nuevas (de novo). La generación usa un algoritmo específico, separado del asistente conversacional.

## Requisitos funcionales

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
| RF-14 | Exportar informe PDF y datos CSV, y guardar informes en la cuenta | Media |
| RF-15 | Cálculo local sin conexión y sincronización al recuperar red | Media |
| RF-16 | Parámetros, fuentes y trazabilidad reproducibles | Alta |
| RF-17 | Generar y comparar candidatos sujetos a condiciones definidas por el usuario | Alta |
| RF-18 | Solicitar predicción externa de un candidato seleccionado y visualizar su resultado 3D | Alta |

**RF-14.** El informe se genera en el dispositivo. Con `VITE_REPORT_STORAGE=enabled` también se guarda en la cuenta. Detalle en [informes](reports.md).

**RF-15.** El cálculo funciona sin conexión. Los guardados en Proyectos que no pueden enviarse esperan en la pestaña y se envían solos al volver la red, con estado junto a la cuenta y en cada fila, reintentos y conflictos resueltos en la fila. Lo pendiente no sobrevive a cerrar la pestaña. Detalle en [decisiones](decisiones.md) y [proyectos](projects.md).

**RF-17.** Conserva parámetros, semilla y versiones en JSON, con cancelación y condiciones y diversidad medidas: longitud fija 5-300, masa y GRAVY, 100-5.000 evaluaciones por brazo, recocido simulado y referencia aleatoria. Método, límites y cinco semillas en [candidatos](candidates.md). No garantiza óptimo, función ni estabilidad.

**RF-18.** La secuencia se envía únicamente tras una acción y un consentimiento explícitos. El resultado se valida y se etiqueta como predicción, con proveedor y confianza cuando exista. Un fallo externo es visible y no se sustituye por coordenadas ficticias. Contrato y límites en [predicción](prediccion.md).

## Requisitos de calidad

| ID | Criterio |
|---|---|
| RNF-01 | Cómputo pesado fuera del hilo principal; objetivo de tareas menores de 50 ms e INP p75 menor de 200 ms. El INP de campo exigiría telemetría con consentimiento y queda fuera del alcance |
| RNF-02 | Dos secuencias de 2.000 residuos alineadas en menos de 5 s en un equipo medio de cuatro núcleos |
| RNF-03 | Objetivo de LCP menor de 2,5 s en 4G simulada. Metodología y límites en [calidad y rendimiento](calidad-y-rendimiento.md) |
| RNF-04 | Objetivo de la API: 100 peticiones por minuto durante 5 minutos |
| RNF-05 | Disponibilidad de la aplicación del 99 % mensual, sin garantizar la de las APIs públicas; degradación explícita |
| RNF-06 | TLS, secretos de servicios exclusivamente en servidor y autorización por recurso |
| RNF-07 | Procesamiento local; guardado y envíos externos deliberados |
| RNF-08 | Accesibilidad WCAG 2.1 AA: contraste, foco y teclado desde el diseño |
| RNF-09 | Compatibilidad con las dos últimas versiones de Chrome, Firefox, Edge y Safari. Se verifica en Chromium, Firefox y WebKit; Safari en dispositivo real y lectores de pantalla son un límite conocido |
| RNF-10 | Cobertura mínima del 70 % en cálculo y análisis estático sin errores. V8 no mide cobertura interna de Rust |
| RNF-11 | Errores del backend con identificador de correlación, sin exponer secretos ni secuencias |
| RNF-12 | Costo cero: servicios con plan gratuito y sin recursos de pago |

## Organización y arquitectura

```text
ProteinForge/
├── frontend/   # React/Vite, repositorio y despliegue propios
└── backend/    # FastAPI, repositorio y despliegue propios
```

- **Frontend** ([Jacklb19/ProteinForge](https://github.com/Jacklb19/ProteinForge)): React y TypeScript con Vite, organizado por características. Descriptores, alineamiento, búsqueda e informes corren en Workers; el núcleo de alineamiento es WASM.
- **Backend** ([Jacklb19/Protein_Back](https://github.com/Jacklb19/Protein_Back)): FastAPI con Python 3.14. Custodia los secretos, valida la identidad, autoriza proyectos y coordina UniProt, SIFTS, el asistente y la predicción. Las migraciones y las pruebas de RLS viven en ese repositorio.
- **Supabase**: Auth, PostgreSQL con RLS y Storage.
- **Despliegue**: dos proyectos de Vercel independientes. `main` es producción y `dev` desarrollo. Ver [despliegue](despliegue.md).
- **Comunicación**: el navegador habla con la API por gRPC-Web ([gRPC](grpc.md)); la API valida el JWT de Supabase y lo reenvía a PostgREST, de modo que RLS decide el acceso. El frontend conoce la API mediante `VITE_API_BASE_URL`.
- UniProt, PDBe/SIFTS, la interpretación y la predicción se coordinan desde la API. El BinaryCIF público se descarga directamente de RCSB y el catálogo es JSON estático.
- Mol* se carga bajo demanda. El visor distingue estructuras experimentales, referencias y predicciones, y el mapeo secuencia/estructura nunca se supone por igualdad de posiciones.

## Contratos científicos y de concurrencia

- FASTA UTF-8 por flujo en Worker, máximo 5.000.000 bytes, con virtualización de entradas.
- Validación incremental con antirrebote de 45 ms. Se aceptan los veinte residuos estándar más U, O, B, Z y X con aviso, y se retira el asterisco terminal. Los descriptores excluyen residuos no estándar y anuncian cuántos.
- Masa promedio más agua, pK de Bjellqvist, inestabilidad de Guruprasad, índice alifático de Ikai y GRAVY de Kyte-Doolittle. Referencias publicadas y tolerancias en fixtures y pruebas.
- Hidropatía con ventanas completas centradas de 9 y 19, sin valores extremos. Chou-Fasman son propensiones clásicas, no estructura predicha.
- Gotoh con BLOSUM45/62/80; BLOSUM62 por defecto, apertura 10 y extensión 0,5. Coste de hueco `10 + 0,5 × (n − 1)`, con extremos globales gratuitos. U se puntúa como C y O como K con aviso; B, Z y X, directamente.
- Alineamiento por bloques de 256, máximo 5.000 residuos por secuencia. Instancia WASM privada por Worker y traza compartida por regiones disjuntas, con alternativa en un único Worker si falta aislamiento. Progreso y cancelación entre antidiagonales.
- COOP/COEP en Vite y Vercel; canvas en Worker con la paleta resuelta desde los tokens. El cálculo no bloquea el hilo principal ni recarga la PWA durante la edición.
- `rust/alignment/pkg/` se genera, se versiona y se reconstruye y compara en CI; `target/` no se versiona.

## Datos y privacidad

- RLS de Supabase separa a los propietarios y bloquea el acceso de los usuarios a `external_cache`. `profiles.id` conserva el UUID de Supabase Auth; las entidades que crea la API usan `uuid.uuid7()` de Python 3.14.
- Las escrituras usan la fecha de actualización conocida (PUT/DELETE) y responden 409 ante un conflicto.
- Cuenta, recuperación y Google funcionan por redirección. El segundo factor TOTP tiene su [contrato](auth-totp-contract.md).
- El asistente usa Groq con `openai/gpt-oss-120b`, consentimiento por solicitud, contexto delimitado, caché y límites. No recibe la secuencia completa. La predicción sí envía la secuencia al proveedor, con consentimiento por solicitud.
- El PDF se genera en el cliente, se sube mediante URL firmada y la API registra el informe; también se exporta CSV.
- Las secuencias no se guardan en el almacenamiento del navegador.

## Verificación

Durante el desarrollo se ejecutan las pruebas afectadas; al cerrar el código, lint, tipos y build. La batería completa se ejecuta cuando cambian contratos compartidos. Los E2E cubren los recorridos afectados y la PWA, los recursos, los Workers y la caché. Una comprobación local no certifica todos los navegadores, el hardware ni la disponibilidad de servicios externos.
