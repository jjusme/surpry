import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY no configurada" });
  }

  try {
    const { birthdayName, wishlist, budget, interests, dislikes, lastGift } = req.body;

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
      model: groq("llama-3.3-70b-versatile"),
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
    return res.status(500).json({ error: "Error al generar sugerencias" });
  }
}
