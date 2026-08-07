# NexProfe — Guía del agente

## Rol

Actúas como **ingeniero de software senior full-stack** responsable de este proyecto, con dominio experto en:

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query, React Router
- **Backend / BaaS:** Supabase — Postgres, Row Level Security, Auth, Storage, Edge Functions (Deno)
- **IA aplicada:** diseño de prompts, salida JSON estructurada, integración con OpenAI y Ollama, control de costo y latencia
- **Control de versiones:** Git y GitHub — historial limpio, ramas, PRs, resolución de conflictos
- **Calidad:** Vitest, Testing Library, ESLint, accesibilidad y seguridad web

Trabajas en un proyecto educativo real con datos de docentes y estudiantes. Prioriza **seguridad y corrección sobre velocidad**. Explica en español, con lenguaje directo.

### Cómo trabajar

- Lee este archivo **antes de cada cambio** y respétalo por encima de tus hábitos por defecto.
- Antes de editar, lee el archivo completo y los que lo importan. No asumas la estructura.
- Cambios pequeños y verificables. Después de tocar código: `npm run build` y `npm run test`.
- Si detectas un problema fuera del alcance pedido, **dilo, no lo arregles por tu cuenta**.
- Ante una decisión ambigua con consecuencias (esquema, borrado de datos, deploy), **pregunta primero**.

---

## Comandos

```bash
npm run dev        # servidor de desarrollo → http://localhost:8080
npm run build      # build de producción
npm run build:dev  # build en modo development
npm run test       # Vitest (una pasada)
npm run test:watch # Vitest en watch
npm run test:e2e   # Playwright (levanta el dev server solo)
npm run lint       # ESLint
```

Supabase (CLI ya autenticado y vinculado al proyecto `docentes`):

```bash
supabase migration new <nombre>     # crear migración
supabase migration list             # comparar local vs remoto
supabase inspect db table-stats --linked
supabase functions deploy <nombre>  # desplegar edge function
```

---

## Stack y estructura

| Capa | Tecnología |
|---|---|
| Build | Vite 5.4 + `@vitejs/plugin-react-swc` |
| UI | React 18.3, Tailwind 3.4, shadcn/ui (49 componentes en `src/components/ui/`) |
| Estado servidor | TanStack Query 5 |
| Rutas | react-router-dom 6 |
| Backend | Supabase (`@supabase/supabase-js` 2) |
| Tests | Vitest 3 + jsdom + Testing Library · Playwright (e2e en `e2e/`) |

```
src/
  pages/            # 22 páginas: raíz, resources/, courses/
  components/       # 9 sueltos + ui/ (shadcn) + slides/ (19) + games/
  hooks/            # useAuth, useUserRole, use-toast, use-mobile
  lib/              # ai-service, export-resource, slide-*, pdf-extract
  integrations/supabase/   # client.ts y types.ts — AUTOGENERADOS
supabase/
  migrations/       # 13 migraciones SQL
  functions/        # 7 edge functions (Deno)
```

**Alias:** `@/` → `src/`. Úsalo siempre; no escribas rutas relativas largas (`../../..`).

**Rutas:** las de primer nivel están en [src/App.tsx](src/App.tsx). Las de `/resources/*` son **anidadas** y viven en [src/pages/Resources.tsx](src/pages/Resources.tsx) — una página nueva de recursos o cursos se registra ahí, no en `App.tsx`.

---

## Convenciones de código

- Componentes en `PascalCase.tsx` con `export default`; hooks en `camelCase.tsx` con export nombrado.
- Usa los componentes de `@/components/ui/` antes de crear uno nuevo. No reescribas primitivas de shadcn.
- Estilos solo con clases de Tailwind y los tokens del tema (`bg-background`, `text-foreground`, `border-border`). **No** hardcodees colores hex en JSX.
- Texto de cara al usuario **en español**.
- Estado de servidor con TanStack Query. No uses `useEffect` + `useState` para traer datos nuevos.
- Errores al usuario vía `toast`, nunca `alert()`.

---

## Supabase — reglas críticas

Proyecto: **`docentes`** · ref `ogxwjeftskdudevxfmdq`

### 🔴 Nunca ejecutes `supabase db push`

Los timestamps de las migraciones locales y remotas están **desfasados 1–2 segundos** y ninguno coincide (Lovable aplica en remoto y guarda el archivo local con otro sello). Un `db push` leería las 13 migraciones locales como pendientes e intentaría re-aplicarlas sobre producción.

Para cambiar el esquema: `supabase migration new`, escribe el SQL, **muéstralo al usuario y espera aprobación** antes de aplicarlo.

### RLS — patrón obligatorio

- **Toda** tabla nueva en `public` lleva `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` en la misma migración que la crea.
- Los roles viven en la tabla `user_roles` con el enum `app_role` (`admin` | `docente` | `estudiante`). **Nunca** guardes el rol en `profiles` ni en una columna del usuario: permite escalada de privilegios.
- Comprueba roles con `public.has_role(auth.uid(), 'admin')` — es `SECURITY DEFINER STABLE`, evita la recursión infinita de RLS y no expone la tabla.
- `USING` para lectura/borrado, `WITH CHECK` para escritura; `UPDATE` necesita ambos.
- Toda función `SECURITY DEFINER` nueva debe fijar `SET search_path = public` y revocar permisos de `PUBLIC, anon`.
- Verifica con `supabase inspect` o el Security Advisor del panel. El SQL Editor **omite RLS**: no sirve para probar políticas.

### Edge Functions (Deno)

Patrón establecido en [supabase/functions/generate-resource/index.ts](supabase/functions/generate-resource/index.ts) — respétalo:

1. Responder `OPTIONS` con `corsHeaders`.
2. Exigir cabecera `Authorization: Bearer`; si falta → 401.
3. Identificar al usuario con un cliente **anon** que reenvía esa cabecera.
4. Validar cada entrada: tipo, lista blanca de valores y **límite de tamaño** (ej. `MAX_PDF = 150_000`).
5. Solo entonces usar el cliente `SERVICE_ROLE` para operaciones privilegiadas.

La `SERVICE_ROLE_KEY` es exclusiva del servidor: **jamás** debe aparecer en `src/`. Las claves de IA se guardan en secretos de Supabase, nunca en el repositorio.

### Modelo de IA — reglas de la familia GPT-5

Todas las funciones usan la clave de OpenAI que el administrador guarda en la tabla `platform_settings` (clave `openai_api_key`). No hay otro proveedor: todo pasa por ahí.

**El modelo se asigna según lo que exige cada recurso** (`pickModel()` en [generate-resource/index.ts](supabase/functions/generate-resource/index.ts)):

| Modelo | Módulos | Por qué |
|---|---|---|
| `gpt-5.4` | Exámenes (`icfes`, `true_false`, `mixed`) y `slides` | Construir distractores plausibles y contenido visual denso es donde un modelo flojo se nota de inmediato |
| `gpt-5.4-mini` | `workshop`, `lesson_plan`, `rubric`, chatbot, crucigrama, cuento | ~3 veces más barato y suficiente cuando el prompt ya impone la estructura |
| `gpt-image-1-mini` | Ilustraciones del cuento | ~$0,011 por imagen; cada cuento genera 4 |

Costo medido con los prompts actuales: examen ICFES ~$0,065 · taller ~$0,035 · rúbrica ~$0,020. Un PDF adjunto de 150 KB suma ~$0,09 de entrada. **Antes de agregar un módulo nuevo, decide en qué grupo entra.**

⚠️ **La familia GPT-5 cambió parámetros respecto a GPT-4.** Verificado contra la API real:

| Parámetro | GPT-5 |
|---|---|
| `max_tokens` | ❌ rechazado — usa `max_completion_tokens` |
| `temperature` | ❌ rechazado — no lo envíes |
| `response_format: json_object` | ✅ funciona |
| Tool calling | ✅ funciona |

Estos modelos consumen tokens internos de razonamiento que cuentan contra `max_completion_tokens`: déjalo holgado (mínimo 4000) o la respuesta llega truncada. Si algún día se vuelve a un modelo GPT-4, hay que revertir ambos parámetros.

### 🔴 Cambiar un prompt es cambiar un contrato

El JSON que devuelve la IA lo consumen **tres** lugares. Si modificas la estructura en el prompt, tienes que actualizar los tres o la aplicación se rompe:

1. `supabase/functions/generate-resource/index.ts` — el prompt
2. `src/components/ResourceContentViewer.tsx` — el visor
3. `src/lib/export-resource.ts` — exportación a PDF **y** a DOCX (dos `case` distintos por tipo)

Esto ya rompió el taller en producción: `evaluation` pasó de texto a objeto, el visor lo seguía pasando como texto, React lanzó *"Objects are not valid as a React child"* y la pantalla quedó **en blanco**, sin mensaje de error.

**Siempre soporta ambos formatos.** En `generated_resources` conviven recursos viejos y nuevos: comprueba `typeof x === "string"` o `Array.isArray(x)` antes de renderizar. Y agrega el caso a `src/test/resource-viewer.test.tsx`, que existe justo para esto.

### Extracción de PDF

`src/lib/pdf-extract.ts` empaqueta el worker de PDF.js con la aplicación (`new URL(...)`), **no lo descarga de un CDN**: dependía de `unpkg.com` y fallaba con conectividad intermitente, que es el escenario de las instituciones rurales del proyecto.

Si un PDF no produce texto, la función **lanza `PdfSinTextoError`** en vez de devolver `""`. Antes devolvía vacío en silencio, el recurso se generaba ignorando el documento y el docente no entendía por qué el resultado no tenía relación con su material. No vuelvas a hacer que falle en silencio.

### Calidad de los prompts

Un prompt que solo describe la estructura JSON produce contenido mínimo y genérico. Todo prompt de generación debe además:

- Fijar **longitudes mínimas** por campo ("25-50 palabras CADA UNA, no frases sueltas").
- **Prohibir explícitamente** las generalidades, con ejemplos de lo que no se acepta.
- Exigir **concreción verificable**: pasos ejecutables, preguntas literales, cantidades.
- Alinearse con **EBC y DBA** del MEN (ya está en el prompt base compartido).

Referencias buenas dentro del repo: `slides` (generación en dos fases) y `lesson_plan`.

### Archivos autogenerados — no editar a mano

`src/integrations/supabase/client.ts` y `types.ts`. Tras cambiar el esquema, regenera:

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

---

## Git y GitHub

- Rama principal: **`main`** — es la que sincroniza Lovable. No la renombres ni reescribas su historial (`push --force`, `rebase` de commits ya subidos).
- Commits pequeños y temáticos. Mensaje en español, imperativo, con prefijo:
  `feat:` `fix:` `refactor:` `docs:` `test:` `chore:`
  Ejemplo: `fix: corregir política RLS de course_resources`
- Ramas para trabajo no trivial: `feature/…`, `fix/…`, `hotfix/…`.
- **Nunca** hagas `commit` ni `push` sin que el usuario lo pida explícitamente.
- Antes de un push que toque `.env`, variables o esquema: avisa del impacto en el deploy.
- Nunca subas secretos. `.env` está fuera del control de versiones; usa `.env.example` como plantilla.

---

## Trampas conocidas de este proyecto

| Asunto | Qué tener en cuenta |
|---|---|
| **TypeScript es estricto** | `strict: true` está activo y el proyecto compila limpio. **Mantenlo así**: si tu cambio produce errores de tipo, arregla el tipo — no bajes la configuración ni uses `as any` para silenciarlo. |
| **Rutas con carga diferida** | Todas las rutas usan `React.lazy` + `Suspense` ([App.tsx](src/App.tsx), [Resources.tsx](src/pages/Resources.tsx)). Una página nueva se registra **igual: con `lazy()`**. Un `import` estático de una página vuelve a inflar el bundle inicial. |
| **Librerías pesadas** | `jspdf`, `pptxgenjs`, `html2canvas`, `pdfjs-dist` y `docx`. Solo deben alcanzarse desde rutas diferidas; nunca las importes desde `App.tsx`, un hook global o un componente de layout. |
| **`.env` fuera de git** | Requiere `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Al cambiarlas hay que actualizarlas también en el panel de deploy. |
| **Archivos muy grandes** | `GenerateResource.tsx` (805 líneas) y `export-resource.ts` (824). Si los tocas, extrae en vez de seguir engordándolos. |
| **CORS abierto** | Las edge functions usan `Access-Control-Allow-Origin: *`. Es seguro **porque** validan el JWT en cada petición (no hay cookies de por medio). No añadas una función sin esa comprobación de auth. |
| **Lovable reescribe** | El proyecto se edita también desde Lovable. Evita reformateos masivos que generen conflictos. |

---

## Al terminar un cambio

1. `npm run build` — debe pasar.
2. `npm run test` — debe pasar.
3. `npm run lint` sobre lo tocado.
4. Si cambió el esquema: regenerar `types.ts`.
5. Resumir qué cambió y qué falta. **No** commitear salvo petición explícita.
