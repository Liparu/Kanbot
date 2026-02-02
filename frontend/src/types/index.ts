export interface User {
  id: string
  email: string
  username: string
  language: string
  settings: Record<string, unknown>
  is_active: boolean
  is_admin: boolean
  is_banned: boolean
  banned_at?: string
  created_at: string
}

export interface Space {
  id: string
  name: string
  type: 'personal' | 'company' | 'agent'
  owner_id: string
  color?: string
  settings: Record<string, unknown>
  calendar_public: boolean
  created_at: string
  members?: SpaceMember[]
}

export interface SpaceMember {
  user_id: string
  username: string
  email: string
  role: 'owner' | 'member' | 'guest'
  agent_permissions: Record<string, unknown>
  joined_at: string
}

export interface Column {
  id: string
  space_id: string
  name: string
  category: ColumnCategory
  position: number
  settings: Record<string, unknown>
  created_at: string
  cards?: Card[]
}

export type ColumnCategory = 'default' | 'inbox' | 'in_progress' | 'waiting' | 'review' | 'archive'

export interface Card {
  id: string
  column_id: string
  name: string
  description?: string
  start_date?: string
  end_date?: string
  location?: string
  position: number
  task_counter: number
  task_completed_counter: number
  metadata_json: Record<string, unknown>
  last_column_id?: string
  waiting_on?: string
  approver_id?: string
  created_by?: string
  created_at: string
  updated_at: string
  tags: CardTag[]
  assignees: SimpleUser[]
  tasks?: Task[]
  comments?: Comment[]
}

export interface CardTag {
  tag: Tag
}

export interface SimpleUser {
  id: string
  username: string
  email: string
}

export interface Tag {
  id: string
  space_id: string
  name: string
  color: string
  is_predefined: boolean
  created_at: string
}

export interface Task {
  id: string
  text: string
  completed: boolean
  position: number
  created_at: string
}

export interface Comment {
  id: string
  card_id: string
  user_id?: string
  content: string
  actor_type: string
  actor_name?: string
  created_at: string
  updated_at: string
  is_edited: boolean
  is_deleted: boolean
}

export interface CalendarEvent {
  id: string
  calendar_id: string
  card_id?: string
  google_event_id?: string
  title: string
  description?: string
  start_date: string
  end_date?: string
  all_day: boolean
  location?: string
  color?: string
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message?: string
  data: Record<string, unknown>
  read: boolean
  created_at: string
}

export interface APIKey {
  id: string
  name: string
  permissions: Record<string, unknown>
  is_agent: boolean
  created_at: string
  last_used?: string
  key?: string
}

export interface AdminUser {
  id: string
  email: string
  username: string
  is_active: boolean
  is_admin: boolean
  is_banned: boolean
  banned_at?: string
  created_at: string
  space_count: number
}

export interface AdminUserListResponse {
  users: AdminUser[]
  total: number
  page: number
  page_size: number
}

export interface SystemStats {
  total_users: number
  new_users_this_week: number
  new_users_this_month: number
  active_users_7_days: number
  total_spaces: number
  personal_spaces: number
  team_spaces: number
  agent_spaces: number
  total_cards: number
  completed_cards: number
  total_comments: number
}
