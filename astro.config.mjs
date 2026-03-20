import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import llmsTxt from './src/integrations/llms-txt.mjs';

export default defineConfig({
  site: 'https://hockingluxurylodges.com',
  integrations: [sitemap(), llmsTxt()],
});
