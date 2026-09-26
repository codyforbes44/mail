import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'user' | 'admin';
}

export interface Email {
  id: string;
  senderId: string;
  senderEmail: string;
  senderName?: string;
  recipientEmail: string;
  subject: string;
  body: string;
  snippet?: string;
  createdAt: Timestamp;
  read: boolean;
  folder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'archive';
  ownerId: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
