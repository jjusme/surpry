import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (process.env.CRON_SECRET && authHeader !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const { data, error } = await supabase.rpc("create_missing_birthday_events");

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ created: data ?? 0 });
}
