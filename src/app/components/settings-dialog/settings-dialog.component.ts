import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import Ruler from '@scena/ruler';
import { ScreenSetting } from '../../models/screen-setting.models';
import { ScreenSettingStore } from '../../stores/screen-setting.store';
import { CardCalibrationComponent } from '../card-calibration/card-calibration.component';

@Component({
  selector: 'app-settings-dialog',
  templateUrl: 'settings-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatButton,
    MatFormField,
    MatIcon,
    MatInput,
    FormsModule,
    CardCalibrationComponent,
  ],
})
export class SettingsDialogComponent {
  private readonly screenSettingStore = inject(ScreenSettingStore);
  private readonly dialogRef =
    inject<MatDialogRef<SettingsDialogComponent>>(MatDialogRef);
  protected readonly logicalResolutionWidth =
    this.screenSettingStore.logicalResolutionWidth;
  protected readonly logicalResolutionHeight =
    this.screenSettingStore.logicalResolutionHeight;
  protected readonly screenSizeInInches =
    this.screenSettingStore.screenSizeInInches;
  protected readonly zoomPercentage = this.screenSettingStore.zoomPercentage;
  protected readonly ppi = this.screenSettingStore.ppi;
  protected readonly isCalibrated = this.screenSettingStore.isCalibrated;
  protected readonly displaySpecsPpi = this.screenSettingStore.displaySpecsPpi;
  protected readonly ppiDisplay = computed(() => this.ppi().toFixed(1));
  protected readonly displaySpecsPpiDisplay = computed(() =>
    this.displaySpecsPpi().toFixed(1),
  );
  protected readonly isShowingAdvanced = signal(false);
  private readonly inchRulerElement =
    viewChild<ElementRef<HTMLDivElement>>('inchRuler');
  private inchRulerInstance: Ruler | null = null;
  private readonly cmRulerElement =
    viewChild<ElementRef<HTMLDivElement>>('cmRuler');
  private cmRulerInstance: Ruler | null = null;

  constructor() {
    effect(() => {
      const inchRulerElement = this.inchRulerElement();
      const ppi = this.ppi();
      if (!inchRulerElement) {
        return;
      }
      inchRulerElement.nativeElement.innerHTML = '';
      this.inchRulerInstance = new Ruler(inchRulerElement.nativeElement, {
        type: 'horizontal',
        zoom: ppi,
        unit: 1,
        textFormat: (value) => (value === 1 ? `${value} in` : `${value}`),
      });
    });
    effect(() => {
      const cmRulerElement = this.cmRulerElement();
      const ppi = this.ppi();
      if (!cmRulerElement) {
        return;
      }
      cmRulerElement.nativeElement.innerHTML = '';
      this.cmRulerInstance = new Ruler(cmRulerElement.nativeElement, {
        type: 'horizontal',
        zoom: ppi / 2.54,
        unit: 1,
        textFormat: (value) => (value === 1 ? `${value} cm` : `${value}`),
      });
    });
  }

  protected setPpi(ppi: number): void {
    this.screenSettingStore.setPpi(ppi);
  }

  protected setScreenSetting<K extends keyof ScreenSetting>(
    key: K,
    value: ScreenSetting[K],
  ): void {
    this.screenSettingStore.set(key, value);
  }

  protected applyDisplaySpecs(): void {
    this.screenSettingStore.applyDisplaySpecs();
  }

  protected toggleAdvanced(): void {
    this.isShowingAdvanced.update((showing) => !showing);
  }

  protected confirmCalibration(): void {
    this.screenSettingStore.markCalibrated();
    this.dialogRef.close();
  }

  @HostListener('window:resize')
  public onResize(): void {
    this.inchRulerInstance?.resize();
    this.cmRulerInstance?.resize();
  }
}
