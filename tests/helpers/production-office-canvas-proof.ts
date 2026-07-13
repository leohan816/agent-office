import { expect, type Page } from '@playwright/test';

/**
 * Shared production-office canvas proof (Advisor test-scope amendment 57). Both the authenticated
 * Living Office spec and the composed application-office spec independently rendered the same
 * production Pixi office and proved it non-blank; this centralizes that proof so the two specs cannot
 * drift apart. It contains only the overlay-hidden canvas capture and the direct non-blank evidence —
 * no runtime behavior, fixtures, auth, server/config, or snapshot policy.
 */

/**
 * Count distinct RGB colors in a PNG by decoding it inside the page: a `data:` image (permitted by
 * `img-src 'self' data:`) is drawn to a 2D canvas and read back with getImageData. A blank/uniform
 * canvas yields a single color; a rendered office yields hundreds. This reads the office pixels the
 * live WebGL canvas cannot expose directly — its drawing buffer is cleared after compositing when the
 * context has no preserveDrawingBuffer, so an on-canvas readback returns a single flat color.
 */
export async function countDistinctCanvasColors(page: Page, png: Buffer): Promise<number> {
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
  return page.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const surface = document.createElement('canvas');
    surface.width = image.naturalWidth;
    surface.height = image.naturalHeight;
    const context = surface.getContext('2d');
    if (context === null) return 0;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, surface.width, surface.height);
    const colors = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
      colors.add(((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0));
    }
    return colors.size;
  }, dataUrl);
}

/**
 * Run `capture` with the DOM actor-label overlay hidden, then restore it. Uses a CSSOM `style`
 * mutation (permitted under the strict CSP, unlike an injected <style> tag) so the office canvas can
 * be captured independently of the labels that composite over it.
 */
export async function withActorOverlayHidden<T>(page: Page, capture: () => Promise<T>): Promise<T> {
  const setVisibility = (value: string): Promise<void> =>
    page.evaluate((next) => {
      const overlay = document.querySelector('.living-office-actor-overlay');
      if (overlay instanceof HTMLElement) overlay.style.visibility = next;
    }, value);
  await setVisibility('hidden');
  try {
    return await capture();
  } finally {
    await setVisibility('');
  }
}

/**
 * Prove the live production office canvas both initialized and rendered a non-blank scene, decoupled
 * from the DOM actor labels that composite over the canvas box. `canvas.screenshot()` is a compositor
 * capture, so it paints any DOM overlapping the canvas on top of the office — including the dense
 * on-canvas labels (present on desktop, hidden on mobile per I2-2's no-Office-occlusion rule; the
 * roster is the mobile first layer). Hiding the overlay first makes this proof label-independent and
 * viewport-consistent rather than entangled with label visibility (office+labels ~216 KB desktop vs
 * office alone ~11 KB mobile).
 *
 * Three evidenced criteria, none of which a blank canvas can satisfy:
 *  1. Initialized dimensions — a failed init leaves the 300x150 default; a real init sizes the canvas
 *     to the office viewport (>320 wide, >200 tall) in both dimensions.
 *  2. Direct color diversity — re-decode the lossless compositor PNG and count distinct RGB colors. A
 *     blank/uniform fill decodes to a single color; a rendered strict-CSP office has hundreds (~967
 *     mobile / ~2950 desktop). This is the primary proof and cannot be met by a byte threshold alone.
 *  3. Compression separation — a rendered office is ~11-38 KB where a same-size solid fill stays under
 *     5 KB; this corroborates (2) and backstops it.
 */
export async function assertOfficeCanvasNonblank(page: Page): Promise<void> {
  const canvas = page.locator('canvas[data-pixel-canvas="true"]');
  await expect(canvas, 'onInit completed and marked the live canvas').toHaveCount(1);
  const size = await canvas.evaluate((element) => ({
    width: (element as HTMLCanvasElement).width,
    height: (element as HTMLCanvasElement).height,
  }));
  expect(size.width, 'canvas intrinsic width (not the 300x150 failed-init default)').toBeGreaterThan(320);
  expect(size.height, 'canvas intrinsic height (not the 300x150 failed-init default)').toBeGreaterThan(200);
  const officeOnly = await withActorOverlayHidden(page, () => canvas.screenshot({ animations: 'disabled' }));
  const officeColors = await countDistinctCanvasColors(page, officeOnly);
  expect(officeColors, 'strict-CSP office canvas must render a rich non-blank scene (distinct colors)')
    .toBeGreaterThan(100);
  expect(officeOnly.byteLength, 'office canvas compresses well above a blank fill').toBeGreaterThan(8000);
}
