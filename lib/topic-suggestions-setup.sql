-- ============================================
-- HashClout: Topic Suggestions
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.topic_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  username text,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_suggestions ENABLE ROW LEVEL SECURITY;

-- Anyone can read (so user sees their own)
DROP POLICY IF EXISTS "Suggestions readable by all" ON public.topic_suggestions;
CREATE POLICY "Suggestions readable by all"
  ON public.topic_suggestions FOR SELECT USING (true);

-- Auth users can submit
DROP POLICY IF EXISTS "Users can suggest" ON public.topic_suggestions;
CREATE POLICY "Users can suggest"
  ON public.topic_suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
