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
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PMREMGenerator,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';
import { SizeComparisonComponent } from './components/size-comparison/size-comparison.component';
import { ScreenSettingStore } from './stores/screen-setting.store';
import { currentPixelRatio } from './utils/calibration.utils';
import { clampPanOffset, pixelsToMetres } from './utils/pan.utils';

@Component({
  imports: [
    RouterModule,
    MatIcon,
    MatButton,
    MatIconButton,
    SizeComparisonComponent,
  ],
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
  private readonly arOverlay = viewChild<ElementRef<HTMLElement>>('arOverlay');

  private readonly matDialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  // alpha lets the camera feed show through in an AR session.
  private readonly renderer = new WebGLRenderer({ alpha: true });
  private readonly scene = new Scene();
  private readonly camera: OrthographicCamera;
  /** A perspective camera is used for AR; XR drives it from the headset pose. */
  private readonly arCamera = new PerspectiveCamera(70, 1, 0.01, 20);

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
  protected readonly hasModelFailed = signal(false);
  protected readonly isModelLoading = signal(true);
  /** 0..1 while downloading, or null when the size is not known. */
  protected readonly loadProgress = signal<number | null>(null);
  protected readonly loadPercent = computed(() => {
    const progress = this.loadProgress();
    return progress === null ? null : Math.round(progress * 100);
  });
  protected readonly isComparisonOpen = signal(false);

  /**
   * 'actual' is the top-down, actual-size view. 'observe' lets the model be
   * rotated to appreciate its shape, at which point it is no longer at actual
   * size, so the badge says so.
   */
  protected readonly viewMode = signal<'actual' | 'observe'>('actual');
  private controls: OrbitControls | null = null;

  /** AR is a progressive enhancement: the button only appears where the device
   * and browser support an immersive-ar WebXR session (Android Chrome today). */
  protected readonly isArSupported = signal(false);
  protected readonly isArActive = signal(false);
  protected readonly isArPlaced = signal(false);
  private arSession: XRSession | null = null;
  private hitTestSource: XRHitTestSource | null = null;
  private gridHelper!: GridHelper;
  private model: Group | null = null;
  private reticle!: Mesh;

  private readonly pixelRatio = signal(currentPixelRatio());
  /** A CSS pixel is no longer the size the calibration was measured at. */
  protected readonly isCalibrationStale = computed(() => {
    const calibrated = this.screenSettingStore.calibratedPixelRatio();
    return calibrated !== null && calibrated !== this.pixelRatio();
  });

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
    this.gridHelper = gridHelper;

    // A ring that lies flat on the detected surface until the user taps.
    this.reticle = new Mesh(
      new RingGeometry(0.05, 0.06, 32).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: 0x22d3ee }),
    );
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

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

    this.loadModel();
    this.watchPixelRatio();
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

  private loadModel(): void {
    this.hasModelFailed.set(false);
    this.isModelLoading.set(true);
    this.loadProgress.set(null);
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
        this.model = gltf.scene;
        this.model.visible = !this.isArActive();
        const size = new Box3()
          .setFromObject(gltf.scene)
          .getSize(new Vector3());
        this.modelSize.set({ width: size.x, height: size.y });
        this.isModelLoading.set(false);
        this.onResize();
        this.promptCalibrationOnce();
      },
      (event) => {
        // lengthComputable is false when the server sends no Content-Length,
        // in which case the bar stays indeterminate.
        this.loadProgress.set(
          event.lengthComputable ? event.loaded / event.total : null,
        );
      },
      (error) => {
        // The details only help a developer; the user gets a retry instead.
        this.isModelLoading.set(false);
        console.error(error);
        this.hasModelFailed.set(true);
        this.promptCalibrationOnce();
      },
    );
  }

  protected retryLoadingModel(): void {
    this.loadModel();
  }

  protected openComparison(): void {
    this.isComparisonOpen.set(true);
  }

  protected closeComparison(): void {
    this.isComparisonOpen.set(false);
  }

  /**
   * Browser zoom and a move to a screen of another density both change
   * `devicePixelRatio`. There is no event for it, so the current ratio is
   * watched as a media query and the watch is renewed on every change.
   */
  private watchPixelRatio(): void {
    const media = matchMedia(`(resolution: ${currentPixelRatio()}dppx)`);
    const onChange = () => {
      media.removeEventListener('change', onChange);
      this.pixelRatio.set(currentPixelRatio());
      this.watchPixelRatio();
    };
    media.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => media.removeEventListener('change', onChange));
  }

  protected adjustForPixelRatio(): void {
    this.screenSettingStore.adjustForPixelRatio(this.pixelRatio());
  }

  public ngAfterViewInit(): void {
    const element = this.rendererContainer()?.nativeElement;
    if (!element) {
      return;
    }
    this.onResize();
    element.appendChild(this.renderer.domElement);

    // Rotation for observe mode. Disabled until the mode is entered so it never
    // interferes with panning. Panning is the custom handler's job, and zoom in
    // metres would break actual size, so both are left to OrbitControls only
    // while observing.
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enablePan = false;
    controls.enabled = false;
    controls.minZoom = 0.4;
    controls.maxZoom = 6;
    controls.addEventListener('change', () => this.requestRender());
    this.controls = controls;
    this.destroyRef.onDestroy(() => controls.dispose());

    this.arCamera.aspect = element.clientWidth / element.clientHeight;
    this.arCamera.updateProjectionMatrix();
    void navigator.xr
      ?.isSessionSupported('immersive-ar')
      .then((supported) => this.isArSupported.set(supported))
      .catch(() => this.isArSupported.set(false));
    this.destroyRef.onDestroy(() => void this.arSession?.end());

    this.requestRender();
  }

  @HostListener('window:resize')
  public onResize(): void {
    const element = this.rendererContainer()?.nativeElement;
    if (!element) {
      return;
    }
    // Backstop for the media query watch: moving a window between screens of
    // different densities resizes it too.
    this.pixelRatio.set(currentPixelRatio());
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
    if (this.viewMode() === 'observe') {
      // Keep the frustum in sync but leave the orbiting camera where it is.
      this.controls?.update();
      this.requestRender();
      return;
    }
    // A smaller view, or a new model, can put the camera out of bounds.
    this.setPan(this.pan().x, this.pan().y);
  }

  protected onPanStart(event: PointerEvent): void {
    if (this.viewMode() === 'observe' || !this.canPan()) {
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

  /** Keyboard panning, so the off-screen parts are reachable without a mouse. */
  protected onKeydown(event: KeyboardEvent): void {
    if (this.viewMode() !== 'actual') {
      return;
    }
    const view = this.viewSize();
    const fraction = event.shiftKey ? 0.25 : 0.1;
    const stepX = view.width * fraction;
    const stepY = view.height * fraction;
    const pan = this.pan();
    switch (event.key) {
      case 'ArrowLeft':
        this.setPan(pan.x - stepX, pan.y);
        break;
      case 'ArrowRight':
        this.setPan(pan.x + stepX, pan.y);
        break;
      case 'ArrowUp':
        this.setPan(pan.x, pan.y + stepY);
        break;
      case 'ArrowDown':
        this.setPan(pan.x, pan.y - stepY);
        break;
      case 'Home':
        this.setPan(0, 0);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  protected toggleObserve(): void {
    if (this.viewMode() === 'observe') {
      this.exitObserve();
    } else {
      this.enterObserve();
    }
  }

  private enterObserve(): void {
    this.viewMode.set('observe');
    // Start centred and front-on, which is the actual-size view, then let the
    // user rotate away from it.
    this.setPan(0, 0);
    this.resetCameraOrientation();
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.enabled = true;
      this.controls.update();
    }
    this.requestRender();
  }

  private exitObserve(): void {
    this.viewMode.set('actual');
    if (this.controls) {
      this.controls.enabled = false;
    }
    this.resetCameraOrientation();
    // Restores the actual-size frustum and re-centres the camera.
    this.onResize();
  }

  /** Back to looking straight down the -Z axis at unit zoom. */
  private resetCameraOrientation(): void {
    this.camera.up.set(0, 1, 0);
    this.camera.position.set(0, 0, 6);
    this.camera.rotation.set(0, 0, 0);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Starts an immersive-ar session. The model is already modelled in metres, so
   * placing it on a surface detected by hit-testing shows it at actual size.
   * Guarded by isArSupported, so this is never reached on an unsupported device.
   */
  protected async enterAr(): Promise<void> {
    if (this.isArActive() || !navigator.xr) {
      return;
    }
    if (this.viewMode() === 'observe') {
      this.exitObserve();
    }
    let session: XRSession;
    try {
      session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: this.arOverlay()?.nativeElement ?? document.body },
      });
    } catch {
      // The user dismissed the permission prompt, or AR became unavailable.
      return;
    }
    this.arSession = session;
    this.isArActive.set(true);
    this.isArPlaced.set(false);

    // Hand the scene to the camera feed: no dark background or grid.
    this.scene.background = null;
    this.gridHelper.visible = false;
    this.reticle.visible = false;
    if (this.model) {
      this.model.visible = false;
    }

    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local');
    await this.renderer.xr.setSession(session);

    const viewerSpace = await session.requestReferenceSpace('viewer');
    this.hitTestSource =
      (await session.requestHitTestSource?.({ space: viewerSpace })) ?? null;

    session.addEventListener('select', this.onArSelect);
    session.addEventListener('end', this.onArEnd);
    this.renderer.setAnimationLoop(this.onArFrame);
  }

  protected exitAr(): void {
    void this.arSession?.end();
  }

  private readonly onArSelect = (): void => {
    if (!this.reticle.visible || !this.model) {
      return;
    }
    const surface = new Vector3().setFromMatrixPosition(this.reticle.matrix);
    // The top-down rotation that faces the ortho camera would stand the device
    // upright on a Y-up surface, so AR uses the model's native orientation,
    // which lies flat with its thickness pointing up.
    this.model.rotation.set(0, 0, 0);
    this.model.position.copy(surface);
    this.model.updateMatrixWorld(true);
    // Rest the base on the surface rather than centring it through the plane.
    const box = new Box3().setFromObject(this.model);
    this.model.position.y += surface.y - box.min.y;
    this.model.visible = true;
    this.isArPlaced.set(true);
  };

  private readonly onArFrame = (_time: number, frame?: XRFrame): void => {
    const referenceSpace = this.renderer.xr.getReferenceSpace();
    if (frame && referenceSpace && this.hitTestSource) {
      const hits = frame.getHitTestResults(this.hitTestSource);
      const pose = hits[0]?.getPose(referenceSpace);
      if (pose) {
        this.reticle.visible = true;
        this.reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        this.reticle.visible = false;
      }
    }
    this.renderer.render(this.scene, this.arCamera);
  };

  private readonly onArEnd = (): void => {
    this.arSession?.removeEventListener('select', this.onArSelect);
    this.arSession?.removeEventListener('end', this.onArEnd);
    this.hitTestSource = null;
    this.arSession = null;
    this.renderer.setAnimationLoop(null);
    this.renderer.xr.enabled = false;
    this.isArActive.set(false);
    this.isArPlaced.set(false);

    // Restore the ordinary actual-size scene.
    this.scene.background = new Color(0x1f2127);
    this.gridHelper.visible = true;
    this.reticle.visible = false;
    if (this.model) {
      // Back to the top-down orientation the ortho view expects.
      this.model.rotation.set(Math.PI / 2, 0, 0);
      this.model.position.set(0, 0, 0);
      this.model.visible = true;
    }
    this.resetCameraOrientation();
    this.onResize();
    this.requestRender();
  };

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
