-- Remove tables and columns that were accidentally applied from the finagent project.
-- None of these are referenced by surpry's codebase.

-- 1. Drop finagent tables (CASCADE handles triggers and dependent objects).
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_conversations CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;
DROP TABLE IF EXISTS public.categorization_rules CASCADE;
DROP TABLE IF EXISTS public.financial_goals CASCADE;
DROP TABLE IF EXISTS public.income_estimates CASCADE;
DROP TABLE IF EXISTS public.messaging_accounts CASCADE;
DROP TABLE IF EXISTS public.pending_ai_actions CASCADE;
DROP TABLE IF EXISTS public.user_budget_settings CASCADE;
DROP TABLE IF EXISTS public.user_categories CASCADE;

-- 2. Drop finagent columns that leaked into the profiles table.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS current_streak,
  DROP COLUMN IF EXISTS longest_streak,
  DROP COLUMN IF EXISTS last_logged_date,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS reminder_enabled,
  DROP COLUMN IF EXISTS reminder_time;

-- 3. Drop finagent-only functions.
DROP FUNCTION IF EXISTS public.rename_user_category(text, text);
DROP FUNCTION IF EXISTS public.save_budget_period(uuid, date, date, numeric);
DROP FUNCTION IF EXISTS public.handle_chat_updated_at();
DROP FUNCTION IF EXISTS public.claim_daily_streak(uuid, date);
