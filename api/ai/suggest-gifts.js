import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY no configurada" });
  }

  try {
    const { birthdayName, wishlist, budget, interests, dislikes, lastGift } = req.body;

    const tooLong =
      (birthdayName?.length || 0) > 200 ||
      (lastGift?.length || 0) > 200 ||
      (Array.isArray(wishlist) && wishlist.length > 50) ||
      (Array.isArray(interests) && interests.length > 50) ||
      (Array.isArray(dislikes) && dislikes.length > 50);
    if (tooLong) {
      return res.status(400).json({ error: "Datos demasiado largos" });
    }

    const prompt = `Eres un asistente para planear regalos de cumpleaños sorpresa en México.

CUMPLEAÑERO: ${birthdayName || "Alguien especial"}
${wishlist?.length ? `WISHLIST ACTUAL:\n${wishlist.map((w) => `- ${w.title} (${w.price_estimate ? `$${w.price_estimate} MXN` : "sin precio"})`).join("\n")}` : "No tiene wishlist registrada."}
${interests?.length ? `INTERESES: ${interests.join(", ")}` : ""}
${dislikes?.length ? `NO QUIERE: ${dislikes.join(", ")}` : ""}
${lastGift ? `REGALO ANTERIOR: ${lastGift}` : ""}
PRESUPUESTO POR PERSONA: ${budget ? `$${budget} MXN` : "No definido"}

Sugiere 3-5 ideas de regalo. Para cada una:
- título del regalo
- por qué es buen regalo para esta persona (1 oración corta)
- precio estimado en MXN
- tienda sugerida (si aplica)

Solo incluye regalo que estén dentro del presupuesto.`;

    const { object } = await generateObject({
      model: groq("openai/gpt-oss-20b"),
      prompt,
      schema: z.object({
        suggestions: z.array(z.object({
          title: z.string(),
          reason: z.string(),
          estimated_price: z.number(),
          store: z.string().optional()
        }))
      })
    });

    return res.status(200).json(object);
  } catch (error) {
    console.error("AI suggest-gifts error:", error);
    return res.status(500).json({ error: `Error al generar sugerencias: ${error?.message || error}` });
  }
}
