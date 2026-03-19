import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const lodges = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/lodges' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    unitId: z.string().optional(),
    roomId: z.number().optional(),
    cardImage: z.string().optional(),
    tags: z.array(z.string()).optional(),
    slug: z.string(),
    excerpt: z.string().optional(),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    author: z.string().optional(),
    excerpt: z.string(),
    coverImage: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { lodges, articles };
