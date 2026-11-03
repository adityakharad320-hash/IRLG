# IRLG

IRLG is a real-world multiplayer gaming platform. The first playable game is Classic Manhunt.

## Architecture

This repository is structured as an npm workspaces monorepo:

```text
IRLG/
  apps/
    web/          # Next.js web application (@irlg/web)
  package.json    # Root monorepo configuration
  README.md       # Repository documentation
  .gitignore      # Root Git ignore rules
```

### Planned Additions
- `apps/server`: Fastify real-time backend
- `apps/mobile`: React Native + Expo mobile application
- `packages/shared`: Shared contracts, schemas, and TypeScript types

## Getting Started

### Prerequisites
- Node.js >= 20 (Node.js 24 LTS recommended)
- npm >= 10

### Installation
Install all dependencies from the root directory:

```bash
npm install
```

### Available Scripts

Run the following commands from the repository root:

- `npm run dev`: Start the web application in development mode
- `npm run build`: Build the web application for production
- `npm run start`: Start the production build of the web application
- `npm run lint`: Run ESLint across the web workspace
- `npm run typecheck`: Run TypeScript type checking across the web workspace
