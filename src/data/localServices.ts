import { WORSHIP_QUEUE_LIMIT, type WorshipQueueItem } from './worshipQueue';

const LOCAL_SERVICES_KEY = 'worship_word_video_services_v1';
const LOCAL_SERVICE_LIMIT = 100;

export interface SavedService {
  id: string;
  title: string;
  items: WorshipQueueItem[];
  service_date: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

function isQueueItem(value: unknown): value is WorshipQueueItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<WorshipQueueItem>;
  return typeof item.id === 'string'
    && typeof item.title === 'string'
    && typeof item.artist === 'string'
    && typeof item.youtubeId === 'string'
    && Boolean(item.youtubeId);
}

function normaliseService(value: unknown): SavedService | null {
  if (!value || typeof value !== 'object') return null;
  const service = value as Partial<SavedService>;
  if (typeof service.id !== 'string' || typeof service.title !== 'string' || !service.title.trim()) return null;
  const now = new Date().toISOString();
  return {
    id: service.id,
    title: service.title.trim().slice(0, 120),
    items: Array.isArray(service.items) ? service.items.filter(isQueueItem).slice(0, WORSHIP_QUEUE_LIMIT) : [],
    service_date: typeof service.service_date === 'string' && service.service_date ? service.service_date : null,
    notes: typeof service.notes === 'string' && service.notes.trim() ? service.notes.trim().slice(0, 500) : null,
    archived_at: typeof service.archived_at === 'string' && service.archived_at ? service.archived_at : null,
    created_at: typeof service.created_at === 'string' ? service.created_at : now,
    updated_at: typeof service.updated_at === 'string' ? service.updated_at : now,
  };
}

function newestFirst(services: SavedService[]): SavedService[] {
  return [...services].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function loadSavedServices(): SavedService[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_SERVICES_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return newestFirst(parsed.map(normaliseService).filter((service): service is SavedService => Boolean(service))).slice(0, LOCAL_SERVICE_LIMIT);
  } catch {
    return [];
  }
}

export function saveSavedServices(services: SavedService[]): SavedService[] {
  const safeServices = newestFirst(services.map(normaliseService).filter((service): service is SavedService => Boolean(service))).slice(0, LOCAL_SERVICE_LIMIT);
  try {
    localStorage.setItem(LOCAL_SERVICES_KEY, JSON.stringify(safeServices));
  } catch {
    // Keep the in-memory planning experience available when browser storage is restricted.
  }
  return safeServices;
}

export function createSavedService(input: { title: string; serviceDate?: string; notes?: string }): SavedService {
  const now = new Date().toISOString();
  return {
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `service-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: input.title.trim().slice(0, 120),
    items: [],
    service_date: input.serviceDate || null,
    notes: input.notes?.trim().slice(0, 500) || null,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };
}

export function upsertSavedService(service: SavedService): SavedService[] {
  return saveSavedServices([service, ...loadSavedServices().filter((item) => item.id !== service.id)]);
}

export function deleteSavedService(serviceId: string): SavedService[] {
  return saveSavedServices(loadSavedServices().filter((service) => service.id !== serviceId));
}
