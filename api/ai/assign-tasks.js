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
    const { tasks, participants } = req.body;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: "No hay tareas para asignar" });
    }
    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: "No hay participantes disponibles" });
    }
    if (tasks.length > 50 || participants.length > 50) {
      return res.status(400).json({ error: "Demasiadas tareas o participantes" });
    }

    const taskList = tasks.map((t) => `- [${t.id}] ${t.title}`).join("\n");
    const participantNames = participants.map((p) => p.name).join(", ");

    const prompt = `Eres el coordinador de un grupo que organiza una sorpresa de cumpleaños.
Distribuye las siguientes tareas entre los participantes de forma equilibrada y lógica
(reparte la carga de manera pareja; si una tarea encaja mejor con alguien por su nombre o rol, úsalo).

TAREAS (formato "[id] título"):
${taskList}

PARTICIPANTES DISPONIBLES: ${participantNames}

Reglas:
- Asigna CADA tarea a exactamente UN participante de la lista.
- Usa los nombres EXACTAMENTE como aparecen en PARTICIPANTES DISPONIBLES.
- Reparte de forma pareja; evita dejar a alguien con todo y a otros sin nada.
- Devuelve el id de la tarea tal cual lo recibiste.`;

    const { object } = await generateObject({
      model: groq("openai/gpt-oss-20b"),
      prompt,
      schema: z.object({
        assignments: z.array(z.object({
          task_id: z.string(),
          assignee: z.string()
        }))
      })
    });

    return res.status(200).json(object);
  } catch (error) {
    console.error("AI assign-tasks error:", error);
    return res.status(500).json({ error: `Error al autoasignar tareas: ${error?.message || error}` });
  }
}
