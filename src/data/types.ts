// Shared liturgy data types.
//
// These describe the *app-ready* shape produced by the build/cleaning pipeline
// (scripts/build-dataset.ts). The raw SQLite tables (documents / items) remain
// the source of truth and are never mutated; everything here is derived.

export type ItemType = 'heading' | 'liturgical_text' | 'verse' | 'rubric' | 'refrain' | 'psalm-prayer';

/** A psalm/canticle verse split at the mid-verse asterisk for indented rendering. */
export interface VerseHalves {
  /** Text before the `*`. */
  first: string;
  /** Text after the `*`, rendered indented on its own line. May be empty. */
  second: string;
}

export interface LiturgyItem {
  /** Original items.id, preserved for traceability back to the raw row. */
  id: number;
  type: ItemType;
  /** Verse/canticle number where present. */
  number: string | null;
  /**
   * Cleaned speaker/role. In M1 this is the raw speaker column passed through.
   * From M2 it becomes a validated role (All, President, Minister, …) or null.
   */
  role: string | null;
  /** The spoken/printed text, with any embedded speaker token stripped (M2). */
  text: string;
  /** Present only for type === 'verse' when an asterisk split applies. */
  verse?: VerseHalves;
}

export interface LiturgyDocument {
  id: number;
  title: string;
  category: string | null;
  subcategory: string | null;
  items: LiturgyItem[];
}
