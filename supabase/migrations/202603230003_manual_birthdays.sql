-- Migration 202603230003_manual_birthdays.sql
-- Add table for manually tracked birthdays (people outside the app)

CREATE TABLE IF NOT EXISTS public.manual_birthdays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  birthday_day int NOT NULL CHECK (birthday_day BETWEEN 1 AND 31),
  birthday_month int NOT NULL CHECK (birthday_month BETWEEN 1 AND 12),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.manual_birthdays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manual_birthdays_owner_all" ON public.manual_birthdays
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for performance
CREATE INDEX IF NOT EXISTS manual_birthdays_user_id_idx ON public.manual_birthdays(user_id);
