import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';
import { ScreenSettingStore } from './stores/screen-setting.store';
import { clampPanOffset, pixelsToMetres } from './utils/pan.utils';

@Component({
  imports: [RouterModule, MatIcon, MatButton, MatIconButton],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    class: 'size-full relative',
  },
})
export class App implements AfterViewInit {
  private readonly screenSettingStore = inject(ScreenSettingStore);
  protected readonly isCalibrated = this.screenSettingStore.isCalibrated;
  protected readonly ppiDisplay = computed(() =>
    this.screenSettingStore.ppi().toFixed(1),
  );
  private readonly rendererContainer =
    viewChild<ElementRef<HTMLDivElement>>('rendererContainer');

  private readonly matDialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly renderer = new WebGLRenderer();
  private readonly scene = new Scene();
  private readonly camera: OrthographicCamera;

  /** Everything below is in metres, the unit the scene is modelled in. */
  private readonly viewSize = signal({ width: 0, height: 0 });
  private readonly modelSize = signal({ width: 0, height: 0 });
  private readonly pan = signal({ x: 0, y: 0 });

  /** At actual size the device is wider than most laptop screens. */
  protected readonly canPan = computed(() => {
    const view = this.viewSize();
    const model = this.modelSize();
    return model.width > view.width || model.height > view.height;
  });
  protected readonly isPanned = computed(
    () => this.pan().x !== 0 || this.pan().y !== 0,
  );
  protected readonly isPanning = signal(false);

  private frameHandle: number | null = null;
  private drag: { pointerId: number; x: number; y: number } | null = null;

  constructor() {
    this.camera = new OrthographicCamera();
    this.camera.position.set(0, 0, 6);

    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.setClearColor(new Color(0x1f2127));

    this.scene.background = new Color(0x1f2127);

    const gridHelper = new GridHelper(1, 100, 0x76809a, 0x3e4557);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -0.08;
    const gridMaterials = Array.isArray(gridHelper.material)
      ? gridHelper.material
      : [gridHelper.material];
    for (const material of gridMaterials) {
      material.transparent = true;
      material.opacity = 0.55;
      material.depthWrite = false;
      material.depthTest = true;
    }
    this.scene.add(gridHelper);

    const pmremGenerator = new PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.03,
    ).texture;
    pmremGenerator.dispose();

    this.scene.add(new AmbientLight(0xffffff, 0.18));
    this.scene.add(new HemisphereLight(0x98a7c8, 0x0f1014, 0.24));

    const keyLight = new DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(2.8, 3.2, 5.4);
    this.scene.add(keyLight);

    const fillLight = new DirectionalLight(0xa9b7d4, 0.52);
    fillLight.position.set(-4.6, 1.9, 2.9);
    this.scene.add(fillLight);

    const rimLight = new DirectionalLight(0x90a6dc, 0.42);
    rimLight.position.set(0.1, -2.8, -5.8);
    this.scene.add(rimLight);

    // The model is meshopt-compressed; the decoder embeds its own wasm.
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      'charachorder-models/CC2 Full Assembly.glb',
      (gltf) => {
        gltf.scene.traverse((node) => {
          if (!(node instanceof Mesh)) {
            return;
          }

          const materials = Array.isArray(node.material)
            ? node.material
            : [node.material];

          for (const material of materials) {
            if (!(material instanceof MeshStandardMaterial)) {
              continue;
            }

            // Tune roughness/metalness to approximate the photographed finish.
            material.color.lerp(new Color(0x121419), 0.78);
            material.roughness = Math.min(
              Math.max(material.roughness, 0.48),
              0.66,
            );
            material.metalness = Math.min(
              Math.max(material.metalness, 0.02),
              0.08,
            );
            material.envMapIntensity = 0.42;
          }
        });
        gltf.scene.rotation.x = Math.PI / 2;
        this.scene.add(gltf.scene); // Add loaded model
        const size = new Box3()
          .setFromObject(gltf.scene)
          .getSize(new Vector3());
        this.modelSize.set({ width: size.x, height: size.y });
        this.onResize();
        this.promptCalibrationOnce();
      },
      undefined,
      (error) => {
        console.error(error);
        this.promptCalibrationOnce();
      },
    );
    effect(() => {
      this.screenSettingStore.ppi();
      // Untracked: onResize both reads and writes the pan, which would
      // otherwise make this effect re-trigger itself.
      untracked(() => this.onResize());
    });
    this.destroyRef.onDestroy(() => {
      if (this.frameHandle !== null) {
        cancelAnimationFrame(this.frameHandle);
      }
      this.renderer.dispose();
    });
  }

  public ngAfterViewInit(): void {
    const element = this.rendererContainer()?.nativeElement;
    if (!element) {
      return;
    }
    this.onResize();
    element.appendChild(this.renderer.domElement);
    this.requestRender();
  }

  @HostListener('window:resize')
  public onResize(): void {
    const element = this.rendererContainer()?.nativeElement;
    if (!element) {
      return;
    }
    const ppi = this.screenSettingStore.ppi();
    const widthMeters = pixelsToMetres(element.clientWidth, ppi);
    const heightMeters = pixelsToMetres(element.clientHeight, ppi);
    this.viewSize.set({ width: widthMeters, height: heightMeters });
    this.camera.left = -widthMeters / 2;
    this.camera.right = widthMeters / 2;
    this.camera.top = heightMeters / 2;
    this.camera.bottom = -heightMeters / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(element.clientWidth, element.clientHeight);
    // A smaller view, or a new model, can put the camera out of bounds.
    this.setPan(this.pan().x, this.pan().y);
  }

  protected onPanStart(event: PointerEvent): void {
    if (!this.canPan()) {
      return;
    }
    this.drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    this.isPanning.set(true);
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  protected onPanMove(event: PointerEvent): void {
    if (this.drag?.pointerId !== event.pointerId) {
      return;
    }
    const ppi = this.screenSettingStore.ppi();
    const dx = pixelsToMetres(event.clientX - this.drag.x, ppi);
    const dy = pixelsToMetres(event.clientY - this.drag.y, ppi);
    this.drag.x = event.clientX;
    this.drag.y = event.clientY;
    // The model follows the pointer, so the camera moves the other way. Screen
    // y grows downwards while world y grows upwards.
    this.setPan(this.pan().x - dx, this.pan().y + dy);
  }

  protected onPanEnd(event: PointerEvent): void {
    if (this.drag?.pointerId !== event.pointerId) {
      return;
    }
    (event.currentTarget as Element).releasePointerCapture(event.pointerId);
    this.drag = null;
    this.isPanning.set(false);
  }

  protected recenter(): void {
    this.setPan(0, 0);
  }

  private setPan(x: number, y: number): void {
    const view = this.viewSize();
    const model = this.modelSize();
    const panned = {
      x: clampPanOffset(x, model.width, view.width),
      y: clampPanOffset(y, model.height, view.height),
    };
    this.pan.set(panned);
    this.camera.position.set(panned.x, panned.y, this.camera.position.z);
    this.requestRender();
  }

  /** Nothing animates, so a frame is only drawn when something changed. */
  private requestRender(): void {
    if (this.frameHandle !== null) {
      return;
    }
    this.frameHandle = requestAnimationFrame(() => {
      this.frameHandle = null;
      this.renderer.render(this.scene, this.camera);
    });
  }

  protected openSettingsDialog(): void {
    if (this.matDialog.openDialogs.length > 0) {
      return;
    }
    this.matDialog.open(SettingsDialogComponent, {
      // Wide enough that a 3.37 inch card still fits on a high-ppi display.
      width: '900px',
      maxWidth: '96vw',
      panelClass: 'calibration-dialog',
      // Focusing the first input would scroll the explanation out of view.
      autoFocus: 'dialog',
    });
  }

  /**
   * Invites the user to calibrate on their first visit, once the model is on
   * screen so that the dialog has some context behind it. Skipping the prompt
   * is remembered as well, so it is never shown a second time -- the badge in
   * the corner stays until the calibration is actually confirmed.
   */
  private promptCalibrationOnce(): void {
    if (
      this.screenSettingStore.isCalibrated() ||
      this.screenSettingStore.hasBeenPrompted()
    ) {
      return;
    }
    this.screenSettingStore.markPrompted();
    this.openSettingsDialog();
  }
}
