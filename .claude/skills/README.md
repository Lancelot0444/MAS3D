# Skills de Claude para MAS3D

Copiadas del repositorio oficial **github.com/anthropics/skills** (licencia Apache-2.0,
ver `LICENSE.txt` dentro de cada carpeta), commit `2c5958e` (6-nov-2026).

| Skill | Para qué sirve en MAS3D |
|---|---|
| `pdf` | Cotizaciones y facturas en PDF, unir/separar PDFs, llenar formularios |
| `xlsx` | Reportes contables y de ventas en Excel con fórmulas |
| `docx` | Contratos, propuestas y documentos Word |
| `pptx` | Catálogos y presentaciones de productos |
| `frontend-design` | Mejorar el diseño de la app y páginas web |
| `webapp-testing` | Probar la app automáticamente con Playwright |
| `canvas-design` | Pósters, piezas gráficas y artes (PNG/PDF) |
| `theme-factory` | Aplicar temas de color/tipografía a documentos |
| `skill-creator` | Crear skills propias de MAS3D |

Claude Code las carga solo al abrir esta carpeta (`claude`). Las dependencias de Python
están en `../requirements-skills.txt`; en Windows `instalar-pc.ps1` instala todo.

Para actualizarlas:

```bash
git clone --depth 1 https://github.com/anthropics/skills /tmp/anthropic-skills
cp -r /tmp/anthropic-skills/skills/{pdf,xlsx,docx,pptx,frontend-design,webapp-testing,canvas-design,theme-factory,skill-creator} .claude/skills/
```
