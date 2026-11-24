export type AccentTone = 'forest' | 'terracotta' | 'ochre' | 'slate';

export type SyncStatus = 'synced' | 'pending' | 'local-only';

export interface ChildProfile {
  id: string;
  name: string;
  nickname: string;
  birthDate: string;
  hobby: string;
  favoriteFood: string;
  favoriteColor: string;
  dream: string;
  aboutMe: string;
  avatarDataUrl?: string;
  accentTone: AccentTone;
  order: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  syncStatus: SyncStatus;
}

export interface MediaAttachment {
  id: string;
  type: 'photo' | 'voice';
  mimeType: string;
  durationSec?: number;
  caption?: string;
  /** True when media bytes have been pushed to Firestore media collection or Firebase Storage */
  remoteSynced?: boolean;
  remoteUrl?: string;
  createdAt: number;
}

export interface JournalEntry {
  id: string;
  childId: string;
  /** Local calendar date YYYY-MM-DD */
  dateKey: string;
  /** Local month folder key YYYY-MM */
  monthKey: string;
  title: string;
  content: string;
  attachments: MediaAttachment[];
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  syncStatus: SyncStatus;
}

export interface StoryChapter {
  id: string;
  title: string;
  content: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreativeStory {
  id: string;
  childId: string;
  title: string;
  synopsis: string;
  coverTone: AccentTone;
  chapters: StoryChapter[];
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  syncStatus: SyncStatus;
}

export interface FirebaseConfigData {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseId?: string;
}

export interface SyncStateSummary {
  configured: boolean;
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
  lastError: string | null;
}
