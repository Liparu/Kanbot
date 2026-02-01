# Multi-Profile Agent Architecture

Visual reference for understanding how a single agent safely manages multiple user profiles in Kanbot.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Physical AI Agent                             │
│                    (e.g., Claude, GPT-4, Custom Bot)                 │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Multi-Profile Agent Class                   │ │
│  │                                                                │ │
│  │  • Profile Registry                                            │ │
│  │  • Current Profile State                                       │ │
│  │  • Audit Logger                                                │ │
│  │  • Request Manager                                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Alice Profile│  │  Bob Profile │  │Charlie Profile│              │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤              │
│  │ Email        │  │ Email        │  │ Email        │              │
│  │ API Key      │  │ API Key      │  │ API Key      │              │
│  │ Context      │  │ Context      │  │ Context      │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│         │                  │                  │                       │
└─────────┼──────────────────┼──────────────────┼───────────────────────┘
          │                  │                  │
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Kanbot Backend API                           │
│                    (with Strict Access Control)                      │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Authentication Layer                          ││
│  │  • Validates API Key                                             ││
│  │  • Maps Key → User                                               ││
│  │  • Enforces Permissions                                          ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐       │
│  │  Alice's Spaces │ │   Bob's Spaces  │ │ Charlie's Spaces│       │
│  ├─────────────────┤ ├─────────────────┤ ├─────────────────┤       │
│  │ • Personal      │ │ • Work Projects │ │ • Home Tasks    │       │
│  │ • Team Alpha    │ │ • Team Beta     │ │ • Planning      │       │
│  │                 │ │                 │ │                 │       │
│  │ Cards, Tags,    │ │ Cards, Tags,    │ │ Cards, Tags,    │       │
│  │ Comments, etc.  │ │ Comments, etc.  │ │ Comments, etc.  │       │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘       │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
           │                       │                       │
           ▼                       ▼                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL Database                          │
│                      (Data Isolation by User ID)                     │
└──────────────────────────────────────────────────────────────────────┘
```

## Request Flow

### Scenario: Agent Creates Task for Alice

```
1. Agent Code
   ┌─────────────────────────────────────────────────────────┐
   │ agent.switch_profile("alice")                           │
   │ agent.create_card(                                      │
   │     space_id="alice-workspace-uuid",                    │
   │     title="Task for Alice"                              │
   │ )                                                        │
   └─────────────────────────────────────────────────────────┘
                            │
                            ▼
2. Profile Manager
   ┌─────────────────────────────────────────────────────────┐
   │ • Set current_profile = "alice"                         │
   │ • Get API key: kb_alice_xxxx...                         │
   │ • Log: profile_switched → alice                         │
   └─────────────────────────────────────────────────────────┘
                            │
                            ▼
3. HTTP Request
   ┌─────────────────────────────────────────────────────────┐
   │ POST /api/v1/cards                                      │
   │ Headers:                                                │
   │   X-API-Key: kb_alice_xxxx...                           │
   │   Content-Type: application/json                        │
   │ Body:                                                   │
   │   { "title": "Task for Alice", ... }                    │
   └─────────────────────────────────────────────────────────┘
                            │
                            ▼
4. Backend Authentication
   ┌─────────────────────────────────────────────────────────┐
   │ • Validate API key                                      │
   │ • Lookup User: alice@company.com                        │
   │ • Set request.user = Alice                              │
   └─────────────────────────────────────────────────────────┘
                            │
                            ▼
5. Authorization Check
   ┌─────────────────────────────────────────────────────────┐
   │ • Verify Alice owns/member of target space              │
   │ • Check Alice has write permissions                     │
   │ • Rate limit: Check Alice's quota                       │
   └─────────────────────────────────────────────────────────┘
                            │
                            ▼
6. Database Write
   ┌─────────────────────────────────────────────────────────┐
   │ INSERT INTO cards (                                     │
   │   id, title, space_id,                                  │
   │   created_by_id = alice_user_id,                        │
   │   ...                                                   │
   │ )                                                        │
   └─────────────────────────────────────────────────────────┘
                            │
                            ▼
7. Response
   ┌─────────────────────────────────────────────────────────┐
   │ 201 Created                                             │
   │ { "id": "card-uuid", "title": "Task for Alice", ... }   │
   └─────────────────────────────────────────────────────────┘
                            │
                            ▼
8. Agent Audit Log
   ┌─────────────────────────────────────────────────────────┐
   │ {                                                       │
   │   "timestamp": "2024-01-15T10:30:00Z",                  │
   │   "profile": "alice",                                   │
   │   "action": "api_request",                              │
   │   "details": {                                          │
   │     "method": "POST",                                   │
   │     "endpoint": "/api/v1/cards"                         │
   │   }                                                     │
   │ }                                                        │
   └─────────────────────────────────────────────────────────┘
```

## Security Boundaries

### Isolation Layers

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: Agent Code                                             │
│ • Profile switching must be explicit                            │
│ • Context managers enforce isolation                            │
│ • Audit logging tracks all switches                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: API Keys                                               │
│ • Each profile has unique API key                               │
│ • Keys are tied to specific user accounts                       │
│ • Key rotation doesn't affect other profiles                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: Backend Authorization                                  │
│ • Every request validates user identity                         │
│ • Space membership checked before access                        │
│ • Rate limits applied per-user                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 4: Database                                               │
│ • Rows are owned by user_id                                     │
│ • Foreign keys enforce relationships                            │
│ • Cascading deletes preserve integrity                          │
└─────────────────────────────────────────────────────────────────┘
```

### Attack Vector Prevention

```
┌───────────────────────────┬──────────────────────────────────────┐
│ Attack Vector             │ Prevention Mechanism                 │
├───────────────────────────┼──────────────────────────────────────┤
│ Profile Cross-Contamination│                                     │
│ (Agent uses wrong profile)│ • Explicit profile switching         │
│                           │ • Context managers auto-restore      │
│                           │ • Audit log tracks switches          │
├───────────────────────────┼──────────────────────────────────────┤
│ API Key Leakage           │ • Keys stored in secret manager      │
│                           │ • Log sanitization filters           │
│                           │ • Never committed to git             │
├───────────────────────────┼──────────────────────────────────────┤
│ Unauthorized Access       │ • Every request validates API key    │
│ (Access other's data)     │ • Space membership checked           │
│                           │ • Database enforces user_id          │
├───────────────────────────┼──────────────────────────────────────┤
│ Credential Theft          │ • TLS encryption in transit          │
│                           │ • Encrypted storage at rest          │
│                           │ • Key rotation policy                │
├───────────────────────────┼──────────────────────────────────────┤
│ Rate Limit Bypass         │ • Per-profile rate limiting          │
│                           │ • Separate quota tracking            │
│                           │ • IP-based fallback                  │
├───────────────────────────┼──────────────────────────────────────┤
│ Replay Attacks            │ • HTTPS only in production           │
│                           │ • Rate limiting prevents abuse       │
│                           │ • Audit log detects anomalies        │
└───────────────────────────┴──────────────────────────────────────┘
```

## Data Flow Example: Morning Briefing

```
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Scheduler                            │
│                   (Cron: Daily at 8:00 AM)                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              generate_daily_briefings(agent)                    │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ with profile  │   │ with profile  │   │ with profile  │
│   ("alice")   │   │    ("bob")    │   │  ("charlie")  │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│GET /spaces    │   │GET /spaces    │   │GET /spaces    │
│(Alice's key)  │   │(Bob's key)    │   │(Charlie's key)│
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│Alice's spaces │   │Bob's spaces   │   │Charlie's spaces│
│• Personal     │   │• Work Projects│   │• Home Tasks   │
│• Team Alpha   │   │• Team Beta    │   │• Planning     │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Aggregate Results                            │
│  {                                                              │
│    "alice": { spaces: 2, tasks_today: 5 },                     │
│    "bob": { spaces: 2, tasks_today: 3 },                       │
│    "charlie": { spaces: 2, tasks_today: 7 }                    │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Email to      │   │ Email to      │   │ Email to      │
│ Alice         │   │ Bob           │   │ Charlie       │
│ "5 tasks"     │   │ "3 tasks"     │   │ "7 tasks"     │
└───────────────┘   └───────────────┘   └───────────────┘
```

## Credential Storage Architecture

### Development Environment

```
┌─────────────────────────────────────────────────────────────┐
│                    .env.agent (local file)                  │
│                                                             │
│  KANBOT_API_URL=http://localhost:8000                       │
│  KANBOT_ALICE_KEY=kb_alice_xxxx...                          │
│  KANBOT_BOB_KEY=kb_bob_yyyy...                              │
│  KANBOT_CHARLIE_KEY=kb_charlie_zzzz...                      │
│                                                             │
│  ⚠️  chmod 600 .env.agent                                   │
│  ⚠️  Add to .gitignore                                      │
└─────────────────────────────────────────────────────────────┘
```

### Production Environment

```
┌────────────────────────────────────────────────────────────┐
│               Secret Management Service                     │
│         (AWS Secrets Manager, HashiCorp Vault)             │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ kanbot/agent-profiles/alice                          │ │
│  │   value: kb_alice_xxxx...                            │ │
│  │   encrypted: yes                                     │ │
│  │   rotation: 90 days                                  │ │
│  │   access_policy: agent-service-role                  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ kanbot/agent-profiles/bob                            │ │
│  │   value: kb_bob_yyyy...                              │ │
│  │   encrypted: yes                                     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ kanbot/agent-profiles/charlie                        │ │
│  │   value: kb_charlie_zzzz...                          │ │
│  │   encrypted: yes                                     │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
                       │
                       │ TLS
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│                  Agent Application                         │
│                                                            │
│  • Fetches keys on startup                                │
│  • Caches in memory (encrypted)                           │
│  • Never logs keys                                        │
│  • Refreshes periodically                                 │
└────────────────────────────────────────────────────────────┘
```

## Monitoring Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│                      Admin Dashboard                             │
│                    /settings (Admin view)                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ System Statistics                                          │ │
│  │ • Total Users: 15                                          │ │
│  │ • Active Agent Profiles: 3 (Alice, Bob, Charlie)           │ │
│  │ • Total Spaces: 42                                         │ │
│  │ • Cards Created Today: 23                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ API Key Activity (Last 24h)                                │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ Alice's Key    │ 145 requests │ 0 errors  │ Last: 2m ago  │ │
│  │ Bob's Key      │ 89 requests  │ 0 errors  │ Last: 5m ago  │ │
│  │ Charlie's Key  │ 234 requests │ 2 errors  │ Last: 1m ago  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Security Alerts                                            │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ ⚠️  Charlie's Key: 2 rate limit hits in last hour          │ │
│  │ ✓  No failed authentication attempts                       │ │
│  │ ✓  No cross-profile access attempts                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Summary

### Key Principles

1. **Strict Isolation**: Each profile operates independently with its own credentials
2. **Explicit Switching**: Profile changes are always explicit, never automatic
3. **Audit Everything**: All operations logged for compliance and debugging
4. **Fail Secure**: Default to denying access rather than granting it
5. **Defense in Depth**: Multiple layers of security (agent code, API keys, backend auth, database)

### Files to Reference

- [Multi-Profile Setup Guide](multi-profile-setup.md) - Administrator quick start
- [Agent Integration Guide](agent-integration.md) - Full implementation guide
- [API Reference](api-reference.md) - REST API documentation
- [CLI Reference](cli-reference.md) - Command-line tools

### Quick Links

- Setup: See [multi-profile-setup.md](multi-profile-setup.md)
- Code: See [agent-integration.md#complete-multi-profile-agent-class](agent-integration.md#complete-multi-profile-agent-class)
- Security: See [agent-integration.md#security-checklist](agent-integration.md#security-checklist)
- Troubleshooting: See [multi-profile-setup.md#troubleshooting](multi-profile-setup.md#troubleshooting)
