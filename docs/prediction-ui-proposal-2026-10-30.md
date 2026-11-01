# Predicción del borrador — plan y revisión previa

30 oct 2026. Alcance: [contrato local](prediction-contract-2026-10-30.md). El propietario delegó expresamente la revisión y aprobación de esta entrega nocturna al coordinador; no se atribuye una revisión personal de estas imágenes al propietario.

## Maquetas anteriores al código de pantalla

32 PNG locales en `artifacts/prediction-2026-10-30/`: preparado, esperando, resultado y error × 1280/360 px × claro/oscuro × es/en. `mockups.mjs` reproduce las capturas con estilos y tokens existentes, sin servicios de diseño externos. La región 3D es un marcador explícito; la implementación usará únicamente coordenadas recibidas y validadas.

Revisión visual ejecutada sobre `ready-360-dark-es.png` y `result-1280-light-en.png`: secuencia legible sin desbordamiento, jerarquía y acciones conservadas en móvil; envío externo y límites científicos visibles. Aprobación técnica del coordinador antes de implementar la pantalla: mantener Mesa clara, reutilizar botones, pestañas, visor y guardado existentes; no añadir frameworks. El checkbox final debe tener el área táctil existente, no la pequeña caja nativa aislada de la maqueta.

## Plan por pantalla y estado

1. Laboratorio existente: añadir pestaña **Predicción** solo con bandera explícita. Conservar las cifras y estructura del experimento Colab previo.
2. Preparado: secuencia exacta, proveedor y consentimiento sin marcar. Cuenta iniciada y API configurada necesarias. Enviar requiere consentimiento por solicitud; entrar en la pestaña no envía nada.
3. Esperando: estado anunciado y botón de cancelar espera; explicar que no garantiza cancelar el cálculo externo. Cambiar variante, secuencia, conjunto o dueño abandona la respuesta pendiente.
4. Resultado: traza Cα validada; proveedor, modelo, fecha y SHA256; descarga del PDB original. Guardar/reabrir usa los controles existentes y documento v2. No sustituir el resultado Colab ni inventar pTM/PAE/confianza.
5. Error, cuota, sesión y configuración: mensajes es/en, borrador conservado y ninguna repetición automática. Cancelar conserva un resultado anterior que corresponda a la misma secuencia.
6. Edición: quitar la predicción si cambia la secuencia. Cambiar solo protección conserva las coordenadas: el predictor recibe únicamente la secuencia, sin restricciones de diseño.

Verificación prevista: consentimiento, cancelación, respuestas tardías, contrato y guardado/reapertura; revisión en navegador del flujo integrado y accesibilidad; batería existente sin nuevos recorridos E2E ajenos a una regresión real. Sin publicación ni activación remota.
