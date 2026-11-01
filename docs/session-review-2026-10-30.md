# Revisión y pruebas reales — sesión del 29–30 oct 2026

**Actualización posterior del 30 oct:** la [entrega local de predicción](prediction-delivery-2026-10-30.md) implementó y verificó la integración, guardado v4 y pantalla. Este informe conserva la revisión inicial anterior a esa implementación; sus cifras no sustituyen el relevo vigente.

El propietario pidió revisar el proyecto, continuar con dos frentes paralelos y probar lo necesario. Se trabajó en `dev` de ambos repositorios. Se conservaron los documentos de investigación anteriores sin confirmar; no hubo commits, push, merge, despliegues de ProteinForge ni migraciones remotas. La sesión cruzó medianoche de America/Bogota.

## Predicción pública: tres estructuras recibidas y validadas

Se comprobó el endpoint documentado `POST https://api.esmatlas.com/foldSequence/v1/pdb/` con tres secuencias públicas de 76 residuos: 1UBQ A y las muestras 1 y 2 del ejemplo existente del laboratorio. Se enviaron secuencias públicas, sin tokens, claves ni datos de proyectos privados. No se instalaron ni ejecutaron modelos en Windows.

| Entrada | HTTP | Bytes del PDB | Átomos | Tiempo de solicitud |
|---|---:|---:|---:|---:|
| 1UBQ A | 200 | 50.181 | 601 | 0,721 s |
| Rediseño 1 del ejemplo | 200 | 49.452 | 592 | 2,112 s |
| Rediseño 2 del ejemplo | 200 | 50.505 | 605 | 1,851 s |

Las tres respuestas llegaron como `chemical/x-pdb`. Se validaron con `experiments/design-lab/experiment.py::parse_pdb`: cadena A, secuencia exactamente igual a la enviada, 76 residuos, N/Cα/C/O en cada posición, coordenadas finitas y sin duplicados/identidad ambigua. Los tres archivos tienen SHA-256 distintos. Los valores Cα de la columna B observados fueron 0,45–0,96; 0,44–0,97; y 0,49–0,97. Se registran como valores B, sin convertirlos todavía en una métrica del contrato del laboratorio.

**Es tiempo de solicitud HTTP, no tiempo de GPU ni latencia garantizada.** El servicio puede usar caché; no se conoce si esas solicitudes provocaron inferencia nueva. Tampoco demuestra el flujo completo desde la web, tres usuarios simultáneos, diseño ProteinMPNN remoto, forma nueva o función experimental.

La [documentación oficial de ESM Atlas](https://esmatlas.com/about) describe un servidor público de plegamiento y API con límites, recomienda solo unas pocas predicciones y desaconseja plegar conjuntos grandes. El caso pequeño tiene por tanto una base documental para estudiarlo, sin convertirla en garantía de servicio. El [repositorio oficial archivado](https://github.com/facebookresearch/esm) documenta el mismo endpoint.

### Límites para integrarlo

- La respuesta recibida no proporciona pTM, PAE, revisión de pesos, cuota restante ni evidencia de ejecución nueva. No inventar esos campos ni asignarle la revisión del modelo local.
- El importador del laboratorio exige el paquete completo del experimento y métricas con escala definida: **estos PDB no se pueden introducir como si fueran ese paquete**. Hace falta un contrato específico que admita metadatos ausentes y procedencia del servidor.
- Una solicitud `HEAD` devolvió 403. Una comprobación `OPTIONS` desde el origen de ProteinForge devolvió 403 y no expuso cabeceras CORS. Esto no demuestra el comportamiento de un POST simple en navegador; falta comprobar ese recorrido. No se afirma que la llamada directa desde React funcione.
- La disponibilidad observada en tres casos no sustituye comprobar errores, límites, consentimiento por envío y las condiciones de uso de una integración. No se cambió CSP ni se añadió una ruta de API.

Evidencia ignorada en `artifacts/gpu-trial-2026-10-29/`: recibos, respuestas exactas y `atlas-three-case-validation.json`. Hubo cuatro POST en total: el primer recibo interpretó incorrectamente un `System.Byte[]` de PowerShell como texto y dio un falso «no-pdb». Se corrigió el lector y se repitió 1UBQ una vez; ese primer recibo no acredita un fallo del proveedor ni se usa en la tabla. No se enviaron secuencias en HEAD u OPTIONS; no se conoce la implementación interna del proveedor.

## Estado de las cuentas de GPU

El propietario creó/inició sesión y envió personalmente la solicitud xGPU, con descripción breve por el límite que observó en el formulario. Se inspeccionó después su página de ModelScope en Edge: **`Application in Approval...`**. Solicitud enviada y pendiente; ningún acceso xGPU concedido observado. No se volvió a enviar ni se modificó la cuenta.

En Hugging Face se inspeccionaron la bienvenida y el formulario de crear Space, sin rellenarlo ni enviarlo. La cuenta actual muestra **Static gratuito y Gradio/Docker deshabilitados como Paid**, con invitación a PRO. No se creó Space, compró plan ni aportó tarjeta. La [documentación de ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu) exige, para el alojamiento gratuito personal, cuenta verificada de más de 30 días y en buen estado; no se promete una fecha automática de habilitación.

La [investigación asiática](asian-gpu-hosting-2026-10-29.md) conserva las condiciones de ModelScope. No se registraron contraseñas, tokens, cookies o identificadores privados en la evidencia del repositorio.

## Backend: dos fallos corregidos

Revisión de identidad, SIFTS/cuotas, proyectos, historial, asistente y migraciones. Se corrigieron en `app/assistant.py` la pérdida del signo al verificar cifras y una excepción Decimal con un hecho numérico largo. Tres regresiones fallaron antes y pasan después. Sin contratos, dependencias, SQL ni interfaz nuevos. [Informe completo](../../backend/docs/review-continuation-2026-10-29.md).

| Verificación local | Resultado |
|---|---|
| Asistente tras el arreglo | 16/16 correctas |
| Batería completa, sin base | 133 descubiertas: 116 ejecutadas correctas y 17 SQL omitidas |
| PostgreSQL 18 temporal | 17/17 SQL correctas; clúster detenido |
| Intérprete local | Python 3.13.14; no nueva ejecución de CI/Python 3.14 |

Son **133 pruebas únicas** entre las dos tandas. Corrige el recuento anterior: `Ran 130 tests ... skipped=17` significaba 113 ejecutadas y 17 omitidas, no 130 ejecutadas más 17. SQL usa `auth.uid()` emulado y no certifica Auth → PostgREST → RLS remotos.

## Frontend: rendimiento medido, sin cambio adoptado

Se diagnosticaron los dos candidatos pendientes. Compartir cachés de `Intl.NumberFormat` no elimina su primer coste, que dominó el perfil. El catálogo español mediante `JSON.parse` se ensayó solo en builds aisladas, sin cambiar `src` o `vite.config.ts`.

**30 pares / 60 cargas**, puertos intercambiados: diferencia LCP de variante menos referencia **+3,225 ms**, IC95 % **[−15,170; +45,415]**; 13 pares más rápidos y 17 más lentos, 0 errores. No hay mejora demostrada y no se adopta. La dispersión de 89,126 ms supera los 21 ms anteriores; hubo actividad del propietario y no se certifica máquina en reposo. Esta tanda no acredita RNF-03 ni revoca el incumplimiento medido anteriormente. [Método y datos](performance-continuation-2026-10-29.md).

Los dos builds fueron correctos. No se repitió la batería de aplicación porque el código final del frontend quedó intacto. Backend y coordinación detuvieron pruebas y navegación automatizada durante la tanda definitiva; no hubo dos baterías E2E a la vez. Navegador y servidores de medición cerrados.

## Producción observada y pendientes

- `/generate` sin sesión terminó la búsqueda por omisión y mostró «Guardar búsquedas en un proyecto requiere una cuenta»: la activación del historial se refleja en la web. **Guardado real y recuento con sesión todavía pendientes**.
- Backend publicado: `/v1/health` → 200 `ok`; `/v1/me` y `/v1/pdb/1trz/residue-mapping` sin token → 401. No prueba JWT real ni cuota por identidad.
- No se usaron las cuentas reales del propietario para probar aislamiento por ID; esa revisión sigue bajo su dirección. Sin lecturas reales nuevas de Groq, pantallas TOTP, cambios del giro de portada o publicación.

Siguiente decisión técnica: definir un contrato conservador para el PDB del servidor público y una prueba desde la web, manteniendo métricas ausentes como ausentes. No presentar los tres casos HTTP como integración terminada. Esperar la admisión de ModelScope para ensayar un ejecutor propio. Las pantallas nuevas siguen requiriendo maqueta y aprobación.

Cierre documental: enlaces locales de los documentos afectados revisados y `git diff --check` correcto en ambos repositorios. No se repite una batería por estas actualizaciones de texto.
