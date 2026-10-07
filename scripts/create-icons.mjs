import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

await mkdir('public/icons', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ad442a"/><path d="M33 24v52m0-26c0-25 34-25 34 0v26" fill="none" stroke="#faf9f6" stroke-width="7" stroke-linecap="round"/></svg></body></html>`);
    await page.locator('svg').screenshot({ path: `public/icons/icon-${size}.png` });
  }
} finally { await browser.close(); }
