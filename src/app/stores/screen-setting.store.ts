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

const INITIAL_SCREEN_SETTING: ScreenSetting = {
  logicalResolutionWidth: 1920,
  logicalResolutionHeight: 1080,
  screenSizeInInches: 24,
  zoomPercentage: 100,
};
const SCREEN_SETTING_KEY = 'screenSetting';

export const ScreenSettingStore = signalStore(
  {
    providedIn: 'root',
  },
  withDevtools(SCREEN_SETTING_KEY),
  withStorageSync({
    key: prefixStorageKey(SCREEN_SETTING_KEY),
    parse(stateString: string): ScreenSetting {
      return { ...INITIAL_SCREEN_SETTING, ...JSON.parse(stateString) };
    },
  }),
  withState(INITIAL_SCREEN_SETTING),
  withMethods((store) => ({
    set<P extends keyof ScreenSetting>(prop: P, value: ScreenSetting[P]): void {
      patchState(store, () => ({ [prop]: value }));
    },
  })),
  withComputed((state) => ({
    ppi: computed(() => {
      const rw = state.logicalResolutionWidth();
      const rh = state.logicalResolutionHeight();
      const size = state.screenSizeInInches();
      const zoom = state.zoomPercentage();
      return (
        ((Math.sqrt(Math.pow(rw, 2) + Math.pow(rh, 2)) / size) * 100) / zoom
      );
    }),
  })),
);
