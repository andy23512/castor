import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
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
import { MatInput } from '@angular/material/input';
import Ruler from '@scena/ruler';
import { ScreenSetting } from '../../models/screen-setting.models';
import { ScreenSettingStore } from '../../stores/screen-setting.store';

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
    MatInput,
    FormsModule,
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
  protected readonly ppiDisplay = computed(() => this.ppi().toFixed(2));
  private readonly inchRulerElement =
    viewChild<ElementRef<HTMLDivElement>>('inchRuler');
  private inchRulerInstance: Ruler | null = null;
  private readonly cmRulerElement =
    viewChild<ElementRef<HTMLDivElement>>('cmRuler');
  private cmRulerInstance: Ruler | null = null;
  protected readonly creditCardWidth = computed(() => {
    const ppi = this.ppi();
    return 3.37 * ppi;
  });
  protected readonly creditCardHeight = computed(() => {
    const ppi = this.ppi();
    return 2.125 * ppi;
  });
  protected readonly creditCardBorderRadius = computed(() => {
    const ppi = this.ppi();
    return 0.125 * ppi;
  });

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

  protected setScreenSetting<K extends keyof ScreenSetting>(
    key: K,
    value: ScreenSetting[K],
  ): void {
    this.screenSettingStore.set(key, value);
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
