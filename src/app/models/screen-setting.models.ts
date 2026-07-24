export interface ScreenSetting {
  logicalResolutionWidth: number;
  logicalResolutionHeight: number;
  screenSizeInInches: number;
  zoomPercentage: number;
  /** Timestamp of the last time the user confirmed the calibration. */
  calibratedAt: number | null;
  /** Timestamp of the first-run prompt, so that it is only shown once. */
  promptedAt: number | null;
}
