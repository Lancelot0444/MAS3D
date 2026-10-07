# MAS3D / Grinola

Repositorio de MAS3D (impresión 3D, Ecuador). Contiene:

- `index.html`, `style.css`, `calculator.js`: calculadora de precios de figuras 3D.
- `.claude/skills/`: skills del proyecto, incluido `building-grinola-shopify` (la tienda Shopify de la marca Grinola).
- `.mcp.json`: servidor Shopify Dev MCP (`@shopify/dev-mcp`) para consultar documentación oficial y validar Liquid/Theme Check.
- `docs/prompt-maestro-grinola.md`: prompt maestro y flujo de trabajo por fases de la tienda.

## Reglas para trabajo en la tienda Grinola

- Usa siempre el skill `building-grinola-shopify` y lee sus `references/` antes de diseñar o programar.
- Sigue el flujo por fases de `docs/prompt-maestro-grinola.md`; no avances de fase con bloqueos críticos y espera aprobación antes de modificar el tema.
- No inventes filtros, objetos ni APIs de Liquid/Shopify: consulta Shopify Dev MCP (o `search_docs_chunks` del conector Shopify) y valida antes de publicar.
- Nunca modifiques el tema en producción directamente; trabaja en un development theme.
- Pagos: no asumas Shopify Payments en Ecuador; confirma por escrito con la pasarela que acepta la categoría de producto.
- Propiedad intelectual: no uses nombres o personajes de terceros sin autorización.
- Los skills de terceros (`shopify-*`, `review-ai-shopify-liquid`, MIT, baslefeber/shopify-skills) son una segunda capa; manda la documentación oficial.
