# Interfaz del asistente · propuesta

Preparada el **23 oct 2026**. Requiere tu elección antes de programar nada de interfaz. El backend ya está implementado y probado en local ([contrato](../../backend/docs/assistant.md)); esto decide solo cómo se ve y dónde vive.

Maquetas y capturas en `artifacts/asistente-2026-10-23/` (fuera de Git): `a.html`, `b.html` y ocho PNG a 360 y 1280 px en tema claro y oscuro. Están hechas con `design-tokens.css`, `fonts.css` e `index.css` del propio proyecto, de modo que tipografías, colores y medidas son las reales. Las cifras son las que la aplicación mostró en producción el 22 oct y **el texto lo escribió Groq de verdad**, no está inventado para la maqueta.

## Qué se añade

Un bloque llamado **Lectura** que explica en prosa las cifras ya calculadas de esa pantalla. Aparece en dos sitios:

- **Laboratorio** (`/generate/lab`): lee pLDDT, RMSD Cα, identidad posicional, pTM y posiciones protegidas de la variante activa.
- **Analizar** (`/analyze`): lee masa, punto isoeléctrico, inestabilidad, índice alifático, GRAVY, composición y ventana del perfil.

No cambia ninguna figura, tabla ni control existente. No es un chat: cada lectura es una petición independiente, sin historial ni preguntas libres.

## Lo que sale del dispositivo

Solo las cifras que ya están en pantalla, con su etiqueta y unidad, tal como la interfaz las muestra. **La secuencia no se envía.** El contrato admite mandarla, pero la interfaz propuesta no la manda, y por eso el aviso puede ser una sola línea corta en vez de un consentimiento largo:

> Se envían las cifras de esta pantalla a Groq, que escribe el texto. Tu secuencia no se envía.

Si más adelante quieres que el asistente lea la secuencia, eso pasa a ser otra decisión con su propio consentimiento.

## Revisión del 23 oct tras tu comentario

Dijiste que se veía «muy IA», «muy vacío» y costoso de leer. Las tres cosas tenían causa concreta y están corregidas en las capturas nuevas, tomadas **dentro de la aplicación real en producción**, no en una maqueta aparte:

- **Vacío**: la maqueta anterior tenía recuadros de relleno donde van la secuencia, el perfil y la estructura. La pantalla real está llena; el hueco lo ponía la maqueta. Aun así quedaba un vacío verdadero: una columna de texto de 62 caracteres dentro de una sección a todo lo ancho deja casi la mitad libre. Ahora ese lado lo ocupan **las cifras exactas que se enviaron**, en una lista a la derecha separada por un filete.
- **Difícil de leer**: el texto llegaba en dos párrafos largos con muchas cifras seguidas. El modelo recibe ahora otra consigna: una frase de entrada sin cifras que dice qué se está mirando, y después tres o cuatro párrafos de dos o tres frases, con un máximo de dos cifras por frase y 180 palabras en total. Además el bloque usa medida de 62 caracteres e interlineado 1,75, en vez del interlineado de interfaz.
- **Muy IA**: no lleva icono, insignia, color ni marca de «IA». La frase de procedencia usa el mismo `field-help` que las demás notas de alcance de la aplicación, y la lista de cifras al lado deja comprobar la lectura contra los datos, que es lo contrario de un texto que hay que creerse.

Pendiente de resolver al implementar: en móvil «Volver a leer» queda suelto bajo el título porque `section-header` envuelve; va después del texto en pantallas estrechas.

## Las dos direcciones

| | A · Lectura al pie de la ficha | B · Lectura al margen |
|---|---|---|
| Dónde | Sección propia al final de la pantalla, bajo las figuras que explica | En la columna lateral, pegada a las cifras: el inspector del laboratorio y el panel de propiedades |
| Cómo se pide | Un botón en la cabecera de la sección; al llegar el texto, pasa a «Volver a leer» | Igual, pero el botón ocupa el ancho de la columna |
| Cómo se lee | Prosa a ancho de lectura, dos párrafos | Primer párrafo visible y el resto dentro de «Seguir leyendo» |
| A favor | Es la «ficha de lectura» llevada al final: el texto respira y se lee como parte del documento | El texto está junto al número que explica, sin desplazarse; ocupa poco |
| En contra | Hay que bajar hasta el final para verlo | La columna es estrecha: el mismo texto se vuelve una tira larga, y parte queda plegada |
| A 360 px | Igual que en escritorio, al final | La columna cae debajo de las figuras, así que acaba pareciéndose a A |

Las dos usan primitivas que ya existen (`section-header`, `button-secondary`, `button-quiet`, `field-help`, `disclosure`, `property-list`), no añaden color y respetan tinta sobre papel, foco visible, 44 px y los dos temas.

**Recomiendo A**, que es la que elegiste y la que está refinada arriba. La dirección visual acordada es «ficha de lectura», y un texto explicativo de dos párrafos es exactamente eso; en la columna estrecha de B el mismo texto se corta en una tira de muchas líneas y obliga a plegar la mitad. B tiene sentido si prefieres verlo sin desplazarte, aunque sea más breve.

También se pueden combinar: **A en Analizar** (hay sitio y el texto es largo) y **B en Laboratorio** (el inspector ya concentra las cifras). Dímelo si lo prefieres.

## Estados que hay que dibujar en cualquiera de las dos

| Estado | Qué se ve |
|---|---|
| En reposo | Título, botón y la línea de aviso |
| Pidiendo | El botón se desactiva y aparece «Escribiendo la lectura…» como `status-message`; se puede seguir usando la pantalla |
| Con texto | La prosa, el botón pasa a «Volver a leer» y debajo una línea con el modelo y el proveedor |
| Sin sesión | El botón lleva a iniciar sesión, igual que hacen hoy Guardar y la consulta de UniProt |
| Error del proveedor | Un `status-message` de error con el motivo traducido y la posibilidad de reintentar; nunca un texto a medias |
| Límite agotado | «Demasiadas lecturas seguidas. Espera un minuto.» con la misma forma que el aviso de UniProt |
| Cifra no respaldada | El mismo aviso de error: la respuesta se descarta en el servidor y no se enseña |
| Cambia la secuencia | La lectura mostrada se retira, porque ya no describe lo que hay en pantalla |

## Textos y accesibilidad

Todo el texto visible va a `src/i18n/es.ts` y `src/i18n/en.ts` en el mismo cambio. Las cifras se envían formateadas según el idioma activo, como ya las formatea la interfaz: en español `8.445,71` y en inglés `8,445.71`. El bloque es una `section` con su encabezado; la llegada del texto se anuncia con `role="status"`, y el foco no salta solo.

## Lo que no incluye

Chat ni preguntas libres, memoria entre pantallas, envío de la secuencia, lectura de alineamientos o candidatos (el contrato ya los admite, pero no se proponen ahora), guardar la lectura en el proyecto, exportarla al informe PDF, y cualquier gasto, publicación o migración.

## Decisión pedida

- **A**: lectura al pie en las dos pantallas.
- **B**: lectura al margen en las dos pantallas.
- **A + B**: A en Analizar y B en Laboratorio.
- **Ninguna**: dejar la interfaz como está; el backend queda implementado y sin usar.

Cuando elijas, hago el plan por pantallas, lo implemento tal cual se aprobó y entrego capturas reales a 360 y 1280 en ambos temas.
