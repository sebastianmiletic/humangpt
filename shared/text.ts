export const MAX_WORDS = 1_500;
export const MAX_CHARACTERS = 12_000;
export const TONES = ['natural', 'casual', 'professional'] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABELS: Record<Tone, string> = {
  natural: 'Natural',
  casual: 'Casual',
  professional: 'Professional',
};

// The character cap also protects text in languages without spaces.
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

export interface RewriteResult {
  text: string;
  tone: Tone;
  sourceWords: number;
  resultWords: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
