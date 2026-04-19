/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  HFAR CORE ENGINE v2.1                                   ║
 * ║  Header-First + Anchor Read                              ║
 * ║  IrsanAI Universe · MIT License                         ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Standalone module — import anywhere in the IrsanAI ecosystem.
 *
 * Usage (ESM):   import { HFAR } from './src/hfar-core.js'
 * Usage (Node):  const { HFAR } = require('./src/hfar-core.js')
 * Usage (Browser): <script src="src/hfar-core.js"></script>
 *                  window.HFAR is available globally
 */

const HFAR_VERSION = '2.1.0';

// IrsanAI Standard — ground truth for gap analysis
const IRSANAI_STANDARD = [
  { id:'hero',     label:'Hero / Titel + Claim',         keywords:['# '],                          weight:20, required:true  },
  { id:'lang',     label:'Sprachumschalter (DE/EN)',      keywords:['deutsch','english','🇩🇪','🇬🇧'], weight:8,  required:false },
  { id:'desc',     label:'Kurzbeschreibung',              keywords:['what is','was ist','overview'], weight:12, required:true  },
  { id:'features', label:'Core Features',                 keywords:['feature','✨','⚡'],             weight:12, required:true  },
  { id:'universe', label:'IrsanAI Universe-Kontext',      keywords:['universe','ecosystem'],         weight:10, required:false },
  { id:'arch',     label:'Technische Specs/Architektur',  keywords:['architecture','spec','stack'],  weight:8,  required:false },
  { id:'install',  label:'Installation / Usage',          keywords:['install','git clone','```bash'],weight:15, required:true  },
  { id:'roadmap',  label:'Roadmap',                       keywords:['roadmap','- [ ]','next steps'], weight:8,  required:false },
  { id:'license',  label:'License',                       keywords:['license','lizenz','mit'],       weight:7,  required:true  },
];

const DE_WORDS = /\b(und|die|der|das|ist|von|für|mit|eine|werden|nicht|auch|sich|dem|auf|den)\b/gi;
const EN_WORDS = /\b(the|and|is|for|with|this|that|your|have|from|are|you|will|can|all)\b/gi;
const BYTES_PER_TOKEN = 3.8;
const HFAR_READ_RATIO = 0.30;

// ── FETCH ──────────────────────────────────────────────────
async function fetchReadme(repoUrl) {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!match) throw new Error(`Ungültige GitHub-URL: "${repoUrl}"`);
  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, '');
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${cleanRepo}/contents/README.md`,
    { headers: { Accept: 'application/vnd.github.v3+json' } }
  );
  if (res.status === 404) throw new Error(`README.md nicht gefunden in ${owner}/${cleanRepo}`);
  if (res.status === 403) throw new Error('GitHub API Rate Limit. Bitte 1 Minute warten.');
  if (!res.ok) throw new Error(`GitHub API Fehler: ${res.status}`);
  const data = await res.json();
  return {
    markdown: atob(data.content.replace(/\n/g, '')),
    repoMeta: { owner, repo: cleanRepo, sha: data.sha, url: repoUrl }
  };
}

// ── CORE ANALYZER ──────────────────────────────────────────
function analyzeMarkdown(markdown) {
  const lines = markdown.split('\n');
  const bytes = new TextEncoder().encode(markdown).length;
  const totalTokens = Math.round(bytes / BYTES_PER_TOKEN);
  const hfarTokens = Math.round(totalTokens * HFAR_READ_RATIO);

  // Structure (Header-First)
  const headers = [];
  let h1Count = 0, h2Count = 0, h3Count = 0;
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+)/);
    if (m) {
      const level = m[1].length;
      headers.push({ level, title: m[2].trim() });
      if (level === 1) h1Count++;
      else if (level === 2) h2Count++;
      else if (level === 3) h3Count++;
    }
  }

  // Content (Anchor-Read)
  const codeBlocks = Math.floor((markdown.match(/```/g) || []).length / 2);
  const links      = (markdown.match(/\[.+?\]\(https?:\/\/.+?\)/g) || []).length;
  const badges     = (markdown.match(/!\[.*?\]\(https?:\/\/.+?\)/g) || []).length;
  const tables     = (markdown.match(/^\|.+\|$/gm) || []).length > 0;
  const checkboxes = (markdown.match(/- \[[ x]\]/g) || []).length;
  const emojis     = (markdown.match(/[\u{1F300}-\u{1FFFF}]/gu) || []).length;
  const words      = markdown.split(/\s+/).filter(Boolean).length;
  const sentences  = (markdown.match(/[.!?]+/g) || []).length;

  // Claim extraction
  let claim = '';
  for (const line of lines) {
    const t = line.trim();
    if (t && !t.startsWith('#') && !t.startsWith('!') && !t.startsWith('<')
        && !t.startsWith('```') && !t.startsWith('|') && !t.startsWith('[![')
        && t.length > 30 && t.length < 300) {
      claim = t.replace(/\*\*/g, '').replace(/\*/g, '').trim();
      break;
    }
  }

  // Language detection
  const deM = (markdown.match(DE_WORDS) || []).length;
  const enM = (markdown.match(EN_WORDS) || []).length;
  const languageCode = deM > enM * 1.4 ? 'de' : enM > deM * 1.4 ? 'en' : 'mixed';
  const language = languageCode === 'de' ? 'Deutsch' : languageCode === 'en' ? 'English' : 'Bilingual DE/EN';

  // Gap analysis
  const mdLower = markdown.toLowerCase();
  const gaps = IRSANAI_STANDARD.filter(s =>
    !s.keywords.some(kw => mdLower.includes(kw.toLowerCase()))
  ).map(s => ({ id: s.id, label: s.label, weight: s.weight, required: s.required }));

  // Scores
  const maxScore = IRSANAI_STANDARD.reduce((s, x) => s + x.weight, 0);
  const missedScore = gaps.reduce((s, x) => s + x.weight, 0);
  const standardScore = Math.round(((maxScore - missedScore) / maxScore) * 100);
  const readability = Math.max(10, Math.min(99, Math.round(98 - (words / Math.max(1, sentences)) * 1.8)));
  const structureScore = Math.min(100, Math.round(
    (h1Count === 1 ? 25 : 0) + Math.min(25, h2Count * 8) +
    (codeBlocks > 0 ? 20 : 0) + Math.min(15, links * 5) +
    (badges > 0 ? 10 : 0) + (tables ? 5 : 0)
  ));
  const contentScore = Math.min(100, Math.round(
    (claim ? 30 : 0) + Math.min(20, emojis * 5) +
    (checkboxes > 0 ? 15 : 0) + Math.min(20, words / 10) +
    (languageCode === 'mixed' ? 15 : 8)
  ));
  const overallScore = Math.round(structureScore * 0.35 + contentScore * 0.30 + standardScore * 0.35);
  const grade = overallScore >= 85 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 55 ? 'C' : overallScore >= 40 ? 'D' : 'F';

  return {
    bytes, totalTokens, hfarTokens,
    savedTokens: totalTokens - hfarTokens,
    savedPercent: Math.round(((totalTokens - hfarTokens) / totalTokens) * 100),
    headers, h1Count, h2Count, h3Count,
    codeBlocks, links, badges, tables, checkboxes, emojis, words, sentences,
    claim, language, languageCode,
    gaps, gapCount: gaps.length,
    requiredGaps: gaps.filter(g => g.required),
    readability, structureScore, contentScore, standardScore, overallScore, grade,
    hfarVersion: HFAR_VERSION,
    analyzedAt: new Date().toISOString()
  };
}

// ── INSIGHTS ───────────────────────────────────────────────
function generateInsights(analysis) {
  const ins = [];
  const push = (title, issue, fix, impact) => ins.push({ title, issue, fix, impact });

  if (analysis.h1Count === 0)
    push('H1-Titel fehlt', 'Kein Haupttitel — kritisch für SEO und ersten Eindruck.', 'Einen H1 ergänzen: # Projektname — Kurze Beschreibung', 'high');
  else if (analysis.h1Count > 1)
    push('Mehrere H1-Titel', `${analysis.h1Count}× H1 — verwirrend für Leser und Crawler.`, 'Auf genau einen H1 reduzieren.', 'high');

  if (!analysis.claim)
    push('Kein Claim erkennbar', 'HFAR konnte keinen Haupt-Claim extrahieren.', 'Direkt nach H1: ein einziger Claim-Satz als Kernbotschaft.', 'high');

  if (analysis.codeBlocks === 0)
    push('Kein Quickstart-Code', 'Keine Code-Blocks — Entwickler wissen nicht wie sie starten.', 'Mindestens einen ```bash Block mit Install + Start ergänzen.', 'high');

  for (const gap of analysis.requiredGaps)
    push(`Pflichtsektion fehlt: ${gap.label}`, `"${gap.label}" ist Required im IrsanAI-Standard.`, `Sektion "${gap.label}" ergänzen (+${gap.weight} Score-Punkte).`, 'high');

  for (const gap of analysis.gaps.filter(g => !g.required))
    push(`Empfohlen: ${gap.label}`, `"${gap.label}" fehlt — schadet dem Standard-Score.`, `Hinzufügen für +${gap.weight} Punkte.`, 'medium');

  if (analysis.badges === 0)
    push('Keine Badges', 'Ohne Badges wirkt das Repo unprofessionell.', 'License, Version und Build-Status Badges ergänzen.', 'medium');

  if (analysis.emojis < 3)
    push('Wenig Emojis', 'Sektionen ohne Emojis sind schwerer zu scannen.', '## ⚡ Features, ## 🚀 Installation etc. verwenden.', 'low');

  if (analysis.languageCode !== 'mixed')
    push('Nur einsprachig', `Nur ${analysis.language} — internationale Reichweite eingeschränkt.`, '[🇩🇪 Deutsch] / [🇬🇧 English] Links am Anfang ergänzen.', 'low');

  if (analysis.readability < 60)
    push('Niedrige Lesbarkeit', `Score: ${analysis.readability}/100`, 'Kürzere Sätze, mehr Bullet Points.', 'medium');

  return ins;
}

// ── README GENERATOR ───────────────────────────────────────
function generateReadme(analysis, repoMeta) {
  const { repo, owner } = repoMeta;
  const claim = analysis.claim || 'Eine leistungsstarke Komponente des IrsanAI Universums.';
  return `# ⚡ ${repo}

> ${claim}

[![MIT License](https://img.shields.io/badge/license-MIT-cyan.svg)](LICENSE)
[![IrsanAI Universe](https://img.shields.io/badge/IrsanAI-Universe-blueviolet)](https://github.com/irsanai)
[![HFAR Score](https://img.shields.io/badge/HFAR%20Score-${analysis.overallScore}%2F100-${analysis.overallScore >= 70 ? 'green' : 'orange'})](https://github.com/irsanai/irsanai-hfar-engine)

[🇩🇪 Deutsch](#deutsch) · [🇬🇧 English](#english)

---

<a name="deutsch"></a>
## 🔍 Was ist ${repo}?

${claim}

---

## ✨ Core Features

${analysis.headers.filter(h => h.level === 2).slice(0, 5).map(h => `- **${h.title}**`).join('\n') || '- Core Feature 1\n- Core Feature 2\n- Core Feature 3'}

---

## 🌐 IrsanAI Universe

Teil des **[IrsanAI Ecosystems](https://github.com/irsanai)**.

---

## 🚀 Installation

\`\`\`bash
git clone https://github.com/${owner}/${repo}.git
cd ${repo}
# Weitere Setup-Schritte
\`\`\`

---

## 🗺️ Roadmap

- [x] v1.0 — Core Funktionalität
- [ ] v2.0 — Erweiterungen
- [ ] v3.0 — Full Ecosystem Integration

---

## 📄 Lizenz

MIT License — Teil des IrsanAI Universe

---

<a name="english"></a>
## 🔍 What is ${repo}?

${claim}

---

*← [Back to IrsanAI Universe](https://github.com/irsanai) · Optimized with [HFAR ENGINE v${HFAR_VERSION}](https://github.com/irsanai/irsanai-hfar-engine)*`;
}

// ── PUBLIC API ─────────────────────────────────────────────
const HFAR = {
  version: HFAR_VERSION,

  async analyze(repoUrl) {
    const { markdown, repoMeta } = await fetchReadme(repoUrl);
    const analysis = analyzeMarkdown(markdown);
    const insights = generateInsights(analysis);
    const optimizedReadme = generateReadme(analysis, repoMeta);
    return { markdown, repoMeta, analysis, insights, optimizedReadme };
  },

  analyzeMarkdown(markdown) { return analyzeMarkdown(markdown); },
  insights(analysis)        { return generateInsights(analysis); },
  generateReadme(analysis, repoMeta) { return generateReadme(analysis, repoMeta); },
  getStandard()             { return [...IRSANAI_STANDARD]; },
  quickScore(markdown)      { return analyzeMarkdown(markdown).overallScore; }
};

// ── EXPORTS ─────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HFAR, HFAR_VERSION, IRSANAI_STANDARD };
} else if (typeof window !== 'undefined') {
  window.HFAR = HFAR;
}
export { HFAR, HFAR_VERSION, IRSANAI_STANDARD };
