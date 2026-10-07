# Section scaffold (validated)

A complete `sections/feature-banner.liquid`: image, heading, text, link, alignment, and a Horizon color scheme. Validated with `validate_theme`. Note the section-background pattern, the `presets` entry, scoped `{% stylesheet %}`, no empty defaults, and a single dynamic value passed as a CSS variable.

```liquid
{% comment %} A feature banner: image, heading, text, and a link, with a Horizon color scheme. {% endcomment %}
<section
  class="feature-banner color-{{ section.settings.color_scheme }} section"
  style="--content-align: {{ section.settings.alignment }};"
>
  <div class="section-background color-{{ section.settings.color_scheme }}"></div>
  <div class="page-width feature-banner__inner">
    {% if section.settings.image %}
      <div class="feature-banner__media">
        {{
          section.settings.image
          | image_url: width: 1200
          | image_tag: loading: 'lazy', widths: '400, 800, 1200', sizes: '(min-width: 750px) 50vw, 100vw'
        }}
      </div>
    {% endif %}
    <div class="feature-banner__content">
      {% if section.settings.heading != blank %}
        <h2 class="feature-banner__heading">{{ section.settings.heading }}</h2>
      {% endif %}
      {% if section.settings.text != blank %}
        <div class="feature-banner__text">{{ section.settings.text }}</div>
      {% endif %}
      {% if section.settings.link_label != blank %}
        <a class="feature-banner__link" href="{{ section.settings.link_url }}">
          {{ section.settings.link_label }}
        </a>
      {% endif %}
    </div>
  </div>
</section>

{% stylesheet %}
  .feature-banner {
    color: var(--color-foreground);
    position: relative;
  }
  .feature-banner__inner {
    display: grid;
    gap: 2rem;
    align-items: center;
  }
  .feature-banner__content {
    text-align: var(--content-align);
  }
  @media (min-width: 750px) {
    .feature-banner__inner {
      grid-template-columns: 1fr 1fr;
    }
  }
{% endstylesheet %}

{% schema %}
{
  "name": "Feature banner",
  "settings": [
    { "type": "image_picker", "id": "image", "label": "Image" },
    { "type": "text", "id": "heading", "label": "Heading", "default": "Built for everyday wear" },
    { "type": "richtext", "id": "text", "label": "Text" },
    { "type": "text", "id": "link_label", "label": "Link label", "default": "Shop now" },
    { "type": "url", "id": "link_url", "label": "Link" },
    {
      "type": "select",
      "id": "alignment",
      "label": "Content alignment",
      "options": [
        { "value": "left", "label": "Left" },
        { "value": "center", "label": "Center" }
      ],
      "default": "left"
    },
    { "type": "color_scheme", "id": "color_scheme", "label": "Color scheme", "default": "scheme-1" }
  ],
  "presets": [{ "name": "Feature banner" }]
}
{% endschema %}
```

For production, move the merchant-facing labels in `{% schema %}` to translation keys (`"label": "t:sections.feature_banner.heading"`) backed by `locales/en.default.schema.json`.
