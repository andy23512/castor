import {
  CARD_LONG_EDGE_INCHES,
  CARD_SHORT_EDGE_INCHES,
  clampPpi,
  DEFAULT_PPI,
  MAX_PPI,
  MIN_PPI,
  ppiFromCardEdge,
  ppiFromDisplaySpecs,
} from './calibration.utils';

describe('calibration utils', () => {
  it('matches the ISO/IEC 7810 ID-1 format', () => {
    expect(CARD_LONG_EDGE_INCHES * 25.4).toBeCloseTo(85.6, 1);
    expect(CARD_SHORT_EDGE_INCHES * 25.4).toBeCloseTo(53.98, 1);
  });

  it('derives the ppi from a matched card edge', () => {
    expect(ppiFromCardEdge(337, CARD_LONG_EDGE_INCHES)).toBeCloseTo(100, 5);
    expect(ppiFromCardEdge(212.5, CARD_SHORT_EDGE_INCHES)).toBeCloseTo(100, 5);
  });

  it('clamps out-of-range and non-numeric values', () => {
    expect(clampPpi(1)).toBe(MIN_PPI);
    expect(clampPpi(99_999)).toBe(MAX_PPI);
    expect(clampPpi(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PPI);
    expect(clampPpi(Number.NaN)).toBe(DEFAULT_PPI);
  });

  it('derives the ppi from display specs, halving it at 200% zoom', () => {
    const specs = {
      logicalResolutionWidth: 1920,
      logicalResolutionHeight: 1080,
      screenSizeInInches: 24,
      zoomPercentage: 100,
    };

    expect(ppiFromDisplaySpecs(specs)).toBeCloseTo(91.79, 2);
    expect(ppiFromDisplaySpecs({ ...specs, zoomPercentage: 200 })).toBeCloseTo(
      45.89,
      2,
    );
  });
});
