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
    const { text, participants } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ error: "El texto no puede estar vacío" });
    }

    if (text.length > 2000) {
      return res.status(400).json({ error: "El texto es demasiado largo" });
    }

    const participantNames = participants?.map((p) => p.name || p.display_name).join(", ") || "todos";

    const prompt = `Analiza el siguiente texto sobre un gasto grupal y extrae la información estructurada.

TEXTO: "${text}"
PARTICIPANTES DISPONIBLES: ${participantNames}

Reglas:
- Categoría: gift, cake, decoration, snacks, o other
- Si el texto dice "mitad y mitad" o "a la mitad", dividir entre todos los participantes igual
- Si menciona personas específicas, asignar solo a esas
- Si no especifica dividir, asumir dividido entre todos
- El monto total debe ser un número`;

    const { object } = await generateObject({
      model: groq("llama-3.3-70b-versatile"),
      prompt,
      schema: z.object({
        title: z.string().describe("Título descriptivo del gasto"),
        amount: z.number().describe("Monto total en MXN"),
        category: z.enum(["gift", "cake", "decoration", "snacks", "other"]),
        split_equally: z.boolean().describe("Si se divide equitativamente"),
        participants_mentioned: z.array(z.string()).describe("Nombres de participantes mencionados específicamente")
      })
    });

    return res.status(200).json(object);
  } catch (error) {
    console.error("AI parse-expense error:", error);
    return res.status(500).json({ error: "Error al analizar el gasto" });
  }
}
