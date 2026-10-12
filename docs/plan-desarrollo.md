# ProteinForge: estado y plan de desarrollo

Revisión del 11 de octubre de 2026. Basada en los dos repositorios locales en `dev`, sus reglas, documentación vigente y código. El progreso histórico conserva decisiones anteriores; esta página resume el estado actual. Los despliegues y la configuración remota no se han inspeccionado.

## El producto que estamos construyendo

Una web pública explica qué es ProteinForge, para quién sirve y cómo se usa. Tiene una entrada a la app sin cuenta, registro e inicio de sesión. El espacio de trabajo reúne herramientas y, cuando esté implementada la persistencia, proyectos personales. La apariencia y los estados deben ser coherentes en todo el recorrido, en móvil y escritorio, con temas claro y oscuro.

ProteinForge es un proyecto académico de exploración de secuencias. Los descriptores no demuestran función o plegamiento. La cadena de la portada es ornamental; la hélice es una referencia geométrica. Las estructuras experimentales y las predicciones deben estar etiquetadas y tener procedencia.

## Qué hace hoy

| Área | Comportamiento existente | Límite real |
|---|---|---|
| Web pública | Presentación, explicación del producto, recorrido, criterio científico, acceso a las herramientas, registro e inicio de sesión | Las capacidades futuras se identifican como tales |
| Inicio de la app | `/app`: bienvenida, ejemplo guiado, análisis/comparación, explicación de secuencias y retorno al borrador | Usa los cálculos reales; no simula proyectos guardados |
| Secuencia y FASTA | Edición, validación por posición, importación en Worker, lista virtualizada, ejemplo P01308 | FASTA hasta 5 MB; U/O/B/Z/X con avisos y tratamiento explícito |
| Análisis | Masa, pI, inestabilidad, índice alifático y GRAVY en Worker | No es validación biológica ni predicción de estructura |
| Perfil | Kyte–Doolittle con ventanas 9/19, lector sincronizado, tabla por residuo y propensiones clásicas | No inventa extremos sin ventana completa; Chou–Fasman no es predicción 3D |
| Alineamiento | Global/local, Gotoh, BLOSUM45/62/80, WASM, resumen, trazas, progreso y cancelación | Hasta 5.000 residuos por entrada; rendimiento documentado para el equipo local |
| Borradores | Secuencia y alineamiento sobreviven al cambio de herramienta durante la visita | Se descartan al recargar; todavía no son proyectos guardados |
| Preferencias y PWA | Tema, preferencias locales y recursos precargados para trabajo sin conexión | Inglés completo y sincronización pendientes |
| Cuenta | Registro, correo/contraseña, recuperación, cambio de contraseña, sesión/refresco, cierre y redirección Google | Requiere configuración pública del frontend; verificado con proveedor simulado, sin certificación de cuentas remotas |
| API | FastAPI: `GET /v1/health`, `GET /v1/me`, validación de identidad mediante Supabase Auth, CORS, errores y correlación | Cliente frontend health/me implementado en Ajustes; health local real comprobado e identidad remota pendiente; no hay CRUD de proyectos |
| Exportación | CSV local con secuencia, valores completos, exclusiones y métodos | Solo resultado vigente; PDF, perfil/alineamiento e informe guardado pendientes |
| Base de datos | Migración inicial para perfiles, proyectos, análisis, alineamientos y caché, con políticas RLS | Auditoría estática existente; no sustituye probar las políticas en PostgreSQL |

La app puede analizar, comparar y descargar propiedades sin iniciar sesión. Crear una cuenta todavía no habilita guardado, informes PDF ni herramientas científicas pendientes. El frontend tiene `.env.example`; no se encontró un archivo `.env` local. El backend sí tiene un archivo local de configuración; no se comprobó su contenido ni su conexión remota.

## Orden para completar el sistema

Este orden reduce trabajo que después habría que rehacer. Cada bloque debe producir un recorrido utilizable y comprobado; no depende de un número de sprint.

| Orden | Entregable | Trabajo de desarrollo | Criterio de terminado |
|---|---|---|---|
| 1 | Experiencia pública y app coherente | Aplicar la dirección Figma aprobada al marco, presentación, análisis, alineamiento, ajustes y cuenta; detalles discretos y adaptación móvil | Entrar desde Inicio, usar ambas herramientas y volver; registro/acceso visibles; teclado, contraste, temas y estados reales comprobados |
| 2 | Cuenta real y conexión a la API | Cliente para los contratos existentes, estados de desconexión/configuración y validación real de la sesión; pruebas de registro, confirmación, recuperación y Google | Una cuenta de prueba puede completar los recorridos y la API reconoce su identidad, sin exponer secretos |
| 3 | Proyectos personales | Acordar payloads de los endpoints previstos, implementar CRUD con propiedad, concurrencia optimista y RLS; integrar listado, apertura, guardado y renombrado | Guardar un análisis, recargar y retomarlo; otro usuario no puede leerlo ni modificarlo; conflicto 409 visible y recuperable |
| 4 | Datos y estructura experimental | Catálogo trazable de fragmentos, consulta UniProt, Mol* bajo demanda, BinaryCIF RCSB y mapeo de residuos | Encontrar/importar una referencia y ver una estructura experimental, con cobertura, procedencia y selección sincronizada |
| 5 | Informes reproducibles | CSV y PDF local con secuencia autorizada, métodos, parámetros, resultados y referencias; almacenamiento según contrato | El resultado exportado corresponde al proyecto y permite repetir el cálculo |
| 6 | Generación RF-17 | Definir condiciones admitidas, estrategia, semilla, presupuesto y límites; implementar búsqueda en Worker, cancelación y comparación frente a referencia aleatoria | Experimento reproducible con candidatos y condiciones evaluadas, sin promesas de actividad biológica |
| 7 | Predicción RF-18 | Elegir y comprobar proveedor; definir payload, tamaño, consentimiento, caché, procedencia y fallos; reutilizar el visor | Una solicitud deliberada muestra una predicción validada; un fallo externo queda explícito y no genera coordenadas falsas |
| 8 | Interpretación y cierre | Asistente limitado a resultados calculados, cuotas/retención, inglés, TOTP opcional, sincronización y pruebas de rendimiento/navegadores | Demo de principio a fin con evidencia, documentación y límites de proveedor conocidos |

Los contratos de proyectos están previstos, pero sus payloads concretos requieren revisión antes de implementarlos. RF-17 y RF-18 tienen alcance aprobado y decisiones científicas pendientes. Las pantallas no deben anunciar esas capacidades como operativas antes de cumplir sus criterios.

## Qué necesitas aportar tú

### Para avanzar ahora

1. **Revisar los recorridos al recibir cada entregable.** El objetivo vigente es desarrollar el sistema completo. Organizaré las capacidades en el orden anterior, sin exigir fechas, sprints ni una selección reducida del alcance. Tu revisión sirve para ajustar el producto mientras avanzamos.
2. **Preparar la configuración pública del frontend en tu equipo.** Desde `.env.example`, completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. `VITE_API_BASE_URL` ya habilita health/me en Ajustes. Las claves de servidor nunca van en variables `VITE_`. No hace falta pegar secretos en el chat.
3. **Identificar el proyecto Supabase de desarrollo y sus responsables.** El backend ya tiene configuración local, pero falta comprobarla deliberadamente. Confirmar si la migración inicial está aplicada y si la base tiene datos que deban conservarse. Primero se probará RLS en una base local; aplicar migraciones remotas requiere tu autorización.
4. **Definir las URLs de desarrollo y de la demo.** Supabase necesita Site URL y redirecciones admitidas para acceso/recuperación; el backend necesita los orígenes del frontend en CORS. Consulta [redirecciones oficiales de Supabase](https://supabase.com/docs/guides/auth/redirect-urls).
5. **Elegir cómo se probarán los correos y Google.** Para registro abierto hay que resolver la entrega de confirmación y recuperación: el SMTP incluido de Supabase es para pruebas y limita los destinatarios autorizados, por lo que no se debe suponer que enviará a cualquier visitante. Ver [SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Google requiere habilitar el proveedor y configurar sus credenciales/redirecciones; ver [guía oficial](https://supabase.com/docs/guides/auth/social-login/auth-google). Se conserva el requisito de costo cero y sin tarjeta al elegir servicios.

### Antes de las capacidades científicas nuevas

6. **Concretar RF-17 conmigo:** qué propiedades se pueden restringir, si se parte de una secuencia o se genera desde cero, qué debe conservarse y qué tamaño/presupuesto acepta la demo. No se han elegido valores por ti.
7. **Concretar RF-18:** proveedor aceptado, consentimiento, tamaño de secuencia, condiciones de uso y si se conservarán resultados. Una respuesta pasada de ESM Atlas no garantiza disponibilidad actual.
8. **Aportar una demo representativa:** secuencias de referencia públicas, un caso de alineamiento y, cuando exista el visor, una estructura experimental identificada. No necesitamos datos privados para verificar el producto.

### Para publicar

9. **Autorizar el despliegue cuando el resultado local esté revisado.** Son dos repositorios y dos proyectos de despliegue independientes. Confirmaremos la versión de Python soportada antes de publicar: 3.14 es el objetivo local aprobado y las pruebas previas usan 3.13. Las versiones soportadas se consultan en la [documentación de Vercel](https://vercel.com/docs/functions/runtimes/python), sin cambiar la arquitectura por suposición.

## Punto de conexión con Supabase

El inicio guiado, las explicaciones, el CSV y el cliente health/me están preparados. La siguiente comprobación real necesita el proyecto de desarrollo y sus valores públicos. Sigue la [guía de conexión](conectar-supabase.md). No hace falta una clave de administrador para verificar identidad; esta conexión no implementa CRUD ni certifica las políticas RLS.
## Qué puedo continuar sin esperar servicios remotos

- Implementar y verificar la interfaz completa de las capacidades existentes.
- Mantener el cliente health/me ya implementado y comprobado con respuestas simuladas y health local real.
- Proponer payloads de proyectos sobre el esquema existente y preparar su verificación local.
- Trabajar en exportación local y componentes del visor, una vez delimitado su entregable.
- Mantener documentación, datos de referencia y pruebas reproducibles.

No se necesitan pagos, nuevas ramas, pushes, merges ni despliegues para completar estas tareas locales. La siguiente capacidad funcional prioritaria es **guardar y retomar proyectos propios**: convierte el banco de trabajo en una experiencia persistente y da una base a informes, generación y predicción.

## Evidencia y límites

El detalle de comprobaciones y cambios está en el progreso local de cada repositorio. Las pruebas de cuenta y API emplean proveedores simulados; las pruebas RLS actuales son estáticas. Chrome local no certifica Firefox/Edge/Safari, lectores de pantalla, servicios externos ni CI remoto. Cada entregable añadirá su evidencia antes de declararse completo.

La entrega actual verificó lint, tipos, build y PWA. Los 156 casos unitarios y 38 E2E tienen pases registrados en batería y repeticiones enfocadas; la última comprobación de Auth/API/CSV pasó 28/28 y la matriz final de bienvenida 6/6. La conexión health/CORS se comprobó contra FastAPI local con identidad deliberadamente sin configurar. Ver progreso para los selectores corregidos y límites de la evidencia.
