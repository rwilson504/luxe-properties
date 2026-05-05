import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';

/**
 * Astro integration that auto-generates llms.txt and llms-full.txt at build time.
 * Reads lodge and local-guide markdown files and produces AI-friendly summaries.
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

        // Read local-guide markdown files
        const guideDir = join(process.cwd(), 'src/content/guide');
        const guideFiles = await readdir(guideDir);
        const guideEntries = [];
        for (const file of guideFiles) {
          if (!file.endsWith('.md')) continue;
          const raw = await readFile(join(guideDir, file), 'utf-8');
          const { data, content } = matter(raw);
          guideEntries.push({ ...data, body: content.trim() });
        }

        // Sort lodges and guide entries
        lodges.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        guideEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

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

        lines.push('', '## Local Guide', '');
        for (const entry of guideEntries) {
          const slug = entry.slug || entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          lines.push(`- [${entry.title}](${siteUrl}/guide/${slug}): ${entry.excerpt}`);
        }

        lines.push('', '## Other Pages', '');
        lines.push(`- [About](${siteUrl}/about): About Hocking Luxury Lodges`);
        lines.push(`- [Local Guide](${siteUrl}/guide): Browse our local guide — things to do, seasonal tips, and travel inspiration for Hocking Hills`);

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

        for (const entry of guideEntries) {
          fullLines.push(`---`, '', `## ${entry.title}`, '');
          fullLines.push(`Author: ${entry.author || 'Hocking Luxury Lodges'}`);
          fullLines.push(`Date: ${entry.date}`);
          fullLines.push('', entry.body, '');
        }

        await writeFile(join(outDir, 'llms-full.txt'), fullLines.join('\n'), 'utf-8');

        console.log('[llms-txt] Generated llms.txt and llms-full.txt');
      },
    },
  };
}
