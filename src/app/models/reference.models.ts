export interface ReferenceObject {
  id: string;
  name: string;
  widthMm: number;
  depthMm: number;
}

/**
 * Common desk objects to gauge how much space a CharaChorder takes compared to
 * what someone already uses. Keyboard sizes vary between models, so these are
 * typical footprints, not any one product.
 */
export const REFERENCE_OBJECTS: ReferenceObject[] = [
  { id: 'full', name: 'Full-size keyboard', widthMm: 440, depthMm: 138 },
  { id: 'tkl', name: 'TKL keyboard', widthMm: 360, depthMm: 138 },
  { id: '60', name: '60% keyboard', widthMm: 290, depthMm: 102 },
];
