# Estado de la tienda Grinola

Tienda: GRINOLA · `store-10071200o9ozp-gk7bv1ri.myshopify.com` · plan Basic · USD · Ecuador · tema Horizon (MAIN).

## Hecho (2026-10-08)

### Colecciones (automáticas por etiqueta)
| Colección | Handle | Etiqueta que la llena |
|---|---|---|
| Core Collection | `core-collection` | `core` |
| Ediciones Limitadas | `ediciones-limitadas` | `limited` |
| Anime Editions | `anime-editions` | `anime` |
| Fantasy Editions | `fantasy-editions` | `fantasy` |
| Sweet Editions | `sweet-editions` | `sweet` |

Un producto limitado lleva dos etiquetas, ej. `limited` + `anime`.

### Metafields de producto (`custom.*`, visibles en la tienda)
`material`, `dimensiones`, `peso`, `tiempo_preparacion`, `caracteristicas` (lista), `cuidados`, `unidades_edicion` (entero, solo ediciones reales), `linea` (Core/Limited).

## Pagos — hallazgos

- Shopify Payments **no** está disponible en Ecuador. Shopify cobra una comisión extra por venta al usar pasarelas externas (según plan).
- **Kushki**: app oficial para Shopify (docs.kushki.com/ec/plugins/shopify). Tarjetas, diferidos, 3DS, antifraude. Requiere contrato y certificación. Comisión negociada. Opción principal recomendada.
- **PayPhone**: 5 % + IVA por venta (tarifa pública), acreditación 24–48 h al banco. Integración Shopify por confirmar con PayPhone.
- **Métodos manuales de Shopify** (transferencia bancaria / DeUna): siempre disponibles como respaldo; el cliente compra en el checkout sin WhatsApp y el pedido queda pendiente hasta confirmar el pago.
- **Riesgo de categoría**: Shopify y PayPal prohíben "drug paraphernalia". Los grinders no están nombrados explícitamente; depende de cómo se describen. Describir los productos con honestidad y obtener **confirmación por escrito** de la pasarela antes de lanzar.

## Pendiente
- Datos del usuario (ver lista en la conversación / `docs/requisitos-usuario.md`).
- Zona horaria: cambiar EDT → America/Guayaquil (Configuración → General).
- Pasarela: solicitud a Kushki (+ PayPhone como alternativa).
- Design system, logo, tema (en copia del tema, nunca en el MAIN), páginas, políticas, envíos, SEO, QA.
