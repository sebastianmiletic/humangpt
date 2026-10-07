import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { MAX_CHARACTERS, MAX_WORDS } from '../../shared/text';

const REWRITE = 'Clear writing helps people connect.\n\nSay what you mean in a natural, conversational way, and your message is easier to understand.';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok', configured: true } }));
});

test('paste, choose a tone, rewrite, copy, and download', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  let submitted: unknown;
  await page.route('**/api/humanize', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { text: REWRITE } });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Humanize text' })).toBeDisabled();
  const source = page.getByRole('textbox', { name: 'Your draft' });
  await source.fill('Effective communication plays a crucial role in fostering meaningful connections.');
  await page.getByRole('radio', { name: 'Casual', exact: true }).check();
  await page.getByRole('button', { name: 'Humanize text' }).click();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue(REWRITE);
  expect(submitted).toMatchObject({ tone: 'casual', text: 'Effective communication plays a crucial role in fostering meaningful connections.' });
  await page.getByRole('button', { name: 'Copy text' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(REWRITE);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download rewrite' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('humangpt-rewrite.txt');
  expect(await readFile((await download.path())!, 'utf8')).toBe(REWRITE);
  await source.fill('A changed draft.');
  await expect(page.getByText('Your draft or tone has changed.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue(REWRITE);
});

test('example, keyboard shortcut, and clear are usable', async ({ page }) => {
  await page.route('**/api/humanize', (route) => route.fulfill({ json: { text: REWRITE } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Try an example' }).click();
  const source = page.getByRole('textbox', { name: 'Your draft' });
  await expect(source).not.toHaveValue('');
  await source.press('Control+Enter');
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue(REWRITE);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(source).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Humanize text' })).toBeDisabled();
  await expect(page.getByText('A fresh take on your words.')).toBeVisible();
});

test('handles provider errors without discarding the draft', async ({ page }) => {
  await page.route('**/api/humanize', (route) => route.fulfill({ status: 429, json: { error: { code: 'rate_limit', message: 'You have reached the hourly rewriting limit.' } } }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Your draft' }).fill('Keep this draft safe.');
  await page.getByRole('button', { name: 'Humanize text' }).click();
  await expect(page.getByRole('alert')).toContainText('hourly rewriting limit');
  await expect(page.getByRole('textbox', { name: 'Your draft' })).toHaveValue('Keep this draft safe.');
  await expect(page.getByRole('button', { name: 'Humanize text' })).toBeEnabled();
});

test('limits word count and character count', async ({ page }) => {
  await page.goto('/');
  const source = page.getByRole('textbox', { name: 'Your draft' });
  await source.fill('word '.repeat(MAX_WORDS + 1));
  await expect(page.getByRole('alert')).toContainText('1,500 words');
  await expect(page.getByRole('button', { name: 'Humanize text' })).toBeDisabled();
  await source.fill('字'.repeat(MAX_CHARACTERS + 1));
  await expect(page.getByRole('alert')).toContainText('12,000 characters');
  await expect(page.getByRole('button', { name: 'Humanize text' })).toBeDisabled();
});

test('explains missing configuration rather than faking a rewrite', async ({ page, request }) => {
  await page.unroute('**/api/health');
  const response = await request.get('/api/health');
  expect(await response.json()).toEqual({ status: 'ok', configured: false });
  await page.goto('/');
  await expect(page.getByText('One setup step left.')).toBeVisible();
  await page.getByRole('button', { name: 'Try an example' }).click();
  await expect(page.getByRole('button', { name: 'Humanize text' })).toBeDisabled();
});

test('shows loading and supports cancellation', async ({ page }) => {
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let requestCount = 0;
  await page.route('**/api/humanize', async (route) => {
    requestCount += 1;
    await responseGate;
    await route.fulfill({ json: { text: REWRITE } }).catch(() => {});
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByRole('button', { name: 'Humanize text' }).click();
  await expect(page.getByText('Finding the right words…')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your draft' })).toHaveAttribute('readonly');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  releaseResponse();
  await expect(page.getByRole('button', { name: 'Humanize text' })).toBeEnabled();
  await expect(page.getByText('Rewrite canceled.', { exact: true })).toBeAttached();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveCount(0);
  expect(requestCount).toBe(1);
});

test('renders HTML in rewrites as harmless text', async ({ page }) => {
  const text = '<script>alert("not executed")</script>\n<img src=x onerror=alert(1)>';
  let dialogs = 0;
  page.on('dialog', async (dialog) => { dialogs += 1; await dialog.dismiss(); });
  await page.route('**/api/humanize', (route) => route.fulfill({ json: { text } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByRole('button', { name: 'Humanize text' }).click();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue(text);
  expect(dialogs).toBe(0);
});

test('has no automated WCAG violations in empty and rewritten states', async ({ page }) => {
  await page.route('**/api/humanize', (route) => route.fulfill({ json: { text: REWRITE } }));
  await page.goto('/');
  const scan = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect((await scan()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByRole('button', { name: 'Humanize text' }).click();
  await expect(page.getByRole('textbox', { name: 'Rewritten text' })).toHaveValue(REWRITE);
  expect((await scan()).violations).toEqual([]);
});

test('fits the viewport and remains usable at 320px', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.screenshot({ path: `test-results/editor-${testInfo.project.name}.png`, fullPage: true });
  const hasOverflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(await hasOverflow()).toBe(false);
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await hasOverflow()).toBe(false);
  await expect(page.getByRole('button', { name: 'Humanize text' })).toBeVisible();
  await page.getByText('Privacy', { exact: true }).click();
  await expect(page.getByText('Text is sent to the configured AI provider', { exact: false })).toBeVisible();
  expect(await hasOverflow()).toBe(false);
});
