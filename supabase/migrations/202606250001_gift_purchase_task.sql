-- =====================================================
-- Gift purchase task
-- Seeds a "Comprar el regalo de X" task on every birthday event (not gatherings),
-- and auto-completes + assigns it to the buyer when a gift is marked as bought.
-- Implemented with triggers so it works regardless of which creation path/function
-- is used (manual RPC or the daily cron) and needs no frontend changes.
-- =====================================================

-- 1. Mark special tasks so triggers/UI can find the gift-purchase one.
ALTER TABLE public.event_tasks
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'custom';

-- 2. Seed the purchase task whenever a birthday event is created.
CREATE OR REPLACE FUNCTION public.seed_gift_purchase_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  -- Only birthday events have a surprise gift; gatherings (convivios) don't.
  IF NEW.event_type IS DISTINCT FROM 'gathering' THEN
    SELECT display_name INTO v_name FROM public.profiles WHERE id = NEW.birthday_user_id;
    INSERT INTO public.event_tasks (event_id, title, created_by, kind)
    VALUES (
      NEW.id,
      'Comprar el regalo de ' || coalesce(nullif(v_name, ''), 'cumpleañero'),
      NEW.organizer_id,
      'gift_purchase'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS birthday_event_seed_gift_task ON public.birthday_events;
CREATE TRIGGER birthday_event_seed_gift_task
AFTER INSERT ON public.birthday_events
FOR EACH ROW
EXECUTE FUNCTION public.seed_gift_purchase_task();

-- 3. When a gift is marked as bought, complete + assign the purchase task to the buyer.
CREATE OR REPLACE FUNCTION public.complete_gift_purchase_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'bought'
     AND OLD.status IS DISTINCT FROM 'bought'
     AND NEW.bought_by_user_id IS NOT NULL THEN
    UPDATE public.event_tasks
    SET is_completed = true,
        completed_at = now(),
        assigned_to = NEW.bought_by_user_id
    WHERE event_id = NEW.event_id
      AND kind = 'gift_purchase'
      AND is_completed = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gift_bought_completes_task ON public.gift_options;
CREATE TRIGGER gift_bought_completes_task
AFTER UPDATE ON public.gift_options
FOR EACH ROW
EXECUTE FUNCTION public.complete_gift_purchase_task();

-- 4. Backfill: add the task to existing, non-completed birthday events that lack it.
INSERT INTO public.event_tasks (event_id, title, created_by, kind)
SELECT be.id,
       'Comprar el regalo de ' || coalesce(nullif(p.display_name, ''), 'cumpleañero'),
       be.organizer_id,
       'gift_purchase'
FROM public.birthday_events be
JOIN public.profiles p ON p.id = be.birthday_user_id
WHERE be.event_type IS DISTINCT FROM 'gathering'
  AND be.status <> 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.event_tasks et
    WHERE et.event_id = be.id AND et.kind = 'gift_purchase'
  );
