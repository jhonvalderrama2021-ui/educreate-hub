import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

/**
 * Capturas de evidencia de las correcciones de la lista de chequeo.
 *
 * No es una prueba: no afirma nada. Recorre las pantallas que cambiaron y
 * guarda una imagen de cada una, para el informe de remediacion. Se separa de
 * las pruebas de verdad precisamente para que nadie la confunda con una.
 *
 * Uso:  npx playwright test e2e/capturas-evidencia.spec.ts
 */

const REF = "ogxwjeftskdudevxfmdq";
const URL_BASE = `https://${REF}.supabase.co`;
const CLAVE = "CapturasEvidencia2026!";
const SALIDA = "C:/Users/Jhon/Pictures/verificacion/evidencias";

let service = "";
let docente = { id: "", correo: "", sesion: null as unknown };

const mgmt = () => readFileSync(process.env.USERPROFILE + "/.supabase/access-token", "utf8").trim();

const sql = (q: string) =>
  fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mgmt()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
  });

test.beforeAll(async () => {
  mkdirSync(SALIDA, { recursive: true });

  const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${mgmt()}` },
  })).json();
  const anon = keys.find((k: { name: string }) => k.name === "anon").api_key;
  service = keys.find((k: { name: string }) => k.name === "service_role").api_key;

  const correo = `capturas.${Date.now()}@nexprofe.test`;
  const u = await (await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: correo, password: CLAVE, email_confirm: true }),
  })).json();
  await sql(`insert into public.user_roles (user_id, role) values ('${u.id}','docente') on conflict do nothing;`);

  const sesion = await (await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email: correo, password: CLAVE }),
  })).json();
  docente = { id: u.id, correo, sesion };
});

// El usuario de prueba se borra siempre, haya salido bien o mal.
test.afterAll(async () => {
  if (docente.id) {
    await fetch(`${URL_BASE}/auth/v1/admin/users/${docente.id}`, {
      method: "DELETE", headers: { apikey: service, Authorization: `Bearer ${service}` },
    });
  }
  await sql(`delete from auth.users where email like 'capturas.%@nexprofe.test';`);
});

async function entrar(page: Page) {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    [`sb-${REF}-auth-token`, JSON.stringify(docente.sesion)],
  );
}

/** Guarda la imagen y espera a que la pantalla se asiente antes. */
async function capturar(page: Page, nombre: string) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SALIDA}/${nombre}.png` });
}

test.describe.configure({ mode: "serial" });

test("ayuda: buscador, resultado y sin resultados", async ({ page }) => {
  await entrar(page);
  await page.goto("/resources/ayuda");
  await page.waitForSelector("#buscar-ayuda");

  await page.fill("#buscar-ayuda", "rubrica");
  await capturar(page, "01-ayuda-busqueda-sin-tilde");

  await page.fill("#buscar-ayuda", "fotosintesis");
  await capturar(page, "02-ayuda-sin-resultados");

  await page.fill("#buscar-ayuda", "");
  // La seccion de atajos esta al final de la pagina.
  await page.getByRole("heading", { name: "Atajos de teclado" }).scrollIntoViewIfNeeded();
  await capturar(page, "03-ayuda-seccion-atajos");
});

test("historial: busqueda, recientes y vacio con filtro", async ({ page }) => {
  await entrar(page);
  await page.goto("/resources/history");
  await page.waitForSelector("#buscar-recurso");
  await capturar(page, "04-historial-buscador");

  // Una busqueda que no existe: muestra el vacio diferenciado.
  await page.fill("#buscar-recurso", "zzzzz");
  await capturar(page, "05-historial-sin-coincidencias");

  // Se espera a que el historial de busquedas se guarde (1,2 s de espera)
  // y se vacia el campo para que aparezcan las sugerencias.
  await page.fill("#buscar-recurso", "historia");
  await page.waitForTimeout(1600);
  await page.fill("#buscar-recurso", "");
  await capturar(page, "06-historial-busquedas-recientes");
});

test("explicaciones en los campos del formulario", async ({ page }) => {
  await entrar(page);
  await page.goto("/resources/generate?type=icfes");
  await page.waitForSelector("text=Número de preguntas");

  await page.getByRole("button", { name: /Qué es el número de preguntas/i }).click();
  await capturar(page, "07-explicacion-numero-preguntas");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Qué es el motor de IA/i }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Qué es el motor de IA/i }).click();
  await capturar(page, "08-explicacion-motor-ia");
});

test("atajos: lista con la tecla ?", async ({ page }) => {
  await entrar(page);
  await page.goto("/resources");
  await page.waitForSelector("text=Centro de Recursos");
  await page.keyboard.press("?");
  await capturar(page, "09-dialogo-atajos");
});

test("errores de validacion junto al campo", async ({ page }) => {
  await page.goto("/auth?mode=signup");
  await page.waitForSelector("#username");
  // Se envia vacio: ahora la validacion propia marca cada campo en lugar de
  // que el navegador atrape el primero con su globo.
  await page.getByRole("button", { name: /Crear cuenta/i }).click();
  await capturar(page, "10-registro-errores-por-campo");

  // Contrasenas distintas: error bajo el campo que corresponde.
  await page.fill("#username", "docente_prueba");
  await page.fill("#name", "Docente de Prueba");
  await page.fill("#email", "correo@ejemplo.com");
  await page.fill("#password", "123456");
  await page.fill("#confirmPassword", "654321");
  await page.getByRole("button", { name: /Crear cuenta/i }).click();
  await capturar(page, "11-registro-contrasenas-distintas");
});

test("modo oscuro con la paleta corregida", async ({ page }) => {
  await entrar(page);
  await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
  await page.goto("/resources/generate?type=lesson_plan");
  await page.waitForSelector("text=Plan de clase");
  await capturar(page, "12-modo-oscuro-contraste");
});
