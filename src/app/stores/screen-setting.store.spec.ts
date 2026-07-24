import { TestBed } from '@angular/core/testing';
import { ScreenSettingStore } from './screen-setting.store';
import { prefixStorageKey } from '../utils/store.utils';

const STORAGE_KEY = prefixStorageKey('screenSetting');

describe('ScreenSettingStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts uncalibrated and unprompted', () => {
    const store = TestBed.inject(ScreenSettingStore);

    expect(store.isCalibrated()).toBe(false);
    expect(store.hasBeenPrompted()).toBe(false);
  });

  it('derives the ppi from the diagonal resolution, size and zoom', () => {
    const store = TestBed.inject(ScreenSettingStore);
    store.set('logicalResolutionWidth', 1920);
    store.set('logicalResolutionHeight', 1080);
    store.set('screenSizeInInches', 24);
    store.set('zoomPercentage', 100);

    expect(store.ppi()).toBeCloseTo(91.79, 2);

    store.set('zoomPercentage', 200);

    expect(store.ppi()).toBeCloseTo(45.89, 2);
  });

  it('falls back to a usable ppi when an input is cleared', () => {
    const store = TestBed.inject(ScreenSettingStore);

    store.set('screenSizeInInches', 0);
    expect(Number.isFinite(store.ppi())).toBe(true);

    store.set('screenSizeInInches', null as unknown as number);
    expect(Number.isFinite(store.ppi())).toBe(true);
  });

  it('records the calibration and the prompt separately', () => {
    const store = TestBed.inject(ScreenSettingStore);

    store.markPrompted();
    expect(store.hasBeenPrompted()).toBe(true);
    expect(store.isCalibrated()).toBe(false);

    store.markCalibrated();
    expect(store.isCalibrated()).toBe(true);
  });

  it('restores the calibrated flag from storage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ screenSizeInInches: 27, calibratedAt: 1_700_000_000 }),
    );

    const store = TestBed.inject(ScreenSettingStore);

    expect(store.isCalibrated()).toBe(true);
    expect(store.screenSizeInInches()).toBe(27);
    // Fields missing from older stored settings fall back to the defaults.
    expect(store.zoomPercentage()).toBe(100);
  });
});
