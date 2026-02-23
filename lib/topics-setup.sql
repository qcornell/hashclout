-- ============================================
-- HashClout: Topics System
-- Run this in Supabase SQL Editor
-- ============================================

-- Topics table
CREATE TABLE IF NOT EXISTS public.topics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  yes_label text NOT NULL DEFAULT 'YES',
  no_label text NOT NULL DEFAULT 'NO',
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  total_debates integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Everyone can read topics
DROP POLICY IF EXISTS "Topics are viewable by everyone" ON public.topics;
CREATE POLICY "Topics are viewable by everyone"
  ON public.topics FOR SELECT
  USING (true);

-- Seed with initial topics
INSERT INTO public.topics (title, description, category, yes_label, no_label, is_active, is_featured) VALUES
  ('Should we ban ICE?', 'Supporters say ICE enforces immigration law and protects borders. Critics argue it causes harm and overreach. Should ICE be banned?', 'politics', 'BAN ICE', 'KEEP ICE', true, true),
  ('Is AI going to replace most jobs?', 'AI is advancing rapidly. Some say it will automate most human work within decades. Others argue it will create more jobs than it destroys.', 'technology', 'YES, MOST JOBS', 'NO, HUMANS ADAPT', true, false),
  ('Should college be free?', 'Student debt is at record highs. Should taxpayers fund free public university, or does free college devalue degrees and burden the economy?', 'education', 'FREE COLLEGE', 'EARNED DEGREES', true, false),
  ('Is social media harmful to society?', 'Social media connects billions but is linked to mental health issues, misinformation, and polarization. Net positive or negative?', 'society', 'HARMFUL', 'BENEFICIAL', true, false),
  ('Should voting be mandatory?', 'Some democracies require citizens to vote. Does mandatory voting strengthen democracy or violate personal freedom?', 'politics', 'MANDATORY', 'VOLUNTARY', true, false),
  ('Should we colonize Mars?', 'SpaceX aims for Mars. Is investing trillions in Mars colonization visionary or a distraction from fixing Earth?', 'science', 'COLONIZE', 'FIX EARTH FIRST', true, false),
  ('Is cryptocurrency the future of money?', 'Bitcoin and crypto promise decentralized finance. Critics say it''s speculative, wasteful, and enables crime. Future of money or bubble?', 'finance', 'CRYPTO IS FUTURE', 'CRYPTO IS A BUBBLE', true, false),
  ('Should the US have universal healthcare?', 'The US is the only wealthy nation without universal healthcare. Would it save lives and money, or lead to worse care and higher taxes?', 'politics', 'UNIVERSAL HC', 'PRIVATE SYSTEM', true, false),
  ('Is remote work better than office work?', 'The pandemic proved remote work is possible. Is working from home more productive and humane, or does it kill collaboration and culture?', 'work', 'REMOTE WINS', 'OFFICE WINS', true, false),
  ('Should there be a maximum wage?', 'CEOs earn 300x their average worker. Should there be a legal cap on earnings, or does that punish success and stifle innovation?', 'economics', 'CAP EARNINGS', 'NO LIMITS', true, false),
  ('Is cancel culture out of control?', 'People lose careers over old tweets. Is accountability culture necessary, or has public shaming become a weapon?', 'society', 'OUT OF CONTROL', 'ACCOUNTABILITY WORKS', true, false),
  ('Should the death penalty be abolished?', 'Some say it deters crime and delivers justice. Others argue it''s cruel, irreversible, and disproportionately applied. Abolish or keep?', 'justice', 'ABOLISH IT', 'KEEP IT', true, false),
  ('Is TikTok a national security threat?', 'TikTok collects massive data with ties to China. Ban it to protect Americans, or is that authoritarian overreach?', 'technology', 'BAN TIKTOK', 'KEEP TIKTOK', true, false),
  ('Should drugs be decriminalized?', 'Portugal decriminalized all drugs and saw reduced addiction. Should the US follow, or does decriminalization enable drug abuse?', 'politics', 'DECRIMINALIZE', 'KEEP LAWS', true, false),
  ('Is nuclear energy the answer to climate change?', 'Nuclear is zero-carbon and reliable but comes with waste and disaster risks. Should we go all-in on nuclear?', 'science', 'GO NUCLEAR', 'TOO RISKY', true, false)
ON CONFLICT DO NOTHING;
