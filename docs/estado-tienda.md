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

## Avance 2026-10-08 (tema "Grinola - Desarrollo", id 163145941097, sin publicar)
- Sistema visual: fondo #111310, texto #ECE6D8, champagne #C9B07A (botones), bosque #1E2B1F, bordes #2C3529. Tipos: Bodoni Moda (títulos), Jost (texto, cercana al logotipo GRINOLA).
- Cabecera: menú `grinola-principal`, barra "Impreso en 3D en Ecuador", sin selector de país/idioma.
- Home: hero, GRINOLA Core, Limited Editions, beneficios, colecciones, proceso (propuesta), FAQ, newsletter.
- Colecciones renombradas: `grinola-core`, `limited-editions` (+ SEO en las 5).
- Páginas borrador (no publicadas): nosotros, preguntas-frecuentes, envios, devoluciones, contacto.
- Menú pie: `grinola-ayuda`.
- Dominios libres: grinola.store ($9), somosgrinola.com ($16), grinola.org ($16), grinola.net ($19). Ocupados: .com/.ec/.shop.
- Pendiente: plantilla de producto (PDP), footer, logo subido (archivo), productos.

## Rediseño a medida (2026-10-08, sobre mockups del dueño)
Código en `theme/` (versionado). Se sube al tema "Grinola - Desarrollo" con themeFilesUpsert tipo URL desde raw.githubusercontent.com (el repo es público: no guardar secretos aquí).
- Secciones: grinola-hero, grinola-collection-cards, grinola-featured-products, grinola-story, grinola-steps, grinola-faq, grinola-product-details.
- Snippets: grinola-motion (reveal al hacer scroll, tilt 3D con mouse, respeta reduced-motion), grinola-icon.
- Home: hero → colecciones → destacados → historia → cómo comprar → FAQ.
- PDP: galería carrusel (swipe en móvil) + zoom, miniaturas a la izquierda, selector de variantes con botones (tamaño Pequeño/Grande, precio se actualiza), franja de beneficios, detalles desde metafields, cómo comprar, FAQ, recomendados.
- No se usan reseñas ni estrellas falsas ni logos de pago no activos.

## Catálogo (2026-10-08, noche)
- 7 productos ACTIVOS y publicados en Tienda online (tienda con contraseña): Fantasy Fruit Purple, Fantasy Fruit Orange, Cupcake Sweet Grinder, Samurai Green Edition, Shadow Ninja Edition, Chibi Blush Edition (Tamaño Pequeño $15 / Grande $25, PROVISIONAL), Skull Flame Case (5 colores, $15 PROVISIONAL).
- 5 en BORRADOR por falta de fotos: Grinder Classic, Grinder Sphere, Pocket Case, Celtic Pocket Case, Rolling Station.
- Inventario no rastreado + venta continua (bajo pedido). Metafields: material PLA, línea, características. Datos semilla en `catalog/`.
- Envíos existentes en Shopify (por defecto): Ecuador "Standard" $11; Internacional $19 (28 países). Revisar/ajustar.
- Footer en español con menú grinola-ayuda y suscripción.
