/**
 * generate-article.mjs
 *
 * Reads existing Hocking Hills articles from src/content/articles/,
 * calls an AI API to produce a new bilingual (English + Spanish) article,
 * and writes the resulting Markdown file back into the articles directory.
 *
 * Environment variables:
 *   OPENAI_API_KEY   – If set, the OpenAI Chat Completions API is used.
 *   GITHUB_TOKEN     – Used as a fallback with the GitHub Models inference
 *                      endpoint when OPENAI_API_KEY is not provided.
 */

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
    const match = raw.match(/^---\n([\s\S]+?)\n---/);
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

async function callOpenAI(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a travel writer specializing in Hocking Hills, Ohio. You write family-friendly, informative articles for a luxury lodge website. Always respond with valid JSON only — no markdown fences, no extra commentary.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 3500,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGitHubModels(prompt, token) {
  const response = await fetch(
    'https://models.inference.ai.azure.com/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a travel writer specializing in Hocking Hills, Ohio. You write family-friendly, informative articles for a luxury lodge website. Always respond with valid JSON only — no markdown fences, no extra commentary.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 3500,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub Models API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(existingArticles, dateStr) {
  const month = new Date(dateStr).toLocaleString('en-US', { month: 'long' });
  const year = new Date(dateStr).getFullYear();

  const existingTopicsList = existingArticles
    .map((a) => `  - ${a.title}`)
    .join('\n');

  return `Generate a new informative, family-friendly article about Hocking Hills, Ohio for a luxury lodge website.

Current date: ${dateStr} (${month} ${year})

Existing articles — DO NOT duplicate any of these topics:
${existingTopicsList}

Requirements:
- Choose a topic that is genuinely different from every article listed above
- Content must be family-friendly and accurate
- Incorporate seasonal relevance for ${month} where possible (e.g., spring waterfalls, fall foliage, winter cabins, summer festivals)
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
  const openaiKey = process.env.OPENAI_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!openaiKey && !githubToken) {
    console.error(
      'Error: either OPENAI_API_KEY or GITHUB_TOKEN must be set to call the AI API.'
    );
    process.exit(1);
  }

  const articlesDir = join(process.cwd(), 'src/content/articles');

  console.log('Reading existing articles…');
  const existing = await getExistingArticles(articlesDir);
  console.log(`Found ${existing.length} existing article(s).`);
  existing.forEach((a) => console.log(`  · ${a.title}`));
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const prompt = buildPrompt(existing, dateStr);

  console.log('\nGenerating new article via AI…');
  let rawJson;
  try {
    rawJson = openaiKey
      ? await callOpenAI(prompt, openaiKey)
      : await callGitHubModels(prompt, githubToken);
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
