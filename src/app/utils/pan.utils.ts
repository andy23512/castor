export const INCHES_TO_METRES = 0.0254;

export function pixelsToMetres(pixels: number, ppi: number): number {
  return (pixels / ppi) * INCHES_TO_METRES;
}

/**
 * Panning is only allowed as far as the part of the model that does not fit on
 * screen, so the device can never be dragged out of view. When the model fits
 * entirely, there is nothing to pan to and the offset stays at zero.
 */
export function clampPanOffset(
  offset: number,
  modelExtent: number,
  viewExtent: number,
): number {
  const limit = Math.max(0, (modelExtent - viewExtent) / 2);
  return Math.min(Math.max(offset, -limit), limit);
}
