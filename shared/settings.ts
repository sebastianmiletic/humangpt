import type { Tone } from './text';

export const SMARTNESS_LEVELS = ['adaptive', 'low', 'medium', 'high'] as const;
export type Smartness = (typeof SMARTNESS_LEVELS)[number];
export type ResolvedSmartness = Exclude<Smartness, 'adaptive'>;
export const VOCABULARIES = ['simple', 'balanced', 'advanced'] as const;
export type Vocabulary = (typeof VOCABULARIES)[number];
export const LENGTHS = ['preserve', 'concise'] as const;
export type RewriteLength = (typeof LENGTHS)[number];
export type Engine = 'local' | 'cloud';

export interface RewriteSettings {
  tone: Tone;
  smartness: Smartness;
  vocabulary: Vocabulary;
  length: RewriteLength;
  contractions: boolean;
  sentenceVariety: boolean;
  protectedTerms: string[];
}

export const DEFAULT_SETTINGS: RewriteSettings = {
  tone: 'natural',
  smartness: 'adaptive',
  vocabulary: 'balanced',
  length: 'preserve',
  contractions: false,
  sentenceVariety: true,
  protectedTerms: [],
};

export const SMARTNESS_LABELS: Record<Smartness, string> = {
  adaptive: 'Adaptive', low: 'Low', medium: 'Medium', high: 'High',
};
export const SMARTNESS_HELP: Record<Smartness, string> = {
  adaptive: 'Chooses edit intensity from the draft’s wording and sentence length.',
  low: 'A light touch: spacing, repeated words, and a few bulky phrases.',
  medium: 'Clearer phrasing and vocabulary, with your structure intact.',
  high: 'More thorough phrasing edits, plus safe splits of long sentences.',
};
export const VOCABULARY_LABELS: Record<Vocabulary, string> = {
  simple: 'Simple', balanced: 'Balanced', advanced: 'Precise',
};
export const VOCABULARY_HELP: Record<Vocabulary, string> = {
  simple: 'Prefer everyday English words.',
  balanced: 'Keep useful vocabulary; simplify needlessly formal wording.',
  advanced: 'Retain technical vocabulary. Precise does not mean bigger words.',
};

export function parseProtectedTerms(value: string): string[] {
  return [...new Set(value.split(/[,\n]/u).map((term) => term.trim()).filter(Boolean))];
}

export function protectedTermsError(terms: string[]): string {
  if (terms.length > 20) return 'Keep up to 20 protected words or phrases.';
  if (terms.some((term) => term.length > 80)) return 'Keep each protected phrase under 80 characters.';
  return '';
}
