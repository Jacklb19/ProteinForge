# RF-18 y persistencia de candidatos y predicciones · propuesta

Preparada el **22 oct 2026**. Requiere decisión del propietario antes de implementar. No se habilitó proveedor, no se envió ninguna secuencia, no se crearon tablas ni se aplicaron migraciones. Concreta los pendientes que [decisiones por concretar](propuestas.md) y la [definición vigente](definicion-proyecto.md) dejan abiertos para RF-17 y RF-18.

Estado real: el generador local guarda su candidato seleccionado en un proyecto, pero **no** la ejecución completa de búsqueda ([candidatos](candidates.md)); el laboratorio guarda variantes, resultados y borradores dentro del snapshot `workspace` v2 ([contrato](laboratory-projects.md)); no existe ruta de predicción activa ni tabla de predicciones. La única prueba histórica de un proveedor público fue una respuesta puntual de ubiquitina, que no habilita un servicio.

## Lo que se decide

1. Quién predice: ejecutor propio ([propuesta de inferencia](app-inference-proposal.md)), proveedor público, o nadie todavía.
2. Dónde se guardan candidatos y predicciones: dentro del snapshot existente, en tablas nuevas, o ambos con caché.
3. Qué consentimiento se pide y con qué texto.
4. Retención y cuotas: cuánto se conserva y qué se borra.
5. Si se guarda el historial completo del generador o solo el candidato elegido.

## Opciones de persistencia

| | A · Dentro del snapshot (recomendada) | B · Tablas nuevas | C · A + caché del proveedor |
|---|---|---|---|
| Esquema | Ninguna tabla nueva; `workspace` ya acepta documentos versionados | `design_candidates` y `predictions` con RLS y `SECURITY INVOKER` | A, más `external_cache` o tabla propia de servidor |
| Migración | Solo validación/proyección si cambia el sobre | Migración nueva completa, grants y pruebas RLS reales | Igual que A, más la caché |
| Límites | 1.000.000 bytes de documento y 2.000.000 por mensaje RPC, ya acordados | A definir por fila y por propietario | Igual, más clave y retención de caché |
| Consultas | Abrir un proyecto; la lista solo lleva presencia y cantidad | Listar/filtrar predicciones por propietario | Igual que A |
| Coste de trabajo | Bajo; reutiliza concurrencia y propiedad existentes | Alto: contratos, SQL, pruebas y clientes | Medio |
| Riesgo | Un proyecto grande se acerca al límite del documento | Duplica información que ya vive en el snapshot | Repetir una predicción idéntica ahorra envío |

Se recomienda **A**, y **C** solo si se habilita un proveedor externo de verdad: la caché evita reenviar la misma secuencia. **B** se justifica únicamente si el propietario quiere listar y comparar predicciones fuera de un proyecto, que hoy nadie pidió.

Cuotas del plan Free de Supabase publicadas el 22 oct 2026: **500 MB de base de datos, 1 GB de archivos y 5 GB de egreso** (más 5 GB en caché). Un PDB predicho de 76 residuos ocupa decenas de kilobytes, así que una demo de dos o tres diseños cabe con holgura; guardar estructuras grandes o muchas ejecuciones no. Mientras los tamaños sean estos, **no hace falta activar Storage**.

## Contrato propuesto para la predicción

Revisable; no es contrato implementado. Mantiene la equivalencia REST / gRPC-Web ya vigente.

- `POST /v1/predictions` autenticado, **una** secuencia por solicitud deliberada, máximo **300 residuos** (coherente con el generador; el laboratorio sigue en 120). Sin lote, sin reintento automático, sin precalentar.
- Cuerpo: secuencia, origen (candidato del generador o variante del laboratorio), proveedor elegido y consentimiento explícito. Sin consentimiento, error de precondición; el consentimiento del asistente no sirve aquí.
- Validación de la respuesta antes de guardarla o mostrarla: tamaño, registros ATOM, cadena explícita, residuos estándar, coordenadas finitas y **secuencia idéntica** a la enviada. Procedencia obligatoria: proveedor, modelo, versión, fecha y hash del archivo. La confianza se muestra solo si el proveedor la documenta, con su escala.
- Un fallo del proveedor es visible: error y reintento deliberado, nunca coordenadas de respaldo presentadas como predicción nueva. Los fixtures públicos trazables siguen siendo material identificado de demostración.
- Etiquetado en el visor: experimental, de referencia y **predicha** no se confunden; una edición posterior de la secuencia invalida la predicción asociada, como ya hace el laboratorio.

## Retención y cuotas

- Caché privada de servidor con clave SHA-256 de secuencia + proveedor + versión, sin `service_role` para clientes y sin acceso de usuarios, como `external_cache` hoy.
- Opciones de retención a elegir: **(i)** conservar hasta que el propietario borre el proyecto, **(ii)** caducar la caché a 90 días, **(iii)** no cachear y repetir el envío. Recomendada **(ii)**.
- Cuota propia por propietario y día, para no cargar un proveedor compartido ni la base gratuita. No se aplican pruebas de carga a proveedores públicos.

## Historial del generador

Hoy se guarda el candidato elegido y sus análisis, no la ejecución. Si el propietario quiere trazabilidad completa de RF-17 (condiciones, semilla, versión, presupuesto, ambos brazos y archivo acotado), cabe como documento versionado dentro del mismo snapshot, con un tope de bytes propio y la misma validación de forma sin recalcular ciencia en la API. Decisión 5: guardar historial completo, o seguir exportando el JSON localmente.

## Comprobación exigida

Pruebas de API con transporte simulado, SQL real local con PostgreSQL temporal para propiedad, concurrencia y rechazo de versiones antiguas, equivalencia REST/gRPC-Web, Buf lint y breaking, y E2E solo del recorrido afectado. Un proveedor externo se prueba primero con **una** solicitud real del propietario, documentando respuesta, tiempo y límites; nunca se declara disponible por una respuesta correcta.

## Lo que no incluye

Habilitar un proveedor de inferencia por su cuenta, Storage, lotes, sincronización entre dispositivos, colaboración simultánea, gasto, publicación ni migraciones remotas. Cualquier pantalla o aviso nuevo necesita maqueta aprobada y textos simultáneos en `es.ts` y `en.ts`.

## Decisión pedida

- **Opción A:** aprobar la persistencia dentro del snapshot y dejar la predicción sin proveedor hasta que exista ejecutor propio.
- **Opción C:** aprobar A y, además, el contrato de predicción con caché de 90 días y el proveedor que el propietario indique.
- **Opción B:** pedir tablas propias de candidatos y predicciones, con su migración y pruebas.
- **Opción D:** no tocar persistencia ahora.

Fuentes: [precios y cuotas de Supabase](https://supabase.com/pricing), [contratos de API](../../backend/docs/api.md), [persistencia de proyectos](../../backend/docs/project-persistence.md), [RF-17 implementado](candidates.md), [laboratorio en Proyectos](laboratory-projects.md), [límites de funciones en Vercel](https://vercel.com/docs/functions/limitations).
