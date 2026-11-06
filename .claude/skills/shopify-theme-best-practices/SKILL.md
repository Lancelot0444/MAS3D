---
name: shopify-theme-best-practices
description: Write production-grade Shopify theme code (Liquid, sections, blocks, snippets) the way a senior developer would. Use whenever generating or editing Liquid, theme sections/blocks/snippets, schema settings, prices, images, translatable strings, or custom product/cart data. Enforces the money filter over raw prices, image_url/image_tag over raw img tags, the t filter over hardcoded strings, metafields and line-item properties over title parsing, composition over monolithic sections, and per-component CSS/JS over inline styles.
---

# Shopify theme best practices

Your job is not to produce Liquid that runs. It is to produce Liquid that a senior Shopify developer would approve in code review and that survives `shopify theme push` to a live store. AI-written Liquid usually parses fine and is still wrong in ways that only show up in production: a raw integer where a price should be, an inline style that gets stripped on upload, a hardcoded English string on a store that sells in five languages.

Apply these rules by default. Each one names the failure it prevents. A rule you understand is one you can override when the case is genuinely the exception, but the burden is on the exception.

## 1. Prices go through the `money` filter, always

`product.price` is an integer in the shop's smallest currency unit (cents). Output it raw and the customer sees `1999`, not `$19.99`. The `money` filter applies the store's currency format.

```liquid
{# BAD: ships "1999" or "$19.9" depending on what you guessed #}
${{ product.price }}
{{ product.price | divided_by: 100 }}

{# GOOD #}
{{ product.price | money }}
{{ product.price | money_with_currency }}
{{ product.compare_at_price | money_without_trailing_zeros }}
```

Never divide by 100 yourself. Currencies have different decimal places (JPY has none) and the filter knows that.

## 2. Images go through `image_url` + `image_tag`, never a raw `<img>`

Raw `<img src>` with a hardcoded asset path skips responsive sizing, lazy-loading, and width/height attributes, so it ships a 2000px file to a phone and shifts the layout while it loads. The Liquid filters generate a correct, responsive tag.

```liquid
{# BAD #}
<img src="{{ product.featured_image.src }}">

{# GOOD #}
{{
  product.featured_image
  | image_url: width: 800
  | image_tag: loading: 'lazy', widths: '300, 600, 900', sizes: '(min-width: 750px) 50vw, 100vw'
}}
```

The one exception is the LCP hero image, which should load eagerly with `loading: 'eager'` and `fetchpriority: 'high'`. See the `shopify-performance-audit` skill.

## 3. User-facing strings go through the `t` filter

Hardcode "Add to cart" and the store can never be translated. Every string a customer reads comes from a locale file via the `t` filter.

```liquid
{# BAD #}
<button>Add to cart</button>

{# GOOD #}
<button>{{ 'products.product.add_to_cart' | t }}</button>
```

Add the key to `locales/en.default.json`. Do **not** use the `default:` argument on the `t` filter (`{{ 'x' | t: default: '...' }}`): theme-check treats `default` as a reserved name and the push fails. Either ship the locale key or hardcode the literal string; never the half-measure.

## 4. Custom data: metafields for product data, line-item properties for cart data

This is the rule AI breaks most often, and the one that separates a professional from a hobbyist. Never derive structured data by parsing the product title, handle, description, or tags. Those are content, not a database, and they break the moment a merchant renames something.

**Per-product custom data → a metafield** (define in Settings → Custom data):

```liquid
{# BAD: title parsing, breaks on any rename #}
{% assign material = product.title | split: ' - ' | last %}

{# GOOD #}
{{ product.metafields.custom.material.value }}
```

**Per-line custom data (engraving, gift note) → a line-item property** inside the product form. Never build a shadow cart in localStorage.

```liquid
{% form 'product', product %}
  <input type="hidden" name="id" value="{{ product.selected_or_first_available_variant.id }}">
  <label for="engraving">{{ 'products.product.engraving' | t }}</label>
  <input type="text" id="engraving" name="properties[Engraving]">
  <button type="submit" name="add">{{ 'products.product.add_to_cart' | t }}</button>
{% endform %}
```

A property whose name starts with `_` is hidden from the customer in cart and checkout but still recorded on the order. See the `shopify-metafields-architect` skill for designing the data model.

## 5. Let Shopify own variant selection

Shopify has a complete variant system: options, availability, price per variant, the selected variant. Rebuilding any of it in JavaScript means you now maintain a parallel source of truth that drifts. Use the platform's variant picker and read `product.selected_or_first_available_variant`.

## 6. Composition over one giant section

Reach for the platform's primitives before writing a 400-line custom section. A storefront is built from small, nestable blocks. A custom block should plug into the existing architecture and emit the data attributes the stock JS expects, not reimplement it.

```liquid
{# A composable block that renders nested child blocks #}
<div class="usp-bar" {{ block.shopify_attributes }}>
  {% content_for 'blocks' %}
</div>
```

Always put `{{ block.shopify_attributes }}` on a block's wrapper element so theme-editor drag-and-drop works.

## 7. Per-component CSS and JS, never inline styles

Inline `style="..."` on elements inside a `text` or `richtext` setting is stripped by Shopify's sanitizer and the upload fails. Use `{% stylesheet %}` and `{% javascript %}` tags (supported in sections, blocks, and snippets). For a single dynamic value, pass it as a CSS variable.

```liquid
{# GOOD: one dynamic value via a CSS variable #}
<div class="promo" style="--gap: {{ block.settings.gap }}px">...</div>
{% stylesheet %}
  .promo { gap: var(--gap); }
{% endstylesheet %}
```

## 8. Accuracy: if it is not in the Shopify docs, it does not exist

The most dangerous AI Liquid is a hallucinated filter that reads plausibly. `titleize` is real in Rails and fake in Shopify; a student once burned ten minutes on code that was syntactically perfect and would never run. Before you ship any filter, tag, or object path you are not certain of, verify it against the Shopify docs (use the Shopify Dev MCP `validate_theme` / `search_docs_chunks`). Memory is not a substitute for the docs.

## Schema gotchas that pass validation but fail `shopify theme push`

`validate_theme` catches Liquid and schema syntax. It does not catch all of these. The live CLI does.

- **`"default": ""` is rejected** for any setting type that requires a value. Provide a non-empty default or omit the `default` key.
- **`{% doc %}` is only allowed in snippets and blocks**, never in sections. Use `{% comment %}` in sections.
- **Inline `style="..."` in `text`/`richtext` settings is sanitized away.** Use the block's own settings (`alignment`, `color`, `font_size`).
- **No filters in a Liquid comparison operand.** `{% if i == rating | plus: 1 %}` fails. Assign first: `{% assign next = rating | plus: 1 %}{% if i == next %}`.
- **Theme block schemas only declare `{ "type": "child-type" }`** in their `blocks` array (no inline `name`/`settings`). Define the child in its own `blocks/_child.liquid` file. The leading underscore is the convention for internal-only child blocks.
- **`for` loops cap at 50 iterations.** Use `{% paginate %}` for larger collections.

## When to use this skill

Any time you generate or edit `.liquid` files, `{% schema %}` JSON, prices, images, translatable strings, or custom product/cart data in a Shopify theme. If the task is specifically performance, SEO, accessibility, data modeling, or scaffolding a new section, the matching dedicated skill goes deeper; this one is the baseline they all assume.

---

Part of [Shopify Skills for Claude](https://github.com/baslefeber/shopify-skills) by [learnshopify.dev](https://learnshopify.dev/starter-kit): opinionated skills for production-grade Shopify development.
