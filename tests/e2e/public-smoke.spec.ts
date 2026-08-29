import { expect, test } from "@playwright/test";

test("landing and health endpoint are available", async ({ page, request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Saiba o que estudar/i })).toBeVisible();
});

test("signup form becomes available after auth initialization", async ({ page }) => {
  await page.goto("/entrar?mode=signup");
  await expect(page.getByRole("heading", { name: "Crie sua Rota" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar minha conta →" })).toBeEnabled();
});

test("TAF keeps personal data behind authentication", async ({ page, request }) => {
  await page.goto("/app/taf");
  await expect(page.getByRole("heading", { name: /TAF: evolução sem achismo/i })).toBeVisible();
  await expect(page.getByText(/modo demonstração não guarda dados físicos/i)).toBeVisible();
  const response = await request.post("/api/physical", { data: { action: "set_goal", eventCode: "run_12m", targetValue: 2400 } });
  expect(response.status()).toBe(401);
});

test("private operational APIs reject anonymous access", async ({ request }) => {
  expect((await request.get("/api/admin/operations")).status()).toBe(403);
  expect((await request.post("/api/gamification/evaluate")).status()).toBe(401);
  const mentor = await request.post("/api/mentor", { data: { question: "Como estudar hoje?" } });
  expect(mentor.status()).toBe(401);
  expect(mentor.headers()["x-request-id"]).toBeTruthy();
});
