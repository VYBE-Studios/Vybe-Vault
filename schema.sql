CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('USER', 'UPLOAD', 'ADMIN')),
  tier TEXT NOT NULL CHECK (tier IN ('Creator', 'Creator+', 'Creator++')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assets (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('Creator', 'Creator+', 'Creator++')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  preview_path TEXT,
  uploader_id BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assets_created_at_idx ON public.assets (created_at DESC);
CREATE INDEX IF NOT EXISTS assets_uploader_idx ON public.assets (uploader_id);

INSERT INTO public.users (username, role, tier)
VALUES ('admin', 'ADMIN', 'Creator++')
ON CONFLICT (username) DO NOTHING;
