import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
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
    const { participantCount, giftsCount, totalExpenses, pendingPayments, eventStatus } = req.body;

    const num = (v) => Number(v) || 0;
    const status = String(eventStatus || "active").slice(0, 50);

    const prompt = `Genera un resumen ejecutivo breve (2-3 oraciones) del estado actual de un evento de cumpleaños sorpresa. Sé conciso, accionable y usa un tono cercano.

Estado:
- Participantes: ${num(participantCount)}
- Regalos propuestos: ${num(giftsCount)}
- Gasto total: $${num(totalExpenses)} MXN
- Pagos pendientes: ${num(pendingPayments)}
- Estado: ${status}

Escribe solo el resumen, sin explicaciones adicionales.`;

    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt
    });

    return res.status(200).json({ summary: text.trim() });
  } catch (error) {
    console.error("AI activity-summary error:", error);
    return res.status(500).json({ error: `Error al generar resumen: ${error?.message || error}` });
  }
}
