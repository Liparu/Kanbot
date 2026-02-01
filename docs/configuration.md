# Configuration Reference

Complete reference for all Kanbot configuration options.

## Environment Variables

### Core Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PROJECT_NAME` | No | `Kanbot` | Application name |
| `VERSION` | No | `1.0.0` | Application version |
| `ENVIRONMENT` | No | `development` | Environment mode (`development`/`production`) |
| `API_V1_STR` | No | `/api/v1` | API prefix |

### Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | **Yes** (prod) | Auto-generated | JWT signing key. **Must be set in production**. Generate with `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440` (24h) | JWT token expiration in minutes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token expiration in days |
| `MAX_LOGIN_ATTEMPTS` | No | `5` | Failed login attempts before lockout |
| `LOGIN_LOCKOUT_MINUTES` | No | `15` | Account lockout duration |

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string. Format: `postgresql+asyncpg://user:pass@host:port/dbname` |
| `POSTGRES_USER` | Yes | - | PostgreSQL username (for Docker) |
| `POSTGRES_PASSWORD` | Yes | - | PostgreSQL password (for Docker) |
| `POSTGRES_DB` | Yes | - | PostgreSQL database name (for Docker) |

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `redis://localhost:6379/0` | Redis connection string |

### CORS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ORIGINS` | No | `http://localhost:3000,http://localhost:5173` | Comma-separated list of allowed origins |

### Admin

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_EMAIL` | No | - | Default admin email (created on first startup) |
| `ADMIN_PASSWORD` | No | - | Default admin password. Must meet password policy. |

### Google Calendar Integration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | No | - | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | - | Google OAuth client secret |

### Frontend (Vite)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | Yes | - | Backend API URL |
| `VITE_WS_URL` | Yes | - | WebSocket URL |

---

## Configuration by Environment

### Development

```bash
# .env for development
ENVIRONMENT=development
SECRET_KEY=dev-secret-key-not-for-production
DATABASE_URL=postgresql+asyncpg://kanbot:kanbot_secret@localhost:5432/kanbot
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
ADMIN_EMAIL=admin@kanbot.local
ADMIN_PASSWORD=AdminPass123!
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

In development mode:
- OpenAPI docs are enabled at `/docs`
- Security headers are relaxed
- Detailed error messages are shown

### Production

```bash
# .env for production
ENVIRONMENT=production
SECRET_KEY=your-64-char-secure-random-string-here
DATABASE_URL=postgresql+asyncpg://kanbot:strong-password@db:5432/kanbot
REDIS_URL=redis://redis:6379/0
CORS_ORIGINS=https://kanbot.yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=VerySecureAdminPass123!
VITE_API_URL=https://kanbot.yourdomain.com/api
VITE_WS_URL=wss://kanbot.yourdomain.com
```

In production mode:
- OpenAPI docs are disabled
- HSTS header is enabled
- CSP header is enabled
- Detailed errors are hidden

---

## Security Headers

When `ENVIRONMENT=production`, the following headers are added:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Disable features |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS |
| `Content-Security-Policy` | (see below) | XSS protection |

---

## Rate Limiting

Default rate limits:

| Endpoint | Limit | Purpose |
|----------|-------|---------|
| `/auth/login` | 5/minute | Prevent brute force |
| `/auth/register` | 3/minute | Prevent spam registration |
| `/auth/refresh` | 10/minute | Prevent token abuse |
| `/admin/*` | 30/minute | Protect admin endpoints |

---

## Password Policy

Passwords must meet the following requirements:

- Minimum 8 characters
- Maximum 128 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)
- At least one special character (!@#$%^&*(),.?":{}|<>)

---

## Account Lockout

After `MAX_LOGIN_ATTEMPTS` (default: 5) failed login attempts:

1. Account is locked for `LOGIN_LOCKOUT_MINUTES` (default: 15)
2. Further login attempts return 429 status
3. Lock is automatically lifted after timeout
4. Successful login resets the counter

---

## Docker Compose Configuration

The `docker-compose.yml` defines these services:

| Service | Port | Description |
|---------|------|-------------|
| `backend` | 8000 | FastAPI application |
| `frontend` | 5173 | Vite dev server |
| `postgres` | 5432 | PostgreSQL database |
| `redis` | 6379 | Redis cache |
| `nginx` | 80 | Reverse proxy |

### Volume Mounts

| Volume | Container Path | Purpose |
|--------|----------------|---------|
| `postgres_data` | `/var/lib/postgresql/data` | Database persistence |
| `redis_data` | `/data` | Redis persistence |

---

## Logging

Backend logs to stdout/stderr with the following format:
```
INFO:app.main:Starting Kanbot API...
```

Configure Docker logging:
```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Health Checks

Health endpoint returns:
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

Docker health check configuration:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```
