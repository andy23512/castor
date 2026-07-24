export interface ScreenSetting {
  /** Source of truth: how many CSS pixels one inch of the screen is. */
  pixelsPerInch: number;
  /** Display specs, kept so that the advanced panel remembers them. */
  logicalResolutionWidth: number;
  logicalResolutionHeight: number;
  screenSizeInInches: number;
  zoomPercentage: number;
  /** Timestamp of the last time the user confirmed the calibration. */
  calibratedAt: number | null;
  /** Timestamp of the first-run prompt, so that it is only shown once. */
  promptedAt: number | null;
}
