# Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase/setup.sql`, and run it once.
3. In **Authentication → URL Configuration**, set the site URL to `https://leesahm.art` and add `http://localhost:5173/**` as a local redirect URL.
4. Copy the project URL and publishable key into `.env.local` using `.env.example`.
5. Add the same two values to the GitHub deployment secrets as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

The publishable key is intended for browser use. Never put a Supabase secret or service-role key in Vite environment variables.
