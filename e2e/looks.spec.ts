// Visual checks on the art directions, through the real pipeline and renderer (the /looks gallery): every sample song must
// render, in Auto, to a different-looking and actually-drawn canvas at phone, laptop and desktop sizes, with no page errors.
import { expect, test, type Page } from '@playwright/test';
import { FIXTURES } from '../lib/theme/fixtures';

const SIZES = [
  { name: 'phone', w: 390, h: 844 },
  { name: 'laptop', w: 1280, h: 720 },
  { name: 'desktop', w: 1920, h: 1080 },
];

/** coarse fingerprint of what is drawn (an 8x8 grid of average colours) and how much the canvas varies */
async function fingerprint(page: Page) {
  return page.getByTestId('look-canvas').evaluate((c: HTMLCanvasElement) => {
    const small = document.createElement('canvas');
    small.width = small.height = 8;
    const x = small.getContext('2d')!;
    x.drawImage(c, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data;
    let spread = 0;
    for (let i = 4; i < d.length; i += 4) spread += Math.abs(d[i]! - d[0]!) + Math.abs(d[i + 1]! - d[1]!) + Math.abs(d[i + 2]! - d[2]!);
    return { sig: Array.from(d).join(','), spread };
  });
}

test.describe('art directions render', () => {
  for (const size of SIZES) {
    test(`every sample song draws in Auto at ${size.name} (${size.w}x${size.h})`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      const sigs = new Set<string>();
      const dirs = new Set<string>();
      for (const f of FIXTURES) {
        await page.goto(`/looks?song=${f.id}&w=${size.w}&h=${size.h}`);
        await page.waitForSelector('[data-testid=look-canvas][data-ready="1"]', { timeout: 30_000 });
        const fp = await fingerprint(page);
        expect(fp.spread, `${f.id} is not blank`).toBeGreaterThan(30);
        sigs.add(fp.sig);
        dirs.add((await page.getByTestId('look-canvas').getAttribute('data-direction'))!);
      }
      expect(sigs.size, 'every song looks different').toBe(FIXTURES.length);
      expect(dirs.size, 'and they are not all the same direction').toBeGreaterThanOrEqual(9);
      expect(errors).toEqual([]);
    });
  }

  test('the gallery lists every sample with its reasons, and says they are not real recordings', async ({ page }) => {
    await page.goto('/looks?w=480');
    await page.waitForFunction((n) => document.querySelectorAll('[data-testid=look-canvas][data-ready="1"]').length >= n, FIXTURES.length, { timeout: 60_000 });
    await expect(page.getByText(/not real recordings/i)).toBeVisible();
    const captions = await page.getByTestId('look-caption').allInnerTexts();
    expect(captions.length).toBe(FIXTURES.length);
    expect(captions.every((c) => /Auto →/.test(c) && /why:/.test(c))).toBe(true);
  });

  for (const size of [SIZES[0]!, SIZES[1]!]) {
    test(`Cover Pop draws every sample as full-bleed art with big words, at ${size.name}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      for (const f of FIXTURES) {
        await page.goto(`/looks?song=${f.id}&w=${size.w}&h=${size.h}&dir=coverpop`);
        await page.waitForSelector('[data-testid=look-canvas][data-ready="1"]', { timeout: 30_000 });
        expect(await page.getByTestId('look-canvas').getAttribute('data-direction')).toBe('coverpop');
        const fp = await fingerprint(page);
        expect(fp.spread, `${f.id} is not blank`).toBeGreaterThan(30);
      }
      expect(errors).toEqual([]);
    });
  }

  test('the icon sheet draws every custom icon, as inline SVG and as canvas sprites', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/looks/icons');
    await expect(page.locator('[data-icon]').first()).toBeVisible();
    expect(await page.locator('[data-icon]').count()).toBeGreaterThanOrEqual(40);
    const blank = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-icon]')]
        .filter((cell) =>
          [...cell.querySelectorAll('canvas')].some((c) => {
            const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
            let a = 0;
            for (let i = 3; i < d.length; i += 4) a += d[i]!;
            return a === 0;
          }),
        )
        .map((c) => c.dataset.icon),
    );
    expect(blank).toEqual([]);
    expect(await page.locator('[data-icon] svg path').count()).toBeGreaterThan(200);
    expect(errors).toEqual([]);
  });

  test('forcing a direction and adjusting it re-renders (the Studio\'s own tweaks), without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/looks?song=amber-hours&w=800&h=450');
    await page.waitForSelector('[data-testid=look-canvas][data-ready="1"]');
    const auto = await fingerprint(page);
    await page.goto(`/looks?song=amber-hours&w=800&h=450&dir=disorder&tw=${encodeURIComponent(JSON.stringify({ appearance: { grain: 0, textScale: 0.8 } }))}`);
    await page.waitForSelector('[data-testid=look-canvas][data-ready="1"]');
    expect(await page.getByTestId('look-canvas').getAttribute('data-direction')).toBe('disorder');
    expect((await fingerprint(page)).sig).not.toBe(auto.sig);
    expect(errors).toEqual([]);
  });
});
