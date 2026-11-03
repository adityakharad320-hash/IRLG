# IRLG

IRLG is a real-world multiplayer gaming platform. The first playable game is Classic Manhunt.

## Architecture

This repository is structured as an npm workspaces monorepo:

```text
IRLG/
  apps/
    web/          # Next.js web application (@irlg/web)
    server/       # Node.js + Fastify backend (@irlg/server)
  package.json    # Root monorepo configuration & lifecycle scripts
  package-lock.json # Single centralized lockfile
  README.md       # Repository documentation
  .gitignore      # Root Git ignore rules
```

### Planned Additions
- `apps/mobile`: React Native + Expo mobile application
- `packages/shared`: Shared game contracts, schemas, and TypeScript types

## Getting Started

### Prerequisites
- Node.js >= 20 (Node.js 24 LTS recommended)
- npm >= 10
- Git

### Installation
Install all dependencies from the repository root:

```bash
npm install
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
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key (server-only)

*Note: The server operates in degraded/unconfigured mode if Supabase credentials are not supplied, allowing full local execution and testing.*

### Running Applications

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
