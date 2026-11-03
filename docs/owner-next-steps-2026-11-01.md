# Lo que falta que haga el propietario — 1 nov 2026

**Cierre:** publicación realizada y predicción/guardado/reapertura desde la web pública comprobados con tu sesión. El proyecto «Prueba de predicción 2026-11-01» queda en tu cuenta. [Informe de resultados y pendientes](release-2026-11-01.md). No tienes que repetir migración, variables ni autorización de esta entrega; el guion inferior es histórico. Lo que sigue a tu cargo es la prueba de aislamiento con la segunda cuenta y las decisiones de interfaz que continúan pendientes.

**Actualización:** el propietario confirmó aplicada la migración nueva y configuradas las dos variables, y autorizó los push/merge de ambos repositorios con autoría exclusiva suya el 1 nov. No repetir esos pasos. La publicación y su verificación se realizan en esta entrega; [estado de publicación](prompt-siguiente-entrega.md#publicación-autorizada--1-nov-2026). Los pasos inferiores conservan el guion entregado antes de esa confirmación. El aislamiento con segunda cuenta y la colaboración para una prueba autenticada en producción siguen pendientes.

## Ya preparado y comprobado

La aplicación local está en <http://127.0.0.1:5330/generate/lab> y la API en `127.0.0.1:5331`. `npm run dev:prediction`, desde `frontend/`, inicia ambos procesos, comprueba que usan el mismo proyecto de Auth y activa la predicción solo en esos procesos. No modifica `.env`, Vercel o Supabase. Ctrl+C detiene los procesos que creó; rechaza puertos ocupados sin terminar otros programas. No usa 5173.

El propietario inició sesión personalmente. Se comprobó por la interfaz una predicción real de la variante pública 1: 76 residuos y PDB de 49.452 bytes, validado y descargado. La repetición inmediata mostró el límite y conservó la estructura anterior. El laboratorio portable v2 descargado contiene exactamente ese PDB; no se leyó, guardó ni pidió el token al propietario. Esto acredita el recorrido **local con Auth y proveedor reales**, no un despliegue nuevo ni tres cuentas. El guardado en la nube todavía no se ha ejercitado.

También se observó SIFTS con esa sesión: P01308:90 (G) → cadena A/autor A:1/posición interna 1 y P01308:110 (N) → A/autor A:21/posición interna 21 en 1TRZ. Sigue pendiente su cuota completa y el rechazo de un JWT auténtico alterado/caducado. Una petición de predicción con token inválido de prueba sí fue rechazada con 401, sin extraer el JWT real.

Hay copia de los resultados en Descargas: `proteinforge-esm-atlas.pdb` y `proteinforge-laboratory.json`. La conservación en proyectos dependerá del paso siguiente.

## 1. Comprobación de Supabase ya realizada

Ya ejecuté [esta consulta de solo lectura](../../backend/supabase/checks/prediction-readiness.sql) en el **SQL Editor** de tu proyecto ProteinForge `ycskfgimxrnhozmmqnze`. Resultado: **false / false / false / false / true**. Falta instalar la migración nueva; RLS sí está activado en las dos tablas comprobadas. No leí filas de usuarios/proyectos o claves ni cambié funciones, filas o configuración. [Informe con alcance y evidencia](readiness-2026-11-01.md). El uso del SQL Editor está documentado por [Supabase](https://supabase.com/docs/guides/database/overview).

Los campos son `prediction_validator_installed`, `laboratory_v2_marker`, `workspace_v4_guard_marker`, `functions_are_invoker` y `project_tables_have_rls`. El cuarto exige cuatro funciones presentes: la nueva ausente ya lo deja en false; no demuestra un defecto de seguridad de las existentes. Los marcadores no sustituyen las pruebas reales de aislamiento. No repitas las migraciones antiguas del laboratorio o del historial, que ya declaraste aplicadas.

## 2. Aplicar la nueva migración

La migración nueva es [20261030000000_structure_predictions.sql](../../backend/supabase/migrations/20261030000000_structure_predictions.sql). Está revisada y probada en PostgreSQL local; no la he aplicado a tu base remota. Reemplaza funciones de validación/guardado y conserva RLS, sin crear tablas o buckets ni modificar filas existentes.

Preparé también una [copia exacta envuelta en BEGIN/COMMIT](../../backend/artifacts/readiness-2026-11-01/apply-prediction.sql) para pegar de una sola vez en SQL Editor. SHA256 del archivo canónico: `9faef56842c4c9cf073971f814a8e9776c5a42e71d92b814f2fd7db62f741a16`. Tras aplicarla, repite la consulta del paso 1 y confirma su resultado. La copia en artifacts es local e ignorada por Git; el archivo canónico versionado es la migración enlazada.

## 3. Preparar las variables de la publicación

En **el proyecto backend de ProteinForge en Vercel**, la variable es `FOLDING_ENABLED=enabled`. En **el proyecto frontend**, es `VITE_STRUCTURE_PREDICTION=enabled`. Mantén las URLs y claves existentes; no se necesita una clave nueva de ESM Atlas, tarjeta ni una GPU propia para este recorrido.

Estas variables se usarán en el despliegue de la nueva entrega. Los cambios de variables se aplican a despliegues posteriores, según la [documentación de Vercel](https://vercel.com/docs/environment-variables). La publicación debe llevar backend/contrato antes del frontend; yo me encargo de Git, la referencia del contrato y sus comprobaciones cuando autorices esa publicación concreta. No contrates planes ni crees recursos nuevos.

## 4. Confirmar la publicación de esta entrega

Después de revisar la entrega y completar la base/configuración, autoriza expresamente los push de `dev` y las fusiones/push a `main` de **ambos repositorios**, con sus despliegues automáticos, para esta entrega. No necesitas ejecutar comandos Git. Los commits locales y la referencia del contrato se preparan con autoría exclusiva de Jacklb19; no se han subido.

Después de publicarla, comprobaremos desde la web pública una predicción y el guardado/reapertura con tu cuenta. La prueba local de hoy no sustituye esa comprobación.

## Revisión con la segunda cuenta

El aislamiento por ID sigue a tu cargo, como acordaste: cuenta A crea un proyecto de prueba; cuenta B intenta leerlo, modificarlo y borrarlo con su ID. Debe obtener un rechazo o ningún resultado. Usa un proyecto de prueba que puedas perder si descubres un fallo. Puedo acompañarte con el guion; no accederé por mi cuenta a esa segunda cuenta.

Las decisiones TOTP, el giro de portada y RNF-03 siguen separadas de la activación de esta predicción. No son pasos obligatorios para esta comprobación local.
