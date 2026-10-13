# ProteinForge — contexto visual

Dirección vigente desde el 12 de octubre de 2026: «ficha de lectura». La referencia completa está en `docs/diseno-visual.md`; el mapa de pantallas, en `docs/pantallas.md`.

- Un solo sitio con la misma barra plana: Inicio, Analizar, Alinear, Diseñar y Biblioteca. Sin sesión, tema e «Iniciar sesión»; con sesión, avatar hacia Perfil. En teléfono, menú como panel superpuesto.
- Cada pantalla abre con un ejemplo real que se puede reemplazar: insulina humana, humana frente a bovina, una búsqueda resuelta y la estructura 1TRZ.
- La interfaz va en tinta sobre papel frío. Los únicos tonos son las seis clases químicas de residuo, definidas en `src/design-tokens.css` y `src/features/chemistry/config.ts`.
- Titulares Bricolage Grotesque, interfaz Atkinson Hyperlegible Next, residuos y cifras IBM Plex Mono.
- Sin rótulos en mayúsculas, tarjetas con icono, pasos numerados ni barra flotante. El texto habla de proteínas, no de la aplicación.
- Movimiento: giro lento de la estructura hasta la primera interacción y fundidos cortos; todo respeta «reducir movimiento». Objetivos táctiles de 44 px, foco visible y contraste AA en ambos temas.

Las primitivas son propias (`Icon`, `BrandMark`, `SegmentedControl`, `PageHeading`, celdas de residuo, cinta de secuencia, mapa de alineamiento, escenario de estructura). No se instalan componentes externos.
