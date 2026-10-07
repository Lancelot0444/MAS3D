# Block scaffold with nested children (validated)

A parent block that hosts repeatable child blocks. Two files: the parent declares the child type and renders children with `{% content_for 'blocks' %}`; the child lives in its own `_`-prefixed file. Both validated with `validate_theme`.

## `blocks/usp-bar.liquid` (parent)

```liquid
{% comment %} A composable trust/USP bar block with nested child blocks. {% endcomment %}
<div class="usp-bar" {{ block.shopify_attributes }}>
  {% content_for 'blocks' %}
</div>

{% stylesheet %}
  .usp-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
  }
{% endstylesheet %}

{% schema %}
{
  "name": "USP bar",
  "blocks": [{ "type": "_usp-item" }],
  "presets": [
    {
      "name": "USP bar",
      "blocks": [
        { "type": "_usp-item" },
        { "type": "_usp-item" }
      ]
    }
  ]
}
{% endschema %}
```

## `blocks/_usp-item.liquid` (child)

The leading underscore marks it internal-only. A theme-block `blocks` array may only declare `{ "type": "_usp-item" }`; the child's own settings live here, in its own file.

```liquid
{% comment %} A single USP/trust item. {% endcomment %}
<div class="usp-item" {{ block.shopify_attributes }}>
  <span class="usp-item__label">{{ block.settings.label }}</span>
</div>

{% stylesheet %}
  .usp-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
{% endstylesheet %}

{% schema %}
{
  "name": "USP item",
  "settings": [
    { "type": "text", "id": "label", "label": "Label", "default": "Free shipping over $50" }
  ]
}
{% endschema %}
```

Key rules this demonstrates:

- `{{ block.shopify_attributes }}` on every block wrapper so the editor can drag, drop, and reorder.
- The parent's `blocks` array references the child by `type` only.
- Every `"type"` must resolve to a real `blocks/<type>.liquid` file, or `shopify theme push` rejects it.
- No `"default": ""` anywhere.
