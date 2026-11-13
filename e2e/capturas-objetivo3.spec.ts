import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

/**
 * Capturas de los modulos funcionales, para el informe del Objetivo 3.
 *
 * No es una prueba: no afirma nada. Abre cada modulo con un docente de
 * prueba y guarda una imagen, como evidencia de que el modulo existe y
 * responde.
 *
 * Se omite a proposito el panel de administracion: su pestana de usuarios
 * muestra los correos de personas reales, que no pueden aparecer en un
 * documento academico.
 *
 * Uso:  npx playwright test e2e/capturas-objetivo3.spec.ts
 */

const REF = "ogxwjeftskdudevxfmdq";
const URL_BASE = `https://${REF}.supabase.co`;
const CLAVE = "CapturasObjetivo3_2026!";
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

  const correo = `obj3.${Date.now()}@nexprofe.test`;
  const u = await (await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: correo, password: CLAVE, email_confirm: true,
      user_metadata: { full_name: "Docente de demostración", username: "docente_demo", role: "docente" },
    }),
  })).json();

  // El disparador que corre al crear la cuenta inserta el rol por defecto,
  // asi que un insert con "on conflict do nothing" puede perder la carrera y
  // dejar al usuario como estudiante. Se borra y se vuelve a poner.
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
    await fetch(`${URL_BASE}/auth/v1/admin/users/${docente.id}`, {
      method: "DELETE", headers: { apikey: service, Authorization: `Bearer ${service}` },
    });
  }
  await sql(`delete from auth.users where email like 'obj3.%@nexprofe.test';`);
});

async function entrar(page: Page) {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    [`sb-${REF}-auth-token`, JSON.stringify(docente.sesion)],
  );
}

async function capturar(page: Page, nombre: string) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SALIDA}/${nombre}.png` });
}

test.describe.configure({ mode: "serial" });

const MODULOS: Array<[string, string, RegExp]> = [
  ["m01-centro-de-recursos", "/resources", /Centro de Recursos/i],
  ["m02-plan-de-clase", "/resources/generate?type=lesson_plan", /Plan de clase/i],
  ["m03-rubricas", "/resources/generate?type=rubric", /Rúbrica/i],
  ["m04-examenes", "/resources/generate?type=icfes", /Exámenes|Examen/i],
  ["m05-talleres", "/resources/generate?type=workshop", /Taller/i],
  ["m06-diapositivas", "/resources/generate?type=slides", /Diapositiva/i],
  ["m07-crucigrama", "/resources/crossword", /Crucigrama/i],
  ["m08-cuento", "/resources/story", /Cuento/i],
  ["m09-bots", "/resources/bots", /Bot/i],
  ["m10-mini-cursos", "/resources/courses", /Curso/i],
  ["m11-historial", "/resources/history", /Historial/i],
  ["m12-ayuda", "/resources/ayuda", /ayuda/i],
];

for (const [nombre, ruta, espera] of MODULOS) {
  test(`captura ${nombre}`, async ({ page }) => {
    await entrar(page);
    await page.goto(ruta);
    await page.getByText(espera).first().waitFor({ timeout: 15000 });
    await capturar(page, nombre);
  });
}
