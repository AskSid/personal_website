import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const MARKDOWN_DIR = path.join(ROOT, 'markdown_posts');
const OUTPUT_DIR = path.join(ROOT, 'html_posts');
const POST_TEMPLATE_PATH = path.join(ROOT, 'blog-post-template.html');
const BLOG_OUTPUT_PATH = path.join(ROOT, 'blog.html');

const BLOG_TEMPLATE_TOP = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blog | Sid Boppana</title>
  <link rel="icon" type="image/png" href="pics/earth.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>

<body>
<nav class="site-nav">
  <div class="site-nav-links">
    <a href="index.html">Home</a>
    <a href="blog.html" class="is-active">Blog</a>
  </div>
  <button class="theme-toggle" id="theme-toggle" aria-label="Toggle color mode" type="button">🌙</button>
</nav>

<header class="page-header">
  <div class="header-row">
    <h1>Blog</h1>
  </div>
</header>
`; // posts will follow

const BLOG_TEMPLATE_BOTTOM = `
<script>
  (function() {
    const storageKey = 'sb-theme';
    const body = document.body;
    const toggle = document.getElementById('theme-toggle');

    const updateToggle = (isDark) => {
      toggle.innerHTML = '<span class="toggle-icon">☀</span>';
      toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    };

    const applyTheme = (isDark) => {
      body.classList.toggle('dark-mode', isDark);
      updateToggle(isDark);
    };

    const storedPreference = localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const startDark = storedPreference ? storedPreference === 'dark' : prefersDark;
    applyTheme(startDark);

    toggle.addEventListener('click', () => {
      const makeDark = !body.classList.contains('dark-mode');
      applyTheme(makeDark);
      localStorage.setItem(storageKey, makeDark ? 'dark' : 'light');
    });
  })();
</script>
</body>
</html>
`;

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripMarkdown(text) {
  return text
    .replace(/^---[\s\S]*?---/, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^[#>-]+\s*/gm, '')
    .replace(/[-*]\s+/g, '')
    .trim();
}

function slugFromFilename(filename) {
  return filename.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function escapeMarkdownForScript(markdown) {
  return markdown.replace(/<\/script>/gi, '<\\/script>');
}

function parseFrontMatter(raw, filename) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`Missing front matter in ${filename}`);
  }
  const metaBlock = match[1];
  const body = match[2].trim();
  const meta = {};
  for (const line of metaBlock.split(/\r?\n/)) {
    const [key, ...rest] = line.split(':');
    if (!key) continue;
    meta[key.trim().toLowerCase()] = rest.join(':').trim();
  }
  if (!meta.title) throw new Error(`Missing title in ${filename}`);
  if (!meta.date) throw new Error(`Missing date in ${filename}`);
  return { meta, body };
}

function formatPostsList(posts) {
  if (!posts.length) {
    return '<p>No posts yet. Write something in markdown_posts/ and run make.</p>';
  }
  return posts.map(post => `  <div class="blog-post">
    <div class="post-header">
      <h2><a href="${post.href}">${escapeHtml(post.title)}</a></h2>
      <div class="date">${escapeHtml(post.date)}</div>
    </div>
    <p>${escapeHtml(post.summary)}</p>
    <a href="${post.href}">Read more →</a>
  </div>`).join('\n\n');
}

async function build() {
  await fs.mkdir(MARKDOWN_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const template = await fs.readFile(POST_TEMPLATE_PATH, 'utf8');
  const markdownFiles = (await fs.readdir(MARKDOWN_DIR)).filter(name => name.endsWith('.md'));

  const posts = await Promise.all(markdownFiles.map(async (file) => {
    const raw = await fs.readFile(path.join(MARKDOWN_DIR, file), 'utf8');
    const { meta, body } = parseFrontMatter(raw, file);
    const slug = slugFromFilename(path.parse(file).name);

    const filled = template
      .replace(/{{ROOT_PATH}}/g, '..')
      .replace(/{{TITLE}}/g, meta.title)
      .replace(/{{DATE}}/g, meta.date)
      .replace('{{MARKDOWN}}', escapeMarkdownForScript(body));

    await fs.writeFile(path.join(OUTPUT_DIR, `${slug}.html`), filled.trim() + '\n');

    return {
      title: meta.title,
      date: meta.date,
      summary: meta.summary || stripMarkdown(body).split(/\.\s+/)[0] || '',
      href: `html_posts/${slug}.html`,
      sortKey: new Date(meta.date)
    };
  }));

  posts.sort((a, b) => b.sortKey - a.sortKey);

  const blogPage = BLOG_TEMPLATE_TOP + '\n' + formatPostsList(posts) + '\n' + BLOG_TEMPLATE_BOTTOM;
  await fs.writeFile(BLOG_OUTPUT_PATH, blogPage.trim() + '\n');

  console.log(`Built ${posts.length} post${posts.length === 1 ? '' : 's'}.`);
}

build().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
