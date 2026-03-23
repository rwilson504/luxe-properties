/**
 * generate-article.mjs
 *
 * Reads existing Hocking Hills articles from src/content/articles/,
 * calls an AI API to produce a new bilingual (English + Spanish) article,
 * and writes the resulting Markdown file back into the articles directory.
 *
 * Environment variables:
 *   OPENROUTER_API_KEY         – OpenRouter API key (required)
 *   OPENROUTER_MODEL           – Web-grounded model for research (default: perplexity/sonar-pro)
 *   OPENROUTER_WRITER_MODEL    – Model for article writing (default: openai/gpt-4.1)
 *   OPENROUTER_WRITER_PROVIDER – Provider to route writer model through (default: Azure,
 *                                forces BYOK routing instead of OpenAI direct)
 */

import 'dotenv/config';
import { readdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a YAML frontmatter value from a raw markdown string. */
function extractFrontmatterField(frontmatter, key) {
  // Handles quoted strings: key: "value" or key: value
  const match = frontmatter.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?`, 'm'));
  return match ? match[1].trim() : '';
}

/** Read all existing articles and return a summary list. */
async function getExistingArticles(articlesDir) {
  const files = await readdir(articlesDir);
  const articles = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const raw = await readFile(join(articlesDir, file), 'utf-8');
    const match = raw.match(/^---\r?\n([\s\S]+?)\r?\n---/);
    if (!match) continue;
    const fm = match[1];
    // Only extract the title — that is all we need to detect duplicate topics.
    articles.push({
      file,
      title: extractFrontmatterField(fm, 'title'),
    });
  }

  return articles;
}

// ---------------------------------------------------------------------------
// AI API calls
// ---------------------------------------------------------------------------

/**
 * Call OpenRouter API with a given model.
 * @param {object} [provider] - Optional provider routing preference (e.g. { order: ['Azure'] })
 */
async function callOpenRouter(messages, apiKey, model, maxTokens = 3500, provider) {
  const payload = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: maxTokens,
  };
  if (provider) {
    payload.provider = provider;
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter API error ${response.status} (${model}): ${body}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildResearchPrompt(existingArticles, dateStr) {
  const month = new Date(dateStr).toLocaleString('en-US', { month: 'long' });
  const year = new Date(dateStr).getFullYear();

  const existingTopicsList = existingArticles
    .map((a) => `  - ${a.title}`)
    .join('\n');

  return `You are a research assistant for a luxury lodge website in Hocking Hills, Ohio.
Today's date is ${dateStr} (${month} ${year}).

Search the web and compile a research brief for a NEW article topic about Hocking Hills.

Existing articles — the new topic must NOT overlap with any of these:
${existingTopicsList}

Your research brief should include:
1. A suggested article topic (genuinely different from those above)
2. Seasonal relevance for ${month}
3. Current, factual details: attraction names, hours, admission prices, addresses, upcoming events
4. Practical visitor tips
5. Any notable recent news or changes (closures, new openings, trail conditions)

Respond in plain text (not JSON). Be thorough and cite specific details.`;
}

function buildWriterPrompt(researchBrief, existingArticles, dateStr) {
  const month = new Date(dateStr).toLocaleString('en-US', { month: 'long' });
  const year = new Date(dateStr).getFullYear();

  const existingTopicsList = existingArticles
    .map((a) => `  - ${a.title}`)
    .join('\n');

  return `Write a new bilingual article for a luxury lodge website in Hocking Hills, Ohio.

Current date: ${dateStr} (${month} ${year})

Here is a research brief with current, web-sourced information to base the article on:

---
${researchBrief}
---

Existing articles — DO NOT duplicate any of these topics:
${existingTopicsList}

Requirements:
- Use the research above for accuracy — do not invent facts
- Content must be family-friendly
- Incorporate seasonal relevance for ${month}
- Include practical visitor information: hours, tips, nearby attractions, local events if relevant
- Naturally mention our luxury lodges — Speakeasy Lodge and Luxe Haus Lodge — where appropriate
- Both English and Spanish versions required; Spanish must be a natural, idiomatic translation

Respond with ONLY a valid JSON object (no markdown code fences, no extra text) matching this exact shape:
{
  "title": "English article title",
  "title_es": "Spanish article title",
  "excerpt": "Compelling English excerpt in 1–2 sentences",
  "excerpt_es": "Spanish excerpt in 1–2 sentences",
  "tags": ["tag1", "tag2", "tag3"],
  "content_en": "Full English Markdown body (500–800 words, ## and ### headings, practical info, links where helpful)",
  "content_es": "Full Spanish Markdown body (same structure as English)"
}`;
}

// ---------------------------------------------------------------------------
// Markdown builder
// ---------------------------------------------------------------------------

function escapeYamlString(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildMarkdown(article, dateStr) {
  const tagsYaml = article.tags.map((t) => `"${escapeYamlString(t)}"`).join(', ');

  return `---
title: "${escapeYamlString(article.title)}"
title_es: "${escapeYamlString(article.title_es)}"
date: ${dateStr}
author: "Hocking Luxury Lodges"
excerpt: "${escapeYamlString(article.excerpt)}"
excerpt_es: "${escapeYamlString(article.excerpt_es)}"
tags: [${tagsYaml}]
---

<div data-lang="en">

${article.content_en.trim()}

</div>

<div data-lang="es">

${article.content_es.trim()}

</div>
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const researchModel = process.env.OPENROUTER_MODEL || 'perplexity/sonar-pro';
  const writerModel = process.env.OPENROUTER_WRITER_MODEL || 'openai/gpt-4.1';
  const writerProvider = process.env.OPENROUTER_WRITER_PROVIDER || 'Azure';

  if (!openRouterKey) {
    console.error('Error: OPENROUTER_API_KEY is required.');
    process.exit(1);
  }

  const articlesDir = join(process.cwd(), 'src/content/articles');

  console.log('Reading existing articles…');
  const existing = await getExistingArticles(articlesDir);
  console.log(`Found ${existing.length} existing article(s).`);
  existing.forEach((a) => console.log(`  · ${a.title}`));
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  // Phase 1: Web research via sonar-pro
  console.log(`\n📡 Phase 1: Researching via ${researchModel}…`);
  let researchBrief;
  try {
    const researchPrompt = buildResearchPrompt(existing, dateStr);
    researchBrief = await callOpenRouter(
      [
        { role: 'system', content: 'You are a thorough travel research assistant. Search the web for current, accurate information.' },
        { role: 'user', content: researchPrompt },
      ],
      openRouterKey,
      researchModel,
      2000
    );
    console.log('Research complete.');
  } catch (err) {
    console.error('Research phase failed:', err.message);
    process.exit(1);
  }

  // Phase 2: Article writing via Azure Foundry GPT-4.1 (BYOK)
  console.log(`\n✍️  Phase 2: Writing article via ${writerModel} (provider: ${writerProvider})…`);
  let rawJson;
  try {
    const writerPrompt = buildWriterPrompt(researchBrief, existing, dateStr);
    rawJson = await callOpenRouter(
      [
        {
          role: 'system',
          content: 'You are a travel writer specializing in Hocking Hills, Ohio. You write family-friendly, informative articles for a luxury lodge website. Always respond with valid JSON only — no markdown fences, no extra commentary.',
        },
        { role: 'user', content: writerPrompt },
      ],
      openRouterKey,
      writerModel,
      3500,
      { order: [writerProvider], allow_fallbacks: false }
    );
  } catch (err) {
    console.error('AI API call failed:', err.message);
    process.exit(1);
  }

  // Strip any accidental markdown fences the model might have added
  const cleaned = rawJson
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let article;
  try {
    article = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('Failed to parse AI response as JSON.');
    console.error('Raw response:', rawJson);
    process.exit(1);
  }

  // Validate required fields
  const required = ['title', 'title_es', 'excerpt', 'excerpt_es', 'tags', 'content_en', 'content_es'];
  for (const field of required) {
    if (!article[field]) {
      console.error(`AI response is missing required field: "${field}"`);
      process.exit(1);
    }
  }

  // Build a URL-safe slug from the English title
  const slug = article.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60)
    .replace(/-$/, '');

  const filename = `${dateStr}-${slug}.md`;
  const filepath = join(articlesDir, filename);

  if (existsSync(filepath)) {
    console.log(`\nFile already exists: ${filename} — nothing to do.`);
    process.exit(0);
  }

  const markdown = buildMarkdown(article, dateStr);
  await writeFile(filepath, markdown, 'utf-8');

  console.log(`\n✅ Article written: ${filename}`);
  console.log(`   Title (EN): ${article.title}`);
  console.log(`   Title (ES): ${article.title_es}`);
  console.log(`   Tags: ${article.tags.join(', ')}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
