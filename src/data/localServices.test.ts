import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSavedService,
  deleteSavedService,
  loadSavedServices,
  upsertSavedService,
} from './localServices';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});

describe('account-free saved services', () => {
  it('creates, updates and restores a service in this browser', () => {
    const service = createSavedService({ title: 'Sunday worship', serviceDate: '2026-09-13' });
    upsertSavedService(service);

    const updated = {
      ...service,
      items: [{ id: 'song-1', title: 'Amazing Grace', artist: 'John Newton', youtubeId: 'Jbe7OruLk8I' }],
      updated_at: new Date(Date.now() + 1_000).toISOString(),
    };
    upsertSavedService(updated);

    expect(loadSavedServices()).toEqual([updated]);
  });

  it('deletes only the selected service', () => {
    const first = createSavedService({ title: 'Morning' });
    const second = createSavedService({ title: 'Evening' });
    upsertSavedService(first);
    upsertSavedService(second);

    expect(deleteSavedService(first.id).map((service) => service.id)).toEqual([second.id]);
  });
});
