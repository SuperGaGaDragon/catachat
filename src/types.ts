export interface Conversation {
  id: string;
  other_user_id: string;
  other_username?: string;
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string | null;
  content: string;
  created_at: string;
}

export interface CurrentUser {
  id: string;
  username: string | null;
  identifier: string;
  role: string;
}

export interface UserLookup {
  id: string;
  username: string;
}

export interface Broadcast {
  id: string;
  sender_id: string;
  sender_name: string | null;
  content: string;
  created_at: string;
}

// ── Group chat ────────────────────────────────────────────────────────────────

export interface GroupMember {
  user_id: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface Group {
  id: string;
  name: string;           // stored name or auto-generated from members
  created_by: string;
  created_at: string;
  last_message_at: string;
  members: GroupMember[];
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}
