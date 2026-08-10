import { describe, expect, it } from 'vitest';
import { chooseProjectionScreen, projectionPopupFeatures, type ProjectionScreenInfo } from './projection';

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
  it('places the projection on the external screen rather than the dashboard screen', () => {
    expect(chooseProjectionScreen({ screens: [laptop, projector], currentScreen: laptop })).toBe(projector);
  });

  it('chooses the other screen even when the dashboard is not on the primary display', () => {
    expect(chooseProjectionScreen({ screens: [laptop, projector], currentScreen: projector })).toBe(laptop);
  });

  it('returns no target when only the dashboard screen is available', () => {
    expect(chooseProjectionScreen({ screens: [laptop], currentScreen: laptop })).toBeNull();
  });

  it('requests a minimal correctly positioned popup', () => {
    const features = projectionPopupFeatures(projector);
    expect(features).toContain('popup=yes');
    expect(features).toContain('toolbar=no');
    expect(features).toContain('left=1440');
    expect(features).toContain('width=1920');
    expect(features).toContain('height=1080');
  });
});
