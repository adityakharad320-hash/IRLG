# IRLG Database Migrations

## Strategy & Operating Model

IRLG strictly separates runtime application database access from migration execution:

1. **Decoupled Architecture:**
   - The Fastify backend does **not** execute automated DDL migrations on process bootstrap.
   - Decoupling migration runs from server startup prevents race conditions during multi-instance rolling deploys (e.g. on Railway) and ensures zero downtime.
   - Runtime operations perform data manipulation (DML) only. Schema modifications (DDL) are applied solely through controlled deployment pipelines.

2. **Migration Tooling & Executable Workflow:**
   - Schema migrations are managed via declarative SQL migration files utilizing the official Supabase CLI.
   - Migrations reside in the dedicated top-level `supabase/migrations/` directory once the remote Supabase project is provisioned.

### Step-by-Step Executable Workflow

#### Initial Setup & Linking
```bash
# 1. Authenticate with Supabase CLI
npx supabase login

# 2. Link local workspace to the remote Supabase project
npx supabase link --project-ref <SUPABASE_PROJECT_ID>
```

#### Creating a New Migration
```bash
# Generate a new timestamped migration file
npx supabase migration new create_game_sessions

# Edit the generated SQL file located in supabase/migrations/<timestamp>_create_game_sessions.sql
```

#### Local Validation
```bash
# Test migrations locally using the local Supabase container stack
npx supabase db reset
```

#### Deploying Migrations to Staging / Production
```bash
# Apply pending migrations to the linked remote database (CI/CD pipeline or deployment step)
npx supabase db push
```

3. **Security Constraints:**
   - **Row Level Security (RLS):** Must remain **enabled** on all production tables (`ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`).
   - **Service-Role Boundary:** The service-role key is restricted to authoritative server processes (e.g., match coordinator, scoring engine) and must never be exposed to clients, logs, or error responses.
   - **Client Access:** Web and mobile clients interact through Supabase Auth and RLS-protected public endpoints using the anonymous API key.
