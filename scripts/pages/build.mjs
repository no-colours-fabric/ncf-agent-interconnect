import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import GithubSlugger from 'github-slugger';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.resolve(root, '.local/pages-artifact');
const origin = 'https://no-colours-fabric.github.io';
const base = '/ncf-agent-interconnect/';
const repository = 'https://github.com/no-colours-fabric/ncf-agent-interconnect/blob/main/';

const sources = [
  'README.md',
  'llms.txt',
  'docs/usage.md',
  'docs/setup.md',
  'docs/installation.md',
  'docs/mcp-clients.md',
  'docs/aionui-setup.md',
  'docs/desktop-controls.md',
  'docs/privacy.md',
  'distribution/README.md',
  'docs/scenarios/README.md',
  'docs/scenarios/01-direct-pair.md',
  'docs/scenarios/02-peer-team.md',
  'docs/scenarios/03-coordinated-team.md',
  'docs/scenarios/04-two-developers.md',
  'docs/scenarios/05-sequential-delivery.md',
  'docs/scenarios/06-human-ai-stages.md',
  'docs/scenarios/07-consultation-and-approval.md',
  'docs/scenarios/08-parallel-delivery.md',
  'docs/scenarios/09-independent-verification.md',
  'docs/scenarios/10-cross-platform-work.md',
  'docs/scenarios/11-handoff-and-memory.md',
  'docs/scenarios/12-priority-fix.md',
  'docs/scenarios/13-mixed-applications.md',
];

const pagePath = (source) => {
  if (source === 'README.md') return 'docs/README.html';
  if (source === 'llms.txt') return 'docs/llms.html';
  return `docs/${source.replace(/^docs\//, '').replace(/\.md$/, '.html')}`;
};
const pageUrl = (source) => `${base}${pagePath(source)}`;
const canonicalUrl = (source) => `${origin}${pageUrl(source)}`;
const sourceSet = new Set(sources);
const assets = new Set(['docs/assets/agents-preview.png', 'docs/assets/app-preview.png']);
const pageTitles = {
  'README.md': 'Product overview',
  'llms.txt': 'Complete AI reference',
  'distribution/README.md': 'Packaged release guide',
};

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", '&apos;');
}

function splitTarget(target) {
  const match = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(target);
  return { pathname: match[1], search: match[2] || '', hash: match[3] || '' };
}

function localTarget(source, target) {
  if (target.startsWith('#') || /^(?:mailto:|tel:|data:)/i.test(target)) return target;

  let sourcePath = target;
  if (target.startsWith(repository)) sourcePath = target.slice(repository.length);
  else if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) return target;
  else if (target.startsWith('/')) sourcePath = target.slice(1);
  else {
    const parts = splitTarget(target);
    sourcePath = `${path.posix.normalize(path.posix.join(path.posix.dirname(source), parts.pathname))}${parts.search}${parts.hash}`;
  }

  const { pathname, search, hash } = splitTarget(sourcePath);
  if (pathname === 'llms.txt') return `${base}raw/llms.txt${search}${hash}`;
  if (sourceSet.has(pathname)) return `${pageUrl(pathname)}${search}${hash}`;
  if (assets.has(pathname)) return `${base}${pathname}${search}${hash}`;
  return `${repository}${sourcePath}`;
}

function textFromInline(inline) {
  return (inline.children || [])
    .filter((child) =>
      ['text', 'code_inline', 'image', 'softbreak', 'hardbreak'].includes(child.type),
    )
    .map((child) => (child.type.endsWith('break') ? ' ' : child.content))
    .join('');
}

function renderer(source) {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false }).use(footnote);
  const slugger = new GithubSlugger();

  md.core.ruler.after('inline', 'github-heading-ids', (state) => {
    for (let index = 0; index < state.tokens.length; index += 1) {
      const token = state.tokens[index];
      if (token.type !== 'heading_open') continue;
      token.attrSet('id', slugger.slug(textFromInline(state.tokens[index + 1])));
    }
  });

  const normalLink =
    md.renderer.rules.link_open ||
    ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const href = token.attrGet('href');
    if (href) token.attrSet('href', localTarget(source, href));
    return normalLink(tokens, index, options, env, self);
  };

  const normalImage =
    md.renderer.rules.image ||
    ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const src = token.attrGet('src');
    if (src) token.attrSet('src', localTarget(source, src));
    token.attrSet('loading', 'lazy');
    return normalImage(tokens, index, options, env, self);
  };

  return md;
}

function frame(title, description, canonical, content, raw = '') {
  const documentTitle =
    title === 'NCF Agent Interconnect' ? title : `${title} · NCF Agent Interconnect`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#f8fbff">
  <title>${escapeHtml(documentTitle)}</title>
  <link rel="canonical" href="${canonical}">
  ${raw ? `<link rel="alternate" type="${raw.endsWith('.txt') ? 'text/plain' : 'text/markdown'}" href="${raw}">` : ''}
  <link rel="icon" href="${base}assets/app-icon.png" type="image/png">
  <link rel="stylesheet" href="${base}docs.css">
</head>
<body>
  <a class="skip-link" href="#content">Skip to content</a>
  <header class="docs-header">
    <a class="docs-brand" href="${base}"><img src="${base}assets/app-icon.png" width="32" height="32" alt="">NCF Agent Interconnect</a>
    <nav aria-label="Main navigation"><a href="${base}">Home</a><a href="${base}docs/">Documentation</a><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect/releases/latest">Download</a></nav>
  </header>
  <main id="content" class="docs-shell">${content}</main>
  <footer class="docs-footer"><a href="${base}">NCF Agent Interconnect</a><a href="${base}docs/">All documentation</a><a href="https://github.com/no-colours-fabric/ncf-agent-interconnect">GitHub</a></footer>
</body>
</html>
`;
}

function documentPage(source, markdown) {
  const md = renderer(source);
  const tokens = md.parse(markdown, {});
  const heading = tokens.findIndex((token) => token.type === 'heading_open' && token.tag === 'h1');
  const title = pageTitles[source] || (heading >= 0 ? textFromInline(tokens[heading + 1]) : source);
  const description = `Read the complete ${title} documentation.`;
  const raw = `${base}raw/${source}`;
  const html = `<div class="docs-breadcrumb"><a href="${base}docs/">Documentation</a><span aria-hidden="true">/</span><span>${escapeHtml(title)}</span></div>
    <div class="docs-layout"><article class="docs-article">${md.renderer.render(tokens, md.options, {})}</article>
    <aside class="docs-sidebar" aria-label="Document links"><h2>Source files</h2><a href="${raw}">Raw ${source.endsWith('.txt') ? 'text' : 'Markdown'}</a><a href="${repository}${source}">View on GitHub</a><h2>Browse</h2><a href="${base}docs/">All documentation</a><a href="${base}docs/scenarios/README.html">Examples and prompts</a></aside></div>`;
  return frame(title, description, canonicalUrl(source), html, raw);
}

function documentList(items, titles) {
  return `<ul class="docs-index-list">${items.map((source) => `<li><a href="${pageUrl(source)}">${escapeHtml(titles.get(source))}</a></li>`).join('')}</ul>`;
}

function indexPage(titles) {
  const main = sources.slice(0, 10);
  const catalog = sources.slice(10, 11);
  const examples = sources.slice(11);
  const content = `<div class="docs-intro"><p class="docs-eyebrow">NCF Agent Interconnect</p><h1>Documentation</h1><p>Read the product overview, setup instructions and complete user guides here. Every page also links to its original Markdown or text file and GitHub source. Documentation is currently in English.</p></div>
    <p><a href="${base}llms.txt">Documentation map for AI tools (llms.txt)</a></p>
    <section aria-labelledby="main-guides"><h2 id="main-guides">Guides and reference</h2>${documentList(main, titles)}</section>
    <section aria-labelledby="example-guides"><h2 id="example-guides">Examples and prompts</h2><p>These fictional scenarios are prompts for explaining how agents can work together. They are not records of completed work.</p>${documentList(catalog, titles)}${documentList(examples, titles)}</section>`;
  return frame(
    'Documentation',
    'Complete NCF Agent Interconnect user documentation, setup guides and examples.',
    `${origin}${base}docs/`,
    content,
  );
}

async function writeArtifact(relative, contents) {
  const destination = path.join(output, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}

if (!output.startsWith(`${root}${path.sep}.local${path.sep}`))
  throw new Error('Artifact must stay inside .local');

await rm(output, { recursive: true, force: true });
await cp(path.join(root, 'site'), output, { recursive: true });

// The source frontend stays intact; only deployment metadata changes in the artifact.
for (const filename of ['index.html', 'holiday.html', 'development.html']) {
  const file = path.join(output, filename);
  const html = await readFile(file, 'utf8');
  const canonical = `${origin}${base}${filename === 'index.html' ? '' : filename}`;
  const canonicalTag = `<link rel="canonical" href="${canonical}" />`;
  const updated = /<link\b[^>]*rel=["']canonical["'][^>]*>/i.test(html)
    ? html.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/i, canonicalTag)
    : html.replace('</head>', `  ${canonicalTag}\n  </head>`);
  await writeFile(file, updated);
}

const titles = new Map();
for (const source of sources) {
  const bytes = await readFile(path.join(root, source));
  const markdown = bytes.toString('utf8');
  const md = renderer(source);
  const tokens = md.parse(markdown, {});
  const heading = tokens.findIndex((token) => token.type === 'heading_open' && token.tag === 'h1');
  titles.set(
    source,
    pageTitles[source] || (heading >= 0 ? textFromInline(tokens[heading + 1]) : source),
  );
  await writeArtifact(`raw/${source}`, bytes);
  await writeArtifact(pagePath(source), documentPage(source, markdown));
}

for (const asset of assets) {
  const bytes = await readFile(path.join(root, asset));
  await writeArtifact(asset, bytes);
  await writeArtifact(`raw/${asset}`, bytes);
}
await writeArtifact('docs/index.html', indexPage(titles));

const llmsIndex = `# NCF Agent Interconnect

> Official website and user documentation for NCF Agent Interconnect.

The complete guides below are generated from the repository's user documentation.
HTML pages are readable without JavaScript. Raw Markdown and text preserve the
original source bytes. Each HTML page links to its source on GitHub.

## Start here

- [Documentation index](${origin}${base}docs/): All user guides, reference material and explanatory scenario prompts.
- [Complete AI reference](${origin}${base}raw/llms.txt): The full llms.txt reference from the repository.
- [GitHub repository](https://github.com/no-colours-fabric/ncf-agent-interconnect): Authoritative documentation sources and application code.

## Guides and reference

${sources
  .slice(0, 10)
  .map(
    (source) =>
      `- [${titles.get(source)}](${canonicalUrl(source)}): Readable HTML. [Raw ${source.endsWith('.txt') ? 'text' : 'Markdown'}](${origin}${base}raw/${source}). [GitHub source](${repository}${source}).`,
  )
  .join('\n')}

## Examples and prompts

The scenario catalog contains fictional prompts for explaining agent collaboration.

${sources
  .slice(10)
  .map(
    (source) =>
      `- [${titles.get(source)}](${canonicalUrl(source)}): [Raw Markdown](${origin}${base}raw/${source}). [GitHub source](${repository}${source}).`,
  )
  .join('\n')}
`;
await writeArtifact('llms.txt', llmsIndex);

const urls = [
  `${origin}${base}`,
  `${origin}${base}holiday.html`,
  `${origin}${base}development.html`,
  `${origin}${base}docs/`,
  ...sources.map(canonicalUrl),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeArtifact('sitemap.xml', sitemap);

console.log(
  `Built ${sources.length} documentation pages, ${sources.length} raw sources and ${urls.length} sitemap URLs in ${output}`,
);
