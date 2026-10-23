import { expect, test, type Browser } from '@playwright/test';

test.describe('player + kinetic lyrics', () => {
  test('plays a demo song, draws moving lyrics, and opens the fullscreen stage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /put the words/i })).toBeVisible();
    await page.getByRole('button', { name: 'Try the demo songs' }).click();
    const player = page.getByRole('region', { name: 'Player' });
    await expect(player.getByText('Neon Static')).toBeVisible();

    // time advances: real audio is playing
    const t = () => player.locator('span.tabular-nums').first().innerText();
    const t0 = await t();
    await page.waitForTimeout(2500);
    expect(await t()).not.toBe(t0);

    await page.keyboard.press('l');
    const stage = page.getByTestId('lyric-stage');
    await expect(stage).toBeVisible();
    await expect(stage.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1200);
    // the canvas actually draws (not blank): sample pixels for variation
    const varied = await stage.locator('canvas').evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext('2d')!;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4000) if (Math.abs(d[i]! - d[0]!) > 8) n++;
      return n;
    });
    expect(varied).toBeGreaterThan(5);
    await page.keyboard.press('Escape');
    await expect(stage).toBeHidden();
  });

  test('settings explains Spotify setup honestly (not connected, no fake playback)', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Not connected')).toBeVisible();
    await expect(page.getByText(/Redirect URI/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect Spotify' })).toBeDisabled();
    await page.goto('/listen');
    await page.getByRole('tab', { name: 'Spotify' }).click();
    await expect(page.getByText('Connect Spotify').first()).toBeVisible();
  });
});

async function guestContext(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

async function loginAndCreate(page: import('@playwright/test').Page, handle: string, title: string) {
  await page.goto('/login');
  await page.getByPlaceholder('maya_b').fill(handle);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/parties/);
  await page.goto('/parties/new');
  await page.getByPlaceholder('Roof party for Sam').fill(title);
  await page.getByRole('button', { name: 'Create party' }).click();
  await page.waitForURL(/\/parties\/[a-z0-9-]+-[a-z0-9]{4}$/);
  await page.getByRole('button', { name: 'Go live' }).click();
  const link = page.getByTestId('invite-link');
  await expect(link).toBeVisible();
  return { joinUrl: (await link.innerText()).trim(), slug: new URL(page.url()).pathname.split('/')[2]! };
}

// A second origin (localhost vs 127.0.0.1) gives the guest an independent cookie jar, like a second phone.
const asGuestOrigin = (url: string) => url.replace(/^https?:\/\/[^/]+/, 'http://localhost:3100');

test.describe('party: two browsers collaborate', () => {
  test('host creates a party, a guest joins by link, suggests a song, host approves it live', async ({ page, browser }) => {
    const { joinUrl, slug } = await loginAndCreate(page, 'e2e_host_' + Date.now().toString(36).slice(-5), 'E2E Party');
    expect(joinUrl).toMatch(/\/join\/[A-Za-z0-9_-]{30,}/);

    const { ctx, page: guest } = await guestContext(browser);
    await guest.setViewportSize({ width: 390, height: 800 });
    await guest.goto(asGuestOrigin(joinUrl));
    await expect(guest.getByRole('heading', { name: /e2e party/i })).toBeVisible();
    await guest.getByPlaceholder('e.g. Alex').fill('Maya');
    await guest.getByRole('button', { name: 'Join party' }).click();
    await guest.waitForURL(/\/p\//);
    await expect(guest.getByText('Hi Maya')).toBeVisible();
    await guest.getByRole('button', { name: 'Suggest Neon Static' }).click();
    await expect(guest.getByText(/waiting for the host/i).first()).toBeVisible();

    // host sees it and approves
    await page.goto(`/parties/${slug}/queue`);
    await expect(page.getByText('Needs approval (1)')).toBeVisible();
    await page.getByRole('button', { name: 'Approve' }).click();

    // the guest's queue updates live, without a reload
    await expect(guest.getByRole('region', { name: 'Queue' }).getByText('Neon Static')).toBeVisible({ timeout: 10_000 });

    // isolation: a guest cannot use host-only APIs
    const res = await guest.request.patch(`http://localhost:3100/api/events/${slug}`, { data: { title: 'pwned' } });
    expect([403, 404]).toContain(res.status());
    await ctx.close();
  });

  test('a rotated invite link is rejected for new guests', async ({ page, browser }) => {
    const { joinUrl } = await loginAndCreate(page, 'e2e_rev_' + Date.now().toString(36).slice(-5), 'Revoke Test');
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Rotate link' }).click();
    await expect(page.getByTestId('invite-link')).not.toHaveText(joinUrl);

    const { ctx, page: guest } = await guestContext(browser);
    await guest.goto(asGuestOrigin(joinUrl));
    await expect(guest.getByText(/link turned off/i)).toBeVisible();
    await ctx.close();
  });
});
