import { test, expect } from '@playwright/test';

test.describe('Regions CMS E2E', () => {
  test.beforeEach(async ({ request }) => {
    // Clean up existing regions before each test to ensure determinism
    const getRes = await request.get('/api/regions');
    if (getRes.ok()) {
      const regions = await getRes.json();
      for (const region of regions) {
        await request.delete(`/api/regions/${region.id}`);
      }
    }
  });

  test('edits a region via API and sees reflected change on the map', async ({ page, request }) => {
    // 1. Navigate to the Geographic page
    await page.goto('/geographic');

    // Verify page headers
    await expect(page.locator('h1')).toContainText('Geofencing Regions');

    // 2. Create a region via POST API
    const createRes = await request.post('/api/regions', {
      data: {
        name: 'Test Region Alpha',
        polygon: [
          { lat: 37.775, lng: -122.418 },
          { lat: 37.776, lng: -122.419 },
          { lat: 37.774, lng: -122.417 },
        ],
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createdRegion = await createRes.json();

    // 3. Verify it is reflected on the map page (the text label should appear)
    await expect(page.locator(`text=${createdRegion.name}`)).toBeVisible();

    // 4. Edit the region name via PATCH API
    const updatedName = 'Updated Region Beta';
    const patchRes = await request.patch(`/api/regions/${createdRegion.id}`, {
      data: {
        name: updatedName,
      },
    });
    expect(patchRes.ok()).toBeTruthy();

    // 5. Verify the updated name is reflected on the map page
    await expect(page.locator(`text=${updatedName}`)).toBeVisible();
    await expect(page.locator(`text=${createdRegion.name}`)).not.toBeVisible();
  });
});
