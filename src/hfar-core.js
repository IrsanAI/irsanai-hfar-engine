/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  HFAR CORE ENGINE v2.1                                   ║
 * ║  Header-First + Anchor Read                              ║
 * ║  IrsanAI Universe · MIT License                         ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Usage (Browser): <script src="src/hfar-core.js"></script>
 *                  window.HFAR is available globally
 * Usage (Node):    const { HFAR } = require('./src/hfar-core.js')
 */

const HFAR_VERSION = '2.1.0';

const IRSANAI_STANDARD = [
  { id:'hero',     label:'Hero / Titel + Claim',          keywords:['# '],                           weight:20, required:true  },
  { id:'lang',     label:'Sprachumschalter (DE/EN)',       keywords:['deutsch','english','🇩🇪','🇬🇧'],  weight:8,  required:false },
  { id:'desc',     label:'Kurzbeschreibung',               keywords:['what is','was ist','overview'],  weight:12, required:true  },
  { id:'features', label:'Core Features',                  keywords:['feature','✨','⚡'],              weight:12, required:true  },
  { id:'universe', label:'IrsanAI Universe-Kontext',       keywords:['universe','ecosystem'],          weight:10, required:false },
  { id:'arch',     label:'Technische Specs/Architektur',   keywords:['architecture','spec','stack'],   weight:8,  required:false },
  { id:'install',  label:'Installation / Usage',           keywords:['install','git clone','```bash'], weight:15, required:true  },
  { id:'roadmap',  label:'Roadmap',                        keywords:['roadmap','- [ ]','next steps'],  weight:8,  required:false },
  { id:'license',  label:'License',                        keywords:['license','lizenz','mit'],        weight:7,  required:true  },
];

const DE_WORDS = /\b(und|die|der|das|ist|von|für|mit|eine|werden|nicht|auch|sich|dem|auf|den)\b/gi;
const EN_WORDS = /\b(the|and|is|for|with|this|that|your|have|from|are|you|will|can|all)\b/gi;
const BYTES_PER_TOKEN = 3.8;
const HFAR_READ_RATIO = 0.30;

// ── FETCH ──────────────────────────────────────────────────
async function fetchReadme(repoUrl) {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!match) throw new Error('Ungültige GitHub-URL: "' + repoUrl + '"');
  const owner = match[1];
  const cleanRepo = match[2].replace(/\.git$/, '');
  const res = await fetch(
    'https://api.github.com/repos/' + owner + '/' + cleanRepo + '/contents/README.md',
    { headers: { Accept: 'application/vnd.github.v3+json' } }
  );
  if (res.status === 404) throw new Error('README.md nicht gefunden in ' + owner + '/' + cleanRepo);
  if (res.status === 403) throw new Error('GitHub API Rate Limit. Bitte 1 Minute warten.');
  if (!res.ok) throw new Error('GitHub API Fehler: ' + res.status);
  const data = await res.json();
  return {
    markdown: atob(data.content.replace(/\n/g, '')),
    repoMeta: { owner: owner, repo: cleanRepo, sha: data.sha, url: repoUrl }
  };
}

// ── CORE ANALYZER ──────────────────────────────────────────
function analyzeMarkdown(markdown) {
  const lines = markdown.split('\n');
  const bytes = new TextEncoder().encode(markdown).length;
  const totalTokens = Math.round(bytes / BYTES_PER_TOKEN);
  const hfarTokens = Math.round(totalTokens * HFAR_READ_RATIO);

  const headers = [];
  var h1Count = 0, h2Count = 0, h3Count = 0;
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (m) {
      var level = m[1].length;
      headers.push({ level: level, title: m[2].trim() });
      if (level === 1) h1Count++;
      else if (level === 2) h2Count++;
      else if (level === 3) h3Count++;
    }
  }

  var codeBlocks = Math.floor((markdown.match(/```/g) || []).length / 2);
  var links      = (markdown.match(/\[.+?\]\(https?:\/\/.+?\)/g) || []).length;
  var badges     = (markdown.match(/!\[.*?\]\(https?:\/\/.+?\)/g) || []).length;
  var tables     = (markdown.match(/^\|.+\|$/gm) || []).length > 0;
  var checkboxes = (markdown.match(/- \[[ x]\]/g) || []).length;
  var emojis     = (markdown.match(/[\u{1F300}-\u{1FFFF}]/gu) || []).length;
  var words      = markdown.split(/\s+/).filter(Boolean).length;
  var sentences  = (markdown.match(/[.!?]+/g) || []).length;

  var claim = '';
  for (var j = 0; j < lines.length; j++) {
    var t = lines[j].trim();
    if (t && t[0] !== '#' && t[0] !== '!' && t[0] !== '<' && t[0] !== '|'
        && t.indexOf('```') !== 0 && t.indexOf('[![') !== 0
        && t.length > 30 && t.length < 300) {
      claim = t.replace(/\*\*/g, '').replace(/\*/g, '').trim();
      break;
    }
  }

  var deM = (markdown.match(DE_WORDS) || []).length;
  var enM = (markdown.match(EN_WORDS) || []).length;
  var languageCode = deM > enM * 1.4 ? 'de' : enM > deM * 1.4 ? 'en' : 'mixed';
  var language = languageCode === 'de' ? 'Deutsch' : languageCode === 'en' ? 'English' : 'Bilingual DE/EN';

  var mdLower = markdown.toLowerCase();
  var gaps = IRSANAI_STANDARD.filter(function(s) {
    return !s.keywords.some(function(kw) { return mdLower.indexOf(kw.toLowerCase()) !== -1; });
  }).map(function(s) {
    return { id: s.id, label: s.label, weight: s.weight, required: s.required };
  });

  var maxScore = IRSANAI_STANDARD.reduce(function(acc, x) { return acc + x.weight; }, 0);
  var missedScore = gaps.reduce(function(acc, x) { return acc + x.weight; }, 0);
  var standardScore = Math.round(((maxScore - missedScore) / maxScore) * 100);
  var readability = Math.max(10, Math.min(99, Math.round(98 - (words / Math.max(1, sentences)) * 1.8)));
  var structureScore = Math.min(100, Math.round(
    (h1Count === 1 ? 25 : 0) + Math.min(25, h2Count * 8) +
    (codeBlocks > 0 ? 20 : 0) + Math.min(15, links * 5) +
    (badges > 0 ? 10 : 0) + (tables ? 5 : 0)
  ));
  var contentScore = Math.min(100, Math.round(
    (claim ? 30 : 0) + Math.min(20, emojis * 5) +
    (checkboxes > 0 ? 15 : 0) + Math.min(20, words / 10) +
    (languageCode === 'mixed' ? 15 : 8)
  ));
  var overallScore = Math.round(structureScore * 0.35 + contentScore * 0.30 + standardScore * 0.35);
  var grade = overallScore >= 85 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 55 ? 'C' : overallScore >= 40 ? 'D' : 'F';

  return {
    bytes: bytes, totalTokens: totalTokens, hfarTokens: hfarTokens,
    savedTokens: totalTokens - hfarTokens,
    savedPercent: Math.round(((totalTokens - hfarTokens) / totalTokens) * 100),
    headers: headers, h1Count: h1Count, h2Count: h2Count, h3Count: h3Count,
    codeBlocks: codeBlocks, links: links, badges: badges, tables: tables,
    checkboxes: checkboxes, emojis: emojis, words: words, sentences: sentences,
    claim: claim, language: language, languageCode: languageCode,
    gaps: gaps, gapCount: gaps.length,
    requiredGaps: gaps.filter(function(g) { return g.required; }),
    readability: readability, structureScore: structureScore,
    contentScore: contentScore, standardScore: standardScore,
    overallScore: overallScore, grade: grade,
    hfarVersion: HFAR_VERSION,
    analyzedAt: new Date().toISOString()
  };
}

// ── INSIGHTS ───────────────────────────────────────────────
function generateInsights(analysis) {
  var ins = [];
  function push(title, issue, fix, impact) { ins.push({ title: title, issue: issue, fix: fix, impact: impact }); }

  if (analysis.h1Count === 0)
    push('H1-Titel fehlt', 'Kein Haupttitel — kritisch für SEO und ersten Eindruck.', 'Einen H1 ergänzen: # Projektname — Kurze Beschreibung', 'high');
  else if (analysis.h1Count > 1)
    push('Mehrere H1-Titel', analysis.h1Count + '× H1 gefunden — verwirrend für Leser und Crawler.', 'Auf genau einen H1 reduzieren.', 'high');

  if (!analysis.claim)
    push('Kein Claim erkennbar', 'HFAR konnte keinen Haupt-Claim extrahieren.', 'Direkt nach H1: ein einziger Claim-Satz als Kernbotschaft.', 'high');

  if (analysis.codeBlocks === 0)
    push('Kein Quickstart-Code', 'Keine Code-Blocks — Entwickler wissen nicht wie sie starten.', 'Mindestens einen ```bash Block mit Install + Start ergänzen.', 'high');

  analysis.requiredGaps.forEach(function(gap) {
    push('Pflichtsektion fehlt: ' + gap.label, '"' + gap.label + '" ist Required im IrsanAI-Standard.', 'Sektion "' + gap.label + '" ergänzen (+' + gap.weight + ' Score-Punkte).', 'high');
  });

  analysis.gaps.filter(function(g) { return !g.required; }).forEach(function(gap) {
    push('Empfohlen: ' + gap.label, '"' + gap.label + '" fehlt — schadet dem Standard-Score.', 'Hinzufügen für +' + gap.weight + ' Punkte.', 'medium');
  });

  if (analysis.badges === 0)
    push('Keine Badges', 'Ohne Badges wirkt das Repo unprofessionell.', 'License, Version und Build-Status Badges ergänzen.', 'medium');

  if (analysis.emojis < 3)
    push('Wenig Emojis', 'Sektionen ohne Emojis sind schwerer zu scannen.', '## ⚡ Features, ## 🚀 Installation etc. verwenden.', 'low');

  if (analysis.languageCode !== 'mixed')
    push('Nur einsprachig', 'Nur ' + analysis.language + ' — internationale Reichweite eingeschränkt.', '[🇩🇪 Deutsch] / [🇬🇧 English] Links am Anfang ergänzen.', 'low');

  if (analysis.readability < 60)
    push('Niedrige Lesbarkeit', 'Score: ' + analysis.readability + '/100', 'Kürzere Sätze, mehr Bullet Points.', 'medium');

  return ins;
}

// ── README GENERATOR ───────────────────────────────────────
function generateReadme(analysis, repoMeta) {
  var repo = repoMeta.repo;
  var owner = repoMeta.owner;
  var claim = analysis.claim || 'Eine leistungsstarke Komponente des IrsanAI Universums.';
  var color = analysis.overallScore >= 70 ? 'green' : 'orange';
  var featureList = analysis.headers
    .filter(function(h) { return h.level === 2; })
    .slice(0, 5)
    .map(function(h) { return '- **' + h.title + '**'; })
    .join('\n') || '- Core Feature 1\n- Core Feature 2\n- Core Feature 3';

  return '# ⚡ ' + repo + '\n\n'
    + '> ' + claim + '\n\n'
    + '[![MIT License](https://img.shields.io/badge/license-MIT-cyan.svg)](LICENSE)\n'
    + '[![IrsanAI Universe](https://img.shields.io/badge/IrsanAI-Universe-blueviolet)](https://github.com/irsanai)\n'
    + '[![HFAR Score](https://img.shields.io/badge/HFAR%20Score-' + analysis.overallScore + '%2F100-' + color + ')](https://github.com/irsanai/irsanai-hfar-engine)\n\n'
    + '[🇩🇪 Deutsch](#deutsch) · [🇬🇧 English](#english)\n\n---\n\n'
    + '<a name="deutsch"></a>\n'
    + '## 🔍 Was ist ' + repo + '?\n\n'
    + claim + '\n\n---\n\n'
    + '## ✨ Core Features\n\n'
    + featureList + '\n\n---\n\n'
    + '## 🌐 IrsanAI Universe\n\n'
    + 'Teil des **[IrsanAI Ecosystems](https://github.com/irsanai)**.\n\n---\n\n'
    + '## 🚀 Installation\n\n'
    + '```bash\ngit clone https://github.com/' + owner + '/' + repo + '.git\ncd ' + repo + '\n```\n\n---\n\n'
    + '## 🗺️ Roadmap\n\n'
    + '- [x] v1.0 — Core Funktionalität\n'
    + '- [ ] v2.0 — Erweiterungen\n'
    + '- [ ] v3.0 — Full Ecosystem Integration\n\n---\n\n'
    + '## 📄 Lizenz\n\n'
    + 'MIT License — Teil des IrsanAI Universe\n\n---\n\n'
    + '<a name="english"></a>\n'
    + '## 🔍 What is ' + repo + '?\n\n'
    + claim + '\n\n---\n\n'
    + '*← [Back to IrsanAI Universe](https://github.com/irsanai) · Optimized with [HFAR ENGINE v' + HFAR_VERSION + '](https://github.com/irsanai/irsanai-hfar-engine)*';
}

// ── PUBLIC API ─────────────────────────────────────────────
var HFAR = {
  version: HFAR_VERSION,

  analyze: async function(repoUrl) {
    var fetched = await fetchReadme(repoUrl);
    var analysis = analyzeMarkdown(fetched.markdown);
    var insights = generateInsights(analysis);
    var optimizedReadme = generateReadme(analysis, fetched.repoMeta);
    return { markdown: fetched.markdown, repoMeta: fetched.repoMeta, analysis: analysis, insights: insights, optimizedReadme: optimizedReadme };
  },

  analyzeMarkdown: function(markdown) { return analyzeMarkdown(markdown); },
  insights:        function(analysis)  { return generateInsights(analysis); },
  generateReadme:  function(analysis, repoMeta) { return generateReadme(analysis, repoMeta); },
  getStandard:     function() { return IRSANAI_STANDARD.slice(); },
  quickScore:      function(markdown) { return analyzeMarkdown(markdown).overallScore; }
};

// ── EXPORTS ─────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HFAR: HFAR, HFAR_VERSION: HFAR_VERSION, IRSANAI_STANDARD: IRSANAI_STANDARD };
}
if (typeof window !== 'undefined') {
  window.HFAR = HFAR;
}
