import { countWords, MAX_CHARACTERS, MAX_WORDS } from '../text';
import { DEFAULT_SETTINGS, protectedTermsError, type ResolvedSmartness, type RewriteSettings } from '../settings';
import { analyzeText, clarityFeatures, resolveSmartness, type TextAnalysis } from './analysis';
import { protectText } from './protection';
import { CONTRACTIONS, RULES, rulePattern } from './rules';
import model from './ranker-model.json';

export interface LocalChange {
  before: string;
  after: string;
  reason: string;
  category: 'cleanup' | 'phrasing' | 'vocabulary' | 'concision' | 'tone' | 'sentences';
  count: number;
}
export interface LocalResult {
  text: string;
  level: ResolvedSmartness;
  adaptiveReason: string;
  changes: LocalChange[];
  editCount: number;
  before: TextAnalysis;
  after: TextAnalysis;
  notice: string;
}

export function rankClarity(text: string): number {
  return clarityFeatures(text).reduce((score, value, index) => score + value * model.weights[index], 0);
}

function caseLike(value: string, original: string): string {
  if (original === original.toUpperCase() && /[A-Z]/u.test(original)) return value.toUpperCase();
  if (/^[A-Z]/u.test(original)) return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
}

function meaningMarkers(text: string): string[] {
  let normalized = text.toLowerCase().replace(/’/gu, "'");
  for (const [expanded, contracted] of CONTRACTIONS) normalized = normalized.replace(rulePattern(contracted), expanded.toLowerCase());
  normalized = normalized.replace(/\bcannot\b/gu, 'can not');
  return normalized.match(/\b(?:not|no|never|unless|may|might|must|should|could|would|will|can|sometimes|always)\b|\bat least\b|\bat most\b|\bup to\b/gu) ?? [];
}

function preservesMarkers(source: string, result: string): boolean {
  const original = meaningMarkers(source);
  const next = meaningMarkers(result);
  let cursor = 0;
  // Existing modal verbs and qualifications must survive, in their original order.
  for (const marker of next) if (marker === original[cursor]) cursor += 1;
  return cursor === original.length;
}

export function rewriteLocal(text: string, settings: RewriteSettings = DEFAULT_SETTINGS): LocalResult {
  if (!text.trim()) throw new Error('Paste a draft before rewriting.');
  if (text.length > MAX_CHARACTERS || countWords(text) > MAX_WORDS) throw new Error('That draft is too long. Try rewriting one section at a time.');
  const termsError = protectedTermsError(settings.protectedTerms);
  if (termsError) throw new Error(termsError);
  const before = analyzeText(text);
  const resolved = resolveSmartness(text, settings);
  if (!before.english) {
    return {
      text, level: resolved.level, adaptiveReason: resolved.reason, changes: [], editCount: 0,
      before, after: before,
      notice: 'Local mode is English-focused and could not confidently edit this draft. Your text is unchanged. Use cloud mode for other languages or deeper rewriting.',
    };
  }
  const protectedText = protectText(text, settings.protectedTerms);
  const level = { low: 1, medium: 2, high: 3 }[resolved.level];

  function candidate(includeVocabulary: boolean, includePhrasing: boolean) {
    let value = protectedText.masked;
    const edits = new Map<string, LocalChange>();
    const apply = (
      pattern: RegExp,
      replacement: string | ((match: string, offset: number, full: string) => string),
      reason: string,
      category: LocalChange['category'],
    ) => {
      value = value.replace(pattern, (match: string, ...args: unknown[]) => {
        const next = typeof replacement === 'string' ? caseLike(replacement, match)
          : replacement(match, args.at(-2) as number, args.at(-1) as string);
        if (next !== match) {
          const key = JSON.stringify([match, next, category]);
          const existing = edits.get(key);
          if (existing) existing.count += 1;
          else edits.set(key, { before: match, after: next, reason, category, count: 1 });
        }
        return next;
      });
    };
    apply(/\b(the|a|an|to|of|and)([ \t]+)\1\b/giu, (match) => match.split(/[ \t]+/u)[0], 'Removed an accidental repeated function word.', 'cleanup');
    apply(/[ \t]{2,}/gu, (match, offset, full) => {
      const lineStart = full.lastIndexOf('\n', offset - 1) + 1;
      const indentation = !full.slice(lineStart, offset).trim();
      const lineEnding = /^(?:\r?\n|$)/u.test(full.slice(offset + match.length));
      return indentation || lineEnding ? match : ' ';
    }, 'Tidied extra spaces outside protected text.', 'cleanup');
    apply(/[ \t]+(?=[,!?;:])/gu, '', 'Removed spaces before punctuation.', 'cleanup');

    for (const [expanded, contracted] of CONTRACTIONS) {
      if (settings.contractions && settings.tone !== 'professional') {
        apply(rulePattern(expanded), contracted, 'Used a natural contraction while keeping the meaning.', 'tone');
      } else {
        apply(rulePattern(contracted), expanded, 'Expanded an unambiguous contraction.', 'tone');
      }
    }
    if (settings.tone === 'casual') {
      apply(rulePattern('moreover'), 'also', 'Used a more conversational transition.', 'tone');
      apply(rulePattern('nevertheless'), 'still', 'Used a more conversational transition.', 'tone');
    }

    for (const rule of RULES) {
      if (rule.level > level) continue;
      if (rule.category === 'vocabulary') {
        if (!includeVocabulary || settings.vocabulary === 'advanced' || (rule.simpleOnly && settings.vocabulary !== 'simple')) continue;
      } else if (!includePhrasing) continue;
      if (rule.category === 'concision' && settings.length !== 'concise') continue;
      const to = settings.tone === 'professional' && ['with regard to', 'with regards to', 'in regard to'].includes(rule.from)
        ? 'regarding' : rule.to;
      apply(rulePattern(rule.from), (match, offset, full) => {
        const preceding = full.slice(0, offset);
        if (['endeavor to', 'endeavors to'].includes(rule.from)
          && /\b(?:a|an|the|this|that|these|those|my|our|your|their|his|her|its)[ \t]+$/iu.test(preceding)) return match;
        if (['it is important to note that', 'it is worth noting that'].includes(rule.from)) {
          const start = Math.max(preceding.lastIndexOf('.'), preceding.lastIndexOf('!'), preceding.lastIndexOf('?'), preceding.lastIndexOf('\n')) + 1;
          const prefix = preceding.slice(start);
          if (!/^[ \t>*#-]*(?:(?:however|also|first|finally|therefore|in addition),[ \t]*)?$/iu.test(prefix)) return match;
        }
        if (rule.from === 'demonstrated that' && /\b(?:has|have|had|is|was|were|be|been|being)[ \t]+$/iu.test(preceding)) return caseLike('shown that', match);
        return caseLike(to, match);
      },
        rule.category === 'vocabulary' ? 'Replaced needlessly formal wording with a familiar equivalent.'
          : rule.category === 'concision' ? 'Shortened a redundant signpost without removing the claim.'
            : 'Replaced a bulky phrase with a direct equivalent.',
        rule.category);
    }

    if (includePhrasing && level === 3 && settings.sentenceVariety) {
      apply(/(?:;[ \t]+|,[ \t]+and[ \t]+)(?:we|you|they|he|she|it)\b/giu, (match, offset, full) => {
        const start = Math.max(full.lastIndexOf('.', offset), full.lastIndexOf('!', offset), full.lastIndexOf('?', offset), full.lastIndexOf('\n', offset)) + 1;
        const tail = full.slice(offset + match.length).search(/[.!?\n]/u);
        const end = tail < 0 ? full.length : offset + match.length + tail;
        if (countWords(protectedText.restore(full.slice(start, end))) <= 35) return match;
        const subject = match.match(/(?:we|you|they|he|she|it)$/iu)![0];
        return `. ${subject.charAt(0).toUpperCase()}${subject.slice(1)}`;
      }, 'Split a long coordinated sentence at an explicit subject.', 'sentences');
    }
    const restored = protectedText.restore(value);
    const valid = protectedText.intact(value) && preservesMarkers(text, restored)
      && countWords(restored) >= Math.max(1, Math.floor(before.words * 0.35));
    return { text: restored, changes: [...edits.values()], valid, score: rankClarity(restored) };
  }

  const baseline = candidate(false, false);
  const candidates = [baseline, candidate(false, true), candidate(true, true)]
    .filter((entry) => entry.valid)
    .sort((a, b) => b.score - a.score || a.changes.length - b.changes.length);
  const selected = candidates[0];
  const rewritten = selected?.text ?? text;
  const changes = selected?.changes ?? [];
  const editCount = changes.reduce((sum, change) => sum + change.count, 0);
  return {
    text: rewritten,
    level: resolved.level,
    adaptiveReason: resolved.reason,
    changes,
    editCount,
    before,
    after: analyzeText(rewritten),
    notice: rewritten === text
      ? 'No safe local edits were recommended. The draft may already read well, or need a deeper rewrite than the local editor can provide.'
      : 'Local polish is ready. Review the edits: this small editor is not a generative language model.',
  };
}
