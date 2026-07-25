import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  MatButtonToggle,
  MatButtonToggleGroup,
} from '@angular/material/button-toggle';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { COMPARISON_DEVICES, Device } from '../../models/device.models';
import { REFERENCE_OBJECTS } from '../../models/reference.models';
import { ScreenSettingStore } from '../../stores/screen-setting.store';
import { mmToPixels } from '../../utils/pan.utils';

interface Box {
  id: string;
  name: string;
  widthMm: number;
  depthMm: number;
  widthPx: number;
  depthPx: number;
  color: string;
  /** References are drawn dashed and unfilled, behind the devices. */
  dashed: boolean;
}

// Concrete values keep Tailwind from purging dynamically built colour classes.
const ACCENT_COLORS: Record<Device['accent'], string> = {
  amber: '#f59e0b',
  sky: '#38bdf8',
  emerald: '#34d399',
};
const REFERENCE_COLOR = '#94a3b8';

const STAGE_MARGIN_PX = 48;

const byAreaDesc = (a: Box, b: Box): number =>
  b.widthPx * b.depthPx - a.widthPx * a.depthPx;

@Component({
  selector: 'app-size-comparison',
  templateUrl: 'size-comparison.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'absolute inset-0 z-10 flex flex-col bg-[#14161b]',
  },
  imports: [MatIcon, MatIconButton, MatButtonToggle, MatButtonToggleGroup],
})
export class SizeComparisonComponent {
  public readonly closed = output<void>();

  private readonly screenSettingStore = inject(ScreenSettingStore);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly isCalibrated = this.screenSettingStore.isCalibrated;

  /** 'fit' scales everything down so the whole comparison is visible. */
  protected readonly mode = signal<'fit' | 'actual'>('fit');
  protected readonly showReferences = signal(false);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly available = signal({ width: 0, height: 0 });

  private readonly actualDevices = computed<Box[]>(() => {
    const ppi = this.screenSettingStore.ppi();
    return COMPARISON_DEVICES.map((device) => ({
      id: device.id,
      name: device.name,
      widthMm: device.widthMm,
      depthMm: device.depthMm,
      widthPx: mmToPixels(device.widthMm, ppi),
      depthPx: mmToPixels(device.depthMm, ppi),
      color: ACCENT_COLORS[device.accent],
      dashed: false,
    }));
  });

  private readonly actualReferences = computed<Box[]>(() => {
    const ppi = this.screenSettingStore.ppi();
    return REFERENCE_OBJECTS.map((ref) => ({
      id: ref.id,
      name: ref.name,
      widthMm: ref.widthMm,
      depthMm: ref.depthMm,
      widthPx: mmToPixels(ref.widthMm, ppi),
      depthPx: mmToPixels(ref.depthMm, ppi),
      color: REFERENCE_COLOR,
      dashed: true,
    }));
  });

  /** References first, so they sit behind the devices; each group largest first. */
  private readonly actualBoxes = computed<Box[]>(() => {
    const devices = [...this.actualDevices()].sort(byAreaDesc);
    if (!this.showReferences()) {
      return devices;
    }
    return [...[...this.actualReferences()].sort(byAreaDesc), ...devices];
  });

  private readonly actualWidth = computed(() =>
    Math.max(...this.actualBoxes().map((b) => b.widthPx)),
  );
  private readonly actualHeight = computed(() =>
    Math.max(...this.actualBoxes().map((b) => b.depthPx)),
  );

  /** How much the outlines are shrunk to fit; 1 in actual-size mode. */
  protected readonly scale = computed(() => {
    if (this.mode() === 'actual') {
      return 1;
    }
    const { width, height } = this.available();
    if (width === 0 || height === 0) {
      return 1;
    }
    return Math.min(
      1,
      (width - STAGE_MARGIN_PX) / this.actualWidth(),
      (height - STAGE_MARGIN_PX) / this.actualHeight(),
    );
  });
  protected readonly isScaledDown = computed(() => this.scale() < 0.999);
  protected readonly scalePercent = computed(() =>
    Math.round(this.scale() * 100),
  );

  // Labels keep their real size; only the outlines scale.
  protected readonly boxes = computed<Box[]>(() => {
    const scale = this.scale();
    return this.actualBoxes().map((b) => ({
      ...b,
      widthPx: b.widthPx * scale,
      depthPx: b.depthPx * scale,
    }));
  });
  /** Devices only, for the legend, in the listed order. */
  protected readonly deviceBoxes = computed(() => this.actualDevices());
  protected readonly referenceBoxes = computed(() => this.actualReferences());

  protected readonly stageWidth = computed(
    () => this.actualWidth() * this.scale(),
  );
  protected readonly stageHeight = computed(
    () => this.actualHeight() * this.scale(),
  );
  protected readonly referenceColor = REFERENCE_COLOR;

  constructor() {
    afterNextRender(() => {
      const element = this.stage().nativeElement;
      const measure = () =>
        this.available.set({
          width: element.clientWidth,
          height: element.clientHeight,
        });
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected setMode(mode: 'fit' | 'actual'): void {
    this.mode.set(mode);
  }

  protected toggleReferences(): void {
    this.showReferences.update((shown) => !shown);
  }

  protected close(): void {
    this.closed.emit();
  }
}
