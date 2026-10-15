# gRPC en ProteinForge

Evaluación del 15 de octubre de 2026, por el nuevo requisito del curso: el proyecto debe usar gRPC. Contratos escritos en el backend (`backend/proto/`); implementación pendiente de las decisiones del final.

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
- **Comprobarlo es el primer paso:** está pendiente montar la librería en una vista previa de Vercel y probarla.

## Arquitectura propuesta

```text
Navegador (React)                     Vercel: API FastAPI                      Máquina con GPU
 connect-web + código generado  ──►    /v1/*   REST actual (se conserva)
   Connect (POST, protobuf/JSON)       /rpc/*  servicios Connect/gRPC-Web  ──►  ejecutor de diseño
   o gRPC-Web                           mismos dominios, mismas reglas        gRPC nativo, HTTP/2,
                                        (Supabase con el token del usuario)   streaming de progreso
```

- Los `.proto` viven en el backend, que es dueño de los contratos.
- La API monta los servicios Connect en la misma aplicación FastAPI, bajo `/rpc`, y reutiliza la validación, la identidad y el acceso a Supabase que ya existen. REST y RPC conviven mientras se migra; quitar REST es una decisión aparte.
- El navegador llama con `Authorization: Bearer` igual que hoy. CORS debe aceptar además las cabeceras de Connect y gRPC-Web (`Connect-Protocol-Version`, `Connect-Timeout-Ms`, `X-Grpc-Web`, `X-User-Agent`) y exponer `Grpc-Status` y `Grpc-Message`. La CSP no cambia, porque el origen de la API es el mismo.
- Sin conexión no cambia nada: el cálculo sigue siendo local, y las llamadas remotas fallan con un error claro igual que hoy.

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

## Dependencias necesarias

Ninguna instalada; todas requieren tu visto bueno. Versiones consultadas el 15 oct 2026.

| Dónde | Paquete | Versión | Estado | Para qué |
|---|---|---|---|---|
| API | `connectrpc` | 0.12.1 | Beta | Servidor ASGI de Connect, gRPC y gRPC-Web dentro de FastAPI |
| API | `protobuf-py` | 0.6.0 | Alfa (dependencia de la anterior) | Mensajes protobuf en Python |
| API | `pyqwest` | 0.12.0 | Beta (dependencia) | Cliente HTTP de `connectrpc` |
| Ejecutor | `grpcio` | 1.84.0 | Estable | Servidor gRPC nativo HTTP/2 para el laboratorio |
| Web | `@connectrpc/connect`, `@connectrpc/connect-web` | 2.2.0 | Estable | Cliente en el navegador |
| Web | `@bufbuild/protobuf` | 2.16.0 | Estable | Mensajes en TypeScript |
| Desarrollo | `@bufbuild/buf`, `@bufbuild/protoc-gen-es` | 1.73.0, 2.16.0 | Estable | Lint, detección de cambios incompatibles y generación de código |

**Riesgo principal:** el servidor Python de Connect es beta y depende de un runtime protobuf alfa.

**Alternativa estable:** `grpcio` detrás de Envoy para gRPC-Web. Exige un servidor con HTTP/2 propio fuera de Vercel (contenedor o máquina virtual), y con eso desaparece el costo cero o cambia el alojamiento. Por eso recomiendo Connect en Vercel, probado primero con una prueba corta, y `grpcio` solo en el ejecutor.

## Sincronización entre repositorios

Los dos repositorios son independientes.

- **Backend:** `buf.yaml` ya define el módulo, el lint y la comprobación de cambios incompatibles (`buf breaking`) contra `main`.
- **Frontend:** genera su código con `buf generate` usando como entrada el repositorio del backend en una etiqueta concreta (Buf admite repositorios git como entrada).
  - El código generado se versiona en `src/gen/`, como ya se hace con el paquete WASM.
  - CI vuelve a generarlo y falla si difiere.

No hace falta el Buf Schema Registry ni ningún servicio de pago.

## Plan por fases

1. **Prueba técnica (1 servicio).**
   - Montar `AccountService` con `connectrpc` bajo `/rpc` en FastAPI y publicarlo en una vista previa de Vercel.
   - Comprobar desde el navegador la llamada Connect y la llamada gRPC-Web, CORS, errores, y una llamada nativa gRPC desde un script local, que en Vercel probablemente falle (y queda documentado).
   - Criterio de paso: funciona en Vercel sin servidor adicional.
2. **Dominios existentes.**
   - `ReferenceService` y `ProjectService` por RPC, en paralelo a REST, reutilizando las funciones actuales.
   - El frontend cambia sus clientes (`libraryApi`, `projectApi`) por clientes generados, con la misma interfaz para la UI.
   - Pruebas unitarias de los manejadores, E2E con respuestas simuladas (una llamada Connect unaria es un `POST` JSON fácil de simular) y las pruebas RLS que ya existen.
3. **Laboratorio de diseño.**
   - Ejecutor con `grpcio` y `DesignService` en la máquina con GPU; la API lo llama por gRPC nativo y reexpone `WatchDesign` al navegador con *streaming* del servidor.
   - Depende de la prueba real del laboratorio (forma → secuencia → predicción) y de dónde se ejecute.
4. **Decisión sobre REST.** Mantenerlo como compatibilidad o retirarlo cuando todo el frontend use RPC.

## Decisiones pendientes

1. **Alcance que exige el profesor:** ¿basta con que un servicio real use gRPC (por ejemplo, el ejecutor del laboratorio), o la comunicación de la app con su API debe pasar a gRPC?
2. **Protocolo del navegador:** Connect (recomendado: errores HTTP legibles, JSON depurable) o gRPC-Web (más «gRPC» de nombre, mismo código).
3. **Aprobar las dependencias** de la tabla, empezando por las de la prueba técnica.
4. **REST:** ¿convive con RPC o se retira al final?

## Fuentes

- [connectrpc/connect-python](https://github.com/connectrpc/connect-python) y [PyPI connectrpc](https://pypi.org/project/connectrpc/): servidor ASGI/WSGI que habla Connect, gRPC y gRPC-Web.
- [Protocolo Connect](https://connectrpc.com/docs/protocol/) y [elección de protocolo en connect-web](https://connectrpc.com/docs/web/choosing-a-protocol/).
- [Migración a Connect-ES v2](https://connectrpc.com/docs/web/migrating-to-v2/).
- [gRPC-Web en ASP.NET Core](https://learn.microsoft.com/aspnet/core/grpc/grpcweb): límites de *streaming* en navegador y papel de Envoy.
- [gRPC-Web por dentro (Kreya)](https://kreya.app/blog/grpc-web-deep-dive/).
- [FastAPI en Vercel](https://vercel.com/docs/frameworks/backend/fastapi), [funciones con streaming](https://vercel.com/docs/functions/streaming-functions) y [límites de duración](https://vercel.com/docs/functions/limitations).
- Versiones comprobadas en PyPI y npm el 15 oct 2026.
