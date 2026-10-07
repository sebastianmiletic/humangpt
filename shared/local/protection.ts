import { escapeRegExp } from './rules';

export function protectText(text: string, terms: string[]) {
  const ranges: Array<{ start: number; end: number }> = [];
  const patterns = [
    /```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)/gu,
    /`[^`\n]+`/gu,
    /^(?: {4}|\t).+$/gmu,
    /"(?:[^"\\]|\\.)*"|“[^”]*”|‘[^’]*’|(?<!\p{L})'[^'\n]+'(?!\p{L})/gu,
    /(?:https?|ftp):\/\/[^\s<>]+|www\.[^\s<>]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu,
    /(?<![\p{L}\p{N}])\/[\w@%+.,~:=/-]+(?:[?#][^\s<>]*)?/gu,
    /\[[^\]\n]*\]\([^\s)]+\)/gu,
    /<(\w+)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>\n]+>/gu,
    /\b(?:e\.g\.|i\.e\.|Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)/gu,
    /\b[A-Z]{2,}(?:[._-][A-Z\d]+)*\b/gu,
    /\b[A-Z][a-z]+(?:[ \t]+(?:[A-Z][a-z]+|[A-Z]{2,}))+\b/gu,
    /[+-]?\d+(?:[.,/:–-]\d+)*(?:%|\b)/gu,
    /\[[\d,; \t-]+\]/gu,
  ];
  for (const term of terms) {
    const start = /^[\p{L}\p{N}_]/u.test(term) ? '(?<![\\p{L}\\p{N}_])' : '';
    const end = /[\p{L}\p{N}_]$/u.test(term) ? '(?![\\p{L}\\p{N}_])' : '';
    patterns.push(new RegExp(`${start}${escapeRegExp(term)}${end}`, 'giu'));
  }
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  // A capitalized word inside a sentence is likely a name. Leave it alone.
  for (const match of text.matchAll(/\b[A-Z][a-z]+\b/gu)) {
    const preceding = text.slice(0, match.index).trimEnd();
    if (preceding && !/[.!?\n]$/u.test(preceding) && !/^[ \t]*$/u.test(text.slice(text.lastIndexOf('\n', match.index - 1) + 1, match.index))) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range.start < last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  let nonce = 0;
  while (text.includes(`\uE000HG${nonce}:`)) nonce += 1;
  const prefix = `\uE000HG${nonce}:`;
  const saved: string[] = [];
  let cursor = 0;
  let masked = '';
  for (const range of merged) {
    masked += text.slice(cursor, range.start) + `${prefix}${saved.length}\uE001`;
    saved.push(text.slice(range.start, range.end));
    cursor = range.end;
  }
  masked += text.slice(cursor);
  const markerPattern = new RegExp(`${escapeRegExp(prefix)}(\\d+)\uE001`, 'gu');
  return {
    masked,
    restore: (value: string) => value.replace(markerPattern, (match, index: string) => saved[Number(index)] ?? match),
    intact: (value: string) => saved.every((_entry, index) => value.includes(`${prefix}${index}\uE001`)),
  };
}
