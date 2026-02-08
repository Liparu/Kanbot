# Kanbot - AI-Agent Friendly Kanban

## Project Overview
Full-stack Kanban application with calendar integration, designed for both humans and AI agents.

## Tech Stack
- **Backend:** FastAPI (Python 3.11), PostgreSQL, Redis, SQLAlchemy
- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Zustand
- **Infrastructure:** Docker Compose, nginx

## Directory Structure
```
backend/
  app/
    api/v1/       # API endpoints (cards, spaces, users, calendar, dashboard, agents)
    models/       # SQLAlchemy models
    schemas/      # Pydantic schemas
    core/         # Config, database, security
frontend/
  src/
    components/   # React components (kanban/, spaces/, calendar/, auth/)
    api/          # API client (client.ts, dashboard.ts)
    stores/       # Zustand stores
```

## Key Conventions
- API: `/api/v1/` prefix, X-API-Key or Bearer token auth
- Cards have: name, description, column_id, start_date, due_date, tags, tasks
- Spaces contain columns, columns contain cards
- Agents table tracks sub-agents (registry endpoint)

## Commands
```bash
# Dev
docker compose up -d --build backend frontend
docker logs kanbot-backend --tail 50

# Database
docker exec -it kanbot-postgres psql -U kanbot -d kanbot

# Test API
curl -H "X-API-Key: kb_..." "http://localhost:8000/api/v1/users/me"
```

## Current Focus
- Agent Dashboard: `/spaces/:spaceId/dashboard`
- Components: CronJobsMonitor, SubAgentWidget, EventStream
- Webhook receiver on port 9999

## Don'ts
- Don't modify docker-compose.yml without asking
- Don't change auth/security without review
- Always run `drift check` after changes
