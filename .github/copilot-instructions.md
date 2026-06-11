# Copilot instructions — Hocking Luxury Lodges

This is a static **Astro 6** site for two vacation-rental lodges (Luxe Haus
and Speakeasy) in Hocking Hills, Ohio. It is built and deployed to
**GitHub Pages** at `hockingluxurylodges.com` (custom domain via
[`public/CNAME`](../public/CNAME)) by [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

There is **no server runtime** — every page is prerendered HTML. All
interactivity is inline `<script is:inline>` in [`src/layouts/Layout.astro`](../src/layouts/Layout.astro)
(i18n switcher, weather badge) plus Bootstrap 5's bundle. Don't add SSR
adapters, API routes, or server endpoints — the site must remain a pure
static build.

Keep changes small, focused, and idiomatic for Astro 6 + Astro Content
Collections. Don't introduce new frameworks or refactor unrelated code.

## Tech stack (versions pinned in [`package.json`](../package.json))

- **Astro 6.0.x** with `@astrojs/sitemap` and a custom `llms-txt` integration
- **Bootstrap 5.3** (CSS + JS bundle) for layout and components
- **Font Awesome 6** (free) — CSS files served from `public/assets/fontawesome/`
- **gray-matter** for parsing frontmatter in the llms-txt integration and
  the monthly guide-entry generator script
- **TypeScript** in strict mode (extends `astro/tsconfigs/strict`)
- **Node 22** (set by the GitHub Actions workflows)

## Project layout

- [`astro.config.mjs`](../astro.config.mjs) — site config, integrations, and
  **redirects** (see "Renaming a route" below).
- [`src/content.config.ts`](../src/content.config.ts) — Content Collections
  schema. Two collections:
  - `lodges` — the two rental properties (`src/content/lodges/*.md`).
    Rich frontmatter: `unitId`, `roomId`, `cardImage`, `airbnbUrl`,
    `vrboUrl`, `youtubeId`, `guests`, `bedrooms`, `beds`, `bathrooms`,
    `sleeping[]`, `amenities[]`, `goodToKnow[]`, `reviews[]`, plus `_es`
    variants for Spanish translations.
  - `guide` — the **Local Guide** (things to do, seasonal tips, travel
    inspiration). Files live in `src/content/guide/*.md`. **This was
    previously called "articles" — do not reintroduce that name.**
- [`src/pages/`](../src/pages/) — Astro routes. Dynamic routes use
  `[slug].astro` and call `getCollection('lodges' | 'guide')`.
- [`src/layouts/Layout.astro`](../src/layouts/Layout.astro) — global shell,
  `<head>` (canonical, OG, Twitter, favicons, manifest), nav, footer,
  weather badge, and the inline i18n runtime (see "i18n" below).
  **Google Analytics ID `G-04Q5RY1JHY` is hardcoded here.**
- [`src/layouts/LodgeLayout.astro`](../src/layouts/LodgeLayout.astro) —
  per-lodge template. Auto-discovers images under
  `src/assets/images/{imageFolder}/{section}/*.{jpg,jpeg,png,gif}` via
  `import.meta.glob` and produces optimized WebP variants with Astro's
  `getImage()` API (400px thumbs at q=75, 1400px full at q=80,
  1600px hero from `cover.jpg` at q=80).
- [`src/components/`](../src/components/) — `LanguageSwitcher.astro`
  (EN/ES dropdown with inline SVG flags), `Analytics.astro` (reusable
  GA4 snippet — note: currently *not* used; analytics are duplicated
  inline in `Layout.astro`).
- [`src/i18n/{en,es}.ts`](../src/i18n/) — translation dictionaries. Both
  must stay in sync.
- [`src/integrations/llms-txt.mjs`](../src/integrations/llms-txt.mjs) —
  custom Astro integration that emits `llms.txt` and `llms-full.txt` at
  build time. Update this whenever you rename a content collection or a
  public URL.
- [`src/styles/custom.css`](../src/styles/custom.css) — brand variables
  (`--brand-primary: #4B7D67`, `--brand-btn-radius: 26px`, etc.) and all
  custom styling. Brand source of truth is also mirrored in
  [`branding.json`](../branding.json).
- [`.github/workflows/`](../.github/workflows/) — `deploy.yml` (Pages) and
  `monthly-guide-entry.yml` (auto-generates a new bilingual guide entry
  on the first of each month via OpenRouter).
- [`.github/scripts/generate-guide-entry.mjs`](../.github/scripts/generate-guide-entry.mjs) —
  the OpenRouter script the monthly workflow runs. Two-phase: research
  with `perplexity/sonar-pro`, write with `openai/gpt-4.1` routed
  through Azure (BYOK). Reads existing entries from `src/content/guide/`
  and writes a new dated Markdown file with EN + ES content.

## Conventions

### Internationalization

- All user-visible strings live in [`src/i18n/en.ts`](../src/i18n/en.ts) and
  [`src/i18n/es.ts`](../src/i18n/es.ts). The dictionaries are serialized
  into the page and applied client-side by the inline script in
  `Layout.astro`. The chosen language is persisted in `sessionStorage`
  under the key `siteLanguage`.
- In templates, mark elements with `data-i18n="key.path"`. Use
  `data-i18n-html` when the string contains HTML (e.g. `<br/>`).
- For long-form bilingual content in Markdown, wrap with
  `<div data-lang="en">…</div>` and `<div data-lang="es">…</div>`. The
  i18n script toggles `display` on these blocks based on the active
  language.
- When adding a new key, add it to **both** locale files using the same
  shape. Spanish translations should read naturally — not literal
  word-for-word.

### Routes & URLs

- Lodges live at `/lodges/{slug}` and guide entries at `/guide/{slug}`.
  The site root is `https://hockingluxurylodges.com`.
- Sitemap is auto-generated to `/sitemap-index.xml` by `@astrojs/sitemap`
  and referenced from [`public/robots.txt`](../public/robots.txt).
- The home page emits `LodgingBusiness` schema.org JSON-LD inline — keep
  it in sync with site name, URL, and address if any of those change.

### Lodge content

- Lodge frontmatter has many optional fields (see [Luxe Haus](../src/content/lodges/luxe-haus.md)
  for a complete example). When adding a new lodge:
  1. Drop images into `src/assets/images/{imageFolder}/{section}/`.
  2. Add `cover.jpg` at the lodge root for the hero image.
  3. Use the existing section folder names where possible
     (`bedroom-N`, `full-bathroom-N`, `full-kitchen`, `living-room-*`,
     `patio-*`, `exterior`, etc.) — `LodgeLayout.astro` formats these
     into section titles via `formatSectionTitle()`.
  4. Provide both English and `_es` variants of every user-facing field.

### Content schema changes

When adding fields to a collection, update
[`src/content.config.ts`](../src/content.config.ts) **and** update
[`src/integrations/llms-txt.mjs`](../src/integrations/llms-txt.mjs) if the
field should appear in the AI-friendly summary.

### Styling

- Bootstrap 5 + Font Awesome are loaded from `public/assets/`.
- Custom CSS belongs in [`src/styles/custom.css`](../src/styles/custom.css).
- Use the `--brand-*` CSS variables (and the `.btn-primary-brand`,
  `.btn-outline-brand` utility classes) instead of hardcoding colors.
  If you need a new brand value, add it to both `:root` in `custom.css`
  and [`branding.json`](../branding.json).

## Renaming a route / adding redirects

Astro emits **meta-refresh redirect HTML** for static builds — this works on
GitHub Pages with no server config. Always add a redirect when renaming a
public URL so existing inbound links and search results keep working.

Add entries to the `redirects` map in [`astro.config.mjs`](../astro.config.mjs):

```js
// astro.config.mjs
export default defineConfig({
  // ...
  redirects: {
    // Static → static
    '/old-page': '/new-page',

    // Dynamic → dynamic. The destination pattern's param shape must match
    // an existing route exactly. If your real page is `/guide/[slug]`,
    // the destination must also be `/guide/[slug]` (NOT `/guide/[...slug]`).
    '/articles/[slug]': '/guide/[slug]',
  },
});
```

Rules and gotchas:

- The destination must match a route that actually exists in `src/pages/`.
  Build will fail with `InvalidRedirectDestination` otherwise.
- **Param shape must match exactly:** `[slug]` ↔ `[slug]`,
  `[...slug]` ↔ `[...slug]`. You can't redirect `[...slug]` → `[slug]`
  or vice versa, even if the runtime values would be identical.
- The generated file includes a `<link rel="canonical">` to the new URL
  and `<meta name="robots" content="noindex">` so old URLs drop out of
  search indexes naturally.
- Add a comment above each redirect explaining when and why it was added.
- **Don't delete redirects** without checking what links to them — they're
  cheap to keep and protect inbound traffic.

When you rename a content collection or move pages, also:

1. Use `git mv` (not delete + create) so file history is preserved.
2. Update [`src/i18n/en.ts`](../src/i18n/en.ts) and
   [`src/i18n/es.ts`](../src/i18n/es.ts) keys and labels.
3. Update [`src/layouts/Layout.astro`](../src/layouts/Layout.astro) nav links.
4. Update [`src/pages/404.astro`](../src/pages/404.astro) CTA links.
5. Update [`src/integrations/llms-txt.mjs`](../src/integrations/llms-txt.mjs)
   (collection name, section heading, and emitted URLs).
6. Update any GitHub workflow / script under `.github/` that reads or
   writes that path (e.g. `monthly-guide-entry.yml`,
   `generate-guide-entry.mjs`).
7. Run `npm run build` and confirm both the new pages **and** the
   `dist/<old-path>/index.html` redirect files are produced.

## Build & local checks

- `npm run dev` — local dev server with HMR (default port 4321).
- `npm run build` — production build into `dist/`. Must succeed before
  pushing; the deploy workflow runs the same command.
- `npm run preview` — serve the built `dist/` locally to sanity-check.
- After a route rename or i18n change, do a quick visual check on Windows:
  ```powershell
  Get-ChildItem dist -Recurse -Filter index.html | Select-Object FullName
  Get-Content dist/llms.txt
  ```
- Build cache lives in `.astro/` (gitignored). If a content rename
  produces stale references in `.astro/data-store.json`, just rebuild —
  it regenerates from the on-disk `src/content/` files.

## Things not to do

- Don't add a new top-level "Articles" or "News" section — that content
  belongs under the **Local Guide** (`/guide`).
- Don't hardcode user-visible English strings in `.astro` files — route
  them through [`src/i18n/`](../src/i18n/) using `data-i18n` attributes.
- Don't bypass `git mv` for renames; we want history intact.
- Don't commit anything from [`.env`](../.env) (contains the real
  `OPENROUTER_API_KEY`) or `node_modules/`. Both are in
  [`.gitignore`](../.gitignore).
- Don't introduce SSR or server endpoints — the site must remain a pure
  static build for GitHub Pages.
- Don't change the GA4 measurement ID (`G-04Q5RY1JHY`) without
  coordinating; it's hardcoded in `Layout.astro`.
- Don't reference raw image paths from Markdown — let `LodgeLayout.astro`
  discover and optimize them via the `imageFolder` frontmatter field.

