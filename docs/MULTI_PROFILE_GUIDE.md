# Multi-Profile Agent Feature - Complete Guide

## Overview

Kanbot now supports **multi-profile agent workflows**, enabling a single physical AI agent to safely serve multiple users while maintaining strict data isolation. This feature is essential for organizations where one agent (e.g., Claude, GPT-4) needs to manage tasks for multiple people.

## What Problem Does This Solve?

### Scenario: One Agent, Multiple Users

**Before**: Organizations had to either:
- Deploy separate agent instances for each user (expensive, complex)
- Share one user account across multiple people (security risk, no isolation)
- Manually switch credentials (error-prone, no audit trail)

**After**: With multi-profile support:
- ✅ One agent instance serves multiple users
- ✅ Complete data isolation between profiles
- ✅ Seamless profile switching with audit logging
- ✅ No risk of cross-contamination
- ✅ Secure credential management

## Architecture

```
Physical Agent (Single Instance)
├── Profile: Alice
│   ├── API Key: kb_alice_...
│   └── Spaces: Alice's data only
├── Profile: Bob
│   ├── API Key: kb_bob_...
│   └── Spaces: Bob's data only
└── Profile: Charlie
    ├── API Key: kb_charlie_...
    └── Spaces: Charlie's data only
```

Each profile:
- Has its own user account in Kanbot
- Has a unique API key
- Can only access spaces they own or are members of
- Cannot see other profiles' data

## Quick Start

### For Administrators

**Step 1**: Create user accounts for each person the agent will serve

```bash
docker-compose exec backend python -m app.cli user create \
  --email agent-for-alice@company.com \
  --username "AI Agent (Alice)" \
  --json
```

**Step 2**: Generate API keys

```bash
docker-compose exec backend python -m app.cli apikey create \
  --user agent-for-alice@company.com \
  --name "Alice Agent Key" \
  --json
```

**Step 3**: Store credentials securely (secret manager, encrypted file, etc.)

**Step 4**: Provide configuration to agent application

See [multi-profile-setup.md](multi-profile-setup.md) for detailed instructions.

### For Developers

**Implementation**: Use the `MultiProfileKanbotAgent` class

```python
from multi_profile_agent import MultiProfileKanbotAgent

# Initialize
agent = MultiProfileKanbotAgent("http://localhost:8000")

# Register profiles
agent.register_profile("alice", "alice@company.com", "kb_alice_...")
agent.register_profile("bob", "bob@company.com", "kb_bob_...")

# Work for Alice
agent.switch_profile("alice")
agent.create_card(space_id="...", title="Task for Alice")

# Work for Bob
agent.switch_profile("bob")
agent.create_card(space_id="...", title="Task for Bob")

# Verify isolation
alice_report = agent.verify_profile_isolation("alice")
print(alice_report)  # Only Alice's spaces
```

See [agent-integration.md#multi-profile-agent-workflow](agent-integration.md#multi-profile-agent-workflow) for complete implementation.

## Key Features

### 1. Strict Data Isolation

- **Multiple Security Layers**:
  - Agent code: Explicit profile switching
  - API keys: Each profile has unique key
  - Backend: Authorization checks on every request
  - Database: User ID enforcement

- **No Cross-Contamination**: Profile A cannot access Profile B's data, even accidentally

### 2. Seamless Profile Switching

```python
# Safe switching with context managers
with profile_context(agent, "alice"):
    agent.create_card(...)  # Creates in Alice's space

with profile_context(agent, "bob"):
    agent.create_card(...)  # Creates in Bob's space

# Original profile automatically restored
```

### 3. Comprehensive Audit Logging

Every action is logged:
- Profile switches
- API requests
- Errors and failures

```python
# Export audit log for compliance
agent.export_audit_log("audit.json")

# Review specific profile's activity
alice_log = agent.get_audit_log("alice")
```

### 4. Rate Limiting Per Profile

Each profile has its own rate limit quota - prevents one user from affecting others.

### 5. Secure Credential Management

Multiple storage options:
- **Development**: Environment variables
- **Production**: AWS Secrets Manager, HashiCorp Vault
- **Self-Hosted**: Encrypted configuration files

## Documentation Structure

We've created comprehensive documentation to support this feature:

### 1. [multi-profile-setup.md](multi-profile-setup.md)
**For**: System administrators
**Contents**:
- Quick setup process
- Credential storage options
- Management commands
- Security best practices
- Troubleshooting

### 2. [agent-integration.md](agent-integration.md#multi-profile-agent-workflow)
**For**: Developers implementing agents
**Contents**:
- Complete Python implementation
- MultiProfileKanbotAgent class
- Safety best practices
- Workflow examples
- Code samples

### 3. [multi-profile-architecture.md](multi-profile-architecture.md)
**For**: Technical understanding
**Contents**:
- Architecture diagrams
- Request flow visualization
- Security boundaries
- Attack vector prevention
- Monitoring guidelines

### 4. [deployment.md](deployment.md#agent-setup)
**For**: Deployment engineers
**Contents**:
- Agent setup in production
- Multi-profile deployment
- Integration with existing infrastructure

### 5. [README.md](../README.md#multi-profile-agent-support)
**For**: Quick overview
**Contents**:
- Feature introduction
- Quick example
- Links to detailed docs

## CLI Commands

We've implemented powerful CLI commands for managing multi-profile agents:

### User Management

```bash
# Create user
kanbot user create --email user@example.com --username john --json

# List users
kanbot user list --json

# Ban/unban
kanbot user ban user@example.com
kanbot user unban user@example.com

# Set admin
kanbot user set-admin user@example.com
```

### API Key Management

```bash
# Create API key
kanbot apikey create --user user@example.com --name "My Key" --json

# List keys
kanbot apikey list --user user@example.com --json

# Revoke key
kanbot apikey revoke <key-id>
```

### System Utilities

```bash
# Check system health
kanbot system health --json

# View statistics
kanbot system stats --json

# Database operations
kanbot db migrate
kanbot db seed
```

All commands support `--json` flag for programmatic access.

## Security Features

### Defense in Depth

1. **Agent Code Level**
   - Explicit profile switching (no automatic inference)
   - Context managers prevent leakage
   - Audit logging for all operations

2. **API Level**
   - Unique API keys per profile
   - API key validation on every request
   - Rate limiting per profile

3. **Backend Level**
   - Authorization checks for all resources
   - Space membership verification
   - User ID enforcement

4. **Database Level**
   - Foreign key constraints
   - User ID on all records
   - Cascading deletes preserve integrity

### Security Checklist

When setting up multi-profile agents:

- [ ] API keys stored in secret manager (not code/env files)
- [ ] Logging sanitizes API keys (never log credentials)
- [ ] Profile switching is always explicit
- [ ] Space access verified before operations
- [ ] Audit trail enabled
- [ ] Rate limiting configured per profile
- [ ] Context managers used to prevent profile leakage
- [ ] Credentials never committed to version control
- [ ] Regular audit log reviews scheduled
- [ ] Minimum permissions for each profile

## Verification

### Automated Verification Script

We provide a verification script to test your setup:

```bash
# Create config
cat > verify_config.json << EOF
{
  "kanbot_url": "http://localhost:8000",
  "profiles": [
    {"id": "alice", "email": "alice@company.com", "api_key": "kb_alice_..."},
    {"id": "bob", "email": "bob@company.com", "api_key": "kb_bob_..."}
  ]
}
EOF

# Run verification
python scripts/verify_multiprofile.py --config verify_config.json
```

The script checks:
- ✅ API connectivity
- ✅ Authentication for each profile
- ✅ Data isolation (no cross-profile access)
- ✅ Unique keys and emails
- ✅ Security headers

## Use Cases

### 1. Personal Assistant for Multiple Executives

```python
# One agent manages calendars for 3 executives
agent.register_profile("ceo", "ceo@company.com", "kb_ceo_...")
agent.register_profile("cto", "cto@company.com", "kb_cto_...")
agent.register_profile("cfo", "cfo@company.com", "kb_cfo_...")

# Morning briefing for each
for profile in ["ceo", "cto", "cfo"]:
    agent.switch_profile(profile)
    tasks = agent.get_todays_tasks()
    send_email(profile, f"You have {len(tasks)} tasks today")
```

### 2. Customer Support Bot

```python
# One agent handles support for multiple clients
for client_id in active_clients:
    agent.switch_profile(client_id)
    
    # Check for new tickets
    tickets = agent.get_new_tickets()
    
    # Process each ticket
    for ticket in tickets:
        agent.add_comment(ticket['id'], "Working on your request...")
```

### 3. Team Collaboration

```python
# Agent coordinates between team members
agent.switch_profile("project_manager")
pm_tasks = agent.get_pending_tasks()

agent.switch_profile("developer")
dev_tasks = agent.get_pending_tasks()

# Generate status report without mixing data
report = {
    "pm": {"pending": len(pm_tasks)},
    "dev": {"pending": len(dev_tasks)}
}
```

## Monitoring

### Admin Dashboard

Access at: `http://localhost/settings` (admin only)

View:
- Total users and active profiles
- API key usage statistics
- Failed authentication attempts
- Cross-profile access attempts (should be 0)
- Rate limit hits

### Audit Logs

```python
# Export for compliance
agent.export_audit_log("audit_2024_01.json")

# Review specific profile
alice_log = agent.get_audit_log("alice")
for entry in alice_log:
    print(f"{entry['timestamp']}: {entry['action']}")
```

## Best Practices

### 1. Credential Management

- **Production**: Use AWS Secrets Manager, HashiCorp Vault, or equivalent
- **Development**: Environment variables (never commit to git)
- **Rotation**: Rotate API keys every 90 days

### 2. Profile Isolation

- **Always use context managers** to prevent profile leakage
- **Verify space access** before operations
- **Log all profile switches** for audit trail

### 3. Error Handling

- **Fail secure**: Default to denying access
- **Log errors** for debugging
- **Graceful degradation**: Don't expose error details to users

### 4. Performance

- **Cache profile data** (but not credentials)
- **Batch operations** when possible
- **Respect rate limits** with exponential backoff

### 5. Compliance

- **Regular audit reviews** (weekly recommended)
- **Document all profiles** in your inventory
- **Alert on anomalies** (failed auth, cross-profile attempts)

## Troubleshooting

### Profile Can Access Another User's Data

**Diagnosis**:
```bash
docker-compose exec backend python -m app.cli space list --json
# Check space memberships
```

**Fix**: Remove profile from spaces they shouldn't access

### API Key Not Working

**Diagnosis**:
```bash
docker-compose exec backend python -m app.cli apikey list --json
# Verify key exists and is active
```

**Fix**: Check key hasn't been revoked, regenerate if needed

### Agent Mixing Up Profiles

**Diagnosis**: Review agent code for missing `switch_profile()` calls

**Fix**: 
- Use context managers for all profile operations
- Add logging to track profile switches
- Review audit log for unexpected switches

## Migration Guide

### Migrating from Single-Profile to Multi-Profile

**Step 1**: Identify current agent's user account

```bash
# Check current user
curl -H "X-API-Key: existing_key" http://localhost:8000/api/v1/users/me
```

**Step 2**: Create additional profiles for other users

```bash
docker-compose exec backend python -m app.cli user create \
  --email agent-for-bob@company.com --json

docker-compose exec backend python -m app.cli apikey create \
  --user agent-for-bob@company.com --json
```

**Step 3**: Update agent code to use MultiProfileKanbotAgent

```python
# Old code
agent = KanbotAgent(base_url, api_key)

# New code
agent = MultiProfileKanbotAgent(base_url)
agent.register_profile("alice", "alice@company.com", alice_key)
agent.register_profile("bob", "bob@company.com", bob_key)
agent.switch_profile("alice")  # Explicit profile selection
```

**Step 4**: Test thoroughly in staging environment

**Step 5**: Deploy to production with monitoring

## Support

### Getting Help

- **Setup Issues**: See [multi-profile-setup.md#troubleshooting](multi-profile-setup.md#troubleshooting)
- **Implementation Help**: See [agent-integration.md](agent-integration.md#multi-profile-agent-workflow)
- **Architecture Questions**: See [multi-profile-architecture.md](multi-profile-architecture.md)

### Reporting Issues

When reporting issues, include:
- Kanbot version
- Number of profiles
- Error messages
- Relevant audit log entries
- Steps to reproduce

## Summary

The multi-profile agent feature enables:

✅ **One agent, multiple users** - Single instance serves entire organization  
✅ **Complete isolation** - No risk of data leakage between profiles  
✅ **Seamless switching** - Context managers make it easy and safe  
✅ **Full audit trail** - Compliance-ready logging  
✅ **Production-ready** - Secure credential management  
✅ **Easy to setup** - CLI commands and verification scripts  

This feature makes Kanbot truly enterprise-ready for AI agent deployments.

---

## Next Steps

1. **For Administrators**: Start with [multi-profile-setup.md](multi-profile-setup.md)
2. **For Developers**: Review [agent-integration.md#multi-profile-agent-workflow](agent-integration.md#multi-profile-agent-workflow)
3. **For Architects**: Study [multi-profile-architecture.md](multi-profile-architecture.md)
4. **For DevOps**: Check [deployment.md#agent-setup](deployment.md#agent-setup)

**Ready to get started?** Follow the [Quick Start](#quick-start) guide above!
