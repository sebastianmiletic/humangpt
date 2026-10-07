import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { clarityFeatures, FEATURE_NAMES } from '../shared/local/analysis';

const root = new URL('../', import.meta.url);
const datasetText = await readFile(new URL('data/editor-preferences.json', root), 'utf8');
const data = JSON.parse(datasetText) as { train: Array<[string, string]>; validation: Array<[string, string]> };
const differences = data.train.map(([preferred, rejected]) => {
  const a = clarityFeatures(preferred);
  const b = clarityFeatures(rejected);
  return a.map((value, index) => value - b[index]);
});
const weights = FEATURE_NAMES.map(() => 0);
const dot = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const epochs = 2_400;
const learningRate = 0.25;
const regularization = 0.008;

// Pairwise logistic regression, full-batch gradient descent, deterministic.
for (let epoch = 0; epoch < epochs; epoch += 1) {
  const gradient = weights.map(() => 0);
  for (const delta of differences) {
    const probability = 1 / (1 + Math.exp(-dot(weights, delta)));
    delta.forEach((value, index) => { gradient[index] += (1 - probability) * value; });
  }
  weights.forEach((weight, index) => {
    weights[index] += learningRate * (gradient[index] / differences.length - regularization * weight);
  });
}
const rounded = weights.map((weight) => Number(weight.toFixed(8)));
const correct = data.validation.filter(([preferred, rejected]) => dot(rounded, clarityFeatures(preferred)) > dot(rounded, clarityFeatures(rejected))).length;
const model = {
  version: 1,
  featureNames: FEATURE_NAMES,
  weights: rounded,
  training: {
    method: 'pairwise logistic regression',
    examples: data.train.length,
    validationExamples: data.validation.length,
    validationCorrect: correct,
    epochs, learningRate, regularization,
    datasetSha256: createHash('sha256').update(datasetText).digest('hex'),
    scope: 'Small authored English preference set. Not a language model or a semantic-quality guarantee.',
  },
};
const output = `${JSON.stringify(model, null, 2)}\n`;
const destination = new URL('shared/local/ranker-model.json', root);
if (process.argv.includes('--check')) {
  if (await readFile(destination, 'utf8') !== output) throw new Error('The local ranking model is stale. Run npm run train:local.');
  console.log('Local ranking model is reproducible and up to date.');
} else {
  await writeFile(destination, output);
  console.log(`Trained on ${data.train.length} preference pairs. Held-out authored pairs: ${correct}/${data.validation.length}.`);
}
