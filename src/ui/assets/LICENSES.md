# Batch B-C UI Dependency and Test License Inventory

| Dependency | Exact version | Use | License | Source |
|---|---:|---|---|---|
| `lucide-react` | `1.24.0` | Locally bundled operational icons | ISC | package `LICENSE` and package metadata in `node_modules/lucide-react` |
| `react` | `19.2.7` | Local dashboard component runtime | MIT | package `LICENSE` and package metadata in `node_modules/react` |
| `react-dom` | `19.2.7` | Local dashboard renderer | MIT | package `LICENSE` and package metadata in `node_modules/react-dom` |
| `@playwright/test` | `1.61.1` | Batch C local Chromium layout/visual test runner | Apache-2.0 | package `LICENSE` and package metadata in `node_modules/@playwright/test` |
| `@axe-core/playwright` | `4.12.1` | Batch C automated WCAG audit adapter | MPL-2.0 | package `LICENSE` and package metadata in `node_modules/@axe-core/playwright` |
| `axe-core` | `4.12.1` | Transitive Batch C accessibility rule engine | MPL-2.0 | package `LICENSE` and package metadata in `node_modules/axe-core` |

No icon, font, raster asset, script, or stylesheet is loaded from a CDN or remote
origin. The Vite production build bundles the imported icon code locally.

Project-authored scene SVG source, ownership, license classification, dimensions,
and SHA-256 are recorded in `src/ui/scene/assets/ASSET_INVENTORY.md`.

## Batch E PWA icons

- Files: `public/icons/agent-office.svg` and
  `public/icons/agent-office-maskable.svg`.
- Source and ownership: project-authored code-native SVG in this repository.
- License: same license as the Agent Office repository.
- Remote content, tracking, executable script, user-supplied SVG, provider logo,
  model identity, and real-person representation: none.
