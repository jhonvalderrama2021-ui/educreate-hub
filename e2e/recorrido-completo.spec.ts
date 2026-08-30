import { test, expect } from "../playwright-fixture";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * Recorrido por TODOS los módulos con sesión iniciada.
 *
 * Nace de un fallo real: el módulo de Cuentos usaba `useEffect` sin
 * importarlo, así que reventaba al abrirlo y la pantalla quedaba en blanco.
 * Pasó las 151 pruebas, la compilación y la revisión, porque ninguna prueba
 * abría esa pantalla.
 *
 * Aquí se abre cada módulo de verdad, con un usuario real, y se falla si la
 * consola del navegador registra un error o si la pantalla queda vacía.
 * Es lo único que atrapa esa clase de fallo.
 */

const REF = "ogxwjeftskdudevxfmdq";
const URL_BASE = `https://${REF}.supabase.co`;
const CLAVE = "RecorridoE2E2026!";

let anon = "";
let service = "";
let docente = { id: "", correo: "", sesion: null as unknown };
let estudiante = { id: "", correo: "", sesion: null as unknown };

/** Errores de consola que no delatan un fallo nuestro. */
const RUIDO = [
  /React Router Future Flag/i,
  /Download the React DevTools/i,
  /favicon/i,
  /net::ERR_/i,
  /Failed to load resource.*40[13]/i,
];

const esRuido = (texto: string) => RUIDO.some((r) => r.test(texto));

async function llavesYUsuarios() {
  const mgmt = readFileSync(process.env.USERPROFILE + "/.supabase/access-token", "utf8").trim();
  const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${mgmt}` } })).json();
  anon = keys.find((k: any) => k.name === "anon").api_key;
  service = keys.find((k: any) => k.name === "service_role").api_key;

  const sql = async (q: string) => fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${mgmt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }) });

  const nuevo = async (etiqueta: string, rol: string) => {
    const correo = `e2e.${etiqueta}.${Date.now()}@nexprofe.test`;
    const u = await (await fetch(`${URL_BASE}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: correo, password: CLAVE, email_confirm: true }) })).json();
    await sql(`insert into public.user_roles (user_id, role) values ('${u.id}','${rol}') on conflict do nothing;`);

    // Se inicia sesión UNA vez por usuario y se reutiliza en todas las
    // pruebas. Iniciarla por la interfaz en cada una agota el límite de
    // Supabase (~33 por IP) y las pruebas fallarían por eso y no por un fallo
    // real. El inicio de sesión por pantalla ya lo cubre smoke.spec.ts.
    const sesion = await (await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({ email: correo, password: CLAVE }) })).json();
    return { id: u.id, correo, sesion };
  };

  docente = await nuevo("docente", "docente");
  estudiante = await nuevo("estudiante", "estudiante");
}

async function borrarUsuarios() {
  const mgmt = readFileSync(process.env.USERPROFILE + "/.supabase/access-token", "utf8").trim();
  for (const id of [docente.id, estudiante.id]) {
    if (!id) continue;
    await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
      method: "DELETE", headers: { apikey: service, Authorization: `Bearer ${service}` } });
  }
  await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${mgmt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: `delete from auth.users where email like 'e2e.%@nexprofe.test';` }) });
}

/**
 * Deja la sesión puesta antes de que cargue la aplicación.
 *
 * Se inyecta en localStorage, que es donde la guarda supabase-js, en vez de
 * pasar por el formulario: siete pruebas iniciando sesión a la vez agotan el
 * límite de peticiones y fallarían por eso, no por un fallo de la plataforma.
 */
async function entrar(page: Page, quien: { sesion: unknown }) {
  const clave = `sb-${REF}-auth-token`;
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    [clave, JSON.stringify(quien.sesion)],
  );
}

/** Recoge los errores de consola y las excepciones de la página. */
function vigilar(page: Page) {
  const errores: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !esRuido(m.text())) errores.push(m.text());
  });
  page.on("pageerror", (e) => {
    if (!esRuido(String(e))) errores.push(`EXCEPCIÓN: ${e.message}`);
  });
  return errores;
}

test.beforeAll(async () => { await llavesYUsuarios(); });
test.afterAll(async () => { await borrarUsuarios(); });

const MODULOS_DOCENTE = [
  { nombre: "Plan de clase", ruta: "/resources/generate?type=lesson_plan", espera: /Plan de clase/i },
  { nombre: "Rúbricas", ruta: "/resources/generate?type=rubric", espera: /Rúbrica/i },
  { nombre: "Exámenes", ruta: "/resources/generate?type=icfes", espera: /Exámenes|Examen/i },
  { nombre: "Talleres", ruta: "/resources/generate?type=workshop", espera: /Taller/i },
  { nombre: "Diapositivas", ruta: "/resources/generate?type=slides", espera: /Diapositiva/i },
  { nombre: "Crear Bot", ruta: "/resources/bots", espera: /Bot/i },
  { nombre: "Crucigrama", ruta: "/resources/crossword", espera: /Crucigrama/i },
  { nombre: "Crear Cuento", ruta: "/resources/story", espera: /Cuento/i },
  { nombre: "Mini Cursos", ruta: "/resources/courses", espera: /Curso/i },
  { nombre: "Historial", ruta: "/resources/history", espera: /Historial/i },
  { nombre: "Ayuda", ruta: "/resources/ayuda", espera: /Ayuda/i },
];

test("todos los módulos del docente abren sin reventar", async ({ page }) => {
  const errores = vigilar(page);
  await entrar(page, docente);

  const rotos: string[] = [];
  for (const m of MODULOS_DOCENTE) {
    const antes = errores.length;
    await page.goto(m.ruta);
    // Se espera a que pinte algo: una pantalla en blanco es el sintoma del
    // fallo que se quiere atrapar.
    try {
      await expect(page.getByText(m.espera).first()).toBeVisible({ timeout: 15_000 });
    } catch {
      rotos.push(`${m.nombre}: no mostró contenido`);
      continue;
    }
    const nuevos = errores.slice(antes);
    if (nuevos.length) rotos.push(`${m.nombre}: ${nuevos[0].slice(0, 160)}`);
  }

  expect(rotos, `Módulos con problemas:\n${rotos.join("\n")}`).toEqual([]);
});

test("el contador de tokens aparece y muestra el saldo", async ({ page }) => {
  await entrar(page, docente);
  await page.goto("/resources/generate?type=rubric");

  const contador = page.getByRole("button", { name: /Te quedan \d+ de \d+ tokens/i });
  await expect(contador).toBeVisible({ timeout: 15_000 });
  await expect(contador).toContainText("200");

  // Al pulsarlo debe abrir el detalle con la tabla de precios
  await contador.click();
  await expect(page.getByText(/Cuánto cuesta cada uno/i)).toBeVisible({ timeout: 10_000 });
});

test("el formulario de generación responde sin errores de consola", async ({ page }) => {
  const errores = vigilar(page);
  await entrar(page, docente);
  await page.goto("/resources/generate?type=rubric");

  // El campo se busca por su etiqueta: si un dia deja de estar asociada, un
  // lector de pantalla dejaria de anunciarlo y esta prueba lo delata.
  const tema = page.getByLabel(/^Tema/);
  await expect(tema).toBeVisible({ timeout: 20_000 });
  await tema.fill("Fracciones equivalentes");
  await expect(tema).toHaveValue("Fracciones equivalentes");

  await page.getByLabel("Instrucciones adicionales (opcional)").fill("Sin tecnicismos");

  const reales = errores.filter((e) => !esRuido(e));
  expect(reales, `Errores de consola:\n${reales.join("\n---\n")}`).toEqual([]);
});

test("el estudiante entra y ve sus cursos sin reventar", async ({ page }) => {
  const errores = vigilar(page);
  await entrar(page, estudiante);
  await page.goto("/resources/courses");
  await expect(page.getByText(/Curso/i).first()).toBeVisible({ timeout: 15_000 });

  // Un estudiante no debe ver los módulos de docente en el menú
  await expect(page.getByRole("link", { name: "Rúbricas" })).toHaveCount(0);

  expect(errores).toEqual([]);
});

test("el panel principal del estudiante no ofrece módulos de docente", async ({ page }) => {
  // El docente lo encontro probando: en el menu lateral el estudiante veia
  // solo lo suyo, pero al entrar a "dashboard" le aparecian todos los
  // modulos y podia crear examenes y planes de clase.
  const errores = vigilar(page);
  await entrar(page, estudiante);
  await page.goto("/dashboard");
  await expect(page.getByText(/Tu espacio/i)).toBeVisible({ timeout: 20_000 });

  for (const vedado of [/Examen ICFES/i, /Plan de clase/i, /Rúbrica/i]) {
    await expect(page.getByRole("link", { name: vedado })).toHaveCount(0);
  }
  // Y conserva lo que si es suyo
  await expect(page.getByRole("link", { name: /Mis cursos/i })).toBeVisible();

  expect(errores).toEqual([]);
});

test("un estudiante que escribe la dirección de exámenes no ve el formulario", async ({ page }) => {
  // Ocultar el enlace no basta: la direccion se puede escribir a mano o
  // llegar por un enlace viejo. El servidor ya responde 403, pero dejarle
  // llenar el formulario para fallar al final seria hacerle perder el tiempo
  // sin decirle por que.
  await entrar(page, estudiante);
  await page.goto("/resources/generate?type=icfes");
  await expect(page.getByText(/solo para docentes/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel(/^Tema/)).toHaveCount(0);
});

test("la portada de recursos del estudiante no lista módulos de docente", async ({ page }) => {
  await entrar(page, estudiante);
  await page.goto("/resources");
  await expect(page.getByText(/Centro de Recursos/i).first()).toBeVisible({ timeout: 20_000 });
  for (const vedado of ["Exámenes", "Talleres", "Planes de clase", "Rúbricas"]) {
    await expect(page.getByText(vedado, { exact: true })).toHaveCount(0);
  }
  await expect(page.getByText("Mis cursos", { exact: true })).toBeVisible();
});

test("un estudiante no puede entrar al panel de administración", async ({ page }) => {
  await entrar(page, estudiante);
  await page.goto("/admin");
  // Debe sacarlo de ahí, no mostrarle el panel
  await page.waitForURL((u) => !u.pathname.startsWith("/admin"), { timeout: 20_000 });
  expect(page.url()).not.toContain("/admin");
});

test("las páginas de datos personales abren", async ({ page }) => {
  const errores = vigilar(page);
  await entrar(page, docente);
  await page.goto("/mis-datos");
  await expect(page.getByText(/datos/i).first()).toBeVisible({ timeout: 15_000 });

  await page.goto("/privacidad");
  await expect(page.getByText(/privacidad|datos/i).first()).toBeVisible({ timeout: 15_000 });

  expect(errores).toEqual([]);
});

test("navegar por el menú lateral no deja ninguna pantalla en blanco", async ({ page }) => {
  const errores = vigilar(page);
  await entrar(page, docente);
  await page.goto("/resources/generate?type=icfes");

  // El menú se arma cuando se resuelve el rol: hasta entonces está vacío.
  // Sin esta espera, las primeras entradas "no existen" y la prueba culparía
  // a la aplicación de algo que solo era el orden de carga.
  await expect(page.getByRole("link", { name: "Rúbricas" })).toBeVisible({ timeout: 20_000 });

  // Se pulsa cada entrada del menú, que es como llegó el fallo de Cuentos
  const enlaces = ["Rúbricas", "Talleres", "Crucigrama", "Crear Cuento", "Historial"];
  const rotos: string[] = [];

  for (const nombre of enlaces) {
    const antes = errores.length;
    const enlace = page.getByRole("link", { name: nombre }).first();
    if (await enlace.count() === 0) { rotos.push(`${nombre}: no está en el menú`); continue; }
    await enlace.click();
    await page.waitForTimeout(1500);

    const cuerpo = await page.locator("main, body").first().innerText().catch(() => "");
    if (cuerpo.trim().length < 40) rotos.push(`${nombre}: pantalla en blanco`);
    const nuevos = errores.slice(antes);
    if (nuevos.length) rotos.push(`${nombre}: ${nuevos[0].slice(0, 160)}`);
  }

  expect(rotos, `Problemas al navegar:\n${rotos.join("\n")}`).toEqual([]);
});

test("cambiar de módulo no arrastra los datos del anterior", async ({ page }) => {
  /*
   * El docente lo encontro probando: llenaba el formulario en Plan de clase,
   * pasaba a Rubricas, y seguian ahi el mismo tema, grado y asignatura.
   *
   * Importa mas de lo que parece: con el tema pegado de antes, subir un PDF
   * ya no bastaba para que el recurso saliera de el, porque el campo no
   * estaba vacio y el documento quedaba relegado a material de apoyo
   * filtrado por un tema que el docente no habia escrito esta vez.
   */
  await entrar(page, docente);
  await page.goto("/resources/generate?type=lesson_plan");

  const tema = page.getByLabel(/^Tema/);
  await expect(tema).toBeVisible({ timeout: 20_000 });
  await tema.fill("La colmena Langstroth");
  await page.getByLabel("Instrucciones adicionales (opcional)").fill("Con ejemplos del altiplano");
  await expect(tema).toHaveValue("La colmena Langstroth");

  // Se pasa a otro modulo por el menu, que es como lo hace el docente
  await page.getByRole("link", { name: "Rúbricas" }).first().click();
  await page.waitForURL(/type=rubric/, { timeout: 15_000 });

  await expect(page.getByLabel(/^Tema/)).toHaveValue("");
  await expect(page.getByLabel("Instrucciones adicionales (opcional)")).toHaveValue("");
});

test("al subir un documento el tema deja de ser obligatorio", async ({ page }) => {
  // Las dos formas de crear: llenar el formulario, o subir un archivo. Con
  // archivo el tema sobra, y la pantalla tiene que decirlo: si sigue
  // marcado como obligatorio, el docente se inventa uno y ese tema
  // inventado le gana al documento.
  await entrar(page, docente);
  await page.goto("/resources/generate?type=lesson_plan");
  await expect(page.getByLabel(/^Tema/)).toBeVisible({ timeout: 20_000 });

  await page.setInputFiles("#file-input", {
    name: "manual-apicultura.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "La colmena Langstroth consta de camara de cria con diez cuadros moviles " +
      "y alzas melarias separadas por rejilla excluidora de reinas.",
    ),
  });

  await expect(page.getByText(/El recurso saldrá del documento/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/manual-apicultura\.txt/)).toBeVisible();
});
