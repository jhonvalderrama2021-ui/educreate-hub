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

test("se puede llegar al formulario de recuperar contrasena", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: /olvidaste tu contrase/i }).click();
  await expect(page.getByRole("heading", { name: /recuperar contrase/i })).toBeVisible();
  // En este modo solo se pide el correo: el campo de contrasena desaparece.
  await expect(page.locator("#password")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /enviar enlace/i })).toBeVisible();
});

test("un enlace de recuperacion invalido avisa en vez de fallar", async ({ page }) => {
  await page.goto("/restablecer");
  await expect(page.getByRole("heading", { name: /nueva contrase/i })).toBeVisible();
});
