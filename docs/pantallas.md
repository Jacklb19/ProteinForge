# Mapa vigente de pantallas

Revisado el 19 oct 2026. Un solo sitio con la misma barra en todas las pantallas: Inicio · Analizar · Alinear · Diseñar · Biblioteca. Con sesión se añade Proyectos y el avatar lleva a Perfil; sin sesión se ofrecen «Iniciar sesión» y «Crear cuenta». Interfaz en español e inglés. Rutas en `src/shared/navigation.ts`.

El propietario eligió A «Colección de secuencias». `/projects` implementa esa dirección con tarjetas científicas; [auditoría y decisión](projects-proposal.md). La nueva consulta requiere la migración de vistas previas y publicación del backend antes del frontend; no están aplicadas remotamente por esta entrega.

| Pantalla | Ruta | Qué muestra al abrir | Estado y límite |
|---|---|---|---|
| Inicio | `/` | Estructura real de la insulina (1TRZ) que se gira, su secuencia con tramos y puentes, perfil, comparación con la bovina, candidatos y, sin sesión, qué añade una cuenta | Todo calculado al cargar; las figuras enlazan a su herramienta |
| Analizar | `/analyze` | Insulina humana: secuencia coloreada, perfil, tendencias, propiedades, composición y estructura | Acciones: Cambiar secuencia, Guardar, Exportar, Alinear. Tramos, puentes y estructura solo para referencias anotadas |
| Alinear | `/alignment` | Humana frente a bovina ya alineadas: conclusión, cifras, mapa y bloques | Gotoh/BLOSUM en WASM con cancelación. La nota sobre la proteína madura solo si la primera secuencia está anotada |
| Diseñar | `/generate` | Búsqueda con las condiciones iniciales ya resuelta | RF17 local; el método va plegado |
| Biblioteca | `/library` | Cuatro referencias, consulta de UniProt y la estructura 1TRZ | UniProt requiere sesión; el visor completo se carga por detrás del dibujo ligero |
| Proyectos | `/projects` | Tarjetas con prefijos químicos, propiedades y comparación guardadas, procedencia y fecha relativa; búsqueda/orden/paginación y acciones deliberadas | Con sesión. Sin sesión ofrece entrar/crear cuenta. Sin preview de un servidor anterior permite abrir, sin inventar resultados |
| Perfil | `/profile` | Cuenta, apariencia, idioma, privacidad y enlace a Proyectos | Requiere sesión; sin ella lleva a Iniciar sesión. Eliminar la cuenta se solicita por correo |
| Iniciar sesión, registro, recuperación | `/sign-in`, `/sign-up`, `/recover` | Formulario único centrado | REST de Supabase Auth; Google por redirección. Confirmación de correo comprobada por el propietario el 19 oct; recuperación y flujo Google completo pendientes |
| Privacidad, condiciones | `/privacy`, `/terms` | Texto legal | Públicas |
| Dirección desconocida | Cualquier otra | Regreso a Analizar o Inicio | — |

Direcciones anteriores: `/app` redirige a Analizar y `/settings` a Perfil. `/app` sigue siendo la dirección de retorno registrada para Google.

## Paneles y acciones

| Acción | Dónde | Comportamiento |
|---|---|---|
| Cambiar secuencia | Analizar | Despliega el editor con validación, FASTA, acceso a Biblioteca, Vaciar y volver al ejemplo. Abre solo cuando la secuencia está vacía |
| Guardar | Analizar, Alinear | Despliega el guardado de proyecto. Sin sesión ofrece iniciar sesión |
| Exportar | Analizar, Alinear | Menú con PDF, JSON y CSV generados en el dispositivo |
| Alinear | Analizar | Lleva la secuencia a la primera caja de Alinear |

## Recorridos

- **Sin cuenta:** Inicio muestra la proteína de ejemplo; «Analizar proteínas» o «Comparar proteínas» abren la herramienta con el ejemplo cargado; desde ahí se reemplaza por una secuencia propia. Todo funciona sin sesión salvo guardar proyectos y consultar UniProt; el trabajo dura lo que dura la visita. Tema e idioma se cambian desde la barra, el menú y el pie.
- **Con cuenta:** tras iniciar sesión se vuelve a Analizar o a la pantalla que pidió la sesión. Proyectos se encuentra en la barra y en el menú móvil; desde Perfil hay un enlace. Permite abrir, renombrar, duplicar y eliminar. Las comparaciones tienen acceso a Alinear; los proyectos mixtos ofrecen los dos destinos. Abrir reemplaza el borrador solo tras confirmación. Duplicar conserva el borrador y proyecto activos.

Los borradores viven en memoria durante la visita. El último proyecto guardado se recupera por un identificador local de cuenta; no se guardan secuencias en el almacenamiento del navegador.

[Diseño visual](diseno-visual.md) · [plan](plan-desarrollo.md) · [proyectos](projects.md) · [referencias](references.md) · [informes](reports.md) · [candidatos](candidates.md).
