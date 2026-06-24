-- Change clothing_style (single text) to clothing_styles (array) for multi-select
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS clothing_styles text[] DEFAULT '{}';

UPDATE profiles
  SET clothing_styles = ARRAY[clothing_style]
  WHERE clothing_style IS NOT NULL AND clothing_style != '';

ALTER TABLE profiles
  DROP COLUMN IF EXISTS clothing_style;
