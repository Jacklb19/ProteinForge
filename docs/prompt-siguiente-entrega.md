# Relevo de desarrollo — ProteinForge

Actualizado el **26 de octubre de 2026**. Leer este documento completo, los AGENTS de raíz/frontend/backend y las últimas entradas de ambos PROGRESS. La raíz no tiene Git; frontend y backend son repositorios independientes.

## Publicación: orden obligatorio

**No hay autorización nueva para push, merge o despliegue.** El propietario aprobó maqueta y suministro SIFTS: «Sí, implementar interfaz y suministro SIFTS». No pedir otra aprobación visual/de contrato para el mismo alcance.

Frontend `0f3166e` genera GetResidueMapping desde el protobuf local. **buf.gen.yaml sigue fijando c2d127c, sin ese método**: publicar así haría que CI regenere tipos anteriores y falle. Tras autorización: publicar backend con el contrato primero, actualizar el pin al commit efectivamente publicado, regenerar/confirmar frontend y publicarlo al final. No usar un commit remoto inexistente ni cambiar CI a un directorio local.

Última producción comprobada el 23 oct: frontend main `3562c0c` y backend main `c2d127c`, CI/Vercel correctos entonces. No se hizo fetch o inspección remota nueva el 25–26. Proyectos, laboratorio y asistente ya están publicados; no reabrir sus migraciones o entregas como pendientes. Groq autenticado en producción, clave/retención y acceso directo por ID con segunda cuenta siguen sin certificar.

## Reglas vigentes

Trabajar en dev. Autor y committer exclusivamente Jacklb19 <jose.burbanob@campusucc.edu.co>, sin firmas, coautores o menciones a herramientas de IA en Git/GitHub. Commits pequeños en inglés; documentación/respuestas en español. Cada texto visible en es/en en el mismo cambio. No forzar AGENTS, PROGRESS, propuestas, artifacts, secretos o dependencias al índice.

Costo cero estricto, sin tarjeta ni modelos en Windows. No cambios de servicios/secretos, SQL remoto, cuentas nuevas o gastos por esta continuación. Publicaciones anteriores no autorizan esta entrega. No repetir migraciones ya aplicadas por el propietario.

## S5: implementación local integrada

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
- Backend: 104 totales, 92 correctas y 12 SQL omitidas sin base. Python 3.13.14 local; 3.14 objetivo sin nueva comprobación. Buf lint/regeneración reproducibles; dos espacios finales emitidos por el generador Python se conservan sin editarlo a mano.
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

Cerrar revisión documental/autoría y pedir autorización de publicación. Después publicar en el orden correcto y comprobar integración autenticada real dentro del alcance autorizado. No volver a pedir aprobación SIFTS o migraciones antiguas. Mantener límites S7/Groq/modelado; elegir entrada completa y validación independiente antes de ampliar importador o DesignService.
