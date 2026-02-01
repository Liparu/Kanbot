# Deployment Guide

This guide covers deploying Kanbot in various environments.

## Table of Contents

- [Docker Deployment (Recommended)](#docker-deployment-recommended)
- [Production Checklist](#production-checklist)
- [SSL/TLS Setup](#ssltls-setup)
- [Scaling](#scaling)
- [Backup and Restore](#backup-and-restore)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Docker Deployment (Recommended)

### Prerequisites

- Docker 24.0+
- Docker Compose 2.0+
- At least 2GB RAM
- 10GB disk space

### Step 1: Clone and Configure

```bash
git clone https://github.com/your-org/kanbot.git
cd kanbot

# Create environment file
cp env.example .env
```

### Step 2: Configure Environment

Edit `.env` with production values:

```bash
# CRITICAL: Generate a secure secret key
SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(64))")

# Set to production
ENVIRONMENT=production

# Configure database (use strong password)
POSTGRES_PASSWORD=your-strong-password-here

# Set allowed origins (your domain)
CORS_ORIGINS=https://kanbot.yourdomain.com

# Admin credentials
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourSecureAdminPass123!
```

### Step 3: Start Services

```bash
# Build and start
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 4: Initialize Database

```bash
# Run migrations
docker-compose exec backend alembic upgrade head

# Seed admin user
docker-compose exec backend python -m app.cli db seed
```

### Step 5: Verify Deployment

```bash
# Check health
docker-compose exec backend python -m app.cli system health

# Check version
docker-compose exec backend python -m app.cli version
```

---

## Production Checklist

Before going to production, ensure:

### Security

- [ ] `SECRET_KEY` is set to a strong, unique value
- [ ] `ENVIRONMENT=production` is set
- [ ] `POSTGRES_PASSWORD` is strong and unique
- [ ] `ADMIN_PASSWORD` meets complexity requirements
- [ ] SSL/TLS is configured
- [ ] Firewall rules restrict database access
- [ ] Regular backups are configured

### Configuration

- [ ] `CORS_ORIGINS` lists only your domains
- [ ] Rate limits are appropriate for your traffic
- [ ] Token expiration is set appropriately
- [ ] Logging is configured

### Infrastructure

- [ ] Database has sufficient resources
- [ ] Redis is secured (if exposed)
- [ ] Monitoring is set up
- [ ] Alerts are configured

---

## Agent Setup

Kanbot is designed to be controlled by autonomous AI agents. For multi-profile agent deployments (one agent serving multiple users), see [Multi-Profile Setup Guide](multi-profile-setup.md).

### Quick Agent Setup

1. **Create agent user account**:
```bash
docker-compose exec backend python -m app.cli user create \
  --email agent@yourdomain.com \
  --username "AI Agent" \
  --json
```

2. **Generate API key**:
```bash
docker-compose exec backend python -m app.cli apikey create \
  --user agent@yourdomain.com \
  --name "Production Agent Key" \
  --json
```

3. **Store API key securely** (use secret manager in production)

4. **Test API access**:
```bash
curl -H "X-API-Key: kb_xxxx..." https://kanbot.yourdomain.com/api/v1/users/me
```

### Multi-Profile Agent Deployment

For agents serving multiple users:

- **Use separate user accounts** for each profile
- **Generate unique API keys** per profile
- **Store credentials in secret manager** (AWS Secrets Manager, HashiCorp Vault)
- **Enable audit logging** for compliance
- **Implement rate limiting per profile**

See [Multi-Profile Setup Guide](multi-profile-setup.md) for detailed instructions and security best practices.

---

## SSL/TLS Setup

### Using Let's Encrypt with Certbot

1. Install Certbot:
```bash
apt-get install certbot python3-certbot-nginx
```

2. Obtain certificate:
```bash
certbot --nginx -d kanbot.yourdomain.com
```

3. Update nginx configuration in `nginx/nginx.conf`:
```nginx
server {
    listen 443 ssl;
    server_name kanbot.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/kanbot.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kanbot.yourdomain.com/privkey.pem;
    
    # ... rest of config
}

server {
    listen 80;
    server_name kanbot.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

4. Mount certificates in docker-compose.yml:
```yaml
nginx:
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
```

---

## Scaling

### Horizontal Scaling

For high-traffic deployments, you can scale the backend:

```bash
docker-compose up -d --scale backend=3
```

Update nginx.conf for load balancing:
```nginx
upstream backend {
    least_conn;
    server backend:8000;
}
```

### Database Scaling

For large deployments, consider:
- Read replicas for query distribution
- Connection pooling (PgBouncer)
- Database sharding for very large datasets

---

## Backup and Restore

### Automated Backups

Create a backup script (`backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/backups/kanbot"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose exec -T postgres pg_dump -U kanbot kanbot > "$BACKUP_DIR/db_$DATE.sql"

# Compress
gzip "$BACKUP_DIR/db_$DATE.sql"

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

Add to crontab:
```bash
0 2 * * * /path/to/backup.sh
```

### Manual Backup via CLI

```bash
docker-compose exec backend python -m app.cli db backup --output /backups/kanbot_backup.sql
```

### Restore

```bash
# Stop the application
docker-compose stop backend frontend

# Restore database
docker-compose exec -T postgres psql -U kanbot kanbot < backup.sql

# Run any pending migrations
docker-compose exec backend alembic upgrade head

# Restart
docker-compose up -d
```

---

## Monitoring

### Health Checks

The application exposes a health endpoint:

```bash
curl http://localhost:8000/health
```

Or via CLI:
```bash
docker-compose exec backend python -m app.cli system health --json
```

### Docker Health Checks

The docker-compose.yml includes health checks. View status:
```bash
docker-compose ps
docker inspect --format='{{.State.Health.Status}}' kanbot-backend
```

### Prometheus Metrics (Optional)

For production monitoring, consider adding Prometheus metrics endpoint.

### Log Aggregation

Configure log forwarding to your preferred logging service:

```yaml
# docker-compose.yml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Common issues:
# - Database not ready: wait for postgres to be healthy
# - Missing environment variables: check .env file
# - Port conflicts: ensure ports 80, 8000, 5432 are free
```

### Database Connection Issues

```bash
# Check postgres is running
docker-compose ps postgres

# Test connection
docker-compose exec backend python -c "from app.core.database import sync_engine; print(sync_engine.connect())"
```

### Migration Failures

```bash
# Check current revision
docker-compose exec backend alembic current

# View migration history
docker-compose exec backend alembic history

# Rollback if needed
docker-compose exec backend alembic downgrade -1
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Check database connections
docker-compose exec postgres psql -U kanbot -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis
docker-compose exec redis redis-cli info
```

---

## Upgrading

### Standard Upgrade

```bash
# Pull latest changes
git pull

# Rebuild containers
docker-compose up -d --build

# Run migrations
docker-compose exec backend alembic upgrade head

# Verify
docker-compose exec backend python -m app.cli system health
```

### Major Version Upgrades

For major version upgrades, always:

1. Backup your database
2. Read the CHANGELOG for breaking changes
3. Test in a staging environment first
4. Plan for downtime if needed
