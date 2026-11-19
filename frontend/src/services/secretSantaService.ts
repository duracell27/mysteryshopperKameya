import { apiFetch } from './apiFetch';

export interface SantaEntry {
  _id: string;
  season: string;
  userId?: string;
  fullName: string;
  department?: string;
  hobbies?: string;
  interestingFacts?: string;
  wantsToReceive?: string;
  doesntWantToReceive?: string;
  recipientId?: SantaEntry | null;
}

export const getMyEntry = async (): Promise<SantaEntry> => {
  const res = await apiFetch('/api/secret-santa/my');
  if (res.status === 404) throw new Error('NOT_FOUND');
  if (!res.ok) throw new Error('Помилка завантаження');
  const data = await res.json();
  return data.entry as SantaEntry;
};

export const getAllEntries = async (): Promise<SantaEntry[]> => {
  const res = await apiFetch('/api/secret-santa/all');
  if (!res.ok) throw new Error('Помилка завантаження');
  const data = await res.json();
  return data.entries as SantaEntry[];
};
