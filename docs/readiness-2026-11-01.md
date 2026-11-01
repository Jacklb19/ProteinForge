# Comprobación de activación — 1 nov 2026

Fecha de referencia: America/Bogota. Entrega local, sin publicación. [Acciones del propietario](owner-next-steps-2026-11-01.md) y [verificación completa anterior](prediction-delivery-2026-10-30.md).

## Recorrido con la cuenta del propietario

El propietario inició sesión personalmente en `http://127.0.0.1:5330/generate/lab`. Se usó la interfaz con Auth de Supabase y API local reales, sin interceptar solicitudes ni sustituir la identidad. No se extrajo ni guardó su JWT.

- La variante pública 1 de ubiquitina, 76 residuos, obtuvo una predicción de ESM Atlas. El visor mostró la estructura exacta y su procedencia; los campos pTM, PAE, confianza y revisión permanecen ausentes, sin valores inventados.
- Se descargaron `proteinforge-esm-atlas.pdb` y `proteinforge-laboratory.json` a Descargas. El PDB tiene **49.452 bytes**, SHA256 `8dafcdec20d2fee788b3566bd047c653a90d80717af483042ea80dafc45abf75`. El validador backend acepta el archivo y el portable v2, que contiene exactamente ese mismo PDB.
- Una repetición inmediata mostró «Servicio ocupado o cuota alcanzada» y conservó la estructura anterior. Es evidencia del mensaje y comportamiento RPC; no se capturó un HTTP 429. No acredita cuotas de tres identidades ni su aislamiento.
- SIFTS mostró P01308:90 (G) → cadena A/autor A:1/posición interna 1 y P01308:110 (N) → A/autor A:21/posición interna 21 en 1TRZ. Se seleccionó A entre las cadenas ofrecidas. Se acredita la lectura autenticada por la pasarela local; quedan cuota de 20/min, atribución entre identidades y JWT auténtico caducado/manipulado.
- No se hizo un guardado de proyecto en la nube. La lectura real anterior de SIFTS en producción no se repitió en producción hoy.

Una llamada separada, directa al proveedor, con la secuencia pública 1UBQ produjo 76 residuos y 50.181 bytes en 1,303 s de pared. No incluye Auth/pasarela, no mide tiempo de GPU y se desconoce si fue caché. No confundir ese archivo con el de la variante obtenida desde la interfaz.

## Lecturas del asistente

Se solicitaron tres lecturas desde Estructura, con la sesión real y las cifras públicas Colab delante. Las tres mostraron el error genérico; el backend registró `502 assistant-unverified-figure` y «Assistant answer cited a figure or verbal proportion absent from its facts». No se guardó ni leyó el texto descartado del proveedor.

| Caso | Cifras del resultado público, pLDDT / RMSD Cα / pTM | Veredicto |
|---|---|---|
| Variante 1 | 93,39 / 0,822 Å / 0,863 | Rechazada; no hubo prosa visible que certificar |
| Variante 2 | 93,47 / 0,751 Å / 0,861 | Rechazada; no hubo prosa visible que certificar |
| Variante 3 | 92,92 / 1,211 Å / 0,858 | Rechazada; no hubo prosa visible que certificar |

El verificador impidió mostrar esas respuestas. Sin inspeccionar el texto descartado no se distingue una cantidad inventada de un posible falso positivo. No se debilitaron sus reglas ni se repitieron solicitudes buscando una salida favorable. La calidad de prosa sigue pendiente de diagnóstico técnico y lectura de salidas aceptadas; no corresponde dar por comprobada la corrección científica.

## Supabase remoto: solo lectura

Se ejecutó [prediction-readiness.sql](../../backend/supabase/checks/prediction-readiness.sql) en SQL Editor del proyecto ProteinForge `ycskfgimxrnhozmmqnze`, coincidente con la configuración local. El texto del editor se comparó con el archivo antes de Run. El editor creó automáticamente un borrador privado de consulta; no se ejecutó DDL ni se modificaron filas o configuración.

| Marcador | Resultado remoto |
|---|---|
| prediction_validator_installed | false |
| laboratory_v2_marker | false |
| workspace_v4_guard_marker | false |
| functions_are_invoker | false |
| project_tables_have_rls | true |

Falta instalar la migración nueva de predicciones. `functions_are_invoker=false` exige cuatro funciones presentes y sin SECURITY DEFINER: la ausencia de la nueva función ya basta para que sea false; **no demuestra que las funciones existentes sean SECURITY DEFINER**. RLS activado tampoco demuestra aislamiento real entre cuentas. La consulta no leyó filas de usuarios o proyectos ni claves. La misma consulta, en PostgreSQL 18 local con la migración, devolvió cinco true; ese clúster temporal volvió a quedar detenido.

## Preparación local y comprobaciones de esta sesión

`npm run dev:prediction` inicia frontend 5330 y API 5331 con sus banderas activadas solo en esos procesos. Comprueba Auth y que ambos apuntan al mismo proyecto, espera health y rechaza puertos ocupados sin terminar procesos ajenos. No modifica archivos `.env`. Ctrl+C detiene sus procesos. El lanzador quedó en ejecución para la revisión del propietario; si se cierra, se puede reiniciar con ese comando.

- `node --check` de los dos scripts y `npm run lint`: correctos. Inicio real y health: 200, identidad configurada. Segundo inicio: rechazó el puerto 5330 ocupado; la aplicación original siguió disponible.
- API real sin token y con un token constante inválido: 401 en ambos casos. CORS permitió el origen local probado. No se manipuló el JWT del propietario.
- Navegador anónimo sin mocks: exige sesión para predecir, cero errores de página en ese recorrido.
- Contrato backend preparado en `77a753c2f8673b964e1943a8845767c9dce67635`; `buf.gen.yaml` ya fija ese commit. Regeneración aislada desde el hermano local: **7 archivos, 0 diferentes**. El commit aún no está remoto: CI no podrá descargarlo hasta subir backend primero.
- Código frontend en `5364848b24a16e290460191d34f929f928a7938c`; backend incluye además `46ed857` (asistente) y `9f2aeec` (consulta de instalación). Commits locales con autor y committer Jacklb19; sin push ni merge.
- Revisión de enlaces locales de los documentos cambiados frente a origin/dev en ambos repositorios, incluyendo nuevos archivos: **186 enlaces en 20 documentos, cero roturas**. `git diff --check` correcto; advertencias normales de conversión LF/CRLF.

No se repitieron baterías de aplicación por los cambios de esta sesión, limitados a herramientas, documentación y pin con generación idéntica. La última batería completa es la del 30 oct: **715 unitarias/100 archivos**, cobertura **87,84 / 79,04 / 83,78 / 91,62 %**, tipos/lint/build/PWA correctos; **141 E2E correctas + 2 omitidas/143**; backend **127 correctas + 19 SQL omitidas/146**, con esas **19 SQL correctas aparte** en PostgreSQL 18. Son cifras de esa ejecución anterior, no nuevas ejecuciones de hoy.

## Evidencia local y límites

Artefactos ignorados: `frontend/artifacts/readiness-2026-11-01/` contiene `local.json`, `local-anonymous.png`, `live-owner-prediction.png`, `live-owner-result.png`, `live-sifts-110.png` y `supabase-readiness.png`; `backend/artifacts/readiness-2026-11-01/` contiene `provider-public.json`, `owner-live.json` y copias públicas PDB/portable. No incluyen JWT. La copia transaccional de la migración en ese directorio es una preparación, no una aplicación remota.

Pendientes: migración/configuración/publicación autorizadas; predicción y guardado/reapertura desde la web pública; dos cuentas reales para aislamiento (a cargo del propietario); completar SIFTS; prosa del asistente; decisiones TOTP/giro y RNF-03 sin acreditar. ModelScope/Hugging Face no se reconsultaron hoy. No hay GPU reservada, gastos, cuentas nuevas ni cambios remotos de Auth/configuración. El endpoint público probado no ofrece garantía de disponibilidad para tres personas.
