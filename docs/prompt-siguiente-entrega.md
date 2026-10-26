# Relevo de desarrollo — ProteinForge

Actualizado el **25 de octubre de 2026**. Hay desarrollo paralelo activo; no interpretar este relevo como autorización de publicación o de un nuevo contrato. Las instrucciones actuales del propietario y los AGENTS prevalecen.

## Lectura y reglas

Leer completo este archivo, los AGENTS de raíz/frontend/backend y las últimas entradas de los dos PROGRESS. La raíz no tiene Git; frontend/backend son repositorios independientes. Trabajar en sus dev, conservando el trabajo de los demás. [Plan paralelo local](../../parallel-development.md).

Documentación y respuestas en español; código/comentarios/commits en inglés. Autor y committer exclusivamente Jacklb19 <jose.burbanob@campusucc.edu.co>, sin firmas, coautores o menciones a herramientas en commits/merges/GitHub. Commits pequeños; no forzar AGENTS, PROGRESS, propuestas, secretos, modelos, dependencias ni artifacts al índice.

Costo cero estricto, sin tarjeta. No instalar ni ejecutar modelos en Windows. Sin push/merge/publicación, SQL remoto, cambios de servicios o secretos por esta continuación. El usuario autorizó el 25 de octubre reanudar los dos chats y que el coordinador programe trabajo independiente; también autorizó enviarles esos mensajes. No extenderlo a mensajes ajenos ni a gastos.

La composición visual nueva requiere maqueta/plan aprobados; no bloquear lógica y pruebas independientes por ello. El asistente y laboratorio existentes ya tienen composición aprobada. Todo texto visible va en español/inglés en el mismo cambio.

## Publicación ya resuelta

Última publicación comprobada, del 23 de octubre: frontend main3562c0c y backend mainc2d127c, CI de producción y Vercel correctos. No hubo nueva comprobación remota/fetch el 25. La lectura autenticada con Groq en producción y su clave/retención remotas siguen sin verificar; no atribuir ese resultado a pruebas simuladas.

Laboratorio/proyectos y migraciones ya publicados/aplicados. El propietario hizo las migraciones: no repetirlas ni solicitar publicar otra vez la entrega anterior. Guardado/apertura/edición/copia/conflicto/borrado e independencia entre cuentas se probaron con proyectos propios ya eliminados; lectura directa por ID con segunda cuenta sigue sin comprobar.

buf.gen.yaml ya fija el backend publicado c2d127c3ea4ed8af91b3cace9fcebd8390129a52 con AssistantService. **La advertencia anterior sobre pin5b6c450 está resuelta.** No cambian contratos RPC en esta continuación. Si se aprueba un contrato nuevo: backend publicado primero, luego actualizar pin/regenerar/confirmar y al final frontend. No publicar contra un contrato remoto inexistente.

## Integración local de las primeras entregas paralelas

Frontend dev partía de4404997; se revisaron e incorporaron siete commits por cherry-pick, sin tocar las ramas de los chats:

- b7cc4b3 / 5c70c03 / b6b15a8 / 5dc776b: menú móvil, carga diferida y herramientas/evidencia de calidad S7.
- 829fcb9 / 49033f2 / 51933be: núcleo SIFTS, adaptador Mol*, puente opcional y propuesta de suministro/recorrido.

La revisión documental posterior se confirma aparte; consultar HEAD/PROGRESS. No se activó el puente en Biblioteca ni se implementó un nuevo selector o servicio público. [Referencias](references.md), [calidad S7](quality-s7.md).

Verificación de esta combinación: **381 unitarias/70 archivos**, cobertura86,14/76,57/83,09/89,53%; tipos/lint/build correctos. **51 E2E Chromium sin omisiones**: shell/responsive/loading/assistant/library/projects/projects-collection/reports, un trabajador, puerto5330. Auth/RPC simulados, BinaryCIF público fixture; no sesiones/escrituras del propietario. PWA5331 correcta,46recursos: fuentes,Workers/WASM,PDF,laboratorio/cuaderno/edición/archivo offline; Mol* fuera de precache. Capturas nuevas revisadas. Avisos previos Vite/fuentes/chunks conservados.

**Atención:** S7 encontró después carreras al cerrar sesión durante un import aplazado (escritura pendiente y lectura visible). Está corrigiéndolas en su segunda entrega; todavía no están integradas aquí. No declarar resuelto ese hallazgo por la batería de la entrega inicial ni publicar sin revisar las regresiones nuevas.

## Chats activos y reservas

- **ProteinForge · S7 calidad y rendimiento**: 01a16ab0-a33d-7853-96bb-4e1376d07849, worktree-quality, rama parallel/quality, puertos5310–5319. Continúa compatibilidad Firefox/WebKit, carreras de sesión, aislamiento accesible y causa medida de LCP/tareas largas. Ya pudo abrir Firefox/WebKit; las comprobaciones completas de esa nueva entrega están pendientes.
- **ProteinForge · S5 sincronización 3D**: 01a16ab0-c9f9-7440-83ad-acb1096f8745, worktree-sifts, rama parallel/sifts, puertos5320–5329. Continúa integridad/memoria, vínculo a versión/hash de referencia completa, regresiones del puente y maqueta/plan revisables.
- **Coordinador actual**: frontend/dev, backend/dev y documentación general. Reserva modelado gratuito, backend y revisión/integración. Puertos5330–5339.

No rebase/mergear ni escribir en sus worktrees mientras estén trabajando. No mezclar sus commits nuevos con los siete iniciales ya incorporados. Leer resultados compactos con wait_threads; no asumir que terminaron por una nota de progreso. No detener procesos ajenos; máximo2workers unitarios/1E2E por frente. Las mediciones de rendimiento deben declarar carga concurrente del equipo.

## Desarrollo propio del backend: SIFTS interno

Backend dev añade474944d (adquisición/normalización y pruebas) y f889396 (utilidad/documentación), a partir de1092acf. [Diseño y verificación](../../backend/docs/sifts.md).

app/sifts.py obtiene XML gzip SIFTS y residue_listing PDBe con hosts fijos, sin credenciales heredadas/redirecciones, descarga y expansión acotadas, plazo/cancelación y rechazo de DTD/JSON/datos contradictorios. Normaliza identidades explícitas; conserva cadenas, autor textual/null e inserciones; no interpola rangos ni atribuye un modelo de coordenadas a SIFTS. Es una función interna: **no existe ruta REST/RPC nueva, cuota pública, caché SQL ni migración**.

17 pruebas nuevas. Batería completa final:88tests totales,76ejecutados correctos y12SQL omitidos sin base; no nueva comprobación PostgreSQL. Python3.13.14 local,3.14 objetivo. Sin cambios en paquetes/proto/generados. Consulta manual pública de dosGET:1TRZ/P01308 devuelve102filas,A/B/C/D, documento2026-10-18. JSON pasó el esquema frontendv1. El ensayo de enlace usó direcciones sintéticas explícitas para comprobar ambigüedad A/C; no prueba visor/backend autenticado.

Repetición local sin red desde backend: .venv/Scripts/python.exe -m scripts.sifts_smoke 1TRZ --xml tests/fixtures/sifts/1trz.xml --listing tests/fixtures/sifts/1trz.json. La variante sin --xml/--listing consulta deliberadamente las dos fuentes públicas. No carga .env; certificados/nombre verificados. Salida en artifacts/sifts ignorado.

Antes de activar: acordar contrato autenticado y cuota por identidad, verificar versión/hash UniProt, completar UI aprobada y recorridos de selección/vigencia. El límite interno de adquisición10MB **no amplía** el máximo RPC de2.000.000bytes; rechazo explícito o segmentación aprobada, sin truncar filas.

## Modelado y alcance

Laboratorio actual: tres rediseños reales de 1UBQ A obtenidos en Colab, selección secuencia/3D, edición/protección/deshacer, variantes y persistencia. Editar secuencia retira estructura/confianza anteriores; no calcula ni deforma coordenadas. Arrastrar átomos con simulación física no forma parte del alcance actual.

No hay inferencia estructural desde la app ni forma nueva comprobada. Cuenta HF recién creada: el formulario real solo habilitó Static gratuito y bloqueó Gradio/Docker pidiendoPRO. No se creó recurso ni registró tarjeta. Modelo públicoRFD4 abrió controles, pero su editor AtomWorks quedó vacío; no se pulsóGenerate ni se obtuvo diseño. No atribuir inferencia al estadoRunning. Un CIF externo requiere adaptación validada al importador de campañas, no importación ciega.

El propietario reafirmó que no tiene presupuesto para gastar. Modal anuncia crédito mensual pero permite cargos: no registrar tarjeta por iniciativa propia ni prometer costo cero. NVIDIA Trial limita su servicio a evaluación interna y no resuelve backend público; las licencias abiertas de modelos son distintas. Colab sigue manual, sin túneles/servicio. No repetir instalación Windows.

## Siguiente trabajo

Revisar las nuevas entregas cuando terminen, especialmente las regresiones de sesión. Integrar localmente de forma secuencial, verificar identidad y cambios compartidos y ejecutar comprobaciones proporcionales. Mantener suministro SIFTS/maqueta pendientes de aprobación concreta; avanzar programación independiente. Conseguir una prueba de modelado gratuita verificable antes de ampliar ese flujo. Actualizar estados distinguiendo local/probado/publicado/pendiente y pedir autorización antes de nuevas operaciones remotas.
