# Estado y siguiente trabajo

Actualizado el 12 oct 2026 tras la entrega autónoma. Estado local en dev; estos cambios **no están publicados**. Sitios previamente publicados: [frontend](https://protein-forge.vercel.app/) y [backend](https://protein-back.vercel.app/). Sin push, merge, despliegue ni cambio remoto.

| Bloque | Implementación/evidencia | Límite vigente |
|---|---|---|
| Experiencia | Jerarquía pública/banco, navegación, acciones, propiedades/formularios/Ajustes, estados y movimiento reducido refinados | Chromium local; revisión externa 21st bloqueada por aprobación automática |
| Proyectos | CRUD API/frontend, JWT/RLS propietario, snapshots, microsegundos, 409/copia, reanudación/borrado deliberado | Migraciones/publicación y sesión real pendientes |
| Seguridad SQL | Seis pruebas PostgreSQL 18 temporal: dos propietarios, anónimo, transferencia, cascada, rollback y carrera con un éxito/un conflicto | Auth.uid emulado; Supabase/PostgREST real pendiente |
| Datos | Tres referencias completas, origen exacto, UniProt autenticado/acotado, consulta pública real P01308 | Dominios/ensamblado y gateway con JWT real pendientes |
| Estructura | Mol*/BinaryCIF real 1TRZ, cámara/errores/pausa y cobertura anotada | Sin SIFTS/selección sincronizada ni predicción; necesita red/WebGL |
| Informes | Worker PDF/JSON/perfil/alineamiento CSV, métodos/hash/valores crudos; PDF renderizado | Sin PDF etiquetado ni subida/registro |
| RF17 | Worker reproducible, longitud/masa/GRAVY, referencia igual presupuesto, diversidad y transferencia/JSON | Heurística académica; ejecuciones en memoria, sin garantía biológica/óptimo |
| PWA | Recursos/WASM/generador/PDF offline comprobados; Mol* excluido del precache | Proyectos/UniProt/coordenadas requieren red; no sincronización diferida |
| Cuenta | REST Auth/recuperación/refresco/Google por redirección existentes | Google/SMTP y sesión válida actuales sin verificar; lectura Supabase bloqueada por aprobación automática |
| RF18/asistente | Propuesta concreta con consentimiento/validación/cache en [candidatos](candidates.md) | Proveedor/límites/retención/contrato pendientes; sin envío privado habilitado |

## Prioridad siguiente

1. Activar persistencia **solo con autorización externa**: [pasos backend](../../backend/docs/project-persistence.md). Comprobar propietarios A/B con sesiones Supabase reales, CRUD/409/borrado. El usuario decide publicación de ambos repositorios.
2. Comprobar Google/SMTP mediante configuración autorizada y cuenta de prueba real; health/CORS no acredita sesión ni correo. [Google](google-oauth-publicacion.md), [Supabase](conectar-supabase.md), [Vercel](despliegue-vercel.md).
3. RF18 vertical: verificar proveedor vigente, concretar consentimiento/retención/cache privada, validar PDB asociado y reutilizar visor como predicha, fixture público de respaldo y errores explícitos. La respuesta histórica ESM Atlas no garantiza el servicio actual.
4. Dominios InterPro/Pfam/ensamblado, SIFTS, interpretación separada con proveedor/retención comprobados.
5. Inglés/TOTP/PDF etiquetado/historial de generaciones/sincronización definida y auditoría de rendimiento/otros navegadores para demo.

Autorización vigente: decisiones técnicas rutinarias revisables dentro del stack y costo cero. Conservada `.env` sin divulgar valores; nunca service_role. No se habilitan servicios sin condiciones verificables ni se reemplaza consentimiento por una aprobación de desarrollo.
