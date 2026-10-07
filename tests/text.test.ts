import { describe, expect, it } from 'vitest';
import { countWords } from '../shared/text';

describe('word counts', () => {
  it.each([
    ['', 0], ['   \n\t ', 0], ['Hello world', 2],
    ['  One\n two\tthree  ', 3], ['Bonjour, tout le monde.', 4],
    ['日本語の文章', 1],
  ])('counts %j as %i words', (text, expected) => {
    expect(countWords(text)).toBe(expected);
  });
});
