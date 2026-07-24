import { clampPanOffset, pixelsToMetres } from './pan.utils';

describe('pan utils', () => {
  it('converts pixels to metres through the calibrated ppi', () => {
    expect(pixelsToMetres(96, 96)).toBeCloseTo(0.0254, 6);
    expect(pixelsToMetres(138.5, 138.5)).toBeCloseTo(0.0254, 6);
  });

  it('does not pan while the model fits on screen', () => {
    expect(clampPanOffset(0.05, 0.2, 0.4)).toBeCloseTo(0, 10);
    expect(clampPanOffset(-0.05, 0.2, 0.2)).toBeCloseTo(0, 10);
  });

  it('pans only as far as the part that does not fit', () => {
    // 0.32 m model in a 0.2 m view: 0.06 m hidden on each side.
    expect(clampPanOffset(0.04, 0.32, 0.2)).toBeCloseTo(0.04, 6);
    expect(clampPanOffset(1, 0.32, 0.2)).toBeCloseTo(0.06, 6);
    expect(clampPanOffset(-1, 0.32, 0.2)).toBeCloseTo(-0.06, 6);
  });
});
