import { PDFTool } from '../types/tool';

/**
 * 100% offline smart search.
 * Understands raw Hinglish like "photo ko pdf", "pdf jodo",
 * "chhota karo", "pেজ" etc. without any server.
 */

const STOPWORDS = new Set([
  'ko', 'ka', 'ki', 'ke', 'se', 'me', 'mein', 'main', 'mai', 'par', 'per',
  'kaise', 'karo', 'kare', 'karna', 'karne', 'karke', 'krna', 'krdo', 'kardo',
  'banao', 'banana', 'banaye', 'banani', 'banado', 'bana', 'bnao',
  'chahiye', 'mujhe', 'mera', 'meri', 'mere', 'apna', 'apni',
  'wala', 'wali', 'wale', 'walon', 'hai', 'hain', 'ho', 'hoga', 'kar',
  'please', 'pls', 'ek', 'the', 'a', 'an', 'and', 'or', 'to', 'from', 'of',
  'do', 'kr', 'krna',
]);

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[।.,!?;:()"'“”‘’\-_/\\|@#$%^&*+=~<>[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// tiny fuzzy: allows 1-2 char typos ("photp" -> "photo", "marge" -> "merge")
function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

function tokenScore(q: string, kw: string): number {
  if (q === kw) return 10;
  if (kw.startsWith(q) && q.length >= 3) return 8;
  if (q.startsWith(kw) && kw.length >= 3) return 7;
  if (kw.includes(q) && q.length >= 3) return 5;
  if (q.includes(kw) && kw.length >= 3) return 4;
  if (q.length >= 4 && kw.length >= 4 && lev(q, kw) <= 1) return 6;
  if (q.length >= 5 && kw.length >= 5 && lev(q, kw) <= 2) return 3;
  return 0;
}

export function smartSearch(tools: PDFTool[], rawQuery: string): PDFTool[] {
  const q = norm(rawQuery);
  if (!q) return tools;

  const tokens = q.split(' ').filter(Boolean);
  const strong = tokens.filter((t) => !STOPWORDS.has(t) && t.length > 0);
  // if query is only stopwords ("ko", "kaise karo"), fall back to all tokens
  const use = strong.length > 0 ? strong : tokens;
  if (use.length === 0) return tools;

  const scored = tools.map((tool) => {
    const corpus = [
      ...tool.keywords.map(norm),
      norm(tool.titleEn),
      norm(tool.titleHi),
      norm(tool.descEn),
      norm(tool.descHi),
      norm(tool.id.replace(/-/g, ' ')),
    ];
    const words = corpus.flatMap((c) => c.split(' ').filter(Boolean));

    let score = 0;
    let matchedTokens = 0;
    for (const qt of use) {
      let best = 0;
      for (const w of words) {
        const s = tokenScore(qt, w);
        if (s > best) best = s;
        if (best >= 10) break;
      }
      if (best > 0) {
        matchedTokens++;
        score += best;
        // title hits count extra
        if (norm(tool.titleEn).includes(qt) || tool.titleHi.includes(qt)) score += 2;
      }
    }
    // bonus when most query words matched (e.g. "photo" + "pdf" both hit)
    if (matchedTokens === use.length && use.length > 1) score += 8;
    return { tool, score, matchedTokens };
  });

  return scored
    .filter((s) => s.matchedTokens > 0 && s.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.titleEn.localeCompare(b.tool.titleEn))
    .map((s) => s.tool);
}
