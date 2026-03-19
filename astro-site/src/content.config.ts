import { defineCollection, z } from 'astro:content';

const lodges = defineCollection({
  type: 'content',
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

export const collections = { lodges };
