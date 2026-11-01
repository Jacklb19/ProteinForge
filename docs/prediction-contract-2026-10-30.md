# Predicción desde el laboratorio — contrato de la entrega local

Decisión técnica del 30 oct 2026, bajo la petición del propietario de avanzar de forma autónoma con dos chats y delegar la revisión/aprobación durante la noche. Se conserva costo cero, sin publicación ni cambios remotos. La coordinación revisa PNG y plan antes de implementar UI; esa revisión fue delegada expresamente por el propietario para esta entrega.

## Alcance

Predecir la **secuencia exacta del borrador activo del laboratorio existente**, de 3–120 residuos canónicos, mediante ESM Atlas. No ejecutar ProteinMPNN remoto, generar esqueletos de novo, fingir pTM/PAE/confianza ni convertir un PDB suelto en un experimento Colab. El usuario acepta el envío de la secuencia por cada petición. Una tarea local activa, cancelación de la espera y errores explícitos; no cola persistente ni promesa de cancelar el cómputo del proveedor.

## API

REST `POST /v1/predictions/fold` y servicio nuevo `proteinforge.folding.v1.FoldingService/Predict`, con una misma función de dominio y JWT de Supabase. Petición REST `{sequence,consentToSendSequence:true}`; protobuf snake_case equivalente. El usuario autenticado solo pide su propio resultado; no hay lectura de IDs de trabajos.

Resultado REST y cliente normalizado:

```json
{
  "schemaVersion": 1,
  "sequence": "SECUENCIA_CANONICA_EXACTA",
  "sequenceSha256": "sha256 ASCII de la secuencia",
  "pdb": "PDB exacto recibido",
  "pdbSha256": "sha256 UTF-8 exacto del PDB",
  "provider": "esm-atlas",
  "model": "esmfold_v1",
  "modelRevision": null,
  "retrievedAt": "fecha UTC con zona de recuperación",
  "sourceUrl": "https://api.esmatlas.com/foldSequence/v1/pdb/",
  "ptm": null,
  "pae": null,
  "confidence": null
}
```

La plantilla describe tipos, no un resultado científico. La revisión, pTM, PAE y confianza quedan ausentes/null; no derivar pLDDT automáticamente de la columna B. En protobuf se omiten las métricas que no existen y el cliente las normaliza a null. Fecha de recuperación, sin atribuirla a la ejecución de un modelo. Proveedor/modelo/URL fijos en configuración por característica; la petición nunca incluye URL.

Validar secuencia exacta, una cadena A, backbone N/Cα/C/O completo en cada residuo, coordenadas/ocupación finitas, residuos estándar, ausencia de identidad ambigua/duplicados y tamaño máximo de respuesta de 1.000.000 bytes. Rechazar HTML, JSON y respuestas parciales aunque HTTP sea 200. Revalidar en Worker en el frontend, incluido SHA-256 y asociación a la secuencia solicitada. Un manifiesto no autentica al proveedor ni garantiza inferencia nueva frente a caché.

Errores estables: validación 422/INVALID_ARGUMENT; falta de consentimiento 403/PERMISSION_DENIED; sin sesión 401/UNAUTHENTICATED; deshabilitado 503/FAILED_PRECONDITION; cuota o tarea simultánea 429/RESOURCE_EXHAUSTED; fallo externo/PDB inválido 502/UNAVAILABLE; timeout 504/DEADLINE_EXCEEDED. El detalle identifica categoría/campo, nunca la secuencia o el cuerpo del proveedor.

Configurar opt-in backend `FOLDING_ENABLED=enabled`, timeout de proveedor 30 s, límite 1 petición/minuto por identidad y 3/minuto por proceso, una petición simultánea por identidad y 1 global por proceso. Sin reintentos automáticos, sin caché de secuencias privadas, sin logs de entradas. Presupuestos en memoria por proceso, sin presentarlos como cuota global entre instancias. Deshabilitado por omisión hasta publicar backend y migración. Frontend `VITE_STRUCTURE_PREDICTION=enabled` también opt-in; en los ensayos locales y E2E se activa expresamente.

## Persistencia

Conservar el documento de laboratorio v1 existente sin cambios. Nuevo **documento portable v2** `kind:proteinforge-laboratory`, misma fuente original `example|archive` y estado, más `predictions`, un objeto con hasta tres claves de ID de variante. Cada valor es el resultado anterior y debe corresponder a la secuencia del borrador de esa variante; una edición invalida/retira la predicción de esa variante. No sustituye las métricas ni el resultado histórico importado.

LaboratorySnapshot exterior sigue schemaVersion 1 (JSON+SHA), documento máximo 1.000.000 bytes en nube. Workspace nuevo **schemaVersion 4** cuando el documento contiene v2; v1/v2/v3 y documentos antiguos se conservan. Sin campos protobuf nuevos para el JSON de laboratorio. Migración nueva, idempotente y solo local: validar documento v2/predicciones y guardia de escritura monótona que rechace clientes v1/v2/v3 sobre un workspace v4. La migración debe conservar RLS, SECURITY INVOKER, concurrencia, vistas previas e historial. No tocar migraciones históricas. Resultado nunca truncado para hacerlo caber; mantener descarga local si excede límite de nube.

Abrir/guardar el laboratorio debe revalidar la fuente original y cada PDB en Worker. Mantener borradores, protecciones y variante seleccionada. La reapertura de un cliente antiguo debe fallar explícitamente, no borrar la predicción. El backend valida estructura/hash/asociación, sin ejecutar ciencia ni descomprimir el ZIP original. Las reglas de v4 deben admitir laboratorio v2, con historial opcional; no aceptar v4 sin v2 ni v2 en versiones inferiores.

## Interfaz y comprobación

Extender la composición aprobada del laboratorio mediante una pestaña Predicción del borrador activo, consentimiento con secuencia/destino visibles, espera cancelable, resultado asociado a la secuencia exacta, visor químico existente, descarga PDB original y guardado/reapertura. Retirar la asociación al cambiar la secuencia y descartar respuestas tardías tras editar/cambiar variante/cerrar sesión. Cambiar solo las protecciones conserva la predicción, pues el predictor no recibe restricciones de diseño. No mostrar ceros como sustituto de métricas ausentes. Español e inglés simultáneos; tokens y primitivas existentes; 360/1280, claro/oscuro y teclado. PNG y plan revisados antes de código UI en [la propuesta](prediction-ui-proposal-2026-10-30.md).

Pruebas de dominio/REST/RPC/autorización, PDB inválido, consentimiento/cuota/cancelación de espera, identidad correcta y no filtrar tokens al proveedor. SQL en PostgreSQL temporal real. Frontend: paridad de versiones, Worker, stale-response, descarga exacta y guardado con dobles. Mantener umbrales. No nuevas pruebas E2E salvo regresión real; adaptar/verificar recorridos existentes y usar un ensayo manual integrado documentado para la función nueva. Una sola batería E2E a la vez, puerto 5190; otros previews 5330–5339. Producción sigue sin esta función hasta autorización separada.
