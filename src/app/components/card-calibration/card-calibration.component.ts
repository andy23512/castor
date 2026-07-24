import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSlider, MatSliderThumb } from '@angular/material/slider';
import {
  CARD_CORNER_RADIUS_INCHES,
  CARD_LONG_EDGE_INCHES,
  CARD_SHORT_EDGE_INCHES,
  MAX_PPI,
  MIN_PPI,
  ppiFromCardEdge,
} from '../../utils/calibration.utils';

@Component({
  selector: 'app-card-calibration',
  templateUrl: 'card-calibration.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIcon, MatIconButton, MatSlider, MatSliderThumb],
})
export class CardCalibrationComponent {
  /** CSS pixels per inch, matched against a real ID-1 card. */
  public readonly ppi = model.required<number>();

  protected readonly minPpi = MIN_PPI;
  protected readonly maxPpi = MAX_PPI;

  private readonly destroyRef = inject(DestroyRef);
  private readonly container =
    viewChild.required<ElementRef<HTMLDivElement>>('container');
  private readonly card = viewChild.required<ElementRef<HTMLDivElement>>('card');
  private readonly availableWidth = signal(0);
  private readonly rotatedByUser = signal(false);
  private dragOriginX: number | null = null;

  /** A card is wider than a phone screen, so it has to be shown upright. */
  protected readonly mustRotate = computed(() => {
    const available = this.availableWidth();
    return available > 0 && this.ppi() * CARD_LONG_EDGE_INCHES > available;
  });
  protected readonly isUpright = computed(
    () => this.rotatedByUser() || this.mustRotate(),
  );
  /** The edge that runs horizontally, which is the one the drag resizes. */
  protected readonly horizontalEdgeInches = computed(() =>
    this.isUpright() ? CARD_SHORT_EDGE_INCHES : CARD_LONG_EDGE_INCHES,
  );
  protected readonly cardWidth = computed(
    () => this.ppi() * this.horizontalEdgeInches(),
  );
  protected readonly cardHeight = computed(
    () =>
      this.ppi() *
      (this.isUpright() ? CARD_LONG_EDGE_INCHES : CARD_SHORT_EDGE_INCHES),
  );
  protected readonly cardCornerRadius = computed(
    () => this.ppi() * CARD_CORNER_RADIUS_INCHES,
  );

  constructor() {
    afterNextRender(() => {
      const element = this.container().nativeElement;
      this.availableWidth.set(element.clientWidth);
      const observer = new ResizeObserver(([entry]) =>
        this.availableWidth.set(entry.contentRect.width),
      );
      observer.observe(element);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected toggleRotation(): void {
    this.rotatedByUser.update((rotated) => !rotated);
  }

  protected onDragStart(event: PointerEvent): void {
    event.preventDefault();
    this.dragOriginX = this.card().nativeElement.getBoundingClientRect().left;
    (event.target as Element).setPointerCapture(event.pointerId);
  }

  protected onDragMove(event: PointerEvent): void {
    if (this.dragOriginX === null) {
      return;
    }
    this.ppi.set(
      ppiFromCardEdge(
        event.clientX - this.dragOriginX,
        this.horizontalEdgeInches(),
      ),
    );
  }

  protected onDragEnd(event: PointerEvent): void {
    this.dragOriginX = null;
    (event.target as Element).releasePointerCapture(event.pointerId);
  }
}
