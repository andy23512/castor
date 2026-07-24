/**
 * ISO/IEC 7810 ID-1, the format of bank cards, driving licences and most ID
 * cards worldwide: 85.60 mm x 53.98 mm with a 3.18 mm corner radius. Because
 * the size is the same everywhere, matching one against the screen is the most
 * reliable calibration input we can ask a user for.
 */
export const CARD_LONG_EDGE_INCHES = 3.37;
export const CARD_SHORT_EDGE_INCHES = 2.125;
export const CARD_CORNER_RADIUS_INCHES = 0.125;

/** CSS pixels per inch. 96 is the CSS reference, used until calibrated. */
export const DEFAULT_PPI = 96;
export const MIN_PPI = 40;
export const MAX_PPI = 400;

export function clampPpi(ppi: number): number {
  // A cleared input or a division by zero must not reach the camera.
  return Number.isFinite(ppi)
    ? Math.min(Math.max(ppi, MIN_PPI), MAX_PPI)
    : DEFAULT_PPI;
}

/** Derives the ppi from an edge the user matched against a real card. */
export function ppiFromCardEdge(pixels: number, edgeInches: number): number {
  return clampPpi(pixels / edgeInches);
}

/** Derives the ppi from the display specs entered in the advanced panel. */
export function ppiFromDisplaySpecs(specs: {
  logicalResolutionWidth: number;
  logicalResolutionHeight: number;
  screenSizeInInches: number;
  zoomPercentage: number;
}): number {
  const diagonalPixels = Math.sqrt(
    specs.logicalResolutionWidth ** 2 + specs.logicalResolutionHeight ** 2,
  );
  return clampPpi(
    ((diagonalPixels / specs.screenSizeInInches) * 100) / specs.zoomPercentage,
  );
}
