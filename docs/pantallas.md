# Mapa vigente de pantallas

Revisado el 26 oct 2026. Presentación pública y laboratorio separados, sobre la base A «Mesa clara»; implementado localmente. El sitio público tiene cabecera y secciones; el laboratorio, barra lateral agrupada (Investigar: Analizar, Comparar, Biblioteca · Diseñar: Diseñar secuencias, Laboratorio 3D · Organizar: Proyectos con sesión) y, al pie, Guía y métodos, Preferencias y Cuenta. Interfaz en español e inglés. Rutas en `src/shared/navigation.ts`.

Proyectos conserva los contratos y garantías de A «Colección de secuencias» y adopta las filas con detalles de Mesa clara; [auditoría y decisión](projects-proposal.md). Laboratorio y persistencia ya publicados; [activación real del 22 oct y límites](laboratory-activation.md). La [lectura de resultados](assistant.md) está implementada localmente en Analizar y Laboratorio con la propuesta A aprobada; todavía sin publicar.

| Pantalla | Ruta | Qué muestra al abrir | Estado y límite |
|---|---|---|---|
| Presentación | `/` | Propósito, estructura real de la insulina (1TRZ) con su secuencia; qué es, herramientas con ejemplos reales, recorrido, tipos de evidencia, cuenta y preguntas | Marco público. Ningún cálculo de herramienta al llegar: cada ejemplo usa su Worker al mostrarse; Diseñar no ejecuta búsquedas. Con sesión ofrece volver al laboratorio |
| Analizar | `/analyze` | Tarea, ficha de insulina humana y Resumen primero; vistas Secuencia, Perfil y Estructura | Acción principal: Analizar mi secuencia. Guardar, Exportar y Alinear secundarios. Lectura al pie con sesión, sin enviar la secuencia (local). Tramos, puentes y estructura solo para referencias anotadas |
| Alinear | `/alignment` | Humana frente a bovina ya alineadas: conclusión, cifras, mapa y bloques | Gotoh/BLOSUM en WASM con cancelación. La nota sobre la proteína madura solo si la primera secuencia está anotada |
| Diseñar | `/generate` | Búsqueda con las condiciones iniciales ya resuelta | RF17 local; el método va plegado |
| Laboratorio | `/generate/lab` | Tres variantes reales de ubiquitina, selector visible y vistas Estructura, Comparación y Archivos y procedencia | A aprobada. Importación ZIP validada en Worker, selección, sustitución/protección/deshacer, archivo local para guardar/reabrir. Guardado explícito de archivo y en Proyectos, con reapertura validada y conflictos; sin nueva inferencia; [método y límites](laboratory.md) |
| Biblioteca | `/library` | Catálogo y UniProt en vistas separadas, ficha seleccionada y estructura 1TRZ | UniProt requiere sesión; el visor completo se carga por detrás del dibujo ligero |
| Proyectos | `/projects` | Filas con nombre, procedencia, fecha y destinos; prefijos y resultados guardados desplegables; búsqueda/orden/paginación y acciones deliberadas | Con sesión. Sin sesión ofrece entrar/crear cuenta. Sin preview de un servidor anterior permite abrir, sin inventar resultados |
| Cuenta y preferencias | `/profile` | Cuenta, apariencia, idioma, privacidad y enlace a Proyectos | Requiere sesión; sin ella lleva a Iniciar sesión. Eliminar la cuenta se solicita por correo. Sin sesión, apariencia e idioma están en Preferencias de la barra lateral |
| Guía y métodos | `/guide` | Métodos y criterios de propiedades, perfil, comparación, diseño, estructuras y evidencia, con índice | Laboratorio. Reutiliza los textos de método existentes; no añade ciencia ni servicios |
| Iniciar sesión, registro, recuperación | `/sign-in`, `/sign-up`, `/recover` | Marco público: contexto del trabajo y formulario, apilados en móvil | REST de Supabase Auth; Google por redirección. Confirmación de correo comprobada por el propietario el 19 oct; recuperación y flujo Google completo pendientes |
| Privacidad, condiciones | `/privacy`, `/terms` | Texto legal | Marco público, con índice de secciones; enlazadas desde ambos pies |
| Dirección desconocida | Cualquier otra | Regreso a Analizar o a la presentación | Marco público |

Cada pantalla distinta de la presentación, Analizar y Alinear llega en su propio archivo al abrir su dirección: mientras tanto se ve un «Cargando…» con `role="status"`, y si el archivo no llega —sin conexión, o tras reemplazar la versión publicada— la pantalla lo dice y ofrece recargar, en lugar de quedarse en blanco. El trabajo sin guardar de la pestaña se conserva en ambos casos.

Direcciones anteriores: `/app` redirige a Analizar y `/settings` a Perfil. `/app` sigue siendo la dirección de retorno registrada para Google.

## Paneles y acciones

| Acción | Dónde | Comportamiento |
|---|---|---|
| Analizar mi secuencia | Analizar | Despliega el editor con validación, FASTA, acceso a Biblioteca, Vaciar y volver al ejemplo. Abre solo cuando la secuencia está vacía |
| Guardar | Analizar, Alinear | Despliega el guardado de proyecto. Sin sesión ofrece iniciar sesión |
| Exportar | Analizar, Alinear | Menú con PDF, JSON y CSV generados en el dispositivo |
| Alinear | Analizar | Lleva la secuencia a la primera caja de Alinear |

## Recorridos

- **Sin cuenta:** la presentación muestra la proteína de ejemplo; «Explorar el ejemplo» o el enlace de cada herramienta abren el laboratorio con el ejemplo cargado; desde ahí se reemplaza por una secuencia propia. Guardar proyectos, consultar UniProt y solicitar una lectura requieren sesión; el trabajo dura lo que dura la visita y se conserva al volver a la presentación. Tema e idioma se cambian desde Preferencias, en la cabecera pública, en su menú móvil y al pie de la barra lateral.
- **Con cuenta:** tras iniciar sesión se abre Analizar o la pantalla que pidió la sesión. Proyectos aparece en el grupo Organizar de la barra lateral y en el menú móvil; el menú de cuenta lleva a Cuenta y preferencias, al sitio público y a cerrar sesión. La presentación ofrece «Ir al laboratorio». Permite abrir, renombrar, duplicar y eliminar. Las comparaciones tienen acceso a Alinear; los proyectos mixtos ofrecen los dos destinos. Abrir reemplaza el borrador solo tras confirmación. Duplicar conserva el borrador y proyecto activos.

Los borradores viven en memoria durante la visita. El último proyecto guardado se recupera por un identificador local de cuenta; no se guardan secuencias en el almacenamiento del navegador. El laboratorio conserva sus variantes al navegar y ofrece descarga/reapertura de archivo; tras recargar se abre el archivo o «Abrir laboratorio» del proyecto guardado para recuperar las ediciones.

[Diseño visual](diseno-visual.md) · [plan](plan-desarrollo.md) · [proyectos](projects.md) · [referencias](references.md) · [informes](reports.md) · [candidatos](candidates.md).
