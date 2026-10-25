export interface User {
  id: string;
  username: string;
}

export interface Room {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
  createdBy?: string;
  createdAt?: string;
}

export interface MessageUser {
  id: string;
  username: string;
}

export interface Message {
  id: string;
  roomId: string;
  text: string;
  createdAt: string;
  user: MessageUser;
}
