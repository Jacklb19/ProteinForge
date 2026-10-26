# Relevo de desarrollo — ProteinForge

Actualizado el **26 de octubre de 2026**. Leer este documento completo, los AGENTS de raíz/frontend/backend y las últimas entradas de ambos PROGRESS. La raíz no tiene Git; frontend y backend son repositorios independientes.

## Publicación completada y pendientes reales

**Publicación autorizada expresamente el 26 oct:** el propietario responde «sí» a publicar dev y actualizar main de ambos repositorios, backend primero y frontend después de actualizar/regenerar el contrato. No repetir esa petición para esta entrega. También aprobó maqueta y suministro SIFTS: «Sí, implementar interfaz y suministro SIFTS».

Backend dev `1443dd9` y main `a3edaf1d7a43ada2b2bbf9113ff9ccef7f123a57` publicados; CI de ambos correcta, incluida Python 3.14. Frontend dev `2e2f02f` y main `6ff8db11c1b78b42258d8a0bde77ff773e52d308` publicados después de actualizar el pin al backend publicado y regenerar sin diferencias. CI general, WASM y despliegues correctos. No repetir esta publicación; futuras entregas requieren su propia autorización. Conservar el orden backend→pin/regeneración→frontend cuando vuelva a cambiar el contrato.

SIFTS autenticado real comprobado en producción con P01308/1TRZ: ambigüedad A/C, cadena A explícita y posiciones UniProt 90→autor A:1 y 110→A:21; transferencia Biblioteca/Analizar y coordenadas cargadas. Sesión existente restaurada por el navegador, sin extraer credenciales, guardar proyectos o enviar secuencias privadas. Una lectura de cifras públicas con Groq mostró error: falta diagnóstico; no atribuirlo a clave/modelo/proveedor sin evidencia. Clave/retención y acceso directo por ID con segunda cuenta siguen sin certificar. No repetir migraciones ya aplicadas.

## Próxima conversación: orden propuesto

1. Distinguir evidencia existente de pruebas nuevas: **ya hay tres rediseños completos de 1UBQ A con predicción ESMFold, métricas y ZIP importable**. No afirmar que ProteinForge carece de diseños completos. Ver [tres variantes](design-lab-three-variants.md) y [guía de ejecución rápida](modeling-next-run.md). El CIF fragmentario de RFD4 es otro ensayo y no sustituye esos resultados.
2. El propietario quiere ejecutar él mismo el caso completo para avanzar rápido. Esperar el ZIP y el cuaderno con salidas, o la ruta exacta donde los guarde. Validar integridad, secuencia completa, coordenadas, procedencia, confianza y comparación; no anunciar un resultado nuevo antes de recibirlo. Repetir semilla 42 reproduce el mismo ensayo, no crea diversidad nueva garantizada.
3. Si el objetivo sigue siendo RFD4/ZeroGPU: obtener allí una entrada/salida completa y predicción independiente. El cuaderno actual usa ProteinMPNN+ESMFold sobre 1UBQ; no valida automáticamente cualquier CIF de RFD4. Falta esa adaptación y no hay ejecutor propio gratuito habilitado.
4. Diagnosticar el error real de Groq en producción sin solicitar/exponer secretos. Conservar validación de cifras; no desactivarla para aparentar éxito.
5. Acordar ejecutor público viable a costo cero, consentimiento, cuotas/cancelación/fallos, importación y persistencia RF-18/historial antes de ampliar contratos o interfaz. [Inferencia](app-inference-proposal.md), [persistencia](prediction-storage-proposal.md), [forma de novo](de-novo-proposal.md) siguen siendo propuestas, no aprobaciones generales.
6. Cerrar límites S7: WebKit offline/Safari/dispositivos, mediciones de rendimiento de campo y aislamiento por ID con segunda cuenta. Dominios/ensamblado siguen pendientes del alcance general. Sin prometer función o estabilidad experimental.

## Reglas vigentes

Trabajar en dev. Autor y committer exclusivamente Jacklb19 <jose.burbanob@campusucc.edu.co>, sin firmas, coautores o menciones a herramientas de IA en Git/GitHub. Commits pequeños en inglés; documentación/respuestas en español. Cada texto visible en es/en en el mismo cambio. No forzar AGENTS, PROGRESS, propuestas, artifacts, secretos o dependencias al índice.

Costo cero estricto, sin tarjeta ni modelos en Windows. No cambios de servicios/secretos, SQL remoto, cuentas nuevas o gastos por esta continuación. La autorización actual se limita a publicar esta entrega; no se extiende a entregas futuras. No repetir migraciones ya aplicadas por el propietario.

## S5: implementación integrada y publicada

[Maqueta y plan aprobados](references.md). Biblioteca añade posición, cadena y estado, conservando catálogo/consulta/visor y confirmación de reemplazo. «Ver selección en Analizar» transfiere una referencia exacta en memoria. Analizar conserva lector/editor/perfil; ese contexto abre el visor general en el lateral de forma diferida. El ejemplo habitual conserva su dibujo inmediato. No hay lector/editor nuevo en Biblioteca.

Selección bidireccional por filas SIFTS y coordenadas reales, con cadena explícita ante copias ambiguas. Conserva posición UniProt, autor textual/null, inserción, huecos y modelo; no interpola intervalos. Versión conocida y SHA-256 de toda la secuencia antes de habilitar selección. Editar, retirar procedencia, cambiar referencia/PDB/modelo/sesión o recibir respuesta nueva cierra el vínculo; respuestas/hashes antiguos no lo reactivan. Fallos de índice/mapeo dejan cámara y coordenadas válidas disponibles. Sin persistencia nueva o cambios del laboratorio.

Backend `b1fdbd8`: GET /v1/pdb/{pdb_id}/residue-mapping?accession=...&sequence_version=... y ReferenceService.GetResidueMapping, autenticados. UniProt fresco, versión/hash completos y accession exacta, sin recibir secuencias privadas. Presupuesto existente de referencias: 20/minuto por identidad/proceso; plazo de 20 s después de autenticar, fuentes y descargas acotadas. Caché pública por PDB: 300 s, cuatro entradas/4 MB serializados, sin identidad/secuencias/SQL. Respuesta REST y RPC binario/JSON completa hasta 2.000.000 bytes, sin truncamiento. Isoformas no habilitadas por este contrato. [Contrato y pruebas](../../backend/docs/sifts.md).

Tercera entrega S5 integrada: `b8e7499/65842bb/6f275d9/8f622fa`; las previas también están incorporadas. En worktree-sifts el generado sigue como diferencia local intencional, idéntico al canónico, fuera de sus commits para no duplicar `0f3166e`: conservar hasta decidir el cierre de esa copia.

## S7: calidad y límites

Integrados cierre de sesión durante imports aplazados, lecturas por propietario, diálogo móvil modal que aísla el fondo, contraste WebKit y reutilización numérica medida. CORP same-origin y cabeceras también en 304 conservan COOP/COEP. WASM verifica bytes y revalidación sin aceptar errores como éxito. [Evidencia](quality-s7.md).

Firefox 155 y WebKit 26.6 se ejecutaron en Windows. WebKit no transfiere canvas al Worker: aviso/tabla calculada comprobados, batería gráfica completa sin certificar. PWA limpia Chromium/Firefox comprobada; WebKit offline registra error interno. Windows/WebKit no certifica Safari, dispositivos físicos, lectores de pantalla o las dos versiones objetivo.

La transición online de PWA instalada a5de1cf→1893ff3 pasó en WebKit con el mismo origen/perfil: borrador conservado mientras espera; proyecto guardado recuperado tras cerrar/reabrir; descriptores/WASM funcionan con recursos antiguos sin CORP. No se invalidaron masivamente. No certifica recuperar texto sin guardar tras cerrar, árbol canónico posterior, producción u offline. Auditoría incorporada en `76efdb5/05a2ec4`; no cambia producto.

## Verificación combinada del 26 oct

- Frontend: tipos/lint/build correctos; **436 unitarias/77 archivos**. Cobertura 86,34/77,21/83,13/89,87 %, mínimos intactos. Build: 47 recursos/2902,96 KiB; avisos previos Vite/fuentes/chunk conservados.
- **76 recorridos Chromium completados**: 74 correctos en la matriz de 14 archivos; dos casos Colab inicialmente omitidos al faltar sus rutas, repetidos con campaña/resultado condicionado reales y 2/2 correctos. Incluye shell, responsive, loading, assistant, library, SIFTS, projects, collection, reports, editor, laboratorio, compatibilidad, alineamiento y WASM. Auth/RPC simulados; BinaryCIF/ZIP reales. Sin sesiones o escrituras del propietario.
- PWA del build integrado en 5331 correcta: navegación, fuentes, Workers/WASM, PDF, laboratorio/cuaderno/edición/archivo offline; Mol* excluido.
- Capturas Biblioteca/Analizar a 360 y 1280 px, ambos temas, inspeccionadas. Cabecera fija en medio de la captura completa corresponde al desplazamiento al tomarla.
- Backend: 104 totales, 92 correctas y 12 SQL omitidas sin base. Python 3.13.14 local; Python 3.14 comprobado después en CI al publicar. Buf lint/regeneración reproducibles; dos espacios finales emitidos por el generador Python se conservan sin editarlo a mano.
- Servicio Connect con identidad **simulada** y tres fuentes HTTPS reales: 102 filas, SV1, hash completo y 16.713 bytes JSON. Smoke offline con coordenadas reales: 102 ida/vuelta, 51 posiciones UniProt únicas y mutación fuera de cobertura rechazada.
- [Carga HTTP local](../../backend/docs/local-api-load.md): 500 solicitudes/300,006 s, cero errores, p95 de 16,262 ms. Identidad/almacenamiento simulados; no carga de proveedores reales, SQL o Vercel.

Logs frontend/artifacts/integration-2026-10-26-* y backend/artifacts/quality/local-api-load.json, ignorados. No atribuir LCP/INP de campo al nuevo árbol por mediciones históricas.

## Modelado: primera ejecución nueva en ZeroGPU

El 26 oct la demo oficial RFD4 devolvió Design 1 en el ejemplo público Inverse folding 2KL8, Thinking low, un diseño, semilla 42. El propietario autorizó expresamente **solo perfil público HF Jacklb** para el Space oficial; no repositorios privados/escritura/pagos. La concesión inicial se bloqueó automáticamente sin ese permiso; se completó tras recibirlo. Sin tarjeta, PRO, servicio propio o modelos Windows.

El propietario indicó C:\Users\josel\Desktop\designs\design-1.cif tras fallar la devolución de ruta de descarga; original intacto, copia validada en frontend/artifacts/modeling/rfd4-2kl8-2026-10-26. CIF de 80.169 bytes, 403 átomos/59 residuos, cadena A/modelo 1, coordenadas finitas y secuencia coherente. **Fragmentos 1–7/28–79, salto CA de 21,425 Å y C–N de 23,688 Å**: no tratar como cadena completa lista para el laboratorio. Sin pLDDT certificado, pesos/versiones completos, predicción independiente, utilidad biológica o medición de GPU/cuota/tiempo. Ejecución gratuita probada; diseño completo útil e inferencia desde la app pendientes. CIF/FASTA/capturas/informe solo locales e ignorados.

El formulario HF del 23 oct bloqueó alojamiento propio Gradio/Docker solicitando PRO; no se creó servicio. No prometer gratuidad al registrar tarjeta en Modal. Demo compartida no implica capacidad ilimitada ni permiso de backend público. Colab sigue manual, sin túneles. Laboratorio actual conserva los tres rediseños 1UBQ y sus ZIP comprobados.

## Copias y siguiente paso

- **ProteinForge · S7 calidad y rendimiento**: 01a16ab0-a33d-7853-96bb-4e1376d07849, worktree-quality, parallel/quality, puertos 5310–5319. Entrega cerrada e integrada; conservar evidencia.
- **ProteinForge · S5 sincronización 3D**: 01a16ab0-c9f9-7440-83ad-acb1096f8745, worktree-sifts, parallel/sifts, puertos 5320–5329. Entrega cerrada e integrada; generado local intencional indicado arriba.
- Coordinación: frontend/dev, backend/dev y documentos generales, puertos 5330–5339. [Plan local](../../parallel-development.md).

No archivar/eliminar copias o ramas sin conservar cambios/evidencias; no rebase ni escritura concurrente mientras estén activas. Seguimientos a esos dos chats autorizados en esta tarea; no extender a mensajes ajenos.

La publicación y la comprobación básica real SIFTS ya terminaron. Consultar ambos PROGRESS antes de repetir operaciones. Continuar por las prioridades de arriba, sin reabrir aprobaciones SIFTS o migraciones antiguas. El propietario ejecutará el ensayo manual: no iniciar inferencia, consumir su cuota o modificar cuentas por esta actualización documental. Mantener límites S7/Groq/modelado y decisiones pendientes antes de ampliar importador o DesignService.
