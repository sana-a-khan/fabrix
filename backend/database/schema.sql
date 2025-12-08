-- Database schema for ntrl Chrome extension
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  scans_remaining INTEGER NOT NULL DEFAULT 10,
  scans_used_today INTEGER NOT NULL DEFAULT 0,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_scan_time TIMESTAMP,
  is_flagged BOOLEAN DEFAULT false,
  flagged_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage logs table
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('scan', 'save')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  estimated_cost DECIMAL(10, 6),
  tokens_used INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB
);

-- Rate limiting table (tracks scans per hour)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  scan_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription ON public.user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON public.usage_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON public.rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits(window_start);

-- Function to reset monthly scans
CREATE OR REPLACE FUNCTION reset_monthly_scans()
RETURNS void AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    scans_remaining = CASE
      WHEN subscription_tier = 'free' THEN 10
      WHEN subscription_tier = 'premium' THEN 100
      ELSE 10
    END,
    last_reset_date = CURRENT_DATE
  WHERE last_reset_date < CURRENT_DATE
    AND EXTRACT(DAY FROM CURRENT_DATE) = 1; -- Reset on 1st of month
END;
$$ LANGUAGE plpgsql;

-- Function to reset daily scan counter (for abuse detection)
CREATE OR REPLACE FUNCTION reset_daily_scans()
RETURNS void AS $$
BEGIN
  UPDATE public.user_profiles
  SET scans_used_today = 0
  WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_scan_usage(p_user_id UUID)
RETURNS TABLE(scans_remaining INTEGER, scans_used_today INTEGER) AS $$
DECLARE
  v_scans_remaining INTEGER;
  v_scans_used_today INTEGER;
BEGIN
  -- First reset if new month/day
  UPDATE public.user_profiles
  SET
    scans_remaining = CASE
      WHEN last_reset_date < DATE_TRUNC('month', CURRENT_DATE) THEN
        CASE
          WHEN subscription_tier = 'free' THEN 10
          WHEN subscription_tier = 'premium' THEN 100
          ELSE 10
        END
      ELSE scans_remaining
    END,
    scans_used_today = CASE
      WHEN last_reset_date < CURRENT_DATE THEN 0
      ELSE scans_used_today
    END,
    last_reset_date = CASE
      WHEN last_reset_date < CURRENT_DATE THEN CURRENT_DATE
      ELSE last_reset_date
    END
  WHERE id = p_user_id;

  -- Then decrement and increment
  UPDATE public.user_profiles
  SET
    scans_remaining = GREATEST(scans_remaining - 1, 0),
    scans_used_today = scans_used_today + 1,
    last_scan_time = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING user_profiles.scans_remaining, user_profiles.scans_used_today
  INTO v_scans_remaining, v_scans_used_today;

  RETURN QUERY SELECT v_scans_remaining, v_scans_used_today;
END;
$$ LANGUAGE plpgsql;

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_window TIMESTAMP WITH TIME ZONE;
  v_scan_count INTEGER;
BEGIN
  v_current_window := DATE_TRUNC('hour', NOW());

  -- Get or create rate limit record for current hour
  INSERT INTO public.rate_limits (user_id, window_start, scan_count)
  VALUES (p_user_id, v_current_window, 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET scan_count = rate_limits.scan_count + 1
  RETURNING scan_count INTO v_scan_count;

  -- Clean up old rate limit records (older than 24 hours)
  DELETE FROM public.rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours';

  -- Return true if under limit, false if over
  RETURN v_scan_count <= p_limit;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint for rate limits
ALTER TABLE public.rate_limits
DROP CONSTRAINT IF EXISTS rate_limits_user_window_unique;

ALTER TABLE public.rate_limits
ADD CONSTRAINT rate_limits_user_window_unique
UNIQUE (user_id, window_start);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can view their own usage logs
CREATE POLICY "Users can view own usage logs" ON public.usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (for backend)
CREATE POLICY "Service role full access user_profiles" ON public.user_profiles
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access usage_logs" ON public.usage_logs
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access rate_limits" ON public.rate_limits
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Function to create user profile on signup (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, subscription_tier, scans_remaining, last_reset_date)
  VALUES (NEW.id, NEW.email, 'free', 10, CURRENT_DATE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT ON public.usage_logs TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Database schema created successfully!';
  RAISE NOTICE 'Tables created: user_profiles, usage_logs, rate_limits';
  RAISE NOTICE 'Functions created: reset_monthly_scans, increment_scan_usage, check_rate_limit';
  RAISE NOTICE 'RLS policies enabled for security';
END $$;
