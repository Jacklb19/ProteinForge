# Plantilla Base para Aplicaciones Web SPA

Plantilla genérica de inicio para aplicaciones web de página única (SPA) con arquitectura serverless en AWS, soporte de aislamiento de origen cruzado para cómputo intensivo en hilos de trabajo y batería completa de pruebas estáticas y dinámicas.

---

## 1. Características principales

- **Pila tecnológica:** React 19, TypeScript (modo estricto sin `any`), Vite.
- **Aislamiento de origen cruzado:** Cabeceras `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp` configuradas en el servidor de desarrollo, vista previa y en la política de cabeceras de CloudFront (`ResponseHeadersPolicy`), habilitando `SharedArrayBuffer` y Web Workers multi-hilo.
- **Calidad de código y pruebas:** ESLint 9+ con configuración estricta, Vitest, React Testing Library, jsdom y reporte de cobertura con v8 (umbral mínimo del 70%).
- **Infraestructura como Código (IaC):** Especificación en AWS SAM (`template.yaml`) para aprovisionar un bucket privado de Amazon S3, distribución Amazon CloudFront con Origin Access Control (OAC), soporte para enrutamiento SPA y cabeceras de seguridad estrictas (CSP, HSTS, X-Frame-Options, X-Content-Type-Options).
- **Integración continua:** Flujo de trabajo en GitHub Actions (`.github/workflows/ci.yml`) que valida tipos, linting, cobertura de pruebas y compilación de producción.

---

## 2. Requisitos previos

- **Node.js:** Versión 24.x (ver `.nvmrc` o `engines` en `package.json`).
- **npm:** Versión 11.x o superior.
- **AWS CLI** y **AWS SAM CLI** (opcionales para el entorno local, necesarios únicamente para el despliegue manual).

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

# Ejecutar pruebas unitarias y de componentes con informe de cobertura
npm run test:coverage

# Generar la versión de producción optimizada
npm run build

# Previsualizar la compilación de producción localmente (puerto 4173 con cabeceras COOP/COEP)
npm run preview
```

---

## 4. Procedimiento de despliegue en AWS (manual)

El despliegue de la infraestructura y de la aplicación estática lo realiza el operador responsable mediante su propia consola o terminal con credenciales de AWS activas. Antigravity/el agente no ejecuta comandos de despliegue ni interactúa directamente con la cuenta de AWS.

### Paso 1: Compilar la plantilla de infraestructura con SAM
```bash
sam build
```

### Paso 2: Desplegar la infraestructura (creación de S3, CloudFront y políticas)
Para el primer despliegue guiado:
```bash
sam deploy --guided
```
O si ya se dispone de `samconfig.toml` configurado (ver `samconfig.toml.example`):
```bash
sam deploy
```

Al finalizar el despliegue, la salida en consola mostrará los siguientes valores (`Outputs`):
- `AppBucketName`: Nombre del bucket S3 generado.
- `CloudFrontDistributionId`: Identificador de la distribución de CloudFront.
- `AppUrl`: URL pública del sitio estático en CloudFront.

### Paso 3: Compilar los artefactos de la aplicación web
```bash
npm run build
```

### Paso 4: Cargar los archivos estáticos al bucket S3
```bash
aws s3 sync dist/ s3://<AppBucketName> --delete
```

### Paso 5: Invalidar la caché de CloudFront
Para asegurar que los visitantes reciban inmediatamente los nuevos archivos:
```bash
aws cloudfront create-invalidation --distribution-id <CloudFrontDistributionId> --paths "/*"
```

---

## 5. Limitaciones técnicas y consideraciones de seguridad

- **Restricción de versión mínima de TLS con el dominio por defecto:**
  Al emplear el dominio predeterminado de CloudFront (`*.cloudfront.net`), AWS utiliza su certificado SSL compartido y no permite parametrizar `MinimumProtocolVersion` para forzar TLS 1.2 o superior en el visor. Si se requiere cumplimiento estricto de TLS 1.2+ (RNF-06), es indispensable configurar un nombre de dominio propio (CNAME alternativo) asociado a un certificado personalizado expedido en AWS Certificate Manager (ACM en la región `us-east-1`).
- **Política de Seguridad de Contenido (CSP):**
  La cabecera CSP configurada en CloudFront (`ResponseHeadersPolicy`) incluye `'wasm-unsafe-eval'` en la directiva `script-src` y `blob:` en `worker-src`, requeridos específicamente para la instanciación de WebAssembly y el arranque de Web Workers en navegadores modernos.