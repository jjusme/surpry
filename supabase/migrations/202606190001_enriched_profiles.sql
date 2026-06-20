-- Migration 202606190001_enriched_profiles.sql
-- Ampliar profiles con datos de perfil enriquecidos

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS shirt_size text CHECK (shirt_size IN ('XS','S','M','L','XL','XXL','N/A')),
  ADD COLUMN IF NOT EXISTS shoe_size text,
  ADD COLUMN IF NOT EXISTS pants_size text,
  ADD COLUMN IF NOT EXISTS favorite_colors text[],
  ADD COLUMN IF NOT EXISTS favorite_brands text[],
  ADD COLUMN IF NOT EXISTS hobbies text[],
  ADD COLUMN IF NOT EXISTS dietary_restrictions text[],
  ADD COLUMN IF NOT EXISTS dislikes text[],
  ADD COLUMN IF NOT EXISTS clothing_style text CHECK (clothing_style IN ('casual','deportivo','formal','mixto')),
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_tiktok text,
  ADD COLUMN IF NOT EXISTS has_completed_setup boolean NOT NULL DEFAULT false;

-- Ampliar wishlist_items
ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('ropa','tecnologia','experiencia','hogar','accesorio','otro')),
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS color_preference text,
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS is_fulfilled boolean NOT NULL DEFAULT false;

-- Tabla anti-wishlist (lo que NO quiere)
CREATE TABLE IF NOT EXISTS public.wish_dont_want (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wish_dont_want ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wish_dont_want_owner_all ON public.wish_dont_want;
CREATE POLICY wish_dont_want_owner_all ON public.wish_dont_want
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Tabla historial de regalos (evitar repetir)
CREATE TABLE IF NOT EXISTS public.gift_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.birthday_events(id) ON DELETE SET NULL,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id),
  giver_id uuid NOT NULL REFERENCES public.profiles(id),
  gift_title text NOT NULL,
  gift_url text,
  notes text,
  year int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gift_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gift_history_select_shared ON public.gift_history;
CREATE POLICY gift_history_select_shared ON public.gift_history
  USING (
    giver_id = auth.uid()
    OR recipient_id = auth.uid()
    OR users_share_group(recipient_id)
  );
DROP POLICY IF EXISTS gift_history_insert_self ON public.gift_history;
CREATE POLICY gift_history_insert_self ON public.gift_history
  WITH CHECK (giver_id = auth.uid());

-- Meta de presupuesto en eventos
ALTER TABLE public.birthday_events
  ADD COLUMN IF NOT EXISTS budget_goal numeric(12,2);

-- RSVP en participantes
ALTER TABLE public.event_participants
  ADD COLUMN IF NOT EXISTS rsvp_status text DEFAULT 'pending'
    CHECK (rsvp_status IN ('pending','confirmed','declined'));

-- Checklist de tareas
CREATE TABLE IF NOT EXISTS public.event_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.birthday_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_tasks_select_participants ON public.event_tasks;
CREATE POLICY event_tasks_select_participants ON public.event_tasks
  USING (can_access_event_data(event_id));
DROP POLICY IF EXISTS event_tasks_insert_participants ON public.event_tasks;
CREATE POLICY event_tasks_insert_participants ON public.event_tasks
  WITH CHECK (can_access_event_data(event_id) AND created_by = auth.uid());
DROP POLICY IF EXISTS event_tasks_update_participants ON public.event_tasks;
CREATE POLICY event_tasks_update_participants ON public.event_tasks
  USING (can_access_event_data(event_id));
DROP POLICY IF EXISTS event_tasks_delete_creator ON public.event_tasks;
CREATE POLICY event_tasks_delete_creator ON public.event_tasks
  USING (created_by = auth.uid() OR can_access_event_data(event_id));
