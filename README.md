# Kanbot

> AI-Agent Friendly Kanban Application with Calendar Integration

Kanbot is a modern, full-stack Kanban board application designed for both human users and autonomous AI agents. It features real-time collaboration, calendar integration, and a comprehensive CLI for programmatic management.

## Features

- **Kanban Boards**: Create spaces with customizable boards and columns
- **Calendar Integration**: Built-in calendar with Google Calendar sync support
- **Real-time Updates**: WebSocket-based live collaboration
- **Multi-user Support**: Teams with role-based permissions
- **AI Agent Ready**: API keys and CLI for autonomous agent integration
- **Admin Dashboard**: User management, statistics, and system monitoring

## Quick Start (Docker)

### Prerequisites

- Docker and Docker Compose
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/kanbot.git
cd kanbot

# Copy environment file and configure
cp env.example .env
# Edit .env with your settings (especially SECRET_KEY for production)

# Start the application
docker-compose up -d

# Run database migrations
docker-compose exec backend python -m alembic upgrade head

# Create admin user (optional - uses ADMIN_EMAIL/ADMIN_PASSWORD from .env)
docker-compose exec backend python -m app.cli db seed
```

The application will be available at:
- **Web UI**: http://localhost (or port 80)
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs (disabled in production)

## Quick Start (Docker Hub - Pre-built Images)

You can also run Kanbot using pre-built images from Docker Hub without building locally:

```bash
# Create a docker-compose.yml file with pre-built images:
cat > docker-compose.yml << 'EOF'
version: "3.8"

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - frontend
      - backend

  frontend:
    image: liparu/kanbot-frontend:v1.0
    environment:
      - VITE_API_URL=http://localhost:8000

  backend:
    image: liparu/kanbot-backend:v1.0
    environment:
      - DATABASE_URL=postgresql+asyncpg://kanbot:kanbot@postgres:5432/kanbot
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=your-secret-key-here-change-in-production
      - ENVIRONMENT=development
      - CORS_ORIGINS=http://localhost,http://localhost:80
      - ADMIN_EMAIL=admin@kanbot.local
      - ADMIN_PASSWORD=admin123
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=kanbot
      - POSTGRES_PASSWORD=kanbot
      - POSTGRES_DB=kanbot
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kanbot"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
EOF

# Create nginx config directory and download config
mkdir -p nginx
curl -o nginx/nginx.conf https://raw.githubusercontent.com/Liparu/Kanbot/main/nginx/nginx.conf

# Start the application
docker-compose up -d

# Run database migrations
docker-compose exec backend python -m alembic upgrade head

# Create admin user
docker-compose exec backend python -m app.cli db seed
```

**Docker Hub Repositories:**
- Frontend: `docker pull liparu/kanbot-frontend:v1.0`
- Backend: `docker pull liparu/kanbot-backend:v1.0`

## Quick Start (Build from Source)

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/kanbot"
export SECRET_KEY="your-secret-key"

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Configuration

Key environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes (prod) | JWT signing key - generate with `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ENVIRONMENT` | No | `development` or `production` |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `ADMIN_EMAIL` | No | Default admin email |
| `ADMIN_PASSWORD` | No | Default admin password |

See [docs/configuration.md](docs/configuration.md) for complete configuration reference.

## CLI Usage

Kanbot includes a powerful CLI for system administration:

```bash
# In Docker
docker-compose exec backend python -m app.cli --help

# Or directly
python -m app.cli --help
```

### Common Commands

```bash
# User Management
kanbot user create --email user@example.com --username john --password "Pass123!"
kanbot user list
kanbot user ban user@example.com

# API Key Management (for agents)
kanbot apikey create --user user@example.com --name "My Agent" --json
kanbot apikey list

# Database
kanbot db migrate
kanbot db seed

# System
kanbot system health
kanbot system stats
```

See [docs/cli-reference.md](docs/cli-reference.md) for complete CLI documentation.

## API Access for Agents

Kanbot is designed to be controlled by autonomous AI agents. There are two authentication methods:

### 1. API Key (Recommended for Agents)

```bash
# Create an API key via CLI
docker-compose exec backend python -m app.cli apikey create \
  --user agent@example.com \
  --name "Claude Agent" \
  --json

# Use the key in requests
curl -H "X-API-Key: kb_xxxx..." http://localhost:8000/api/v1/spaces
```

### 2. JWT Token (For Interactive Sessions)

```bash
# Login to get token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=user@example.com&password=yourpassword"

# Use token in requests
curl -H "Authorization: Bearer eyJhbG..." http://localhost:8000/api/v1/spaces
```

See [docs/agent-integration.md](docs/agent-integration.md) for complete agent integration guide.

### Multi-Profile Agent Support

A single physical agent can safely manage multiple user profiles simultaneously. This enables one agent to serve multiple people in an organization while maintaining strict data isolation:

```python
# Example: One agent managing multiple users
agent = MultiProfileKanbotAgent("http://localhost:8000")

# Register profiles
agent.register_profile("alice", "alice@company.com", "kb_alice_key...")
agent.register_profile("bob", "bob@company.com", "kb_bob_key...")

# Work for Alice
agent.switch_profile("alice")
agent.create_card(space_id="...", title="Task for Alice")

# Work for Bob
agent.switch_profile("bob")
agent.create_card(space_id="...", title="Task for Bob")

# Verify isolation
agent.verify_profile_isolation("alice")
```

See [Multi-Profile Workflow](docs/agent-integration.md#multi-profile-agent-workflow) for complete implementation guide with security best practices.

## API Endpoints

| Category | Endpoints |
|----------|-----------|
| Auth | `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/refresh` |
| Users | `/api/v1/users/me`, `/api/v1/users/{id}` |
| Spaces | `/api/v1/spaces`, `/api/v1/spaces/{id}` |
| Boards | `/api/v1/spaces/{id}/boards` |
| Cards | `/api/v1/cards`, `/api/v1/cards/{id}` |
| Calendar | `/api/v1/calendar/events` |
| Search | `/api/v1/search` |

See [docs/api-reference.md](docs/api-reference.md) for complete API documentation.

## WebSocket

Real-time updates are available via WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/{space_id}?token={jwt_token}');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data.type, data.data);
};
```

## Documentation

- [Deployment Guide](docs/deployment.md) - Production deployment with Docker
- [Configuration Reference](docs/configuration.md) - Environment variables and settings
- [API Reference](docs/api-reference.md) - Complete REST API documentation
- [CLI Reference](docs/cli-reference.md) - Command-line tools for administration
- [Agent Integration Guide](docs/agent-integration.md) - Autonomous agent integration
- [Multi-Profile Setup](docs/multi-profile-setup.md) - Quick start for multi-profile agents

## Security

Kanbot includes several security features:

- JWT-based authentication with configurable expiration
- API key authentication for programmatic access
- Rate limiting on sensitive endpoints
- Account lockout after failed login attempts
- Password strength requirements
- Input sanitization (XSS protection)
- Security headers (CSP, HSTS in production)

For production deployment security checklist, see [docs/deployment.md](docs/deployment.md).

## License

MIT License - see [LICENSE](LICENSE) for details.
