---
name: shopify-section-builder
description: Scaffold a complete, production-ready Shopify (Horizon / Online Store 2.0) section or theme block. Use when asked to build a new section, build a block, create a customizable theme component, add a content section to a store, or generate section/block schema. Produces correct schema JSON, merchant settings, scoped CSS/JS, locale keys, shopify_attributes for the editor, and nested child blocks via content_for.
---

# Shopify section builder

A section is the unit a merchant drops onto a page and customizes in the theme editor. Getting one right means more than valid Liquid: the schema has to expose the right settings, the CSS has to be scoped, every string has to be translatable, and the editor has to be able to drag, drop, and reorder it. AI tends to produce a section that renders but isn't actually editor-ready, missing `shopify_attributes`, hardcoding strings, or painting a background that Horizon's CSS overrides. This skill scaffolds the whole thing correctly.

## The anatomy of a correct section

1. **Markup** with a class hook and `{{ block.shopify_attributes }}` on any block wrappers.
2. **`{% stylesheet %}`** for scoped CSS (never inline styles, never a global asset file for component CSS).
3. **`{% schema %}`** with settings, blocks, and a `presets` entry so it appears in the editor's "Add section" list.
4. **Locale keys** for every label and default the merchant or customer reads.

Use `{% comment %}` in sections, not `{% doc %}` (`{% doc %}` is only valid in snippets and blocks).

See `references/section-scaffold.md` for a full validated section, and `references/block-scaffold.md` for a block with nested child blocks.

## Schema rules that prevent a failed `shopify theme push`

These pass `validate_theme` and still get rejected by the live CLI, so bake them in:

- **Never `"default": ""`.** Provide a non-empty default or omit the `default` key. This is the most common push failure.
- **Add a `presets` block** or the section won't show up in the theme editor's add-section flow.
- **No filters inside a Liquid comparison.** Assign the computed value first.
- **For settings types**, use the right one: `text`, `richtext`, `image_picker`, `color_scheme`, `select`, `range`, `collection`, `product_list`, `url`, etc. Use `collection`/`product_list` when the count is dynamic; only use repeated individual `product` slots when the count is genuinely fixed and small.

## Horizon color schemes: the section-background pattern

In Horizon, `base.css` forces `.section` elements transparent so backgrounds can be layered, with a 3-class specificity rule. So painting `background:` on the section element does nothing. Instead render a dedicated `.section-background` child and put the color-scheme class on **both** the section (so children inherit `--color-foreground`) and the background div (so it actually paints):

```liquid
<section class="feature color-{{ section.settings.color_scheme }} section">
  <div class="section-background color-{{ section.settings.color_scheme }}"></div>
  <div class="page-width feature__inner">
    <h2>{{ section.settings.heading }}</h2>
  </div>
</section>

{% stylesheet %}
  .feature { color: var(--color-foreground); position: relative; }
  /* No background on .feature: the .section-background child paints it. */
{% endstylesheet %}
```

## Nested blocks: separate child files

A section or block that hosts repeatable child content declares the child type and renders children with `content_for`. Theme-block schemas may only declare `{ "type": "child-type" }` in their `blocks` array (no inline `name`/`settings`); define the child in its own `blocks/_child.liquid` file. The leading underscore marks it internal-only.

```liquid
<div class="usp-bar" {{ block.shopify_attributes }}>
  {% content_for 'blocks' %}
</div>
{% schema %}
{ "name": "USP bar", "blocks": [{ "type": "_usp-item" }], "presets": [{ "name": "USP bar" }] }
{% endschema %}
```

## After scaffolding

Run `validate_theme` (Shopify Dev MCP) on every file, fix what it flags, then confirm against a dev theme with `shopify theme push`, since the live CLI catches schema issues the validator misses. Cross-check that every `"type"` referenced in a block list resolves to a real `blocks/<type>.liquid` file.

## When to use this skill

Building any new section or block: a hero, a USP/trust bar, a featured-collection row, a rich-text block, an FAQ accordion, a custom PDP block. For the data those blocks read, pair with `shopify-metafields-architect`; for the baseline Liquid rules, `shopify-theme-best-practices`.

---

Part of [Shopify Skills for Claude](https://github.com/baslefeber/shopify-skills) by [learnshopify.dev](https://learnshopify.dev/starter-kit): opinionated skills for production-grade Shopify development.
