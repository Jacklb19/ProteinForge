# Inferencia desde la aplicación · propuesta

Preparada el **22 oct 2026**. Requiere decisión del propietario antes de implementar. Nada se ejecutó, instaló ni contrató para escribirla. Desarrolla el punto 5 del [relevo](prompt-siguiente-entrega.md): delimitar arquitectura, consentimiento, límites, procedencia y prueba real **antes** de ampliar `DesignService` o añadir un ejecutor.

Hoy el recorrido es manual y comprobado: el laboratorio exporta un borrador y el cuaderno, el propietario ejecuta en Colab y vuelve a importar el ZIP ([recorrido condicionado](design-lab-constraints.md), [laboratorio](laboratory.md)). La aplicación **no** solicita inferencia. `proteinforge.design.v1alpha1.DesignService` existe solo como borrador en `backend/proto/proteinforge/design/v1alpha1/design_service.proto`, sin implementación ni ejecutor.

## API de NVIDIA: términos completos revisados el 23 oct 2026

Leídas las nueve páginas de [NVIDIA API Trial Terms of Service](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf), versión **19 septiembre 2025**, enlazadas desde [RFdiffusion](https://build.nvidia.com/ipd/rfdiffusion) y [ProteinMPNN](https://build.nvidia.com/ipd/proteinmpnn):

- **1.2 y 1.4:** prueba limitada a evaluación interna; excluye producción del servicio y de sus resultados. La producción requiere suscripción separada de NVIDIA o de un proveedor; no hay excepción académica o por ausencia de ingresos.
- **2.2–2.4, 2.6, 3.3 y 4.3:** se necesitan derechos sobre las entradas, hay restricciones para datos confidenciales/personales y existen excepciones de conservación y usos para mejora/seguridad. No prometer ausencia de registro.
- **4.2 y 9:** restricciones para poner el servicio o resultados a disposición de terceros y licencias adicionales por modelo. La licencia abierta del modelo no sustituye los términos del servicio alojado.
- **8, 11–15:** disponibilidad revocable, sin garantías, responsabilidad limitada y arbitraje; no es una promesa de infraestructura gratuita permanente.

El [FAQ oficial](https://docs.api.nvidia.com/nim/docs/product) incluye servir a usuarios finales reales en la definición de producción. **Interpretación para ProteinForge:** abrir inferencia al público entra en ese supuesto aunque la web sea académica y no cobre. La prueba gratuita no autoriza esa integración.

Además, la ficha actual de [ESMFold](https://build.nvidia.com/meta/esmfold) marca su endpoint como **Deprecated** y pide migrar a otro modelo. No se ha probado su disponibilidad mediante inferencia; la cadena RFdiffusion→ProteinMPNN→ESMFold alojada no puede darse por operativa.

**Recomendación pendiente del propietario:** si se explora NVIDIA, hacerlo como ensayo interno solo para él, con datos públicos y sin servir ni publicar sus resultados como función de la web. Restringir la identidad es necesario para ese alcance, pero no convierte cualquier uso personal en evaluación: sigue sujeto a los términos y a las condiciones específicas del modelo. Antes de implementar, verificar un predictor disponible y acordar contrato, consentimiento y acceso. Para inferencia pública, obtener condiciones de producción compatibles o mantener el recorrido manual actual. No se creó cuenta, aceptó contrato, generó clave ni ejecutó solicitud de modelo.

## Lo que se decide

1. Si se abre inferencia desde la web y para quién: solo el propietario, o cualquier sesión con cuenta.
2. Qué ejecutor: **A** ninguno (seguir manual), **B** equipo del propietario, **C** GPU alquilada por horas.
3. Cómo viajan los resultados: bytes dentro del mensaje RPC o archivo en Storage con URL firmada.
4. Dónde vive el estado del trabajo y cuánto dura.
5. Si `DesignService` se implementa como está o se corrige antes de servirlo.

## Opciones de arquitectura

| | A · Manual (actual, recomendada por ahora) | B · Ejecutor del propietario | C · GPU alquilada a demanda |
|---|---|---|---|
| Quién calcula | Colab gratuito, a mano | PC del propietario detrás de la API | Máquina por horas de un proveedor |
| Costo | Cero | Cero, con el equipo encendido | Con tarjeta; fuera de «costo cero» hasta autorización expresa |
| Disponibilidad | Sesión interactiva; Colab no garantiza GPU y limita a 12 h | Solo mientras el equipo esté encendido y accesible | Mientras esté contratada |
| Trabajo nuevo | Ninguno | API + ejecutor + estado + cancelación + cliente + pantalla | Igual que B, más credenciales, gasto y aislamiento del proveedor |
| Riesgo técnico | Ninguno nuevo | ESMFold ya marcó un pico de 7,91 GiB con 76 residuos: la RTX 4060 Laptop de 8.188 MiB queda al límite, sin margen comprobado | Reproducibilidad entre máquinas distintas no garantizada |
| Riesgo de producto | El recorrido depende del propietario | Un ejecutor apagado debe decir «no disponible», no inventar resultados | Factura por tiempo encendido, no por resultados |

No existe opción sobre Colab: su FAQ prohíbe el control remoto, los trabajadores distribuidos y servir cómputo que no sea interactivo en su interfaz, y permite terminar esos entornos sin aviso. **Un túnel o API sobre Colab gratuito queda descartado**, no solo desaconsejado.

Recomendación: mantener **A** hasta que exista una campaña de novo acordada ([propuesta](de-novo-proposal.md)). Si el propietario quiere inferencia desde la app, **B limitada a él mismo**, con una sola tarea a la vez, sin cola y sin promesa de disponibilidad; **C** solo con autorización explícita de gasto.

## Contrato: qué falta decidir en el borrador

El borrador cubre `StartDesign`, `WatchDesign`, `GetDesign` y `CancelDesign`, con `DesignSpec`, etapas, candidatos, confianza por residuo, RMSD y `Provenance`. Antes de servirlo hay que resolver:

- **Tamaño.** `DesignCandidate` lleva estructuras como `bytes`. El límite vigente de mensaje RPC es **2.000.000 bytes** (`backend/app/rpc/router.py`) y no se amplía: un PDB predicho de 76 residuos ocupa decenas de kilobytes y un paquete completo rondó 140.397 bytes, así que un caso pequeño cabe, pero varios candidatos con PAE no. Decidir entre devolver un candidato por mensaje, trocear en el flujo o subir el paquete a Storage y entregar una URL firmada.
- **Estado.** `WatchDesign` es streaming de servidor, admitido por Connect/gRPC-Web; una función sin estado en Vercel no conserva trabajos entre invocaciones. Decidir tabla propia de trabajos con RLS y `SECURITY INVOKER`, o delegar el estado al ejecutor y que la API solo reenvíe. Hace falta migración nueva en el primer caso.
- **Cuotas.** `RESOURCE_EXHAUSTED` ya está previsto en el borrador: definir una tarea simultánea por propietario, un máximo de candidatos por tarea y una longitud máxima coherente con el laboratorio (120 residuos hoy; el generador admite 5–300).
- **Cancelación y pérdida.** Qué pasa si el ejecutor desaparece a mitad: la tarea debe terminar en fallo explícito con el motivo, no quedarse en «en curso» indefinidamente ni completarse con datos parciales.
- **Procedencia.** `Provenance` debe llegar siempre con nombre, versión y pesos de cada herramienta, semillas y marcas de tiempo; un resultado sin procedencia completa se rechaza al validar, igual que hoy en el importador.
- **Validación.** El cliente revalida íntegramente en Worker con las mismas reglas actuales (hashes, secuencia exacta, cadena explícita, coordenadas finitas, PAE numérica). Un manifiesto propio no autentica al autor ni demuestra que se ejecutó un modelo.
- **`DESIGN_MODE_NEW_BACKBONE`** solo tiene sentido si antes existe un caso de novo comprobado. Hasta entonces, implementar únicamente `DESIGN_MODE_MODIFY_REFERENCE` o nada.

## Consentimiento, privacidad y textos

- La secuencia sale del navegador: se pide consentimiento por acción, nombrando el destino concreto (equipo del propietario, proveedor alquilado) y qué se envía. `consent_to_send_sequence` ya es obligatorio en el borrador y sin él la respuesta es `FAILED_PRECONDITION`.
- No se registran secuencias ni secretos en logs; los errores siguen nombrando campos y no valores.
- El consentimiento del asistente no autoriza enviar secuencias a inferencia, y viceversa.
- Toda pantalla o aviso nuevo necesita propuesta maquetada aprobada y texto simultáneo en `src/i18n/es.ts` y `src/i18n/en.ts`.

## Prueba real exigida antes de ampliar la interfaz

1. Una tarea completa desde la aplicación con un ejecutor real: etapas observadas, resultado validado por el Worker y procedencia completa.
2. Una cancelación efectiva y un fallo provocado, ambos visibles y sin resultados inventados.
3. Un rechazo por falta de consentimiento y otro por cuota.
4. Medición de VRAM, RAM, tiempo y tamaño de respuesta; si el pico supera la GPU del ejecutor, se registra el límite en lugar de forzarlo.
5. Pruebas de API y de cliente, y E2E solo del recorrido afectado.

Mientras no existan esas evidencias, no se anuncia «predicción desde la app» ni se ofrece el botón.

## Lo que no incluye

Cola persistente, varios ejecutores, Kubernetes, entrenamiento, pesos en Git o en la función de Vercel, endpoints nuevos sin aprobación, gasto, publicación ni migraciones remotas.

## Decisión pedida

- **Opción A:** mantener el recorrido manual; `DesignService` sigue siendo borrador y no se añade ejecutor.
- **Opción B:** implementar inferencia limitada al propietario con ejecutor en su equipo, una tarea a la vez, resueltos antes los cinco puntos del contrato.
- **Opción C:** autorizar GPU alquilada por horas, con gasto explícito y tope acordado.

Fuentes: [FAQ de Colab](https://research.google.com/colaboratory/faq.html), [limitaciones de funciones en Vercel](https://vercel.com/docs/functions/limitations), [contratos actuales](../../backend/docs/api.md), [arquitectura del backend](../../backend/docs/arquitectura.md), [alojamiento y precios consultados el 12 oct](design-lab-roadmap.md). Los precios de ese roadmap no se reverificaron hoy y no autorizan gasto.
