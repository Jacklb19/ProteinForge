# Mapa vigente de pantallas

Actualizado el 13 oct 2026. Un solo sitio con la misma barra en todas las pantallas: Inicio · Analizar · Alinear · Diseñar · Biblioteca. Sin sesión se ofrecen «Iniciar sesión» y «Crear cuenta»; con sesión, el avatar lleva a Perfil. Interfaz en español e inglés. Rutas en `src/shared/navigation.ts`.

| Pantalla | Ruta | Qué muestra al abrir | Estado y límite |
|---|---|---|---|
| Inicio | `/` | Estructura real de la insulina (1TRZ) que se gira, su secuencia con tramos y puentes, perfil, comparación con la bovina, candidatos y, sin sesión, qué añade una cuenta | Todo calculado al cargar; las figuras enlazan a su herramienta |
| Analizar | `/analyze` | Insulina humana: secuencia coloreada, perfil, tendencias, propiedades, composición y estructura | Acciones: Cambiar secuencia, Guardar, Exportar, Alinear. Tramos, puentes y estructura solo para referencias anotadas |
| Alinear | `/alignment` | Humana frente a bovina ya alineadas: conclusión, cifras, mapa y bloques | Gotoh/BLOSUM en WASM con cancelación. La nota sobre la proteína madura solo si la primera secuencia está anotada |
| Diseñar | `/generate` | Búsqueda con las condiciones iniciales ya resuelta | RF17 local; el método va plegado |
| Biblioteca | `/library` | Cuatro referencias, consulta de UniProt y la estructura 1TRZ | UniProt requiere sesión; el visor completo se carga por detrás del dibujo ligero |
| Perfil | `/profile` | Proyectos, cuenta, apariencia, idioma y privacidad de datos | Requiere sesión; sin ella lleva a Iniciar sesión. Eliminar la cuenta se solicita por correo |
| Iniciar sesión, registro, recuperación | `/sign-in`, `/sign-up`, `/recover` | Formulario único centrado | REST de Supabase Auth; Google por redirección. Entrega SMTP y flujo Google completo sin verificar |
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
- **Con cuenta:** tras iniciar sesión se vuelve a Analizar o a la pantalla que pidió la sesión. Los proyectos se abren, renombran y eliminan desde Perfil.

Los borradores viven en memoria durante la visita. El último proyecto guardado se recupera por un identificador local de cuenta; no se guardan secuencias en el almacenamiento del navegador.

[Diseño visual](diseno-visual.md) · [plan](plan-desarrollo.md) · [proyectos](projects.md) · [referencias](references.md) · [informes](reports.md) · [candidatos](candidates.md).
