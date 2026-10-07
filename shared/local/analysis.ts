import { countWords } from '../text';
import type { ResolvedSmartness, RewriteSettings } from '../settings';
import { RULES, rulePattern } from './rules';

export const FEATURE_NAMES = [
  'bulkyPhraseDensity', 'longSentenceLoad', 'longWordRatio', 'averageWordLength',
  'fragmentRatio', 'repeatedFunctionWords', 'spacingIssues',
] as const;

export function englishWords(text: string): string[] {
  return text.match(/[a-z]+(?:['’][a-z]+)?/giu) ?? [];
}

export function sentences(text: string): string[] {
  // Estimates only. Abbreviations and code can affect sentence counts.
  return text.split(/[.!?]+(?:\s|$)|\n+/u).map((part) => part.trim()).filter(Boolean);
}

export function bulkyPhraseCount(text: string): number {
  return RULES.filter((rule) => rule.category !== 'vocabulary')
    .reduce((count, rule) => count + [...text.matchAll(rulePattern(rule.from))].length, 0);
}

const ENGLISH_MARKERS = new Set('the a an this that these those is are was were be been being it its I i you your we our they their he she have has had will would should could can may might not no never and or but because to of for from in on with by at as if then than while which who what how hello thanks please use using used start started help clear text draft writing words sentence language today now need more less'.split(' '));

export function looksEnglish(text: string): boolean {
  const tokens = englishWords(text);
  const letters = text.match(/\p{L}/gu) ?? [];
  const latin = text.match(/[a-z]/giu) ?? [];
  if (!tokens.length || latin.length / Math.max(1, letters.length) < 0.85) return false;
  const markers = tokens.filter((word) => ENGLISH_MARKERS.has(word.toLowerCase())).length;
  return markers / tokens.length >= 0.12 || (tokens.length < 8 && (markers > 0 || bulkyPhraseCount(text) > 0));
}

function syllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/(?:[^aeiouy]e|ed|es)$/u, '');
  return Math.max(1, cleaned.match(/[aeiouy]+/gu)?.length ?? 1);
}

export interface TextAnalysis {
  words: number;
  sentences: number;
  averageSentenceWords: number;
  longSentences: number;
  readingEase: number | null;
  readingLabel: 'Easy' | 'Standard' | 'Dense' | 'Not estimated';
  readingMinutes: number;
  bulkyPhrases: number;
  english: boolean;
}

export function analyzeText(text: string): TextAnalysis {
  const words = countWords(text);
  const segments = sentences(text);
  const english = looksEnglish(text);
  const lexical = englishWords(text);
  const average = words / Math.max(1, segments.length);
  const readingEase = english && lexical.length >= 8
    ? Math.round(Math.max(0, Math.min(100,
      206.835 - 1.015 * lexical.length / Math.max(1, segments.length)
      - 84.6 * lexical.reduce((sum, word) => sum + syllables(word), 0) / lexical.length,
    ))) : null;
  return {
    words,
    sentences: segments.length,
    averageSentenceWords: Math.round(average * 10) / 10,
    longSentences: segments.filter((segment) => countWords(segment) > 30).length,
    readingEase,
    readingLabel: readingEase === null ? 'Not estimated' : readingEase >= 65 ? 'Easy' : readingEase >= 45 ? 'Standard' : 'Dense',
    readingMinutes: Math.max(1, Math.ceil(words / 220)),
    bulkyPhrases: bulkyPhraseCount(text),
    english,
  };
}

export function clarityFeatures(text: string): number[] {
  const tokens = englishWords(text);
  const chunks = sentences(text);
  const n = Math.max(1, tokens.length);
  const chunkSizes = chunks.map((chunk) => englishWords(chunk).length);
  return [
    Math.min(1, bulkyPhraseCount(text) * 5 / n),
    Math.min(2, chunkSizes.reduce((sum, length) => sum + Math.max(0, length - 24), 0) / n),
    tokens.filter((word) => word.length >= 9).length / n,
    tokens.reduce((sum, word) => sum + word.length, 0) / n / 10,
    chunkSizes.filter((size) => size > 0 && size < 3).length / Math.max(1, chunks.length),
    Math.min(1, (text.match(/\b(the|a|an|to|of|and)\s+\1\b/giu)?.length ?? 0) * 5 / n),
    Math.min(1, (text.match(/[ \t]{2,}|[ \t]+[,!?;:]/gu)?.length ?? 0) * 5 / n),
  ];
}

export function resolveSmartness(text: string, settings: RewriteSettings): { level: ResolvedSmartness; reason: string } {
  if (settings.smartness !== 'adaptive') {
    return { level: settings.smartness, reason: 'You chose this edit intensity.' };
  }
  const analysis = analyzeText(text);
  if (!analysis.english) return { level: 'medium', reason: 'Local language analysis is English-focused. Cloud mode can handle other languages.' };
  if (analysis.bulkyPhrases >= 3 || analysis.longSentences >= 2 || (analysis.readingEase !== null && analysis.readingEase < 40)) {
    return { level: 'high', reason: 'The draft has several bulky phrases, long sentences, or dense wording.' };
  }
  if (analysis.bulkyPhrases > 0 || analysis.longSentences > 0 || (analysis.readingEase !== null && analysis.readingEase < 65)) {
    return { level: 'medium', reason: 'Some wording or sentence length could be clearer.' };
  }
  return { level: 'low', reason: 'The draft already reads clearly, so a light touch is enough.' };
}
