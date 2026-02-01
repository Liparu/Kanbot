# Multi-Profile Agent Setup Guide

Quick reference for administrators setting up a single agent to manage multiple user profiles.

## Scenario

You have one AI agent (e.g., Claude, GPT-4, custom bot) that needs to:
- Serve multiple people in your organization
- Keep each person's data completely isolated
- Switch between profiles seamlessly
- Maintain audit logs for compliance

## Setup Process

### Step 1: Create User Accounts

Create a separate Kanbot user account for each person the agent will serve:

```bash
# For Alice
docker-compose exec backend python -m app.cli user create \
  --email agent-for-alice@company.com \
  --username "AI Agent (Alice)" \
  --json

# For Bob
docker-compose exec backend python -m app.cli user create \
  --email agent-for-bob@company.com \
  --username "AI Agent (Bob)" \
  --json

# For Charlie
docker-compose exec backend python -m app.cli user create \
  --email agent-for-charlie@company.com \
  --username "AI Agent (Charlie)" \
  --json
```

**Output**: Each command returns a JSON object with user details and a generated password.

### Step 2: Generate API Keys

Generate an API key for each profile:

```bash
# Alice's API key
docker-compose exec backend python -m app.cli apikey create \
  --user agent-for-alice@company.com \
  --name "Alice Agent Key" \
  --json

# Bob's API key
docker-compose exec backend python -m app.cli apikey create \
  --user agent-for-bob@company.com \
  --name "Bob Agent Key" \
  --json

# Charlie's API key
docker-compose exec backend python -m app.cli apikey create \
  --user agent-for-charlie@company.com \
  --name "Charlie Agent Key" \
  --json
```

**Important**: Save the API keys immediately - they are only shown once!

Example output:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Alice Agent Key",
    "key": "kb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
    "user_email": "agent-for-alice@company.com",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Step 3: Store Credentials Securely

Choose one of these methods:

#### Option A: Environment Variables (Development/Testing)

Create a `.env.agent` file:

```bash
KANBOT_API_URL=http://localhost:8000
KANBOT_ALICE_KEY=kb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
KANBOT_BOB_KEY=kb_x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0
KANBOT_CHARLIE_KEY=kb_m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0
```

**Do not commit this file to version control!**

#### Option B: AWS Secrets Manager (Production)

```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name kanbot/agent-profiles/alice \
  --secret-string "kb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"

aws secretsmanager create-secret \
  --name kanbot/agent-profiles/bob \
  --secret-string "kb_x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0"

aws secretsmanager create-secret \
  --name kanbot/agent-profiles/charlie \
  --secret-string "kb_m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0"
```

#### Option C: HashiCorp Vault (Production)

```bash
# Store secrets in Vault
vault kv put secret/kanbot/agent-profiles/alice \
  api_key=kb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0

vault kv put secret/kanbot/agent-profiles/bob \
  api_key=kb_x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0

vault kv put secret/kanbot/agent-profiles/charlie \
  api_key=kb_m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0
```

### Step 4: Configure Agent Application

Provide the agent application with profile information. Example configuration:

```json
{
  "kanbot_url": "http://localhost:8000",
  "profiles": [
    {
      "id": "alice",
      "email": "agent-for-alice@company.com",
      "api_key": "kb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
    },
    {
      "id": "bob",
      "email": "agent-for-bob@company.com",
      "api_key": "kb_x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0"
    },
    {
      "id": "charlie",
      "email": "agent-for-charlie@company.com",
      "api_key": "kb_m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0"
    }
  ]
}
```

**Encrypt this configuration file!** See [agent-integration.md](agent-integration.md#step-3-store-credentials-securely) for encryption examples.

## Verification

### Automated Verification Script

Use the provided verification script to test your setup:

```bash
# Create config file for verification
cat > verify_config.json << EOF
{
  "kanbot_url": "http://localhost:8000",
  "profiles": [
    {
      "id": "alice",
      "email": "agent-for-alice@company.com",
      "api_key": "kb_a1b2c3..."
    },
    {
      "id": "bob",
      "email": "agent-for-bob@company.com",
      "api_key": "kb_x1y2z3..."
    }
  ]
}
EOF

# Run verification
python scripts/verify_multiprofile.py --config verify_config.json
```

The script checks:
- ✅ API connectivity
- ✅ API key authentication
- ✅ Profile isolation (each profile only sees their data)
- ✅ Profile uniqueness (no duplicate keys/emails)
- ✅ Security headers

### Manual Verification

### Test Profile Isolation

```bash
# Test Alice's profile
curl -H "X-API-Key: kb_a1b2c3..." http://localhost:8000/api/v1/spaces
# Should return only Alice's spaces

# Test Bob's profile
curl -H "X-API-Key: kb_x1y2z3..." http://localhost:8000/api/v1/spaces
# Should return only Bob's spaces

# Test cross-access (should fail)
curl -H "X-API-Key: kb_a1b2c3..." http://localhost:8000/api/v1/spaces/{bobs-space-id}
# Should return 403 Forbidden
```

### Verify API Keys

```bash
# List all API keys (as admin)
docker-compose exec backend python -m app.cli apikey list --json

# Check specific user's keys
docker-compose exec backend python -m app.cli apikey list \
  --user agent-for-alice@company.com \
  --json
```

## Management Commands

### Add New Profile

```bash
# Create user
docker-compose exec backend python -m app.cli user create \
  --email agent-for-david@company.com \
  --username "AI Agent (David)" \
  --json

# Generate API key
docker-compose exec backend python -m app.cli apikey create \
  --user agent-for-david@company.com \
  --name "David Agent Key" \
  --json

# Update agent configuration with new profile
```

### Revoke Profile Access

```bash
# List keys for the profile
docker-compose exec backend python -m app.cli apikey list \
  --user agent-for-alice@company.com \
  --json

# Revoke the key
docker-compose exec backend python -m app.cli apikey revoke <key-id>

# Optionally ban the user account
docker-compose exec backend python -m app.cli user ban agent-for-alice@company.com
```

### Rotate API Keys

```bash
# Generate new key
docker-compose exec backend python -m app.cli apikey create \
  --user agent-for-alice@company.com \
  --name "Alice Agent Key (Rotated)" \
  --json

# Update agent configuration with new key
# Test new key works
# Revoke old key
docker-compose exec backend python -m app.cli apikey revoke <old-key-id>
```

## Security Best Practices

### 1. Principle of Least Privilege

Each profile should only be a member of spaces they need access to:

```bash
# Don't make profile users admins unless absolutely necessary
# They should only access spaces they're explicitly added to
```

### 2. Regular Key Rotation

Rotate API keys periodically:

```bash
# Schedule: Every 90 days
# 1. Generate new key
# 2. Update agent config
# 3. Test
# 4. Revoke old key
```

### 3. Monitor Agent Activity

Review audit logs regularly:

```bash
# Check admin statistics
docker-compose exec backend python -m app.cli system stats --json

# Review user activity in admin dashboard
# Monitor for unusual patterns
```

### 4. Secure Credential Storage

- **Never** commit API keys to version control
- Use secret management systems in production
- Encrypt configuration files at rest
- Restrict file permissions: `chmod 600 agent_config.json`

### 5. Network Security

```bash
# Use HTTPS in production
KANBOT_API_URL=https://kanbot.company.com

# Restrict API access by IP if possible (in nginx/firewall)
# Example nginx config:
# location /api/ {
#     allow 10.0.1.0/24;  # Agent server subnet
#     deny all;
# }
```

## Troubleshooting

### Profile Can Access Another User's Data

**Symptom**: Alice's profile can see Bob's spaces

**Diagnosis**:
```bash
# Check space memberships
docker-compose exec backend python -m app.cli space list --json | jq '.data.spaces[] | select(.name=="Bobs Space") | .members'
```

**Fix**: Remove Alice from Bob's space if mistakenly added

### API Key Not Working

**Symptom**: 401 Unauthorized errors

**Diagnosis**:
```bash
# Verify key exists and is active
docker-compose exec backend python -m app.cli apikey list --json | grep "kb_a1b2c3"
```

**Fix**: 
- Check key hasn't been revoked
- Verify key format (should start with `kb_`)
- Check key wasn't truncated when copying

### Agent Mixing Up Profiles

**Symptom**: Data appearing in wrong user's spaces

**Diagnosis**: Review agent application code

**Fix**: 
- Ensure explicit `switch_profile()` calls
- Use context managers
- Add logging for profile switches
- Review agent-integration.md for safe implementation patterns

### Rate Limiting

**Symptom**: 429 Too Many Requests errors

**Diagnosis**: Check rate limit headers in responses

**Fix**:
- Implement exponential backoff in agent code
- Contact admin to increase rate limits if legitimate usage
- Review [agent-integration.md](agent-integration.md#4-handle-rate-limits-gracefully) for implementation

## Monitoring Dashboard

### Key Metrics to Track

1. **Profile Activity**
   - Requests per profile per day
   - Failed authentication attempts
   - API key usage patterns

2. **Data Isolation**
   - Cross-profile access attempts (should be 0)
   - Space membership changes
   - Permission errors (403s)

3. **Performance**
   - Average response time per profile
   - Rate limit hits
   - Error rates

### Admin Dashboard

Access the admin dashboard at: `http://localhost/settings` (as admin user)

- View all users
- Monitor system statistics
- Review API key usage
- Check system health

## Support

For detailed implementation examples and code samples, see:
- [Agent Integration Guide](agent-integration.md#multi-profile-agent-workflow)
- [API Reference](api-reference.md)
- [CLI Reference](cli-reference.md)

## Summary Checklist

- [ ] Created user accounts for each profile
- [ ] Generated API keys for each profile
- [ ] Stored credentials securely (secret manager or encrypted)
- [ ] Configured agent application with profiles
- [ ] Tested profile isolation (each profile can only see their data)
- [ ] Verified API keys work
- [ ] Set up monitoring/audit logging
- [ ] Documented key rotation schedule
- [ ] Restricted network access (production)
- [ ] Reviewed security best practices
