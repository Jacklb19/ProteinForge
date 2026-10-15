# gRPC en ProteinForge

Evaluación e implementación del 15 de octubre de 2026, por el nuevo requisito del curso: el proyecto debe usar gRPC. Contratos en el backend (`proto/`). Decisiones tomadas: la API completa por gRPC, gRPC-Web en el navegador, REST se conserva en el backend y gRPC nativo para el futuro ejecutor del laboratorio.

## Qué es gRPC

gRPC es un sistema de llamadas remotas. Los servicios y sus mensajes se describen en archivos `.proto` (Protocol Buffers). De ese contrato se genera código tipado para servidor y cliente en cada lenguaje, así que ambos lados comparten la misma definición en vez de repetirla a mano.

- Viaja sobre HTTP/2 con mensajes binarios compactos y usa *trailers* de HTTP para el estado final de cada llamada.
- Admite cuatro formas de llamada: unaria (una petición, una respuesta), *streaming* del servidor, *streaming* del cliente y bidireccional.
- Errores con códigos fijos (`NOT_FOUND`, `UNAUTHENTICATED`, `ABORTED`…), plazos (*deadlines*) y metadatos, que es donde viaja el token.

## gRPC en el navegador

Un navegador no puede hablar gRPC nativo: `fetch` no da control sobre las tramas de HTTP/2 ni sobre los *trailers*. Hay dos protocolos pensados para el navegador, ambos con los mismos `.proto`:

| Protocolo | Cómo llega al servidor | Streaming desde el navegador |
|---|---|---|
| **gRPC-Web** | Un traductor delante del servidor gRPC (Envoy con su filtro `grpc_web`) o un servidor que lo hable directamente | Unaria y del servidor. No hay *streaming* del cliente ni bidireccional |
| **Connect** | Cualquier servidor que implemente Connect; las llamadas unarias son un `POST` con cuerpo protobuf o JSON y códigos HTTP normales | Unaria y del servidor por HTTP/1.1. El bidireccional exige HTTP/2 |

Los servidores de Connect hablan a la vez Connect, gRPC y gRPC-Web con el mismo código, y en el navegador `@connectrpc/connect-web` elige uno de los dos transportes (`createConnectTransport` o `createGrpcWebTransport`). Connect conserva los códigos de error de gRPC y los traduce a estados HTTP; por ejemplo, `unavailable` es 503.

## Qué cambia para ProteinForge

Hoy hay tres piezas:
- la web en Vercel;
- la API FastAPI en Vercel, con REST, JSON y errores RFC 9457;
- Supabase para identidad y datos.

Todo el cálculo científico (descriptores, perfil, alineamiento en WebAssembly, búsqueda de candidatos, informes) corre dentro del navegador en Workers y no cruza la red.

**Dónde encaja gRPC:**

1. **Navegador ↔ API.** Cuenta, proyectos y consulta de UniProt son llamadas tipadas con contrato estable: el caso de uso típico de Connect o gRPC-Web.
2. **API ↔ ejecutor de diseño.** El laboratorio previsto necesita una máquina con GPU separada de Vercel y trabajos largos con progreso. Es el uso más natural de gRPC nativo: de servidor a servidor, HTTP/2 y *streaming* del servidor para el progreso.

**Dónde no encaja:**
- El cálculo local (Workers/WASM) no tiene red de por medio; pasarlo por gRPC lo haría más lento, dependiente del servidor y menos privado.
- Supabase Auth y las descargas de RCSB son servicios de terceros con su propia API; se siguen usando tal cual.

**La restricción de Vercel.** Las funciones de Python en Vercel ejecutan aplicaciones ASGI petición a petición, y la documentación oficial no menciona HTTP/2 con *trailers* ni servidores gRPC de larga vida. Por eso:
- **No cuento con gRPC nativo en Vercel.**
- **Connect y gRPC-Web sí deberían funcionar en Vercel:** son peticiones HTTP normales, y Vercel admite respuestas en *streaming* en Python dentro de la duración máxima (300 s por defecto en el plan gratuito con Fluid compute).
- **Comprobado en local:** Uvicorn sirve Connect y gRPC-Web; Hypercorn (HTTP/2) sirve además gRPC nativo. Falta comprobarlo en una vista previa de Vercel.

## Arquitectura

```text
Navegador (React)                     Vercel: API FastAPI                      Máquina con GPU
 connect-web + código generado  ──►    /v1/*  REST (se conserva)
   gRPC-Web (POST, protobuf binario)    /proteinforge.<paquete>.<Servicio>/<Método>  ──►  ejecutor de diseño
                                        gRPC-Web, Connect y gRPC nativo          gRPC nativo, HTTP/2,
                                        mismas funciones de dominio y reglas     streaming de progreso
                                        (Supabase con el token del usuario)      (pendiente)
```

- Los `.proto` viven en el backend, que es dueño de los contratos.
- Los servicios están en la raíz de la API (los clientes gRPC nativos no admiten prefijo de ruta). Un enrutador ASGI delante de FastAPI envía `/proteinforge.*` a los servicios generados y el resto a REST; CORS y la correlación envuelven ambos.
- Cada método reutiliza las funciones de dominio, la validación Pydantic, la identidad y el acceso a Supabase de REST. Los errores llegan como códigos gRPC con un mensaje estable que nunca incluye datos enviados.
- El navegador llama con `Authorization: Bearer` y `X-Request-Id` igual que antes. CORS admite las cabeceras de Connect y gRPC-Web y expone `Grpc-Status`, `Grpc-Message` y `X-Request-Id`. La CSP no cambia: el origen de la API es el mismo.
- Sin conexión no cambia nada: el cálculo sigue siendo local, y las llamadas remotas fallan con las mismas categorías de error que la interfaz ya explica.

### En el frontend

- `src/gen/`: código generado por `protoc-gen-es` (versionado, no editar).
- `src/features/api/rpc.ts`: transporte gRPC-Web (binario, sin cookies ni redirecciones, tiempo máximo `API_TIMEOUT_MS`) y conversión de códigos gRPC a `ApiError` (`UNAUTHENTICATED`→sesión, `ABORTED`→conflicto, `NOT_FOUND`, `INVALID_ARGUMENT`→validación, `FAILED_PRECONDITION` con `projects-schema-unavailable`→esquema, fallo de `fetch`→red, respuesta que no es gRPC-Web→respuesta inválida).
- `src/features/api/timestamps.ts`: `Timestamp` ⇄ ISO sin perder dígitos; la fecha de actualización de un proyecto es el control de concurrencia y debe volver exacta.
- `apiClient.ts` (`AccountService`), `projectApi.ts` (`ProjectService`) y `libraryApi.ts` (`ReferenceService`) conservan su interfaz para la UI; las respuestas se convierten a los documentos de siempre y pasan por los mismos esquemas zod. La lista de proyectos pagina con `nextPageToken` opaco en lugar de un desplazamiento numérico.
- Pruebas: `src/test/grpcWeb.ts` codifica y decodifica el formato real de gRPC-Web; las unitarias responden a `fetch` con él y las E2E (`e2e/rpc.ts`) cumplen las rutas con él.

## Contratos

Archivos en `backend/proto/proteinforge/`. Pasan `buf lint` con las reglas STANDARD y compilan con `buf build` (Buf 1.73.0).

| Servicio | Archivo | RPC | Equivale a |
|---|---|---|---|
| `AccountService` | `account/v1/account_service.proto` | `GetStatus`, `GetMe` | `GET /v1/health`, `GET /v1/me` |
| `ProjectService` | `project/v1/project_service.proto` + `workspace.proto` | `ListProjects`, `GetProject`, `CreateProject`, `UpdateProject`, `DeleteProject` | `/v1/projects` |
| `ReferenceService` | `reference/v1/reference_service.proto` | `SearchEntries`, `GetEntry` | `/v1/uniprot/*` |
| `DesignService` (borrador) | `design/v1alpha1/design_service.proto` | `StartDesign`, `WatchDesign` (*streaming*), `GetDesign`, `CancelDesign` | Nada todavía: laboratorio previsto |

**Decisiones de forma:**

- **Mismos campos y límites que los modelos Pydantic y los esquemas zod actuales.** El *workspace* replica `schemaVersion 1`: procedencia, descriptores y alineamiento con sus enumeraciones (matriz, modo, huecos terminales). Los límites (100.000 residuos, 5.000 por secuencia alineada, nombres de 1–120 caracteres) están anotados en los comentarios y los sigue aplicando el servidor.
- **Fechas como `google.protobuf.Timestamp`.**
  - La concurrencia optimista pasa de `expectedUpdatedAt` a `expected_update_time`.
  - Un conflicto devuelve `ABORTED`, que Connect traduce a 409, el mismo estado que hoy.
- **Paginación con `page_token` opaco en lugar de `offset`,** según la guía de diseño de APIs de Google. Internamente puede seguir siendo un desplazamiento.
- **Errores:** los `type` de RFC 9457 pasan a códigos de gRPC.

  | RFC 9457 hoy | Código gRPC |
  |---|---|
  | `project-not-found` | `NOT_FOUND` |
  | `project-conflict` | `ABORTED` |
  | validación | `INVALID_ARGUMENT`, con detalles que nombran campos y nunca valores de secuencias |
  | sin token | `UNAUTHENTICATED` |
  | esquema no preparado | `FAILED_PRECONDITION` |
  | servicio externo caído | `UNAVAILABLE` |

  El identificador de correlación viaja en la cabecera `X-Request-Id` como hoy.
- **Lecturas con `idempotency_level = NO_SIDE_EFFECTS`,** para que Connect pueda usarlas por `GET` y cachearlas si interesa.
- **`DesignService` va en `v1alpha1`:** no promete compatibilidad hasta que la primera prueba real del laboratorio diga qué producen las herramientas.
  - Exige consentimiento explícito porque la secuencia sale del navegador.
  - La confianza por residuo (pLDDT) se documenta como confianza del predictor, no como función.
- **Validación:** sigue en Pydantic y en zod al principio. Añadir `protovalidate` para declararla en el propio `.proto` es una mejora opcional; requiere aprobar la dependencia.

## Dependencias

Aprobadas e instaladas con versión fija el 15 oct 2026.

| Dónde | Paquete | Versión | Estado | Para qué |
|---|---|---|---|---|
| API | `connectrpc` | 0.12.1 | Beta | Servidor ASGI de Connect, gRPC y gRPC-Web dentro de FastAPI |
| API | `protobuf-py` (+ `protobuf-py-ext`) | 0.6.0 | Alfa | Mensajes protobuf en Python |
| API | `pyqwest` | 0.12.0 | Beta | Cliente HTTP de `connectrpc` |
| API, desarrollo | `protoc-gen-py`, `protoc-gen-connectrpc`, `hypercorn` | 0.6.0, 0.12.1, 0.18.0 | — | Generación de código y servidor HTTP/2 local para probar gRPC nativo |
| Ejecutor | `grpcio` | 1.84.0 | Estable | Servidor gRPC nativo para el laboratorio (sin instalar) |
| Web | `@connectrpc/connect`, `@connectrpc/connect-web` | 2.2.0 | Estable | Cliente gRPC-Web en el navegador |
| Web | `@bufbuild/protobuf` | 2.16.0 | Estable | Mensajes en TypeScript |
| Web, desarrollo | `@bufbuild/buf`, `@bufbuild/protoc-gen-es` | 1.73.0, 2.16.0 | Estable | Lint, cambios incompatibles y generación de código |

**Riesgo principal:** el servidor Python de Connect es beta y depende de un runtime protobuf alfa. Las pruebas de contrato del backend cubren cada servicio para detectar regresiones al actualizar.

**Alternativa estable:** `grpcio` detrás de Envoy para gRPC-Web. Exige un servidor con HTTP/2 propio fuera de Vercel; por eso se usa Connect en Vercel y `grpcio` solo en el ejecutor.

## Sincronización entre repositorios

Los dos repositorios son independientes.

- **Backend:** `buf.yaml` ya define el módulo, el lint y la comprobación de cambios incompatibles (`buf breaking`) contra `main`.
- **Backend:** el código Python generado se versiona en `app/rpc/gen/`; CI ejecuta `buf lint`, regenera y falla si difiere.
- **Frontend:** `buf.gen.yaml` toma como entrada el repositorio del backend en un commit fijo (`ref`). Tras cambiar un contrato: actualizar `ref` y ejecutar `npx buf generate`.
  - El código generado se versiona en `src/gen/`, como ya se hace con el paquete WASM.

No hace falta el Buf Schema Registry ni ningún servicio de pago.

## Estado por fases

1. **Prueba técnica** — hecha en local con los tres protocolos. Pendiente: vista previa de Vercel.
2. **Dominios existentes** — hecho. `AccountService`, `ProjectService` y `ReferenceService` servidos junto a REST; el frontend usa solo gRPC-Web.
3. **Laboratorio de diseño** — pendiente. Ejecutor con `grpcio` y `DesignService` en la máquina con GPU; la API lo llama por gRPC nativo y reexpone `WatchDesign` al navegador con *streaming* del servidor. Depende de la prueba real del laboratorio.
4. **REST** — se conserva en el backend como compatibilidad, por indicación del profesor.

## Fuentes

- [connectrpc/connect-python](https://github.com/connectrpc/connect-python) y [PyPI connectrpc](https://pypi.org/project/connectrpc/): servidor ASGI/WSGI que habla Connect, gRPC y gRPC-Web.
- [Protocolo Connect](https://connectrpc.com/docs/protocol/) y [elección de protocolo en connect-web](https://connectrpc.com/docs/web/choosing-a-protocol/).
- [Migración a Connect-ES v2](https://connectrpc.com/docs/web/migrating-to-v2/).
- [gRPC-Web en ASP.NET Core](https://learn.microsoft.com/aspnet/core/grpc/grpcweb): límites de *streaming* en navegador y papel de Envoy.
- [gRPC-Web por dentro (Kreya)](https://kreya.app/blog/grpc-web-deep-dive/).
- [FastAPI en Vercel](https://vercel.com/docs/frameworks/backend/fastapi), [funciones con streaming](https://vercel.com/docs/functions/streaming-functions) y [límites de duración](https://vercel.com/docs/functions/limitations).
- Versiones comprobadas en PyPI y npm el 15 oct 2026.
