import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import llmsTxt from './src/integrations/llms-txt.mjs';

export default defineConfig({
  site: 'https://hockingluxurylodges.com',
  integrations: [
    sitemap({
      // Unlisted legal pages (e.g. QuickBooks EULA/Privacy) must stay out of the sitemap.
      filter: (page) => !page.includes('/legal/'),
    }),
    llmsTxt(),
  ],
  // Permanent redirects for legacy URLs. When renaming a route, add an entry
  // here so old inbound links and search-engine results keep working.
  // See .github/copilot-instructions.md → "Renaming a route / adding redirects".
  redirects: {
    // 2026-05: Renamed "Articles" section to "Local Guide".
    '/articles': '/guide',
    '/articles/[slug]': '/guide/[slug]',
  },
});
