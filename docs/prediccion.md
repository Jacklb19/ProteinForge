# Predicción estructural desde el laboratorio

La pestaña **Predicción** del [laboratorio](laboratory.md) envía la secuencia exacta del borrador activo a la API, que la reenvía al servidor público de ESM Atlas (modelo `esmfold_v1`). Es opcional y está desactivada por defecto: `VITE_STRUCTURE_PREDICTION=enabled` en el frontend y `FOLDING_ENABLED=enabled` en el backend. No hay GPU propia ni modelos en Vercel, y el servicio público puede estar ocupado o no responder: no hay garantía de disponibilidad. La [documentación del backend](https://github.com/Jacklb19/Protein_Back/blob/main/docs/folding.md) describe el servicio.

## Alcance

- Predice la **secuencia exacta del borrador activo**, de 3 a 120 residuos canónicos. No ejecuta ProteinMPNN remoto, no genera esqueletos de novo, no inventa pTM, PAE ni confianza y no convierte un PDB suelto en un experimento de Colab.
- Cada petición exige sesión y un consentimiento explícito de la persona para enviar la secuencia. Hay una tarea local activa, cancelación de la espera y errores explícitos; no hay cola persistente ni se promete cancelar el cómputo del proveedor.
- Cancelar, cambiar la secuencia, la variante o el conjunto, o cerrar la sesión abandona las respuestas pendientes. Cambiar la secuencia retira su predicción; cambiar solo las protecciones la conserva, porque el predictor no recibe restricciones de diseño.
- La estructura se muestra en el visor químico existente con proveedor, modelo y fecha de recuperación, con descarga del PDB original. Ausentes, las métricas no se sustituyen por ceros.
- Con una referencia, la pestaña muestra el RMSD de Cα de la predicción frente a la referencia, calculado en el Worker con el mismo emparejamiento que el cuaderno de Colab (ver [laboratorio](laboratory.md)).

## API

REST `POST /v1/predictions/fold` y `proteinforge.folding.v1.FoldingService/Predict`, con una misma función de dominio y el JWT de Supabase. Petición REST: `{ "sequence": ..., "consentToSendSequence": true }`. Un usuario autenticado solo pide su propio resultado; no hay lectura por ID de trabajo.

Resultado normalizado:

```json
{
  "schemaVersion": 1,
  "sequence": "<secuencia canónica exacta>",
  "sequenceSha256": "<SHA-256 ASCII de la secuencia>",
  "pdb": "<PDB exacto recibido>",
  "pdbSha256": "<SHA-256 UTF-8 exacto del PDB>",
  "provider": "esm-atlas",
  "model": "esmfold_v1",
  "modelRevision": null,
  "retrievedAt": "<fecha UTC de recuperación>",
  "sourceUrl": "https://api.esmatlas.com/foldSequence/v1/pdb/",
  "ptm": null,
  "pae": null,
  "confidence": null
}
```

La plantilla describe tipos, no un resultado científico. La revisión, pTM, PAE y la confianza quedan en `null` (en protobuf se omiten y el cliente las normaliza a `null`); no se deriva pLDDT de la columna B. La fecha es la de recuperación, no la de ejecución del modelo. Proveedor, modelo y URL son fijos en configuración: la petición nunca incluye una URL.

- **Validación:** secuencia exacta, una sola cadena A, esqueleto N/Cα/C/O completo en cada residuo, coordenadas y ocupación finitas, residuos estándar, sin identidades ambiguas ni duplicadas y respuesta de hasta 1.000.000 bytes. Se rechazan HTML, JSON y respuestas parciales aunque el HTTP sea 200. El frontend revalida en un Worker, incluidos el SHA-256 y la asociación con la secuencia pedida. Un manifiesto no autentica al proveedor ni garantiza una inferencia nueva frente a una caché.
- **Errores:** validación 422 / `INVALID_ARGUMENT`; falta de consentimiento 403 / `PERMISSION_DENIED`; sin sesión 401 / `UNAUTHENTICATED`; deshabilitado 503 / `FAILED_PRECONDITION`; cuota o tarea simultánea 429 / `RESOURCE_EXHAUSTED`; fallo externo o PDB inválido 502 / `UNAVAILABLE`; tiempo agotado 504 / `DEADLINE_EXCEEDED`. El detalle nombra la categoría o el campo, nunca la secuencia ni el cuerpo del proveedor.
- **Límites** (`app/folding_config.py`): tiempo máximo del proveedor 30 s, una petición por minuto por identidad y tres por minuto por proceso, una simultánea por identidad y una global por proceso. Sin reintentos automáticos, sin caché de secuencias privadas y sin registrar las entradas. Los presupuestos están en memoria por proceso y no son una cuota global entre instancias. La API reenvía texto plano a ESM Atlas sin el token del usuario.

## Persistencia

El documento del laboratorio v1 se conserva sin cambios. El **documento portable v2** (`kind: proteinforge-laboratory`) añade `predictions`, un objeto con hasta tres claves de ID de variante. Cada valor es el resultado anterior y debe corresponder a la secuencia del borrador de esa variante; editarla retira la predicción de esa variante. No sustituye las métricas ni el resultado histórico importado.

- El `LaboratorySnapshot` exterior sigue siendo `schemaVersion` 1 (JSON más SHA-256) con un máximo de 1.000.000 bytes en la cuenta. El workspace pasa a `schemaVersion` 4 cuando el documento contiene v2; v1, v2 y v3 se conservan. No hay campos protobuf nuevos para el JSON del laboratorio, ni tablas ni Storage nuevos.
- La migración `20261030000000_structure_predictions.sql` valida el documento v2 y sus predicciones y añade una guardia de escritura monótona que rechaza a clientes v1, v2 y v3 sobre un workspace v4, conservando RLS, `SECURITY INVOKER`, concurrencia, vistas previas e historial. No acepta v4 sin v2 ni v2 en versiones inferiores.
- Abrir y guardar revalida la fuente original y cada PDB en un Worker y conserva borradores, protecciones y variante seleccionada. La reapertura con un cliente antiguo falla de forma explícita en lugar de borrar la predicción. El backend valida estructura, hash y asociación sin ejecutar ciencia ni descomprimir el ZIP original. El resultado nunca se trunca para que quepa: si excede el límite de la cuenta, se mantiene la descarga local.
- Las predicciones guardadas son registros independientes; se pueden compartir los archivos exportados. No hay enlaces públicos.

## Activación

Orden de despliegue: aplicar la migración, publicar el backend, fijar `buf.gen.yaml` al commit del backend publicado, regenerar los stubs, publicar el frontend y activar las dos banderas. Con las banderas vacías la pestaña no aparece.

## Pruebas

Dominio, REST, RPC y autorización; PDB inválido; consentimiento, cuota y cancelación de la espera; que no se filtren tokens al proveedor; y los plazos del cliente (`ctx.timeout_ms`) aplicados a la autenticación y a la llamada al proveedor. Las pruebas SQL se ejecutan contra PostgreSQL. En el frontend, paridad de versiones, Worker, respuesta tardía, descarga exacta y guardado con dobles. El Worker exige el mismo prefijo `ATOM  ` en el reconocimiento y en el análisis geométrico, para que ninguna línea alterada pase como validada (`src/features/design-lab/prediction.test.ts`).
