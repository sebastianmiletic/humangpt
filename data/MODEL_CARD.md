# HumanGPT local candidate ranker

## Purpose

Rank a small set of conservative English editing candidates inside a browser Web Worker. It selects among rule-generated rewrites; it does not generate language, understand facts, measure authenticity, or predict AI-detector outcomes.

## Model and features

- Pairwise logistic regression, seven numeric text features.
- Features: bulky-phrase density, long-sentence load, long-word ratio, average word length, fragment ratio, repeated function words, and spacing issues.
- Full-batch gradient descent with fixed hyperparameters and no randomness.
- Weights are bundled in `shared/local/ranker-model.json` and evaluated locally with a dot product.
- No provider, API, GPU, telemetry, runtime downloads, or external ML framework.

The ranked candidates are bounded by the selected smartness, vocabulary, tone, length, and sentence preferences. Protected spans and original qualification markers are checked before ranking. Adaptive intensity selection is a separate, transparent heuristic based on the draft's wording and estimated readability, not a model IQ setting.

## Dataset and provenance

`editor-preferences.json` contains 56 authored training preference pairs and 16 separate authored validation pairs. Each pair contains a preferred clear version and a bulkier, less fluent, or mechanically flawed version. These are synthetic editorial examples written for this project, not drafts collected from users, a web crawl, or an independently annotated benchmark.

The validation set is not included in gradient updates. The committed model records its performance on those 16 pairs and the SHA-256 of the dataset. This tiny, narrow evaluation is a regression check, **not evidence of general linguistic competence**. Many examples share editing patterns, so high validation accuracy should not be generalized.

## Reproducibility

```bash
npm run train:local
npm run test:model
```

Training uses only the committed dataset and shared feature code. CI recomputes weights and fails if the checked-in artifact is stale. Nothing learns from pasted drafts or persisted preferences.

## Limitations and risk reduction

- English-focused. Language detection and readability use heuristics; they can be wrong.
- Favors straightforward wording, which can be inappropriate for poetry, legal prose, research, or deliberately complex style.
- Cannot infer author intent or prove preservation of meaning. Proper names and domain-specific meanings can escape protection.
- Cannot fix arbitrary grammar or paraphrase unfamiliar structures.
- Short texts, abbreviations, lists, and code can distort readability features.
- Does not automatically personalize or improve from usage.
- A protected-term field, literal-span preservation, qualification checks, bounded substitutions, and visible edit explanations reduce accidental changes but do not eliminate them.

Precise vocabulary retains existing terminology rather than searching a thesaurus. Unsupported drafts can remain unchanged, with an explicit explanation. Writers must review every result; optional cloud rewriting is a separate feature with its own privacy and factual-accuracy risks.

## License

The authored dataset, training code, and bundled weights use the repository's MIT license.
