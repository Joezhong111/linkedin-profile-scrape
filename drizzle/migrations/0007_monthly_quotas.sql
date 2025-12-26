-- Drop existing quota and usage tables
DROP TABLE IF EXISTS apify_usage CASCADE;
DROP TABLE IF EXISTS apify_quotas CASCADE;

-- Create new monthly quota table
CREATE TABLE monthly_quotas (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monthly_limit INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Create new monthly usage table
CREATE TABLE monthly_usage (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, period_start)
);

-- Create index for efficient queries
CREATE INDEX idx_monthly_usage_period ON monthly_usage(period_start, period_end);
