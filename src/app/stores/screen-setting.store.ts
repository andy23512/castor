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
import { prefixStorageKey } from '../utils/store.utils';

const FALLBACK_RESOLUTION_WIDTH = 1920;
const FALLBACK_RESOLUTION_HEIGHT = 1080;
const MIN_PPI = 1;
const MAX_PPI = 2000;
const FALLBACK_PPI = 96;
const SCREEN_SETTING_KEY = 'screenSetting';

/**
 * `screen.width`/`screen.height` report the logical resolution, which is what
 * this app needs. It is only a starting guess: the physical screen size cannot
 * be detected, so the user still has to calibrate.
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
    ...detectLogicalResolution(),
    screenSizeInInches: 24,
    zoomPercentage: 100,
    calibratedAt: null,
    promptedAt: null,
  };
}

export const ScreenSettingStore = signalStore(
  {
    providedIn: 'root',
  },
  withDevtools(SCREEN_SETTING_KEY),
  withStorageSync({
    key: prefixStorageKey(SCREEN_SETTING_KEY),
    parse(stateString: string): ScreenSetting {
      // Merging keeps settings stored by older versions loadable.
      return { ...createInitialScreenSetting(), ...JSON.parse(stateString) };
    },
  }),
  withState(createInitialScreenSetting),
  withMethods((store) => ({
    set<P extends keyof ScreenSetting>(prop: P, value: ScreenSetting[P]): void {
      patchState(store, () => ({ [prop]: value }));
    },
    markCalibrated(): void {
      patchState(store, { calibratedAt: Date.now() });
    },
    markPrompted(): void {
      patchState(store, { promptedAt: Date.now() });
    },
  })),
  withComputed((state) => ({
    isCalibrated: computed(() => state.calibratedAt() !== null),
    hasBeenPrompted: computed(() => state.promptedAt() !== null),
    ppi: computed(() => {
      const rw = state.logicalResolutionWidth();
      const rh = state.logicalResolutionHeight();
      const size = state.screenSizeInInches();
      const zoom = state.zoomPercentage();
      const ppi = ((Math.sqrt(rw ** 2 + rh ** 2) / size) * 100) / zoom;
      // A cleared or half-typed input must not reach the camera as NaN/Infinity.
      return Number.isFinite(ppi)
        ? Math.min(Math.max(ppi, MIN_PPI), MAX_PPI)
        : FALLBACK_PPI;
    }),
  })),
);
