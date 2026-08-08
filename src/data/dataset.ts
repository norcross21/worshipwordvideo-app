// Loads the bundled offline dataset. Cached by the service worker so it works
// with no network once installed.
import type { LiturgyDocument } from './types';

let cache: Promise<LiturgyDocument[]> | null = null;

export function loadDataset(): Promise<LiturgyDocument[]> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}dataset.json`).then((r) => {
      if (!r.ok) throw new Error(`Failed to load dataset: ${r.status}`);
      return r.json() as Promise<LiturgyDocument[]>;
    });
  }
  return cache;
}

export async function getDocument(id: number): Promise<LiturgyDocument | undefined> {
  const docs = await loadDataset();
  return docs.find((d) => d.id === id);
}
