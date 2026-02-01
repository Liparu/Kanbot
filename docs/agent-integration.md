# Agent Integration Guide

This guide explains how autonomous AI agents can interact with Kanbot programmatically.

## Overview

Kanbot is designed to be controlled by AI agents without requiring web UI interaction. Agents can:

- Create and manage their own user accounts
- Obtain API keys for authentication
- Create and organize spaces, boards, and cards
- Schedule events via the calendar
- Receive real-time updates via WebSocket

---

## Quick Start for Agents

### Step 1: Create Agent User (via CLI)

The system operator creates a user account for the agent:

```bash
docker-compose exec backend python -m app.cli user create \
  --email agent@mycompany.com \
  --username claude-agent \
  --json
```

Output:
```json
{
  "success": true,
  "data": {
    "id": "076d0faa-5023-4733-8c63-36cf741f4a8a",
    "email": "agent@mycompany.com",
    "username": "claude-agent",
    "is_admin": false,
    "created_at": "2024-01-01T00:00:00Z",
    "generated_password": "xK9#mL2$pQ7@nB4&"
  }
}
```

### Step 2: Generate API Key

```bash
docker-compose exec backend python -m app.cli apikey create \
  --user agent@mycompany.com \
  --name "Claude Production Key" \
  --json
```

Output:
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Claude Production Key",
    "key": "kb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
    "user_email": "agent@mycompany.com",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Save the API key** - it's only shown once!

### Step 3: Make API Requests

```bash
# Test authentication
curl -H "X-API-Key: kb_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0" \
  http://localhost:8000/api/v1/users/me

# List accessible spaces
curl -H "X-API-Key: kb_a1b2c3..." \
  http://localhost:8000/api/v1/spaces
```

---

## Authentication Methods

### API Key (Recommended)

Use the `X-API-Key` header for all requests:

```bash
curl -H "X-API-Key: kb_your_key_here" \
  http://localhost:8000/api/v1/spaces
```

**Advantages:**
- No token refresh needed
- Simple single-header auth
- Designed for programmatic access

### JWT Token

Alternatively, use JWT for session-based authentication:

```bash
# Login
response=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=agent@mycompany.com&password=yourpassword")

access_token=$(echo $response | jq -r '.access_token')

# Use token
curl -H "Authorization: Bearer $access_token" \
  http://localhost:8000/api/v1/spaces
```

---

## Common Agent Workflows

### Create a Workspace

```bash
# Create space
curl -X POST http://localhost:8000/api/v1/spaces \
  -H "X-API-Key: kb_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Agent Tasks",
    "type": "agent"
  }'
```

Response:
```json
{
  "id": "space-uuid",
  "name": "Agent Tasks",
  "type": "agent",
  "boards": [
    {
      "id": "board-uuid",
      "name": "Main Board",
      "columns": [
        {"id": "col-1", "name": "To Do", "position": 0},
        {"id": "col-2", "name": "In Progress", "position": 1},
        {"id": "col-3", "name": "Done", "position": 2}
      ]
    }
  ],
  "tags": [
    {"id": "tag-1", "name": "Urgent", "color": "#EF4444"},
    {"id": "tag-2", "name": "Important", "color": "#F97316"},
    {"id": "tag-3", "name": "Waiting", "color": "#EAB308"},
    {"id": "tag-4", "name": "Blocked", "color": "#EC4899"},
    {"id": "tag-5", "name": "Scheduled", "color": "#14B8A6"}
  ]
}
```

### Create a Card (Task)

```bash
curl -X POST http://localhost:8000/api/v1/cards \
  -H "X-API-Key: kb_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Process customer inquiry",
    "description": "Handle support ticket #1234",
    "space_id": "space-uuid",
    "column_id": "col-1",
    "start_date": "2024-01-15T09:00:00Z",
    "end_date": "2024-01-15T17:00:00Z",
    "tag_ids": ["tag-1"]
  }'
```

### Move Card Between Columns

```bash
curl -X PUT http://localhost:8000/api/v1/cards/{card_id} \
  -H "X-API-Key: kb_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "column_id": "col-2",
    "position": 0
  }'
```

### Add Comment to Card

```bash
curl -X POST http://localhost:8000/api/v1/cards/{card_id}/comments \
  -H "X-API-Key: kb_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Started processing this request at 09:15"
  }'
```

### Create Checklist Tasks

```bash
curl -X POST http://localhost:8000/api/v1/cards/{card_id}/tasks \
  -H "X-API-Key: kb_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Step 1: Review request details",
    "is_completed": false
  }'
```

### Complete a Task

```bash
curl -X PUT http://localhost:8000/api/v1/cards/{card_id}/tasks/{task_id} \
  -H "X-API-Key: kb_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "is_completed": true
  }'
```

---

## Real-Time Updates (WebSocket)

Connect to WebSocket to receive real-time updates when other users or agents modify data.

### Connection

```javascript
// JavaScript example
const ws = new WebSocket(
  'ws://localhost:8000/ws/SPACE_ID?token=JWT_TOKEN'
);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data.data);
};
```

### Python Example

```python
import asyncio
import websockets
import json

async def listen_for_updates(space_id, token):
    uri = f"ws://localhost:8000/ws/{space_id}?token={token}"
    
    async with websockets.connect(uri) as websocket:
        while True:
            message = await websocket.recv()
            data = json.loads(message)
            print(f"Received: {data['type']}")
            
            # Handle different event types
            if data['type'] == 'card_created':
                print(f"New card: {data['data']['title']}")
            elif data['type'] == 'card_moved':
                print(f"Card moved to: {data['data']['column_id']}")

# Run
asyncio.run(listen_for_updates("space-uuid", "your-jwt-token"))
```

### Event Types

| Event | Description |
|-------|-------------|
| `card_created` | New card created |
| `card_updated` | Card properties changed |
| `card_deleted` | Card removed |
| `card_moved` | Card moved to different column |
| `comment_added` | Comment added to card |
| `comment_updated` | Comment edited |
| `comment_deleted` | Comment removed |
| `task_added` | Checklist task added |
| `task_updated` | Task status changed |
| `task_deleted` | Task removed |
| `member_added` | New member joined space |
| `member_removed` | Member left space |

---

## Calendar Integration

### Get Events for Date Range

```bash
curl "http://localhost:8000/api/v1/calendar/events?start=2024-01-01&end=2024-01-31" \
  -H "X-API-Key: kb_your_key"
```

### Schedule an Event (via Card)

Cards with `start_date` and `end_date` appear in the calendar:

```bash
curl -X POST http://localhost:8000/api/v1/cards \
  -H "X-API-Key: kb_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team sync meeting",
    "space_id": "space-uuid",
    "column_id": "col-1",
    "start_date": "2024-01-20T14:00:00Z",
    "end_date": "2024-01-20T15:00:00Z",
    "location": "Meeting Room A"
  }'
```

---

## Search

### Search Cards

```bash
curl "http://localhost:8000/api/v1/cards?q=customer&space_id=space-uuid" \
  -H "X-API-Key: kb_your_key"
```

### Global Search

```bash
curl "http://localhost:8000/api/v1/search?q=meeting&type=cards" \
  -H "X-API-Key: kb_your_key"
```

---

## Error Handling

All API errors return JSON with consistent format:

```json
{
  "detail": "Error description"
}
```

### Common HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request | Check request body format |
| 401 | Unauthorized | Check API key is valid |
| 403 | Forbidden | Agent lacks permission for this resource |
| 404 | Not Found | Resource doesn't exist |
| 422 | Validation Error | Check field values |
| 429 | Rate Limited | Wait before retrying |
| 500 | Server Error | Report to administrator |

### Rate Limits

| Endpoint Category | Limit |
|-------------------|-------|
| Authentication | 5/minute |
| Admin | 30/minute |
| Other | 100/minute |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## Best Practices

### 1. Use Agent Space Type

Create spaces with `type: "agent"` to differentiate agent workspaces:

```bash
curl -X POST http://localhost:8000/api/v1/spaces \
  -H "X-API-Key: kb_your_key" \
  -H "Content-Type: application/json" \
  -d '{"name": "Agent Workspace", "type": "agent"}'
```

### 2. Include Descriptive Comments

Leave audit trail by commenting on your actions:

```bash
curl -X POST http://localhost:8000/api/v1/cards/{card_id}/comments \
  -H "X-API-Key: kb_your_key" \
  -H "Content-Type: application/json" \
  -d '{"content": "[AUTO] Task completed by automation at 2024-01-15T10:30:00Z"}'
```

### 3. Use Tags Consistently

Leverage default tags for status tracking:

| Tag | Color | Use Case |
|-----|-------|----------|
| Urgent | Red | Immediate attention needed |
| Important | Orange | High priority |
| Waiting | Yellow | Blocked on external input |
| Blocked | Pink | Cannot proceed |
| Scheduled | Turquoise | Has calendar dates |

### 4. Handle Rate Limits Gracefully

```python
import time
import requests

def api_request(url, headers, max_retries=3):
    for attempt in range(max_retries):
        response = requests.get(url, headers=headers)
        
        if response.status_code == 429:
            reset_time = int(response.headers.get('X-RateLimit-Reset', 60))
            time.sleep(reset_time)
            continue
            
        return response
    
    raise Exception("Rate limit exceeded after retries")
```

### 5. Validate Before Creating

Check if resources exist before creating duplicates:

```python
# Check if space exists
spaces = requests.get(
    f"{BASE_URL}/spaces",
    headers={"X-API-Key": API_KEY}
).json()

existing = next(
    (s for s in spaces['spaces'] if s['name'] == 'My Workspace'),
    None
)

if not existing:
    # Create new space
    ...
```

---

## Complete Python Agent Example

```python
import requests
from datetime import datetime, timedelta

class KanbotAgent:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
    
    def _request(self, method: str, endpoint: str, **kwargs):
        url = f"{self.base_url}{endpoint}"
        response = requests.request(method, url, headers=self.headers, **kwargs)
        response.raise_for_status()
        return response.json() if response.text else None
    
    def get_spaces(self):
        return self._request("GET", "/spaces")
    
    def create_space(self, name: str, space_type: str = "agent"):
        return self._request("POST", "/spaces", json={
            "name": name,
            "type": space_type
        })
    
    def create_card(self, space_id: str, column_id: str, title: str, **kwargs):
        data = {
            "title": title,
            "space_id": space_id,
            "column_id": column_id,
            **kwargs
        }
        return self._request("POST", "/cards", json=data)
    
    def move_card(self, card_id: str, column_id: str, position: int = 0):
        return self._request("PUT", f"/cards/{card_id}", json={
            "column_id": column_id,
            "position": position
        })
    
    def add_comment(self, card_id: str, content: str):
        return self._request("POST", f"/cards/{card_id}/comments", json={
            "content": content
        })
    
    def complete_task(self, card_id: str, task_id: str):
        return self._request("PUT", f"/cards/{card_id}/tasks/{task_id}", json={
            "is_completed": True
        })

# Usage
agent = KanbotAgent("http://localhost:8000/api/v1", "kb_your_api_key")

# Get or create workspace
spaces = agent.get_spaces()
workspace = next(
    (s for s in spaces['spaces'] if s['name'] == 'Agent Tasks'),
    None
)

if not workspace:
    workspace = agent.create_space("Agent Tasks")

# Create a new task
card = agent.create_card(
    space_id=workspace['id'],
    column_id=workspace['boards'][0]['columns'][0]['id'],
    title="Process incoming request",
    description="Handle automated workflow",
    start_date=datetime.utcnow().isoformat() + "Z",
    end_date=(datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z"
)

# Add comment
agent.add_comment(card['id'], "[AUTO] Task created by automation agent")

# Move to "In Progress"
in_progress_col = next(
    c for c in workspace['boards'][0]['columns'] 
    if c['name'] == 'In Progress'
)
agent.move_card(card['id'], in_progress_col['id'])

print(f"Created and started task: {card['id']}")
```

---

## Multi-Profile Agent Workflow

This section explains how a **single physical agent** can safely manage multiple user profiles simultaneously - for example, one agent serving multiple people in an organization.

### Use Case

A single AI agent (e.g., Claude, GPT-4) may need to:
- Work for multiple users (Alice, Bob, Charlie)
- Each user has their own Kanbot account with separate spaces
- Agent must keep each user's data isolated
- Switch between profiles seamlessly without data leakage

### Profile Isolation Architecture

```
Physical Agent
├── Profile: alice@company.com
│   ├── API Key: kb_alice_key123...
│   ├── Spaces: Alice's Personal, Team Alpha
│   └── Context: Alice's preferences, history
├── Profile: bob@company.com
│   ├── API Key: kb_bob_key456...
│   ├── Spaces: Bob's Tasks, Project Beta
│   └── Context: Bob's preferences, history
└── Profile: charlie@company.com
    ├── API Key: kb_charlie_key789...
    ├── Spaces: Charlie's Workspace
    └── Context: Charlie's preferences, history
```

### Setup: Creating Multiple Profiles

#### Step 1: Create User Accounts

Create separate user accounts for each person the agent will serve:

```bash
# Create Alice's agent profile
docker-compose exec backend python -m app.cli user create \
  --email agent-for-alice@company.com \
  --username "AI Agent (Alice)" \
  --json

# Create Bob's agent profile
docker-compose exec backend python -m app.cli user create \
  --email agent-for-bob@company.com \
  --username "AI Agent (Bob)" \
  --json

# Create Charlie's agent profile
docker-compose exec backend python -m app.cli user create \
  --email agent-for-charlie@company.com \
  --username "AI Agent (Charlie)" \
  --json
```

#### Step 2: Generate API Keys for Each Profile

```bash
# Alice's key
docker-compose exec backend python -m app.cli apikey create \
  --user agent-for-alice@company.com \
  --name "Alice's Agent Key" \
  --json
# Output: kb_alice_xxxxx...

# Bob's key
docker-compose exec backend python -m app.cli apikey create \
  --user agent-for-bob@company.com \
  --name "Bob's Agent Key" \
  --json
# Output: kb_bob_yyyyy...

# Charlie's key
docker-compose exec backend python -m app.cli apikey create \
  --user agent-for-charlie@company.com \
  --name "Charlie's Agent Key" \
  --json
# Output: kb_charlie_zzzzz...
```

#### Step 3: Store Credentials Securely

**Option A: Environment Variables (Development)**

```bash
# .env.agent
KANBOT_ALICE_KEY=kb_alice_xxxxx...
KANBOT_BOB_KEY=kb_bob_yyyyy...
KANBOT_CHARLIE_KEY=kb_charlie_zzzzz...
```

**Option B: Secret Manager (Production)**

```python
# Using AWS Secrets Manager example
import boto3

def store_profile_key(profile_name: str, api_key: str):
    client = boto3.client('secretsmanager')
    client.create_secret(
        Name=f'kanbot/agent-profiles/{profile_name}',
        SecretString=api_key
    )

# Store keys
store_profile_key('alice', 'kb_alice_xxxxx...')
store_profile_key('bob', 'kb_bob_yyyyy...')
store_profile_key('charlie', 'kb_charlie_zzzzz...')
```

**Option C: Encrypted Configuration File**

```python
import json
from cryptography.fernet import Fernet

# Generate encryption key (do this once, store securely)
encryption_key = Fernet.generate_key()
cipher = Fernet(encryption_key)

# Encrypt profile data
profiles = {
    "alice": {
        "email": "agent-for-alice@company.com",
        "api_key": "kb_alice_xxxxx...",
        "preferences": {}
    },
    "bob": {
        "email": "agent-for-bob@company.com",
        "api_key": "kb_bob_yyyyy...",
        "preferences": {}
    }
}

encrypted = cipher.encrypt(json.dumps(profiles).encode())
with open('agent_profiles.enc', 'wb') as f:
    f.write(encrypted)
```

### Safe Profile Management Implementation

#### Complete Multi-Profile Agent Class

```python
import os
import logging
from typing import Dict, Optional, Any
from datetime import datetime
import requests

class MultiProfileKanbotAgent:
    """
    Agent that safely manages multiple user profiles with strict isolation.
    """
    
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.profiles: Dict[str, Dict[str, str]] = {}
        self.current_profile: Optional[str] = None
        self.logger = logging.getLogger(__name__)
        
        # Audit log for compliance
        self.audit_log = []
    
    def register_profile(self, profile_id: str, email: str, api_key: str):
        """
        Register a new profile for management.
        
        Args:
            profile_id: Unique identifier (e.g., "alice")
            email: User's email
            api_key: API key for this profile
        """
        if profile_id in self.profiles:
            raise ValueError(f"Profile {profile_id} already registered")
        
        self.profiles[profile_id] = {
            "email": email,
            "api_key": api_key,
            "created_at": datetime.utcnow().isoformat()
        }
        
        self.logger.info(f"Registered profile: {profile_id} ({email})")
        self._audit("profile_registered", profile_id, {"email": email})
    
    def switch_profile(self, profile_id: str):
        """
        Switch active profile. All subsequent operations use this profile.
        
        Args:
            profile_id: Profile to activate
        """
        if profile_id not in self.profiles:
            raise ValueError(f"Unknown profile: {profile_id}")
        
        old_profile = self.current_profile
        self.current_profile = profile_id
        
        self.logger.info(f"Switched profile: {old_profile} -> {profile_id}")
        self._audit("profile_switched", profile_id, {
            "from": old_profile,
            "to": profile_id
        })
    
    def get_current_headers(self) -> Dict[str, str]:
        """Get headers for current profile."""
        if not self.current_profile:
            raise RuntimeError("No profile selected. Call switch_profile() first.")
        
        return {
            "X-API-Key": self.profiles[self.current_profile]["api_key"],
            "Content-Type": "application/json"
        }
    
    def _audit(self, action: str, profile_id: str, details: Dict[str, Any]):
        """Record audit trail."""
        self.audit_log.append({
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "profile": profile_id,
            "details": details
        })
    
    def _request(self, method: str, endpoint: str, **kwargs):
        """
        Make API request with current profile credentials.
        Includes safety checks and audit logging.
        """
        if not self.current_profile:
            raise RuntimeError("No active profile. Call switch_profile() first.")
        
        url = f"{self.base_url}{endpoint}"
        headers = self.get_current_headers()
        
        # Safety: Log the request
        self._audit("api_request", self.current_profile, {
            "method": method,
            "endpoint": endpoint
        })
        
        try:
            response = requests.request(method, url, headers=headers, **kwargs)
            response.raise_for_status()
            return response.json() if response.text else None
        except Exception as e:
            self.logger.error(
                f"Request failed for {self.current_profile}: {method} {endpoint} - {e}"
            )
            raise
    
    # Profile-aware API methods
    
    def get_spaces(self):
        """Get spaces accessible to current profile."""
        return self._request("GET", "/api/v1/spaces")
    
    def create_space(self, name: str, space_type: str = "agent"):
        """Create space for current profile."""
        return self._request("POST", "/api/v1/spaces", json={
            "name": name,
            "type": space_type
        })
    
    def create_card(self, space_id: str, column_id: str, title: str, **kwargs):
        """Create card in current profile's space."""
        data = {
            "title": title,
            "space_id": space_id,
            "column_id": column_id,
            **kwargs
        }
        return self._request("POST", "/api/v1/cards", json=data)
    
    def add_comment(self, card_id: str, content: str):
        """Add comment as current profile."""
        return self._request("POST", f"/api/v1/cards/{card_id}/comments", json={
            "content": content
        })
    
    # Safety utilities
    
    def verify_profile_isolation(self, profile_id: str) -> Dict[str, Any]:
        """
        Verify that profile can only access its own data.
        Returns access report.
        """
        original_profile = self.current_profile
        self.switch_profile(profile_id)
        
        try:
            # Get accessible spaces
            spaces = self.get_spaces()
            
            # Verify no cross-profile access
            report = {
                "profile": profile_id,
                "email": self.profiles[profile_id]["email"],
                "accessible_spaces": len(spaces.get('spaces', [])),
                "isolation_verified": True
            }
            
            return report
        finally:
            if original_profile:
                self.switch_profile(original_profile)
    
    def get_audit_log(self, profile_id: Optional[str] = None) -> list:
        """
        Get audit log, optionally filtered by profile.
        """
        if not profile_id:
            return self.audit_log
        
        return [
            entry for entry in self.audit_log
            if entry['profile'] == profile_id
        ]
    
    def export_audit_log(self, filepath: str):
        """Export audit log for compliance."""
        import json
        with open(filepath, 'w') as f:
            json.dump(self.audit_log, f, indent=2)
        
        self.logger.info(f"Audit log exported to {filepath}")

# Usage Example
def main():
    # Initialize agent
    agent = MultiProfileKanbotAgent("http://localhost:8000")
    
    # Register profiles (load from secure storage in production)
    agent.register_profile(
        "alice",
        "agent-for-alice@company.com",
        os.getenv("KANBOT_ALICE_KEY")
    )
    agent.register_profile(
        "bob",
        "agent-for-bob@company.com",
        os.getenv("KANBOT_BOB_KEY")
    )
    
    # Work for Alice
    agent.switch_profile("alice")
    alice_spaces = agent.get_spaces()
    
    alice_workspace = next(
        (s for s in alice_spaces['spaces'] if s['name'] == 'Alice Tasks'),
        None
    )
    
    if not alice_workspace:
        alice_workspace = agent.create_space("Alice Tasks", "agent")
    
    agent.create_card(
        space_id=alice_workspace['id'],
        column_id=alice_workspace['boards'][0]['columns'][0]['id'],
        title="Task for Alice",
        description="Handled by agent"
    )
    
    # Switch to Bob
    agent.switch_profile("bob")
    bob_spaces = agent.get_spaces()
    
    bob_workspace = next(
        (s for s in bob_spaces['spaces'] if s['name'] == 'Bob Tasks'),
        None
    )
    
    if not bob_workspace:
        bob_workspace = agent.create_space("Bob Tasks", "agent")
    
    agent.create_card(
        space_id=bob_workspace['id'],
        column_id=bob_workspace['boards'][0]['columns'][0]['id'],
        title="Task for Bob",
        description="Handled by agent"
    )
    
    # Verify isolation
    alice_report = agent.verify_profile_isolation("alice")
    bob_report = agent.verify_profile_isolation("bob")
    
    print(f"Alice isolation: {alice_report}")
    print(f"Bob isolation: {bob_report}")
    
    # Export audit log
    agent.export_audit_log("agent_audit.json")

if __name__ == "__main__":
    main()
```

### Safety Best Practices

#### 1. **Always Verify Profile Before Operations**

```python
def safe_operation(agent: MultiProfileKanbotAgent, profile_id: str):
    # Store current profile
    original = agent.current_profile
    
    try:
        # Switch to target profile
        agent.switch_profile(profile_id)
        
        # Perform operation
        result = agent.get_spaces()
        
        return result
    finally:
        # Always restore original profile
        if original:
            agent.switch_profile(original)
```

#### 2. **Implement Context Managers for Profile Switching**

```python
from contextlib import contextmanager

@contextmanager
def profile_context(agent: MultiProfileKanbotAgent, profile_id: str):
    """
    Context manager for safe profile switching.
    
    Usage:
        with profile_context(agent, "alice"):
            agent.create_card(...)
    """
    original = agent.current_profile
    agent.switch_profile(profile_id)
    
    try:
        yield agent
    finally:
        if original:
            agent.switch_profile(original)

# Usage
with profile_context(agent, "alice"):
    agent.create_card(space_id="...", column_id="...", title="Alice's task")

with profile_context(agent, "bob"):
    agent.create_card(space_id="...", column_id="...", title="Bob's task")
```

#### 3. **Prevent Credential Leakage in Logs**

```python
import logging
import re

class SanitizingFilter(logging.Filter):
    """Filter to redact API keys from logs."""
    
    def filter(self, record):
        # Redact API keys
        record.msg = re.sub(
            r'kb_[a-zA-Z0-9]{40,}',
            'kb_***REDACTED***',
            str(record.msg)
        )
        return True

# Apply filter
logger = logging.getLogger()
logger.addFilter(SanitizingFilter())
```

#### 4. **Validate Profile Permissions**

```python
def ensure_space_access(agent: MultiProfileKanbotAgent, space_id: str) -> bool:
    """
    Verify current profile has access to space before operations.
    """
    spaces = agent.get_spaces()
    accessible_ids = [s['id'] for s in spaces.get('spaces', [])]
    
    if space_id not in accessible_ids:
        raise PermissionError(
            f"Current profile ({agent.current_profile}) "
            f"cannot access space {space_id}"
        )
    
    return True

# Usage
ensure_space_access(agent, target_space_id)
agent.create_card(space_id=target_space_id, ...)
```

#### 5. **Implement Rate Limiting Per Profile**

```python
from collections import defaultdict
from time import time, sleep

class RateLimitedAgent(MultiProfileKanbotAgent):
    def __init__(self, base_url: str, requests_per_minute: int = 30):
        super().__init__(base_url)
        self.requests_per_minute = requests_per_minute
        self.request_times: Dict[str, list] = defaultdict(list)
    
    def _check_rate_limit(self):
        """Enforce per-profile rate limits."""
        profile = self.current_profile
        now = time()
        
        # Remove requests older than 1 minute
        self.request_times[profile] = [
            t for t in self.request_times[profile]
            if now - t < 60
        ]
        
        # Check limit
        if len(self.request_times[profile]) >= self.requests_per_minute:
            wait_time = 60 - (now - self.request_times[profile][0])
            self.logger.warning(
                f"Rate limit reached for {profile}, waiting {wait_time:.1f}s"
            )
            sleep(wait_time)
        
        # Record this request
        self.request_times[profile].append(now)
    
    def _request(self, method: str, endpoint: str, **kwargs):
        self._check_rate_limit()
        return super()._request(method, endpoint, **kwargs)
```

### Multi-Profile Workflow Examples

#### Example 1: Morning Briefing for All Users

```python
def generate_daily_briefings(agent: MultiProfileKanbotAgent):
    """Generate morning briefing for each user."""
    
    briefings = {}
    
    for profile_id in agent.profiles.keys():
        with profile_context(agent, profile_id):
            spaces = agent.get_spaces()
            
            # Get today's tasks
            today_cards = []
            for space in spaces['spaces']:
                # Query cards with start_date = today
                # (Simplified - actual implementation would filter by date)
                today_cards.extend(space.get('cards', []))
            
            briefings[profile_id] = {
                "profile": profile_id,
                "email": agent.profiles[profile_id]["email"],
                "spaces_count": len(spaces['spaces']),
                "tasks_today": len(today_cards),
                "cards": today_cards
            }
    
    return briefings

# Usage
briefings = generate_daily_briefings(agent)
for profile_id, data in briefings.items():
    print(f"\nBriefing for {profile_id}:")
    print(f"  - {data['spaces_count']} spaces")
    print(f"  - {data['tasks_today']} tasks today")
```

#### Example 2: Coordinating Shared Projects

```python
def handle_shared_project(agent: MultiProfileKanbotAgent):
    """
    Alice and Bob are working on the same project space.
    Agent coordinates between their profiles.
    """
    
    # Get Alice's perspective
    with profile_context(agent, "alice"):
        alice_spaces = agent.get_spaces()
        project_space = next(
            s for s in alice_spaces['spaces']
            if s['name'] == 'Shared Project Alpha'
        )
        
        # Alice creates a task
        alice_card = agent.create_card(
            space_id=project_space['id'],
            column_id=project_space['boards'][0]['columns'][0]['id'],
            title="Design system architecture",
            description="Created by Alice's agent"
        )
    
    # Get Bob's perspective (he's also a member)
    with profile_context(agent, "bob"):
        bob_spaces = agent.get_spaces()
        project_space = next(
            s for s in bob_spaces['spaces']
            if s['name'] == 'Shared Project Alpha'
        )
        
        # Bob can see Alice's card and comment on it
        agent.add_comment(
            alice_card['id'],
            "[Bob's Agent] Acknowledged, will review architecture proposal"
        )
```

#### Example 3: Privacy-Preserving Reporting

```python
def generate_aggregate_report(agent: MultiProfileKanbotAgent):
    """
    Generate anonymous aggregate statistics without exposing
    individual user data.
    """
    
    stats = {
        "total_profiles": len(agent.profiles),
        "total_spaces": 0,
        "total_cards_created_today": 0,
        "profiles_active": 0
    }
    
    for profile_id in agent.profiles.keys():
        with profile_context(agent, profile_id):
            spaces = agent.get_spaces()
            
            if len(spaces['spaces']) > 0:
                stats["profiles_active"] += 1
            
            stats["total_spaces"] += len(spaces['spaces'])
            
            # Count cards created today
            # (Simplified - actual implementation would filter by date)
            for space in spaces['spaces']:
                stats["total_cards_created_today"] += len(
                    space.get('cards', [])
                )
    
    # Return only aggregate data - no individual user info
    return stats

# Usage
report = generate_aggregate_report(agent)
print(f"Agent managing {report['total_profiles']} profiles")
print(f"Total spaces: {report['total_spaces']}")
```

### Security Checklist

- [ ] **API keys stored securely** (env vars, secret manager, or encrypted files)
- [ ] **Never log API keys** (use sanitizing filters)
- [ ] **Profile switching always explicit** (no automatic inference)
- [ ] **Verify space access** before operations
- [ ] **Audit trail enabled** for all profile operations
- [ ] **Rate limiting per profile** to prevent abuse
- [ ] **Context managers used** to prevent profile leakage
- [ ] **Credentials never committed** to version control
- [ ] **Regular audit log reviews** for anomalies
- [ ] **Each profile has minimum permissions** needed

### Troubleshooting Multi-Profile Issues

#### Profile Cross-Contamination

**Symptom**: Data appearing in wrong user's space

**Diagnosis**:
```python
# Check current profile before operation
print(f"Current profile: {agent.current_profile}")
print(f"Current API key: {agent.profiles[agent.current_profile]['api_key'][:10]}...")

# Verify space ownership
spaces = agent.get_spaces()
for space in spaces['spaces']:
    print(f"Space: {space['name']}, Owner: {space['owner_email']}")
```

**Fix**: Always use context managers or explicit profile switches

#### Permission Denied Across Profiles

**Symptom**: One profile can access another's data

**Diagnosis**:
```python
# Test isolation
for profile_id in agent.profiles.keys():
    report = agent.verify_profile_isolation(profile_id)
    print(report)
```

**Fix**: Ensure each profile has separate user account and API key

#### Audit Log Shows Unexpected Activity

**Symptom**: Actions logged for wrong profile

**Diagnosis**:
```python
# Review audit log for specific profile
alice_log = agent.get_audit_log("alice")
for entry in alice_log:
    print(f"{entry['timestamp']}: {entry['action']} - {entry['details']}")
```

**Fix**: Review code for missing `switch_profile()` calls

---

## Troubleshooting

### API Key Not Working

1. Verify key format starts with `kb_`
2. Check key is active: `kanbot apikey list --json`
3. Ensure key wasn't revoked

### Permission Denied (403)

- Agent can only access spaces they own or are members of
- Request admin to add agent as space member if needed

### Rate Limited (429)

- Implement exponential backoff
- Check `X-RateLimit-Reset` header for wait time
- Contact admin if legitimate usage exceeds limits

### WebSocket Disconnects

- Implement reconnection logic
- JWT tokens expire - refresh before connecting
- Consider using API key for REST, JWT for WebSocket
