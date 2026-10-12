# Mapa vigente de pantallas

Actualizado el 12 oct 2026. Web pública con encabezado en escritorio y dock móvil; banco con Mi espacio · Analizar · Alinear · Ajustes. Biblioteca/candidatos se abren desde las tareas y Analizar. Cuenta/tema accesibles en ambos marcos. Rutas en `src/shared/navigation.ts`.

| Pantalla/panel | Ruta | Estado local y límite |
|---|---|---|
| Inicio público | `/` | Ejemplo P01308 calculado, perfil y ornamentos etiquetados; cinco herramientas disponibles, persistencia en preparación hasta activación remota |
| Mi espacio | `/app` | Bienvenida, borrador, cuatro tareas y proyectos por propietario |
| Analizar | `/analyze` | Editor/FASTA, propiedades/perfil/propensiones/lector, origen exacto, guardar/exportar |
| Alinear | `/alignment` | Gotoh/BLOSUM WASM, cancelación/trazas, vigencia de resultados; guardar/exportar comparación |
| Guardar proyecto | Analizar/Alinear | Crear/actualizar/copia y recarga confirmada; 409 conserva borrador; requiere API/migraciones activadas |
| Lista de proyectos | Mi espacio | Listar/paginar/abrir/renombrar/eliminar con confirmaciones y token de propietario |
| Biblioteca | `/library` | Tres referencias completas offline, UniProt autenticado, versiones y reemplazo deliberado; dominios/ensamblado pendientes |
| Visor experimental | Biblioteca | Mol* bajo demanda/BinaryCIF real, cámara/errores; cobertura anotada, selección sincronizada pendiente |
| Informe | Analizar/Alinear | PDF/JSON/CSV local, métodos/hash/procedencia; comparación vigente, PDF sin etiquetado semántico |
| Candidatos | `/generate` | RF17 local: masa/GRAVY, semilla/presupuesto, referencia aleatoria, diversidad y transferencia a análisis/alineamiento |
| Predicción/interpretación | Sin ruta activa | RF18/asistente pendientes de condiciones de proveedor, consentimiento y caché |
| Ajustes | `/settings` | Cuenta/conexión API/tema/idioma; inglés completo/TOTP/sincronización pendientes |
| Acceso/registro/recuperación | `/sign-in`, `/sign-up`, `/recover` | REST Supabase Auth; estados configurado/no configurado; Google habilitado públicamente; flujo completo y entrega SMTP sin verificar |
| Privacidad/condiciones | `/privacy`, `/terms` | Públicas, incluyen guardado deliberado y consultas/descargas reales |
| Dirección desconocida | Cualquier otra | Regreso al trabajo o Inicio |

Entrar a la app abre Mi espacio; el ejemplo abre Analizar. Tras acceso se vuelve a Mi espacio o destino solicitado. Borradores/búsquedas en memoria; último proyecto guardado recuperado del servidor por un identificador local de cuenta. Sin secuencias en localStorage ni sincronización offline.

Marco, PageHeading, tokens/fuentes conservados. Chromium proporcional a 360/1280, ambos temas, AA, teclado/foco, 44 px y movimiento reducido; otros navegadores sin certificar. [Plan](plan-desarrollo.md), [proyectos](projects.md), [referencias](references.md), [informes](reports.md), [RF17](candidates.md).
