# API Reference

Complete API documentation for Kanbot.

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

Kanbot supports two authentication methods:

### 1. JWT Token (Bearer Authentication)

For interactive sessions and web applications.

**Login:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=yourpassword"
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Using the token:**
```bash
curl -H "Authorization: Bearer eyJhbG..." http://localhost:8000/api/v1/users/me
```

### 2. API Key (Recommended for Agents)

For programmatic access and autonomous agents.

**Creating an API key (via CLI):**
```bash
kanbot apikey create --user user@example.com --name "My Agent"
```

**Using the API key:**
```bash
curl -H "X-API-Key: kb_xxxx..." http://localhost:8000/api/v1/spaces
```

---

## Endpoints

### Authentication

#### POST /auth/login
Authenticate user and receive tokens.

**Request Body (form-urlencoded):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | string | Yes | Email or username |
| password | string | Yes | User password |

**Response:**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer"
}
```

**Error Codes:**
- 401: Invalid credentials
- 429: Account locked (too many attempts)

---

#### POST /auth/register
Register a new user account.

**Request Body (JSON):**
```json
{
  "email": "user@example.com",
  "username": "myusername",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "myusername",
  "is_admin": false,
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

#### POST /auth/refresh
Refresh access token using refresh token.

**Request Body (JSON):**
```json
{
  "refresh_token": "eyJhbG..."
}
```

**Response:**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer"
}
```

---

### Users

#### GET /users/me
Get current authenticated user.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "myusername",
  "language": "en",
  "is_admin": false,
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

#### PUT /users/me
Update current user profile.

**Request Body (JSON):**
```json
{
  "username": "newusername",
  "language": "en"
}
```

---

#### PUT /users/me/password
Change current user's password.

**Request Body (JSON):**
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewPass456!"
}
```

---

### Spaces

#### GET /spaces
List spaces accessible to current user.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | int | 1 | Page number |
| page_size | int | 20 | Results per page |

**Response:**
```json
{
  "spaces": [
    {
      "id": "uuid",
      "name": "My Space",
      "type": "personal",
      "color": "#3B82F6",
      "owner_id": "uuid",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

---

#### POST /spaces
Create a new space.

**Request Body (JSON):**
```json
{
  "name": "My Project",
  "type": "company",
  "color": "#10B981"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "My Project",
  "type": "company",
  "color": "#10B981",
  "owner_id": "uuid",
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

#### GET /spaces/{space_id}
Get space details.

**Response:**
```json
{
  "id": "uuid",
  "name": "My Project",
  "type": "company",
  "color": "#10B981",
  "owner_id": "uuid",
  "boards": [...],
  "members": [...],
  "tags": [...],
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

#### PUT /spaces/{space_id}
Update space.

**Request Body (JSON):**
```json
{
  "name": "Updated Name",
  "color": "#EF4444"
}
```

---

#### DELETE /spaces/{space_id}
Delete a space and all its contents.

---

### Boards

#### GET /spaces/{space_id}/boards
List boards in a space.

---

#### POST /spaces/{space_id}/boards
Create a new board.

**Request Body (JSON):**
```json
{
  "name": "Sprint Board"
}
```

---

#### PUT /spaces/{space_id}/boards/{board_id}
Update board.

---

#### DELETE /spaces/{space_id}/boards/{board_id}
Delete board.

---

### Columns

#### GET /spaces/{space_id}/boards/{board_id}/columns
List columns in a board.

---

#### POST /spaces/{space_id}/boards/{board_id}/columns
Create a new column.

**Request Body (JSON):**
```json
{
  "name": "To Do",
  "position": 0
}
```

---

#### PUT /spaces/{space_id}/boards/{board_id}/columns/{column_id}
Update column.

---

#### DELETE /spaces/{space_id}/boards/{board_id}/columns/{column_id}
Delete column.

---

### Cards

#### GET /cards
Search cards across all accessible spaces.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search query |
| space_id | uuid | Filter by space |
| assignee_id | uuid | Filter by assignee |
| tag_ids | uuid[] | Filter by tags |
| start_date | datetime | Filter by start date |
| end_date | datetime | Filter by end date |

---

#### POST /cards
Create a new card.

**Request Body (JSON):**
```json
{
  "title": "New Task",
  "description": "Task description",
  "column_id": "uuid",
  "space_id": "uuid",
  "start_date": "2024-01-01T09:00:00Z",
  "end_date": "2024-01-01T17:00:00Z",
  "assignee_ids": ["uuid"],
  "tag_ids": ["uuid"]
}
```

---

#### GET /cards/{card_id}
Get card details.

**Response:**
```json
{
  "id": "uuid",
  "title": "New Task",
  "description": "Task description",
  "column_id": "uuid",
  "space_id": "uuid",
  "position": 0,
  "start_date": "2024-01-01T09:00:00Z",
  "end_date": "2024-01-01T17:00:00Z",
  "location": "Meeting Room A",
  "assignees": [...],
  "tags": [...],
  "tasks": [...],
  "comments": [...],
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

#### PUT /cards/{card_id}
Update card.

**Request Body (JSON):**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "column_id": "uuid",
  "position": 1
}
```

---

#### DELETE /cards/{card_id}
Delete card.

---

### Card Tasks

#### POST /cards/{card_id}/tasks
Add task to card.

**Request Body (JSON):**
```json
{
  "title": "Subtask 1",
  "is_completed": false
}
```

---

#### PUT /cards/{card_id}/tasks/{task_id}
Update task.

---

#### DELETE /cards/{card_id}/tasks/{task_id}
Delete task.

---

### Card Comments

#### POST /cards/{card_id}/comments
Add comment to card.

**Request Body (JSON):**
```json
{
  "content": "This is a comment"
}
```

---

#### PUT /cards/{card_id}/comments/{comment_id}
Update comment.

---

#### DELETE /cards/{card_id}/comments/{comment_id}
Delete comment.

---

### Tags

#### GET /spaces/{space_id}/tags
List tags in a space.

---

#### POST /spaces/{space_id}/tags
Create a tag.

**Request Body (JSON):**
```json
{
  "name": "Urgent",
  "color": "#EF4444"
}
```

---

#### PUT /spaces/{space_id}/tags/{tag_id}
Update tag.

---

#### DELETE /spaces/{space_id}/tags/{tag_id}
Delete tag.

---

### Members

#### GET /spaces/{space_id}/members
List space members.

---

#### POST /spaces/{space_id}/members
Invite member to space.

**Request Body (JSON):**
```json
{
  "email": "newmember@example.com",
  "role": "member"
}
```

---

#### PUT /spaces/{space_id}/members/{member_id}
Update member role.

---

#### DELETE /spaces/{space_id}/members/{member_id}
Remove member from space.

---

### Calendar

#### GET /calendar/events
Get calendar events for current user.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| start | datetime | Start of date range |
| end | datetime | End of date range |
| space_id | uuid | Filter by space |

**Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "title": "Meeting",
      "start_date": "2024-01-01T09:00:00Z",
      "end_date": "2024-01-01T10:00:00Z",
      "space_id": "uuid",
      "space_name": "Work",
      "space_color": "#3B82F6",
      "location": "Room A"
    }
  ]
}
```

---

### Search

#### GET /search
Global search across spaces.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search query |
| type | string | Filter by type (cards, spaces) |

---

### Admin Endpoints

Requires admin privileges.

#### GET /admin/users
List all users (admin only).

---

#### GET /admin/stats
Get system statistics (admin only).

**Response:**
```json
{
  "users": {
    "total": 100,
    "admins": 2,
    "active": 95
  },
  "spaces": 50,
  "cards": 1000
}
```

---

#### PUT /admin/users/{user_id}
Update user (admin only).

---

#### DELETE /admin/users/{user_id}
Delete user (admin only).

---

## WebSocket

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/{space_id}?token={jwt_token}');
```

### Events

**Received events:**
```json
{
  "type": "card_created",
  "data": { ... }
}
```

Event types:
- `card_created`
- `card_updated`
- `card_deleted`
- `card_moved`
- `column_created`
- `column_updated`
- `column_deleted`
- `member_added`
- `member_removed`
- `comment_added`
- `comment_updated`
- `comment_deleted`
- `task_added`
- `task_updated`
- `task_deleted`
- `tag_created`
- `tag_updated`
- `tag_deleted`

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message"
}
```

**Common HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 422 | Validation Error - Invalid data format |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| /auth/login | 5/minute |
| /auth/register | 3/minute |
| /auth/refresh | 10/minute |
| /admin/* | 30/minute |
| Other endpoints | 100/minute |

Rate limit headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time until reset (seconds)
