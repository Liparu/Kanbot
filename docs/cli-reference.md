# CLI Reference

Kanbot includes a comprehensive command-line interface for system administration, user management, and automation.

## Installation

The CLI is automatically available when running Kanbot via Docker:

```bash
docker-compose exec backend python -m app.cli --help
```

Or when running locally:

```bash
cd backend
python -m app.cli --help
```

---

## Global Options

All commands support these global options:

| Option | Description |
|--------|-------------|
| `--help` | Show help message and exit |
| `--json` | Output in JSON format (for machine parsing) |

---

## Command Groups

### user - User Management

Manage user accounts including creation, deletion, and administrative actions.

```bash
kanbot user [COMMAND]
```

#### user create

Create a new user account.

```bash
kanbot user create --email EMAIL --username USERNAME [OPTIONS]
```

**Options:**
| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--email` | Yes | - | User email address |
| `--username` | Yes | - | Username |
| `--password` | No | Auto-generated | User password |
| `--admin` | No | False | Create as admin |
| `--json` | No | False | JSON output |

**Examples:**
```bash
# Create regular user with auto-generated password
kanbot user create --email user@example.com --username john

# Create admin user with specific password
kanbot user create --email admin@example.com --username admin --password "SecurePass123!" --admin

# Create user and get JSON output (for scripts)
kanbot user create --email agent@bot.local --username agent --json
```

**Output (with --json):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "john",
    "is_admin": false,
    "created_at": "2024-01-01T00:00:00Z",
    "generated_password": "xK9#mL2$pQ7@"
  },
  "message": "User 'john' created successfully"
}
```

---

#### user list

List all users with pagination.

```bash
kanbot user list [OPTIONS]
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--page` | 1 | Page number |
| `--limit` | 20 | Results per page |
| `--json` | False | JSON output |

**Examples:**
```bash
# List first page
kanbot user list

# List with pagination
kanbot user list --page 2 --limit 10

# JSON output
kanbot user list --json
```

---

#### user get

Get detailed information about a user.

```bash
kanbot user get IDENTIFIER [OPTIONS]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| IDENTIFIER | User ID, email, or username |

**Examples:**
```bash
kanbot user get admin@example.com
kanbot user get john
kanbot user get 076d0faa-5023-4733-8c63-36cf741f4a8a
```

---

#### user delete

Delete a user account.

```bash
kanbot user delete IDENTIFIER [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation prompt |
| `--json` | JSON output |

**Examples:**
```bash
# Interactive deletion
kanbot user delete user@example.com

# Force deletion (no confirmation)
kanbot user delete user@example.com --force
```

---

#### user reset-password

Reset a user's password.

```bash
kanbot user reset-password IDENTIFIER [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--password` | New password (auto-generated if not provided) |
| `--json` | JSON output |

**Examples:**
```bash
# Generate new random password
kanbot user reset-password john

# Set specific password
kanbot user reset-password john --password "NewPass456!"
```

---

#### user ban

Ban a user account (prevents login).

```bash
kanbot user ban IDENTIFIER [OPTIONS]
```

**Examples:**
```bash
kanbot user ban spammer@example.com
```

---

#### user unban

Unban a previously banned user.

```bash
kanbot user unban IDENTIFIER [OPTIONS]
```

---

#### user set-admin

Grant or revoke admin privileges.

```bash
kanbot user set-admin IDENTIFIER [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--revoke` | Revoke admin status instead of granting |

**Examples:**
```bash
# Grant admin status
kanbot user set-admin trusted@example.com

# Revoke admin status
kanbot user set-admin former-admin@example.com --revoke
```

---

### apikey - API Key Management

Manage API keys for programmatic access and agent authentication.

```bash
kanbot apikey [COMMAND]
```

#### apikey create

Create a new API key for a user.

```bash
kanbot apikey create --user USER --name NAME [OPTIONS]
```

**Options:**
| Option | Required | Description |
|--------|----------|-------------|
| `--user` | Yes | User ID, email, or username |
| `--name` | Yes | API key name/description |
| `--json` | No | JSON output |

**Examples:**
```bash
# Create API key for agent
kanbot apikey create --user agent@bot.local --name "Production Agent"

# JSON output (capture key programmatically)
kanbot apikey create --user agent@bot.local --name "CI/CD Pipeline" --json
```

**Output:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Production Agent",
    "key": "kb_a1b2c3d4e5f6...",
    "user_email": "agent@bot.local",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "message": "API key created successfully"
}
```

**Important:** The API key is only shown once. Store it securely!

---

#### apikey list

List API keys (shows key prefix only for security).

```bash
kanbot apikey list [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--user` | Filter by user |
| `--json` | JSON output |

---

#### apikey revoke

Revoke an API key (deactivate without deleting).

```bash
kanbot apikey revoke KEY_ID [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation |
| `--json` | JSON output |

---

### db - Database Operations

Manage database migrations, backups, and seeding.

```bash
kanbot db [COMMAND]
```

#### db migrate

Run database migrations.

```bash
kanbot db migrate [OPTIONS]
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--revision` | head | Target revision |
| `--json` | False | JSON output |

**Examples:**
```bash
# Migrate to latest
kanbot db migrate

# Migrate to specific revision
kanbot db migrate --revision abc123
```

---

#### db downgrade

Downgrade database to previous revision.

```bash
kanbot db downgrade --revision REVISION [OPTIONS]
```

**Examples:**
```bash
# Downgrade one step
kanbot db downgrade --revision -1

# Downgrade to specific revision
kanbot db downgrade --revision abc123
```

---

#### db revision

Show current database revision.

```bash
kanbot db revision [OPTIONS]
```

---

#### db history

Show migration history.

```bash
kanbot db history [OPTIONS]
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--limit` | 10 | Number of revisions to show |

---

#### db backup

Create a database backup using pg_dump.

```bash
kanbot db backup [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--output` | Output file path (auto-generated if not provided) |

**Examples:**
```bash
# Auto-named backup
kanbot db backup

# Specific path
kanbot db backup --output /backups/kanbot_2024-01-01.sql
```

---

#### db seed

Seed database with initial data (creates admin user).

```bash
kanbot db seed [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--admin-only` | Only create admin user |

**Note:** Requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables.

---

### system - System Operations

System health, statistics, and configuration.

```bash
kanbot system [COMMAND]
```

#### system health

Check health of all services.

```bash
kanbot system health [OPTIONS]
```

**Output:**
```
            Service Health            
┏━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━━┓
┃ Service  ┃ Status     ┃ Message    ┃
┡━━━━━━━━━━╇━━━━━━━━━━━━╇━━━━━━━━━━━━┩
│ Database │ OK healthy │ Connected  │
│ Redis    │ OK healthy │ Connected  │
│ Api      │ OK healthy │ Responding │
└──────────┴────────────┴────────────┘

All services healthy
```

---

#### system stats

Show system statistics.

```bash
kanbot system stats [OPTIONS]
```

**Output:**
```
System Statistics
  Users: 100 (admins: 2)
  Spaces: 50
  Cards: 1000
```

---

#### system version

Show version information.

```bash
kanbot system version [OPTIONS]
```

---

#### system config

Show current configuration (secrets hidden by default).

```bash
kanbot system config [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--show-secrets` | Reveal hidden values |

---

### space - Space Management

Administrative space management.

```bash
kanbot space [COMMAND]
```

#### space list

List all spaces.

```bash
kanbot space list [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--owner` | Filter by owner email |
| `--space-type` | Filter by type (personal/company/agent) |
| `--page` | Page number |
| `--limit` | Results per page |

---

#### space get

Get space details.

```bash
kanbot space get SPACE_ID [OPTIONS]
```

---

#### space delete

Delete a space and all its contents.

```bash
kanbot space delete SPACE_ID [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation |

**Warning:** This permanently deletes the space, all boards, columns, cards, and associated data!

---

## JSON Output Format

All commands with `--json` flag output consistent JSON:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

**Error Codes:**
| Code | Description |
|------|-------------|
| `USER_NOT_FOUND` | User doesn't exist |
| `EMAIL_EXISTS` | Email already registered |
| `USERNAME_EXISTS` | Username already taken |
| `KEY_NOT_FOUND` | API key doesn't exist |
| `SPACE_NOT_FOUND` | Space doesn't exist |
| `INVALID_ID` | Invalid UUID format |
| `MIGRATION_FAILED` | Database migration failed |
| `CREATE_FAILED` | Resource creation failed |
| `DELETE_FAILED` | Resource deletion failed |

---

## Scripting Examples

### Create User and API Key (Bash)

```bash
#!/bin/bash

# Create user
result=$(docker-compose exec -T backend python -m app.cli user create \
  --email agent@mycompany.com \
  --username my-agent \
  --json)

# Extract user ID
user_id=$(echo $result | jq -r '.data.id')
password=$(echo $result | jq -r '.data.generated_password')

echo "User created: $user_id"
echo "Password: $password"

# Create API key
key_result=$(docker-compose exec -T backend python -m app.cli apikey create \
  --user agent@mycompany.com \
  --name "Production Key" \
  --json)

api_key=$(echo $key_result | jq -r '.data.key')

echo "API Key: $api_key"
```

### Health Check Script

```bash
#!/bin/bash

result=$(docker-compose exec -T backend python -m app.cli system health --json)

overall=$(echo $result | jq -r '.data.overall')

if [ "$overall" = "healthy" ]; then
  echo "All services OK"
  exit 0
else
  echo "Services unhealthy!"
  exit 1
fi
```

### PowerShell Example

```powershell
# Create user and get API key
$result = docker-compose exec backend python -m app.cli user create `
  --email agent@mycompany.com `
  --username my-agent `
  --json | ConvertFrom-Json

if ($result.success) {
    Write-Host "User created: $($result.data.email)"
    Write-Host "Password: $($result.data.generated_password)"
}

# Create API key
$keyResult = docker-compose exec backend python -m app.cli apikey create `
  --user agent@mycompany.com `
  --name "Agent Key" `
  --json | ConvertFrom-Json

if ($keyResult.success) {
    $env:KANBOT_API_KEY = $keyResult.data.key
    Write-Host "API Key saved to environment variable"
}
```

---

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
