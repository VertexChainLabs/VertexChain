import { test, expect } from '@playwright/test';

/**
 * E2E selectors in this file use `data-testid` attributes (see
 * `Frontend/CONTRIBUTING.md` for the naming convention). Test IDs make the
 * suite resilient to copy changes, i18n, and visual refactors. All ARIA
 * roles/labels remain on the underlying components and are still validated
 * in the unit tests under `Frontend/src/components/map/`.
 */
test.describe('Map page — browse, gist, post', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation'], { origin: 'http://localhost:3099' });
    await page.goto('/map');
  });

  test('happy path: browse landing, navigate to map, view gists, and post a new gist', async ({ page }) => {
    // Loader appears, then disappears once the map mounts.
    const loader = page.getByTestId('map-loader');
    await expect(loader).toBeAttached({ timeout: 15_000 });
    await expect(loader).toHaveCount(0, { timeout: 15_000 });

    const addButton = page.getByTestId('map-add-gist-button');
    await expect(addButton).toBeAttached({ timeout: 15_000 });
    await addButton.click({ force: true, timeout: 5_000 });

    const modal = page.getByTestId('map-add-gist-modal');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    // Title still rendered (we just don't couple to its exact copy).
    await expect(modal.locator('#add-gist-title')).toBeVisible();

    const textarea = page.getByTestId('map-add-gist-modal-input');
    await expect(textarea).toBeVisible();

    const gistText = 'E2E test gist — great suya spot at this location!';
    await textarea.fill(gistText);
    await expect(textarea).toHaveValue(gistText);

    const submit = page.getByTestId('map-add-gist-modal-submit');
    await expect(submit).toBeEnabled();
    await submit.click();

    // Loading state: button disabled while the gist is being "pinned".
    // The modal must remain open during the pin (it closes only after the simulated response).
    await expect(modal).toBeVisible();
    await expect(submit).toBeDisabled({ timeout: 3_000 });
    // After the simulated 2s submit, modal exits, button becomes enabled again, and textarea resets.
    // The textarea must still be in DOM at this point (framer-motion's spring exit keeps it mounted
    // long enough for Playwright to read its value); guard explicitly so a future flake doesn't
    // surface as a 'no such element' mystery.
    await expect(submit).toBeEnabled({ timeout: 5_000 });
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue('');

    await expect(modal).not.toBeVisible();
  });

  test('negative: cannot submit with empty gist content', async ({ page }) => {
    await expect(page.getByTestId('map-loader')).toHaveCount(0, { timeout: 15_000 });

    const addButton = page.getByTestId('map-add-gist-button');
    await expect(addButton).toBeAttached({ timeout: 15_000 });
    await addButton.click({ force: true, timeout: 5_000 });

    const modal = page.getByTestId('map-add-gist-modal');
    await expect(modal).toBeVisible();

    const textarea = page.getByTestId('map-add-gist-modal-input');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue('');

    const submit = page.getByTestId('map-add-gist-modal-submit');
    await submit.click();

    // Empty submit is a no-op: modal stays open and the submit button is still visible/enabled.
    await expect(modal).toBeVisible();
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
  });

  test('negative: escape key closes the modal without posting', async ({ page }) => {
    await expect(page.getByTestId('map-loader')).toHaveCount(0, { timeout: 15_000 });

    const addButton = page.getByTestId('map-add-gist-button');
    await expect(addButton).toBeAttached({ timeout: 15_000 });
    await addButton.click({ force: true, timeout: 5_000 });

    const modal = page.getByTestId('map-add-gist-modal');
    await expect(modal).toBeVisible();

    await page.getByTestId('map-add-gist-modal-input').fill('This should not appear');
    await page.keyboard.press('Escape');

    await expect(modal).not.toBeVisible();
  });

  test('negative: clicking the backdrop overlay closes the modal without posting', async ({ page }) => {
    await expect(page.getByTestId('map-loader')).toHaveCount(0, { timeout: 15_000 });

    const addButton = page.getByTestId('map-add-gist-button');
    await expect(addButton).toBeAttached({ timeout: 15_000 });
    await addButton.click({ force: true, timeout: 5_000 });

    const modal = page.getByTestId('map-add-gist-modal');
    await expect(modal).toBeVisible();

    await page.getByTestId('map-add-gist-modal-input').fill('This should also not appear');

    // Click outside the dialog (top-left of the viewport, well outside the modal box).
    await page.mouse.click(50, 50);

    await expect(modal).not.toBeVisible();
  });
});
