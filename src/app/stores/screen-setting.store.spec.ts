import { TestBed } from '@angular/core/testing';
import { ScreenSettingStore } from './screen-setting.store';
import { DEFAULT_PPI, MAX_PPI, MIN_PPI } from '../utils/calibration.utils';
import { prefixStorageKey } from '../utils/store.utils';

const STORAGE_KEY = prefixStorageKey('screenSetting');

describe('ScreenSettingStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts uncalibrated, unprompted and at the CSS reference ppi', () => {
    const store = TestBed.inject(ScreenSettingStore);

    expect(store.isCalibrated()).toBe(false);
    expect(store.hasBeenPrompted()).toBe(false);
    expect(store.ppi()).toBe(DEFAULT_PPI);
  });

  it('takes the ppi matched against the card', () => {
    const store = TestBed.inject(ScreenSettingStore);

    store.setPpi(138.5);

    expect(store.ppi()).toBe(138.5);
  });

  it('keeps the ppi within a usable range', () => {
    const store = TestBed.inject(ScreenSettingStore);

    store.setPpi(0);
    expect(store.ppi()).toBe(MIN_PPI);

    store.setPpi(10_000);
    expect(store.ppi()).toBe(MAX_PPI);

    store.setPpi(Number.NaN);
    expect(store.ppi()).toBe(DEFAULT_PPI);
  });

  it('derives a ppi from the display specs on request only', () => {
    const store = TestBed.inject(ScreenSettingStore);
    store.set('logicalResolutionWidth', 1920);
    store.set('logicalResolutionHeight', 1080);
    store.set('screenSizeInInches', 24);
    store.set('zoomPercentage', 100);

    expect(store.displaySpecsPpi()).toBeCloseTo(91.79, 2);
    expect(store.ppi()).toBe(DEFAULT_PPI);

    store.applyDisplaySpecs();

    expect(store.ppi()).toBeCloseTo(91.79, 2);
  });

  it('records the calibration and the prompt separately', () => {
    const store = TestBed.inject(ScreenSettingStore);

    store.markPrompted();
    expect(store.hasBeenPrompted()).toBe(true);
    expect(store.isCalibrated()).toBe(false);

    store.markCalibrated();
    expect(store.isCalibrated()).toBe(true);
  });

  it('restores the ppi and the calibrated flag from storage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ pixelsPerInch: 138.5, calibratedAt: 1_700_000_000 }),
    );

    const store = TestBed.inject(ScreenSettingStore);

    expect(store.ppi()).toBe(138.5);
    expect(store.isCalibrated()).toBe(true);
  });

  it('migrates settings stored before the card calibration', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        logicalResolutionWidth: 1920,
        logicalResolutionHeight: 1080,
        screenSizeInInches: 24,
        zoomPercentage: 100,
      }),
    );

    const store = TestBed.inject(ScreenSettingStore);

    expect(store.ppi()).toBeCloseTo(91.79, 2);
  });
});
