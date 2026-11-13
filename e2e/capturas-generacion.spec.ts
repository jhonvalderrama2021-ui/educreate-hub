import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

/**
 * Captura una generacion REAL, de principio a fin, para el informe del
 * Objetivo 3.
 *
 * Es la evidencia de que la integracion con la API de OpenAI funciona: las
 * demas capturas muestran formularios, pero ninguna prueba que el contenido
 * se produzca. Aqui se llena el formulario, se pulsa generar y se fotografia
 * el resultado con su aviso de procedencia.
 *
 * Consume credito real de la cuenta de OpenAI: un plan de clase. Por eso se
 * separa de las demas capturas y no se ejecuta junto con ellas.
 *
 * Uso:  npx playwright test e2e/capturas-generacion.spec.ts
 */

const REF = "ogxwjeftskdudevxfmdq";
const URL_BASE = `https://${REF}.supabase.co`;
const CLAVE = "CapturasGeneracion2026!";
const SALIDA = "C:/Users/Jhon/Pictures/Pagina_Tesis/Objetivo_3/evidencias";

let service = "";
let docente = { id: "", sesion: null as unknown };

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

  const correo = `gen.${Date.now()}@nexprofe.test`;
  const u = await (await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: correo, password: CLAVE, email_confirm: true,
      user_metadata: { full_name: "Docente de demostración", username: "docente_demo", role: "docente" },
    }),
  })).json();

  // El rol se fuerza: el disparador de alta inserta el de por defecto y
  // puede ganar la carrera, dejando al usuario como estudiante.
  await sql(
    `delete from public.user_roles where user_id = '${u.id}';` +
    `insert into public.user_roles (user_id, role) values ('${u.id}','docente');`,
  );

  const sesion = await (await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email: correo, password: CLAVE }),
  })).json();
  docente = { id: u.id, sesion };
});

test.afterAll(async () => {
  if (docente.id) {
    // Se borran primero los recursos generados, y despues la cuenta.
    await sql(`delete from public.generated_resources where user_id = '${docente.id}';`);
    await fetch(`${URL_BASE}/auth/v1/admin/users/${docente.id}`, {
      method: "DELETE", headers: { apikey: service, Authorization: `Bearer ${service}` },
    });
  }
  await sql(`delete from auth.users where email like 'gen.%@nexprofe.test';`);
});

async function entrar(page: Page) {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    [`sb-${REF}-auth-token`, JSON.stringify(docente.sesion)],
  );
}

/** Elige una opcion de un desplegable de Radix por el texto de su etiqueta. */
async function elegir(page: Page, etiqueta: string, opcion: string) {
  const campo = page.locator("div").filter({ hasText: new RegExp(`^${etiqueta}`) }).last();
  await campo.getByRole("combobox").first().click();
  await page.getByRole("option", { name: opcion, exact: false }).first().click();
}

test("genera un plan de clase real y captura el proceso", async ({ page }) => {
  // La generacion depende de un servicio externo y puede tardar.
  test.setTimeout(240_000);

  await entrar(page);
  await page.goto("/resources/generate?type=lesson_plan");
  await page.waitForSelector("#campo-tema");

  await page.fill(
    "#campo-tema",
    "Suma y resta de fracciones con distinto denominador, aplicada a situaciones de cocina y de reparto",
  );
  await elegir(page, "Asignatura", "Matemáticas");

  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SALIDA}/g1-formulario-diligenciado.png` });

  // Se pulsa generar y se fotografia el indicador de progreso antes de que
  // llegue la respuesta: es la evidencia del criterio de visibilidad del
  // estado del sistema.
  await page.getByRole("button", { name: /Generar con IA/i }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SALIDA}/g2-generando.png` });

  // La respuesta del modelo puede tardar cerca de un minuto.
  await page.getByText(/Contenido generado con inteligencia artificial/i)
    .first().waitFor({ timeout: 180_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SALIDA}/g3-recurso-generado.png` });

  // Detalle del aviso de procedencia, que registra el modelo y la fecha.
  const aviso = page.getByText(/Contenido generado con inteligencia artificial/i).first();
  await aviso.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SALIDA}/g4-aviso-de-procedencia.png` });

  // Pagina completa, para ver el recurso entero de una vez.
  await page.screenshot({ path: `${SALIDA}/g5-recurso-completo.png`, fullPage: true });
});
