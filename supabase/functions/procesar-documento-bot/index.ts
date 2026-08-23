import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { partirEnFragmentos } from "../_compartido/fragmentar.ts";

/**
 * Vectoriza un documento para que un bot pueda responder a partir de el.
 *
 * Ultimo punto de la tarea 8 de la reunion: "el bot puede partir de un
 * documento que yo pueda anexar" y "nos tocaria hacerle como una
 * vectorizacion a los PDF".
 *
 * El texto llega ya extraido desde el navegador (pdf-extract.ts). Aqui se
 * parte en fragmentos, se convierte cada uno en un vector y se guardan. La
 * busqueda ocurre despues, en chat-bot.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODELO_EMBEDDING = "text-embedding-3-small";

// Limite por documento. Una cartilla del MEN completa cabe de sobra; un
// libro entero se corta, y se avisa.
const MAX_CARACTERES = 400_000;
const LOTE_EMBEDDINGS = 96;

async function pedirEmbeddings(textos: string[], apiKey: string): Promise<number[][]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODELO_EMBEDDING, input: textos }),
  });

  if (!r.ok) {
    const detalle = await r.text();
    throw new Error(`OpenAI respondio ${r.status}: ${detalle.slice(0, 200)}`);
  }

  const datos = await r.json();
  // El orden de la respuesta no esta garantizado; viene un indice.
  return datos.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding as number[]);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const responder = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return responder({ error: "No autorizado" }, 401);

    const cliente = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: errorAuth } = await cliente.auth.getUser();
    if (errorAuth || !user) return responder({ error: "No autorizado" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // El administrador puede desactivar una cuenta sin borrarla.
    const { data: activo } = await admin.rpc("es_usuario_activo", { p_id: user.id });
    if (activo === false) {
      return responder({
        error: "Tu cuenta esta desactivada. Comunicate con el administrador de la plataforma.",
      }, 403);
    }

    const { botId, nombre, texto } = await req.json();
    if (!botId || typeof texto !== "string") {
      return responder({ error: "botId y texto son requeridos" }, 400);
    }
    if (texto.trim().length < 200) {
      return responder({
        error: "El documento tiene muy poco texto para que sirva de fuente. " +
               "Si es un PDF escaneado, el texto no se puede extraer.",
      }, 400);
    }

    // El bot debe ser de quien lo pide. Se consulta con la sesion del usuario
    // para que RLS haga su trabajo.
    const { data: bot } = await cliente
      .from("bots").select("id").eq("id", botId).eq("user_id", user.id).single();
    if (!bot) return responder({ error: "Bot no encontrado" }, 404);

    const { data: ajuste } = await admin
      .from("platform_settings").select("value").eq("key", "openai_api_key").single();
    if (!ajuste?.value) {
      return responder({
        error: "API Key de OpenAI no configurada. El administrador debe configurarla en el panel.",
      }, 400);
    }
    const apiKey = ajuste.value as string;

    const recortado = texto.length > MAX_CARACTERES;
    const fragmentos = partirEnFragmentos(texto.slice(0, MAX_CARACTERES));
    if (fragmentos.length === 0) {
      return responder({ error: "No se pudo dividir el documento en fragmentos" }, 400);
    }

    // Se registra antes de vectorizar: si algo falla a mitad, el docente ve
    // el documento marcado como error en vez de que desaparezca sin rastro.
    const { data: documento, error: errorDoc } = await admin
      .from("bot_documentos")
      .insert({
        bot_id: botId,
        user_id: user.id,
        nombre: String(nombre || "Documento").slice(0, 200),
        caracteres: texto.length,
        fragmentos: fragmentos.length,
        estado: "procesando",
      })
      .select("id")
      .single();
    if (errorDoc || !documento) throw errorDoc ?? new Error("No se pudo registrar el documento");

    try {
      for (let i = 0; i < fragmentos.length; i += LOTE_EMBEDDINGS) {
        const lote = fragmentos.slice(i, i + LOTE_EMBEDDINGS);
        const vectores = await pedirEmbeddings(lote, apiKey);

        const filas = lote.map((textoFragmento, j) => ({
          documento_id: documento.id,
          bot_id: botId,
          user_id: user.id,
          orden: i + j,
          texto: textoFragmento,
          embedding: JSON.stringify(vectores[j]),
        }));

        const { error: errorFrag } = await admin.from("bot_fragmentos").insert(filas);
        if (errorFrag) throw errorFrag;
      }

      await admin.from("bot_documentos")
        .update({ estado: "listo" }).eq("id", documento.id);

      return responder({
        documentoId: documento.id,
        fragmentos: fragmentos.length,
        caracteres: texto.length,
        recortado,
      });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "Error desconocido";
      await admin.from("bot_documentos")
        .update({ estado: "error", detalle_error: mensaje.slice(0, 500) })
        .eq("id", documento.id);
      throw e;
    }
  } catch (e) {
    console.error("procesar-documento-bot:", e);
    return responder({ error: e instanceof Error ? e.message : "Error desconocido" }, 500);
  }
});
