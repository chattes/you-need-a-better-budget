// Repository contracts shared by the IndexedDB cache and Google Sheets sync.

export interface Change {
  entity: string;
  id: string;
  operation: 'upsert' | 'delete';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  updated_at: string;
}

export interface OutboxEntry {
  id: string;
  entity: string;
  operation: 'upsert' | 'delete';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  created_at: string;
  retries: number;
  synced: boolean;
}

export interface Repository<T extends { id: string }> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  upsert(entity: T): Promise<void>;
  upsertMany(entities: T[]): Promise<void>;
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  getSince(timestamp: string): Promise<T[]>;
  getChangesSince(timestamp: string): Promise<Change[]>;
}
