# IRLG

IRLG is a real-world multiplayer gaming platform. The first playable game is Classic Manhunt.

## Architecture

This repository is structured as an npm workspaces monorepo:

```text
IRLG/
  apps/
    web/            # Next.js web application (@irlg/web)
    server/         # Node.js + Fastify backend (@irlg/server)
  supabase/         # Supabase CLI configuration & migrations
    migrations/     # Declarative versioned SQL migrations
    config.toml     # Local Supabase development configuration
  package.json      # Root monorepo configuration & lifecycle scripts
  package-lock.json # Single centralized lockfile
  README.md         # Repository documentation
  .gitignore        # Root Git ignore rules
```

### Planned Additions
- `apps/mobile`: React Native + Expo mobile application
- `packages/shared`: Shared game contracts, schemas, and TypeScript types

## Getting Started

### Prerequisites
- Node.js >= 20 (Node.js 24 LTS recommended)
- npm >= 10
- Git
- Supabase CLI (`npx supabase`)

### Installation
Install all dependencies from the repository root:

```bash
npm install
```

### Supabase Setup & Linking

The platform uses Supabase PostgreSQL for persistent data and Supabase Auth for identity management.

#### 1. CLI Authentication and Project Linking
Authenticate with Supabase and link your remote project:

```bash
# Log in to your Supabase account
npx supabase login

# Link the project using your project reference ID
npx supabase link --project-ref <PROJECT_REF>
```

#### 2. Running Migrations
Database schema changes are managed via declarative migrations in `supabase/migrations/`:

```bash
# Apply pending migrations to the linked remote database
npx supabase db push

# Generate a new migration for schema changes
npx supabase migration new <migration_name>
```

### Environment Configuration
The backend server uses environment variables defined via Zod schema. A template is provided in `apps/server/.env.example`:

```bash
# Copy template for local development
cp apps/server/.env.example apps/server/.env
```

Key environment variables:
- `PORT`: Server port (default: `4000`)
- `HOST`: Server host (default: `0.0.0.0`)
- `NODE_ENV`: Runtime environment (`development` | `test` | `production`)
- `CORS_ORIGIN`: Allowed origins (e.g. `http://localhost:3000`)
- `API_PREFIX`: Base API prefix (default: `/api/v1`)
- `SUPABASE_URL`: Supabase project URL (`https://<PROJECT_REF>.supabase.co`)
- `SUPABASE_ANON_KEY`: Supabase anon/public key (or publishable key)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key (server-only; never exposed to web or client bundles)

*Note: The server operates in degraded/unconfigured mode if Supabase credentials are not supplied, allowing full local execution and testing.*

## Security & Authentication Model

### Authentication Flow
1. Users authenticate through Supabase Auth (email/password, OAuth, magic links).
2. The client receives a JWT access token.
3. Protected backend requests include `Authorization: Bearer <access_token>`.
4. The Fastify backend validates the token server-side via `client.auth.getUser(token)` against Supabase Auth.
5. Authenticated endpoints (e.g. `GET /api/v1/users/me`) populate `request.user` and ensure user profile synchronization.

### Row Level Security (RLS) Model
All platform user data is protected by PostgreSQL Row Level Security:
- **Default Deny:** Access is denied unless an explicit policy permits it.
- **Ownership Scoping:** Policies enforce `auth.uid() = id`, ensuring players can only read and update their own profile records.
- **Privilege Separation:** The backend server uses the service-role client strictly for authoritative operations (such as session synchronization, matchmaking, and scoring). Normal client queries execute through RLS-restricted roles.

## Running Applications

From the repository root:

- **Web Application:**
  - `npm run dev`: Start Next.js development server (`http://localhost:3000`)
  - `npm run build`: Build web application for production
  - `npm run start`: Run production web server

- **Backend Application:**
  - `npm run dev:server`: Start Fastify development server with hot-reload (`http://localhost:4000`)
  - `npm run build:server`: Compile TypeScript backend to `dist/`
  - `npm run start:server`: Run compiled production backend server
  - `npm run test:server`: Run Vitest test suite

### Quality & Verification Scripts

Run from the repository root:

- **Web:**
  - `npm run typecheck` or `npm run typecheck:web`
  - `npm run lint` or `npm run lint:web`
- **Backend:**
  - `npm run typecheck:server`
  - `npm run lint:server`
  - `npm run test:server`
- **Full Test Suite:**
  - `npm test`
