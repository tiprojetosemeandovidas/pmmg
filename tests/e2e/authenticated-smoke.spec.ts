import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("authenticated candidate can load private product areas", async ({ page }) => {
  test.skip(!email || !password, "Configure E2E_EMAIL e E2E_PASSWORD para o teste autenticado.");
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(password!);
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByText(/sincronizado|salvando|conectando/i)).toBeVisible();
  await page.goto("/app/mentor");
  await expect(page.getByRole("heading", { name: /Mentor IA/i })).toBeVisible();
  await page.goto("/app/oportunidades");
  await expect(page.getByRole("heading", { name: /Seu estudo abre mais de uma porta/i })).toBeVisible();
});
