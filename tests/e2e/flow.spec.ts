import { expect, test, type Page } from '@playwright/test';

// Needs: local Supabase running + `npm run seed`. AI runs on fallbacks when LLM_API_KEY is empty.
const login = async (page: Page, role: string) => {
  await page.context().clearCookies();
  await page.goto('/hi/login');
  await page.getByLabel('ईमेल').fill(`${role}@demo.in`);
  await page.getByLabel('पासवर्ड').fill('demo1234');
  await page.getByRole('button', { name: 'प्रवेश करें' }).click();
  await expect(page).toHaveURL(/\/hi$/);
};
const open = async (page: Page, ref: string, tab = false) => {
  if (tab) await page.getByRole('link', { name: /सभी/ }).click();
  await page.getByRole('link', { name: new RegExp(ref) }).click();
  await expect(page.getByText(/चरण \d \/ 4/)).toBeVisible();
};

test('sale case: step 1 to approved across three roles', async ({ page }) => {
  const ref = 'DK-2026-00105';
  await login(page, 'lekhpal');
  await open(page, ref);
  await page.getByRole('button', { name: /AI जाँच/ }).click();
  await expect(page.getByText(/AI उपलब्ध नहीं/)).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('मैंने जाँच कर ली है').check();
  await page.getByRole('button', { name: 'चरण पूरा करें' }).click();

  await expect(page.getByText('चरण 2 / 4')).toBeVisible();
  await page.getByLabel('निरीक्षण टिप्पणी').fill('मौक़े पर कब्ज़ा पाया गया। चारों ओर खेत हैं।');
  await page.getByRole('button', { name: /व्यवस्थित करें/ }).click();
  await page.getByLabel('निष्कर्ष').fill('निरीक्षण संतोषजनक');
  await page.getByRole('button', { name: 'रिपोर्ट जमा करें' }).click();
  await expect(page.getByText('चरण 3 / 4')).toBeVisible();

  await login(page, 'kanungo');
  await open(page, ref);
  await page.getByLabel('टिप्पणी').fill('अभिलेख अनुरूप');
  await page.getByRole('button', { name: 'संस्तुति भेजें' }).click();
  await expect(page.getByText('चरण 4 / 4')).toBeVisible();

  await login(page, 'tehsildar');
  await open(page, ref);
  await page.getByRole('button', { name: /✨ स्वीकृत करें/ }).click();
  await expect(page.getByLabel('आदेश का मसौदा')).not.toHaveValue('');
  await page.getByRole('button', { name: 'स्वीकृत करें', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'पुष्टि करें' }).click();
  await expect(page.getByText('स्वीकृत', { exact: true }).first()).toBeVisible();
});

test('return path: kanungo returns a step-3 case to step 2', async ({ page }) => {
  await login(page, 'kanungo');
  await page.getByRole('link', { name: /DK-2026-0011[3-7]/ }).first().click();
  await page.getByLabel('वापस भेजें').check();
  await page.getByLabel('टिप्पणी').fill('सीमा विवरण अधूरा');
  await page.getByRole('button', { name: 'संस्तुति भेजें' }).click();
  await expect(page.getByText('चरण 2 / 4')).toBeVisible();
});
