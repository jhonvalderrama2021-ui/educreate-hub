import { test, expect } from "../playwright-fixture";

test("la portada carga y muestra la marca", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/NexProfe/i);
});

test("una ruta privada redirige a /auth", async ({ page }) => {
  await page.goto("/resources");
  await page.waitForURL("**/auth", { timeout: 15_000 });
  expect(page.url()).toContain("/auth");
});

test("una ruta inexistente muestra la pagina 404", async ({ page }) => {
  await page.goto("/ruta-que-no-existe");
  await expect(page.getByText("404")).toBeVisible();
});
