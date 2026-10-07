import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DRAFT = 'It is important to note that we utilize this guide in order to communicate clearly. We review the draft on a daily basis.';
const POLISHED = 'Note that we use this guide to communicate clearly. We review the draft daily.';

async function configureLocal(page: import('@playwright/test').Page) {
  await page.getByRole('radio', { name: 'High', exact: true }).check();
  await page.getByLabel('Vocabulary', { exact: false }).selectOption('simple');
  await page.getByText('Fine-tune your rewrite', { exact: true }).click();
  await page.getByLabel('Length', { exact: false }).selectOption('concise');
}

test('rewrites locally with no key and sends no draft or health request', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.getByLabel('Processing')).toHaveValue('local');
  await configureLocal(page);
  await page.getByRole('textbox', { name: 'Your draft' }).fill(DRAFT);
  await page.getByRole('button', { name: 'Humanize text' }).click();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue(POLISHED);
  expect(apiRequests).toEqual([]);
  await page.getByText('Review 4 local edits', { exact: false }).click();
  await expect(page.getByText('Reading ease, estimated', { exact: true })).toBeVisible();
  await expect(page.getByText('Replaced a bulky phrase with a direct equivalent.', { exact: true }).first()).toBeVisible();
});

test('smartness and vocabulary produce different, controlled local edits', async ({ page }) => {
  await page.goto('/');
  const source = page.getByRole('textbox', { name: 'Your draft' });
  await source.fill('We utilize the guide in order to take into consideration the cost.');
  await page.getByRole('radio', { name: 'Low', exact: true }).check();
  await page.getByRole('button', { name: 'Humanize text' }).click();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue('We utilize the guide to take into consideration the cost.');
  await page.getByRole('radio', { name: 'High', exact: true }).check();
  await page.getByRole('button', { name: 'Rewrite again' }).click();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue('We use the guide to consider the cost.');
  await page.getByLabel('Vocabulary', { exact: false }).selectOption('advanced');
  await page.getByRole('button', { name: 'Rewrite again' }).click();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue('We utilize the guide to consider the cost.');
});

test('reloads and rewrites completely offline after the first cache', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText('Offline ready', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Make it sound like you.' })).toBeVisible();
  await expect(page.getByText('Offline local mode:', { exact: false })).toBeVisible();
  await configureLocal(page);
  await page.getByRole('textbox', { name: 'Your draft' }).fill(DRAFT);
  await page.getByRole('button', { name: 'Humanize text' }).click();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue(POLISHED);
});

test('cloud mode needs a key, but switching back to local works', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Processing').selectOption('cloud');
  await expect(page.getByText('Cloud mode needs an API key.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try an example' }).click();
  await expect(page.getByRole('button', { name: 'Humanize text' })).toBeDisabled();
  await page.getByRole('button', { name: 'Use local mode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Humanize text' })).toBeEnabled();
  await page.getByRole('button', { name: 'Humanize text' }).click();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).not.toHaveValue('');
});

test('protected phrases survive, but drafts and terms never enter storage or caches', async ({ page }) => {
  await page.goto('/');
  await configureLocal(page);
  const term = 'My Private Brand';
  const draft = `We utilize the guide from ${term} in order to check the draft.`;
  await page.getByLabel('Protected words or phrases', { exact: false }).fill(`utilize, ${term}`);
  await page.getByRole('textbox', { name: 'Your draft' }).fill(draft);
  await page.getByRole('button', { name: 'Humanize text' }).click();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue(`We utilize the guide from ${term} to check the draft.`);
  await expect(page.getByText('Offline ready', { exact: true })).toBeVisible();
  const stored = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = (await Promise.all(keys.map(async (key) => (await (await caches.open(key)).keys()).map((request) => request.url)))).flat();
    return { storage: JSON.stringify({ ...localStorage }), urls };
  });
  expect(stored.storage).not.toContain(term);
  expect(stored.storage).not.toContain(draft);
  expect(stored.urls.some((url) => new URL(url).pathname.startsWith('/api/'))).toBe(false);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Your draft' })).toHaveValue('');
  await page.getByText('Fine-tune your rewrite', { exact: true }).click();
  await expect(page.getByLabel('Protected words or phrases', { exact: false })).toHaveValue('');
  await expect(page.getByRole('radio', { name: 'High', exact: true })).toBeChecked();
});

test('explains unsupported-language and unchanged results honestly', async ({ page }) => {
  await page.goto('/');
  const draft = '这是一个测试。请保留原文。';
  await page.getByRole('textbox', { name: 'Your draft' }).fill(draft);
  await page.getByRole('button', { name: 'Humanize text' }).click();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue(draft);
  await expect(page.getByText('Local mode is English-focused and could not confidently edit this draft.', { exact: false }).first()).toBeVisible();
});

test('advanced controls and change review are accessible and fit 320px', async ({ page }, testInfo) => {
  await page.goto('/');
  await configureLocal(page);
  await page.getByRole('textbox', { name: 'Your draft' }).fill(DRAFT);
  await page.getByRole('button', { name: 'Humanize text' }).click();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue(POLISHED);
  await page.getByText('Review 4 local edits', { exact: false }).click();
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: `test-results/local-${testInfo.project.name}.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test('serves an installable manifest and real app icons', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) {
    const image = await request.get(icon.src);
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toContain('image/png');
  }
});
