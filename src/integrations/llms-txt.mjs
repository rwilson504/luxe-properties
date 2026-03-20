import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';

/**
 * Astro integration that auto-generates llms.txt and llms-full.txt at build time.
 * Reads lodge and article markdown files and produces AI-friendly summaries.
 */
export default function llmsTxt() {
  return {
    name: 'llms-txt',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const outDir = dir.pathname.replace(/^\/([A-Z]:)/i, '$1'); // fix Windows paths
        const siteUrl = 'https://hockingluxurylodges.com';

        // Read lodge markdown files
        const lodgesDir = join(process.cwd(), 'src/content/lodges');
        const lodgeFiles = await readdir(lodgesDir);
        const lodges = [];
        for (const file of lodgeFiles) {
          if (!file.endsWith('.md')) continue;
          const raw = await readFile(join(lodgesDir, file), 'utf-8');
          const { data, content } = matter(raw);
          lodges.push({ ...data, body: content.trim() });
        }

        // Read article markdown files
        const articlesDir = join(process.cwd(), 'src/content/articles');
        const articleFiles = await readdir(articlesDir);
        const articles = [];
        for (const file of articleFiles) {
          if (!file.endsWith('.md')) continue;
          const raw = await readFile(join(articlesDir, file), 'utf-8');
          const { data, content } = matter(raw);
          articles.push({ ...data, body: content.trim() });
        }

        // Sort lodges and articles
        lodges.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        articles.sort((a, b) => new Date(b.date) - new Date(a.date));

        // --- Generate llms.txt (index) ---
        const lines = [
          '# Hocking Luxury Lodges',
          '',
          '> Luxury vacation rental lodges in Hocking Hills, Ohio. Contemporary retreats with hot tubs, arcades, and stunning scenery — pet friendly, perfect for families and groups of up to 10.',
          '',
          '## Lodges',
          '',
        ];

        for (const lodge of lodges) {
          lines.push(`- [${lodge.title}](${siteUrl}${lodge.slug}): ${lodge.excerpt}`);
          if (lodge.guests) lines.push(`  - Sleeps ${lodge.guests} guests, ${lodge.bedrooms} bedrooms, ${lodge.beds || lodge.bedrooms} beds, ${lodge.bathrooms} baths`);
          if (lodge.petFriendly) lines.push(`  - Pet friendly`);
          if (lodge.airbnbUrl) lines.push(`  - Book on Airbnb: ${lodge.airbnbUrl}`);
          if (lodge.vrboUrl) lines.push(`  - Book on Vrbo: ${lodge.vrboUrl}`);
        }

        lines.push('', '## Articles', '');
        for (const article of articles) {
          const slug = article.slug || article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          lines.push(`- [${article.title}](${siteUrl}/articles/${slug}): ${article.excerpt}`);
        }

        lines.push('', '## Other Pages', '');
        lines.push(`- [About](${siteUrl}/about): About Hocking Luxury Lodges`);
        lines.push(`- [All Articles](${siteUrl}/articles): Browse all articles about Hocking Hills activities and travel tips`);

        await writeFile(join(outDir, 'llms.txt'), lines.join('\n'), 'utf-8');

        // --- Generate llms-full.txt (full content) ---
        const fullLines = [
          '# Hocking Luxury Lodges — Full Content',
          '',
          '> Luxury vacation rental lodges in Hocking Hills, Ohio.',
          '',
        ];

        for (const lodge of lodges) {
          fullLines.push(`---`, '', `## ${lodge.title}`, '');
          fullLines.push(`URL: ${siteUrl}${lodge.slug}`);
          if (lodge.guests) fullLines.push(`Guests: ${lodge.guests} | Bedrooms: ${lodge.bedrooms} | Beds: ${lodge.beds || lodge.bedrooms} | Baths: ${lodge.bathrooms}`);
          if (lodge.petFriendly) fullLines.push(`Pet Friendly: Yes`);
          if (lodge.airbnbUrl) fullLines.push(`Airbnb: ${lodge.airbnbUrl}`);
          if (lodge.vrboUrl) fullLines.push(`Vrbo: ${lodge.vrboUrl}`);
          fullLines.push('', lodge.body, '');
        }

        for (const article of articles) {
          fullLines.push(`---`, '', `## ${article.title}`, '');
          fullLines.push(`Author: ${article.author || 'Hocking Luxury Lodges'}`);
          fullLines.push(`Date: ${article.date}`);
          fullLines.push('', article.body, '');
        }

        await writeFile(join(outDir, 'llms-full.txt'), fullLines.join('\n'), 'utf-8');

        console.log('[llms-txt] Generated llms.txt and llms-full.txt');
      },
    },
  };
}
