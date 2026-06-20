import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY no configurada" });
  }

  try {
    const { participantCount, giftsCount, totalExpenses, pendingPayments, eventStatus } = req.body;

    const prompt = `Genera un resumen ejecutivo breve (2-3 oraciones) del estado actual de un evento de cumpleaños sorpresa. Sé conciso, accionable y usa un tono cercano.

Estado:
- Participantes: ${participantCount || 0}
- Regalos propuestos: ${giftsCount || 0}
- Gasto total: $${totalExpenses || 0} MXN
- Pagos pendientes: ${pendingPayments || 0}
- Estado: ${eventStatus || "active"}

Escribe solo el resumen, sin explicaciones adicionales.`;

    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt
    });

    return res.status(200).json({ summary: text.trim() });
  } catch (error) {
    console.error("AI activity-summary error:", error);
    return res.status(500).json({ error: "Error al generar resumen" });
  }
}
