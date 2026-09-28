# Plantilla Base para Aplicaciones Web SPA (Vercel + Supabase)

Plantilla genérica de inicio para aplicaciones web de página única (SPA) con arquitectura sin costo sobre **Vercel** y **Supabase**, soporte de aislamiento de origen cruzado para cómputo intensivo en hilos de trabajo y batería completa de pruebas estáticas y de base de datos.

---

## 1. Características principales

- **Pila tecnológica:** React 19, TypeScript (modo estricto sin `any`), Vite.
- **Alojamiento y borde (Vercel):** Servido con red de entrega global bajo el plan Hobby. Configuración centralizada en `vercel.json` con soporte para enrutamiento SPA.
- **Aislamiento de origen cruzado y seguridad:** Cabeceras `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, HSTS y CSP restrictiva (con `'wasm-unsafe-eval'` y `worker-src 'self' blob:`, y orígenes `https://*.supabase.co`), habilitando `SharedArrayBuffer` y Web Workers multi-hilo tanto en local como en Vercel.
- **Base de datos y autenticación (Supabase):** PostgreSQL relacional con esquema versionado en `supabase/migrations/` (`profiles`, `projects`, `analyses`, `alignments`, `external_cache`).
- **Seguridad en datos (RLS):** Row Level Security activo en todas las tablas con datos de usuario, con políticas restrictivas evaluadas mediante `(select auth.uid())` para usuarios autenticados y aislamiento estricto en caché externa.
- **Calidad de código y pruebas:** ESLint 10 con configuración estricta, Vitest, React Testing Library, jsdom y prueba automatizada de cumplimiento de RLS en cada migración SQL.

---

## 2. Requisitos previos

- **Node.js:** Versión 24.x (ver `.nvmrc` o `engines` en `package.json`).
- **npm:** Versión 11.x o superior.
- **Cuenta en Vercel y Supabase** (planes gratuitos sin tarjeta).
- **Supabase CLI** (opcional, para desarrollo local o aplicación de migraciones).

---

## 3. Instalación y comandos locales

```bash
# Instalar dependencias con versiones fijadas en el lockfile
npm ci

# Ejecutar el servidor de desarrollo local (puerto 5173 con cabeceras COOP/COEP)
npm run dev

# Verificación de tipos estáticos
npm run typecheck

# Análisis estático de código (ESLint)
npm run lint

# Ejecutar pruebas unitarias, de componentes y de migraciones con cobertura
npm run test:coverage

# Generar la versión de producción optimizada
npm run build

# Previsualizar la compilación de producción localmente (puerto 4173 con cabeceras COOP/COEP)
npm run preview
```

---

## 4. Procedimiento de despliegue

El despliegue lo realiza el operador responsable mediante la integración Git de Vercel y la consola de Supabase. El agente no ejecuta despliegues ni interactúa con servicios remotos.

### Paso 1: Configurar el proyecto en Supabase
1. Crear un nuevo proyecto en [Supabase](https://supabase.com) (plan Free).
2. Obtener la **URL del proyecto** y la **clave anónima (`anon public`)** desde la sección *Project Settings > API*.
3. Aplicar las migraciones del directorio `supabase/migrations/`:
   - **Vía Supabase CLI (recomendado):**
     ```bash
     supabase link --project-ref <tu-project-ref>
     supabase db push
     ```
   - **O vía SQL Editor:** Copiar y ejecutar el contenido de `supabase/migrations/20260928000000_initial_schema.sql` en el editor SQL del panel de Supabase.

### Paso 2: Desplegar en Vercel
1. Importar el repositorio Git en [Vercel](https://vercel.com) (plan Hobby).
2. Framework Preset: **Vite** (detectado automáticamente).
3. Configurar las variables de entorno en el panel de Vercel (*Settings > Environment Variables*):
   - `VITE_SUPABASE_URL`: `https://<tu-id>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `<tu-clave-anon-publica>`
4. Desplegar. Vercel aplicará automáticamente las cabeceras declaradas en `vercel.json` y el enrutamiento para la SPA.

---

## 5. Consideraciones de seguridad y arquitectura

- **Seguridad a nivel de fila (RLS):** La clave anónima (`anon`) llega al cliente de forma segura porque la base de datos PostgreSQL impone RLS en todas las tablas con datos de usuario. Toda consulta sin autenticar es rechazada.
- **Acceso a caché externa:** La tabla `external_cache` revoca permisos tanto a `anon` como a `authenticated`. Solo la API del backend mediante el rol de servicio (`service_role`) puede acceder a ella.
- **Política de Seguridad de Contenido (CSP):** Se restringe estrictamente a `'self'` y al subdominio `https://*.supabase.co`. Dominios de fuentes externas (PDB, UniProt) se declararán conforme se integren en sprints posteriores.