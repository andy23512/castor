import {
  withDevtools,
  withStorageSync,
} from '@angular-architects/ngrx-toolkit';
import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { ScreenSetting } from '../models/screen-setting.models';
import {
  clampPpi,
  currentPixelRatio,
  DEFAULT_PPI,
  ppiFromDisplaySpecs,
} from '../utils/calibration.utils';
import { prefixStorageKey } from '../utils/store.utils';

const FALLBACK_RESOLUTION_WIDTH = 1920;
const FALLBACK_RESOLUTION_HEIGHT = 1080;
const SCREEN_SETTING_KEY = 'screenSetting';

/**
 * `screen.width`/`screen.height` report the logical resolution, which is what
 * the advanced panel asks for. It is only a starting guess: the physical screen
 * size cannot be detected, so the user still has to calibrate.
 */
function detectLogicalResolution(): Pick<
  ScreenSetting,
  'logicalResolutionWidth' | 'logicalResolutionHeight'
> {
  const width = Math.round(globalThis.screen?.width ?? 0);
  const height = Math.round(globalThis.screen?.height ?? 0);
  return width > 0 && height > 0
    ? { logicalResolutionWidth: width, logicalResolutionHeight: height }
    : {
        logicalResolutionWidth: FALLBACK_RESOLUTION_WIDTH,
        logicalResolutionHeight: FALLBACK_RESOLUTION_HEIGHT,
      };
}

export function createInitialScreenSetting(): ScreenSetting {
  return {
    pixelsPerInch: DEFAULT_PPI,
    ...detectLogicalResolution(),
    screenSizeInInches: 24,
    zoomPercentage: 100,
    calibratedAt: null,
    calibratedPixelRatio: null,
    promptedAt: null,
  };
}

export function parseScreenSetting(stateString: string): ScreenSetting {
  const stored = JSON.parse(stateString) as Partial<ScreenSetting>;
  const setting = { ...createInitialScreenSetting(), ...stored };
  if (stored.pixelsPerInch === undefined) {
    // Settings stored before the card calibration only held the display specs.
    setting.pixelsPerInch = ppiFromDisplaySpecs(setting);
  }
  return setting;
}

export const ScreenSettingStore = signalStore(
  {
    providedIn: 'root',
  },
  withDevtools(SCREEN_SETTING_KEY),
  withStorageSync({
    key: prefixStorageKey(SCREEN_SETTING_KEY),
    parse: parseScreenSetting,
  }),
  withState(createInitialScreenSetting),
  withComputed((state) => ({
    ppi: computed(() => clampPpi(state.pixelsPerInch())),
    /** What the advanced panel would apply, previewed while typing. */
    displaySpecsPpi: computed(() =>
      ppiFromDisplaySpecs({
        logicalResolutionWidth: state.logicalResolutionWidth(),
        logicalResolutionHeight: state.logicalResolutionHeight(),
        screenSizeInInches: state.screenSizeInInches(),
        zoomPercentage: state.zoomPercentage(),
      }),
    ),
    isCalibrated: computed(() => state.calibratedAt() !== null),
    hasBeenPrompted: computed(() => state.promptedAt() !== null),
  })),
  withMethods((store) => ({
    set<P extends keyof ScreenSetting>(prop: P, value: ScreenSetting[P]): void {
      patchState(store, () => ({ [prop]: value }));
    },
    setPpi(pixelsPerInch: number): void {
      patchState(store, { pixelsPerInch: clampPpi(pixelsPerInch) });
    },
    applyDisplaySpecs(): void {
      patchState(store, { pixelsPerInch: store.displaySpecsPpi() });
    },
    markCalibrated(): void {
      patchState(store, {
        calibratedAt: Date.now(),
        calibratedPixelRatio: currentPixelRatio(),
      });
    },
    /**
     * Rescales the calibration for a changed `devicePixelRatio`. This is exact
     * when the browser zoom changed, which is the common case; moving the
     * window to a screen of another density changes the ratio too, and there
     * the user has to calibrate again.
     */
    adjustForPixelRatio(pixelRatio: number): void {
      const calibrated = store.calibratedPixelRatio();
      if (calibrated === null || pixelRatio <= 0) {
        return;
      }
      patchState(store, {
        pixelsPerInch: clampPpi(store.ppi() * (calibrated / pixelRatio)),
        calibratedPixelRatio: pixelRatio,
        calibratedAt: Date.now(),
      });
    },
    markPrompted(): void {
      patchState(store, { promptedAt: Date.now() });
    },
  })),
);
