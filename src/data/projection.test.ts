import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chooseProjectionScreen,
  projectionPopupFeatures,
  projectionScreenOptions,
  publishProjectionState,
  readProjectionState,
  type ProjectionScreenInfo,
} from './projection';

const laptop: ProjectionScreenInfo = {
  availLeft: 0,
  availTop: 0,
  availWidth: 1440,
  availHeight: 900,
  isPrimary: true,
  isInternal: true,
};

const projector: ProjectionScreenInfo = {
  availLeft: 1440,
  availTop: 0,
  availWidth: 1920,
  availHeight: 1080,
  isPrimary: false,
  isInternal: false,
};

describe('projection window helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('places the projection on the external screen rather than the dashboard screen', () => {
    expect(chooseProjectionScreen({ screens: [laptop, projector], currentScreen: laptop })).toBe(projector);
  });

  it('chooses the other screen even when the dashboard is not on the primary display', () => {
    expect(chooseProjectionScreen({ screens: [laptop, projector], currentScreen: projector })).toBe(laptop);
  });

  it('returns no target when only the dashboard screen is available', () => {
    expect(chooseProjectionScreen({ screens: [laptop], currentScreen: laptop })).toBeNull();
  });

  it('offers every external display in a predictable order for the controller', () => {
    const sideProjector: ProjectionScreenInfo = {
      label: 'Side screen',
      availLeft: -1920,
      availTop: 0,
      availWidth: 1920,
      availHeight: 1080,
      isPrimary: false,
      isInternal: false,
    };
    const mainProjector = { ...projector, label: 'Main projector' };

    expect(projectionScreenOptions({
      screens: [laptop, mainProjector, sideProjector],
      currentScreen: laptop,
    })).toEqual([sideProjector, mainProjector]);
  });

  it('requests a minimal correctly positioned popup', () => {
    const features = projectionPopupFeatures(projector);
    expect(features).toContain('popup=yes');
    expect(features).toContain('toolbar=no');
    expect(features).toContain('left=1440');
    expect(features).toContain('width=1920');
    expect(features).toContain('height=1080');
  });

  it('keeps the receiver launch id while the controller changes videos', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.stubGlobal('window', { location: { origin: 'https://example.test' } });

    publishProjectionState({ queue: [], playingIndex: null, playbackRevision: 1, launchId: 'screen-session' });
    const changed = publishProjectionState({ queue: [], playingIndex: null, playbackRevision: 2 });

    expect(changed.launchId).toBe('screen-session');
    expect(readProjectionState().playbackRevision).toBe(2);
  });

  it('upgrades projection state saved by the older receiver', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ queue: [], playingIndex: null, playbackRevision: 7, updatedAt: 12 }),
    });

    expect(readProjectionState()).toMatchObject({ launchId: '', playbackRevision: 7, updatedAt: 12 });
  });
});
