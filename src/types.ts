import { Timestamp } from 'firebase/firestore';

export enum NoteSize {
  SHORT = 'короткий',
  MEDIUM = 'средний',
  LONG = 'длинный'
}

export interface Note {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  collaboratorEmails: string[];
  topic?: string;
  targetSize?: NoteSize;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}
