import { describe, expect, it } from 'vitest';
import { analyzeText, clarityFeatures, FEATURE_NAMES, resolveSmartness } from '../shared/local/analysis';
import { rankClarity, rewriteLocal } from '../shared/local/engine';
import { protectText } from '../shared/local/protection';
import { DEFAULT_SETTINGS, parseProtectedTerms, protectedTermsError } from '../shared/settings';
import model from '../shared/local/ranker-model.json';
import preferences from '../data/editor-preferences.json';

const settings = { ...DEFAULT_SETTINGS, smartness: 'high' as const, vocabulary: 'simple' as const, length: 'concise' as const };

describe('local English editor', () => {
  it('makes meaningful edits without a provider or API key', () => {
    const result = rewriteLocal('It is important to note that we utilize this guide in order to communicate clearly. We meet on a daily basis.', settings);
    expect(result.text).toBe('Note that we use this guide to communicate clearly. We meet daily.');
    expect(result.editCount).toBe(4);
    expect(result.changes.some((change) => change.category === 'vocabulary')).toBe(true);
  });
  it('changes less at Low, and permits thorough phrasing at High', () => {
    const draft = 'We utilize the guide in order to take into consideration the cost.';
    const low = rewriteLocal(draft, { ...settings, smartness: 'low' });
    const medium = rewriteLocal(draft, { ...settings, smartness: 'medium' });
    const high = rewriteLocal(draft, settings);
    expect(low.text).toBe('We utilize the guide to take into consideration the cost.');
    expect(medium.text).toBe('We use the guide to take into consideration the cost.');
    expect(high.text).toBe('We use the guide to consider the cost.');
    expect(low.editCount).toBeLessThan(high.editCount);
  });
  it('treats vocabulary as preference, not random synonym spinning', () => {
    const draft = 'We utilize the guide and frequently request additional assistance.';
    const simple = rewriteLocal(draft, settings).text;
    const precise = rewriteLocal(draft, { ...settings, vocabulary: 'advanced' }).text;
    expect(simple).toBe('We use the guide and often request extra help.');
    expect(precise).toBe(draft);
    expect(rewriteLocal('The initial is printed on the cover.', settings).text).toContain('initial');
    expect(rewriteLocal('The commencement ceremony begins soon.', settings).text).toContain('commencement');
  });
  it('uses concision only when requested', () => {
    const draft = 'It is important to note that we may need help.';
    expect(rewriteLocal(draft, { ...settings, length: 'preserve' }).text).toBe(draft);
    expect(rewriteLocal(draft, settings).text).toBe('Note that we may need help.');
  });
  it('honors contractions and keeps negation intact', () => {
    const draft = 'We do not use this method because we cannot confirm the claim.';
    const result = rewriteLocal(draft, { ...settings, tone: 'casual', contractions: true });
    expect(result.text).toBe("We don't use this method because we can't confirm the claim.");
    expect(rewriteLocal(result.text, { ...settings, tone: 'professional' }).text).toBe(draft);
  });
  it('does not expand ambiguous contractions', () => {
    const draft = "It's been useful, and he'd like to review it.";
    expect(rewriteLocal(draft, settings).text).toBe(draft);
  });
  it('keeps qualifications and negations while simplifying phrases', () => {
    const draft = 'We may utilize this guide, but we should not assume it always works. In the event that the data is incomplete, we might need more time.';
    const result = rewriteLocal(draft, settings).text;
    for (const marker of ['may', 'should not', 'always', 'might']) expect(result).toContain(marker);
    expect(result).toContain('If the data is incomplete');
  });
  it('protects quotes, code, URLs, email, citations, names, and numbers', () => {
    const draft = 'We utilize the guide from Utilize Labs. “Utilize this in order to proceed” is a quote. The cost is $1,250.50, growth is -2.5%, and we may contact test@example.com. Read https://example.com/in-order-to [1, 2].\n\n```js\nconst message = "utilize in order to";\n```\n\nWe utilize `utilize(value)` in order to test it.';
    const result = rewriteLocal(draft, settings).text;
    for (const literal of ['Utilize Labs', '“Utilize this in order to proceed”', '$1,250.50', '-2.5%', 'test@example.com', 'https://example.com/in-order-to', '[1, 2]', '```js\nconst message = "utilize in order to";\n```', '`utilize(value)`']) expect(result).toContain(literal);
    expect(result).toContain('We use the guide');
    expect(result).toContain('in order to";');
  });
  it('does not replace a capitalized name in the middle of a sentence', () => {
    expect(rewriteLocal('We spoke to Utilize about the guide.', settings).text).toContain('Utilize');
  });
  it('keeps custom terms exact, including their case', () => {
    const result = rewriteLocal('We utilize this guide in order to help. We UTILIZE that guide too.', { ...settings, protectedTerms: ['utilize', 'in order to'] });
    expect(result.text).toContain('utilize this guide in order to');
    expect(result.text).toContain('UTILIZE');
  });
  it('protects literal terms without regex injection or partial-word matches', () => {
    const protectedText = protectText('We use C++ and a [test]. The art is part of the guide.', ['C++', '[test]', 'art']);
    expect(protectedText.restore(protectedText.masked)).toBe('We use C++ and a [test]. The art is part of the guide.');
    expect(protectedText.masked).toContain('part');
  });
  it('preserves paragraphs and Markdown list structure', () => {
    const draft = 'We utilize the guide.\n\n- We utilize the first method.\n- We make use of the second method.\n';
    expect(rewriteLocal(draft, settings).text).toBe('We use the guide.\n\n- We use the first method.\n- We use the second method.\n');
  });
  it('preserves participle grammar instead of using indiscriminate synonyms', () => {
    expect(rewriteLocal('The study has demonstrated that this method works.', settings).text).toBe('The study has shown that this method works.');
    expect(rewriteLocal('It was demonstrated that the claim is correct.', settings).text).toBe('It was shown that the claim is correct.');
    expect(rewriteLocal('The study demonstrated that this method works.', settings).text).toBe('The study showed that this method works.');
  });
  it('does not turn noun endeavors or embedded statements into malformed phrases', () => {
    expect(rewriteLocal('Their endeavors to keep the guide clear may continue.', settings).text).toContain('Their endeavors to');
    expect(rewriteLocal('It is an endeavor to keep the guide clear.', settings).text).toContain('an endeavor to');
    const embedded = 'We believe it is important to note that this method may fail.';
    expect(rewriteLocal(embedded, settings).text).toBe(embedded);
  });
  it('preserves indentation, hard line breaks, and relative paths', () => {
    const draft = 'We utilize the guide.  \n  - We utilize the next method.\nRead /utilize/guide and ftp://example.com/utilize.';
    const result = rewriteLocal(draft, settings).text;
    expect(result).toContain('We use the guide.  \n  - We use');
    expect(result).toContain('/utilize/guide');
    expect(result).toContain('ftp://example.com/utilize.');
  });
  it('does not delete meaningful repetitions such as had had and that that', () => {
    const draft = 'We had had enough time. We knew that that result was correct.';
    expect(rewriteLocal(draft, settings).text).toBe(draft);
  });
  it('tidies accidental repeated function words and spaces', () => {
    expect(rewriteLocal('We read the the guide  before the meeting , then shared it.', settings).text).toBe('We read the guide before the meeting, then shared it.');
  });
  it('splits a suitable long sentence only with High sentence variety', () => {
    const draft = 'We review the draft carefully to check that every statement is supported by the source and that the examples remain consistent with the original argument, and we give the writer enough time to check each change before sharing the final result.';
    const result = rewriteLocal(draft, settings);
    expect(result.text).toContain('. We give');
    expect(result.changes.some((change) => change.category === 'sentences')).toBe(true);
    expect(rewriteLocal(draft, { ...settings, sentenceVariety: false }).text).toBe(draft);
    expect(rewriteLocal(draft, { ...settings, smartness: 'medium' }).text).toBe(draft);
  });
  it('does not force a fake change on already-clear writing', () => {
    const draft = 'We write clearly. We check every fact.';
    const result = rewriteLocal(draft);
    expect(result.text).toBe(draft);
    expect(result.editCount).toBe(0);
    expect(result.notice).toContain('No safe local edits');
  });
  it.each(['这是一个测试。请保留原文。', 'Bonjour, voici mon texte à vérifier.', 'これは元の文章です。'])('leaves unsupported-language text untouched: %s', (draft) => {
    const result = rewriteLocal(draft, settings);
    expect(result.text).toBe(draft);
    expect(result.notice).toContain('English-focused');
    expect(result.after.readingEase).toBeNull();
  });
  it('fails safely for empty or oversized input', () => {
    expect(() => rewriteLocal('  ')).toThrow('Paste a draft');
    expect(() => rewriteLocal('a'.repeat(12_001))).toThrow('too long');
    expect(() => rewriteLocal('word '.repeat(1_501))).toThrow('too long');
  });
  it('handles a full-size draft while retaining every qualification', () => {
    const draft = 'We may utilize the guide in order to review the facts before sharing them. '.repeat(100);
    const result = rewriteLocal(draft, settings);
    expect(result.text.match(/\bmay\b/gu)).toHaveLength(100);
    expect(result.text).toContain('We may use the guide to review');
    expect(result.editCount).toBe(200);
  });
  it('round-trips protected content even when marker-like text is supplied', () => {
    const draft = 'We use \uE000HG0:0\uE001 and “quoted content” with 2.5% growth.';
    const protectedText = protectText(draft, ['use']);
    expect(protectedText.restore(protectedText.masked)).toBe(draft);
    expect(protectedText.intact(protectedText.masked)).toBe(true);
  });
  it('runs deterministically and does not introduce HTML execution paths', () => {
    const draft = 'We utilize this <script>alert(1)</script> in order to test the guide.';
    expect(rewriteLocal(draft, settings)).toEqual(rewriteLocal(draft, settings));
    expect(rewriteLocal(draft, settings).text).toContain('<script>alert(1)</script>');
  });
});

describe('adaptive analysis and learned ranking', () => {
  it('chooses Low for clear text and High for several bulky phrases', () => {
    expect(resolveSmartness('We write clearly. We check every fact.', DEFAULT_SETTINGS).level).toBe('low');
    expect(resolveSmartness('We make use of the guide in order to check the draft on a daily basis.', DEFAULT_SETTINGS).level).toBe('high');
  });
  it('honors an explicit level rather than overriding the writer', () => {
    expect(resolveSmartness('We make use of the guide in order to check the draft on a daily basis.', { ...settings, smartness: 'low' }).level).toBe('low');
  });
  it('reports estimates rather than detector scores', () => {
    expect(analyzeText('We use clear words. We keep each fact in the draft.')).toMatchObject({ english: true, readingLabel: 'Easy' });
    expect(analyzeText('短い文章です。').readingEase).toBeNull();
    expect(clarityFeatures('We use this guide.')).toHaveLength(FEATURE_NAMES.length);
    expect(model.featureNames).toEqual(FEATURE_NAMES);
    expect(model.weights.every(Number.isFinite)).toBe(true);
  });
  it('prefers held-out clear versions on the small authored dataset', () => {
    for (const [preferred, rejected] of preferences.validation) expect(rankClarity(preferred)).toBeGreaterThan(rankClarity(rejected));
    expect(model.training.examples).toBe(preferences.train.length);
    expect(model.training.validationExamples).toBe(preferences.validation.length);
  });
  it('parses protected phrases and validates their limits', () => {
    expect(parseProtectedTerms(' Brand, term\nBrand, , C++ ')).toEqual(['Brand', 'term', 'C++']);
    expect(protectedTermsError(['a'.repeat(81)])).toContain('80');
    expect(protectedTermsError(Array.from({ length: 21 }, (_, index) => `term${index}`))).toContain('20');
  });
});
