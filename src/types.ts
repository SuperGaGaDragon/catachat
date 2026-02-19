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
