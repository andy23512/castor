export interface Device {
  id: string;
  name: string;
  /** Across the desk, left to right, in millimetres. */
  widthMm: number;
  /** Front to back, in millimetres. */
  depthMm: number;
  /** Off the desk, in millimetres. */
  heightMm: number;
  /** Grams. */
  weightG: number;
  /** Tailwind colour name used for the outline and the legend swatch. */
  accent: 'amber' | 'sky' | 'emerald';
}

/**
 * Published footprints, not CAD measurements, so the three can be compared on
 * one basis. Numbers from the manufacturer's spec, collected at
 * https://hackmd.io/@andy23512/rJTf2dzlJl (Lite converted from inches).
 *
 * The 3D CC2 in the main view is its full CAD assembly with the halves spread,
 * which measures larger (about 319 x 133 mm) than this closed-up spec figure.
 */
export const COMPARISON_DEVICES: Device[] = [
  {
    id: 'cc1',
    name: 'CharaChorder One',
    widthMm: 296,
    depthMm: 110,
    heightMm: 38,
    weightG: 308,
    accent: 'sky',
  },
  {
    id: 'ccl',
    name: 'CharaChorder Lite',
    widthMm: 295,
    depthMm: 105,
    heightMm: 33,
    weightG: 467,
    accent: 'emerald',
  },
  {
    id: 'cc2',
    name: 'CharaChorder Two',
    widthMm: 295,
    depthMm: 111,
    heightMm: 29,
    weightG: 303,
    accent: 'amber',
  },
];
