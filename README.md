# Backend

Node.js + Express API server for the ContentFlow app.

## Structure

- `src/index.js`: API entrypoint
- `src/config/`: backend configuration (`supabase.js`)
- `src/controllers/`: request handlers (scaffold)
- `src/routes/`: route definitions (scaffold)
- `src/services/`: business logic (scaffold)
- `src/middleware/`: middleware utilities (scaffold)

## Run

```bash
npm install
npm run dev
```

Use `.env.example` to configure:

- `API_PORT`
- `APP_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

## Supabase SQL (required)

Copy and run the SQL content from this file in Supabase SQL Editor:

- `Backend/sql/001_init_supabase.sql`

This migration creates:

- `profiles`
- `posts`
- `calendar_events`
- `team_tasks`
- RLS policies for user-scoped access
- Storage bucket `post-media` and storage policies
