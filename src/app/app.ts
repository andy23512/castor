import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  HostListener,
  inject,
  viewChild,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import {
  ACESFilmicToneMapping,
  AmbientLight,
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
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';
import { ScreenSettingStore } from './stores/screen-setting.store';

@Component({
  imports: [RouterModule, MatIcon, MatIconButton],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    class: 'size-full relative',
  },
})
export class App implements AfterViewInit {
  private readonly screenSettingStore = inject(ScreenSettingStore);
  private readonly rendererContainer =
    viewChild<ElementRef<HTMLDivElement>>('rendererContainer');

  private readonly matDialog = inject(MatDialog);

  private readonly renderer = new WebGLRenderer();
  private readonly scene = new Scene();
  private readonly camera: OrthographicCamera;

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

    const loader = new GLTFLoader();
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
      },
      undefined,
      (error) => {
        console.error(error);
      },
    );
    effect(() => {
      this.screenSettingStore.ppi();
      this.onResize();
    });
  }

  public ngAfterViewInit(): void {
    const element = this.rendererContainer()?.nativeElement;
    if (!element) {
      return;
    }
    this.onResize();
    element.appendChild(this.renderer.domElement);
    this.animate();
  }

  @HostListener('window:resize')
  public onResize(): void {
    const element = this.rendererContainer()?.nativeElement;
    if (!element) {
      return;
    }
    const ppi = this.screenSettingStore.ppi();
    const widthMeters = (element.clientWidth / ppi) * 0.0254;
    const heightMeters = (element.clientHeight / ppi) * 0.0254;
    this.camera.left = -widthMeters / 2;
    this.camera.right = widthMeters / 2;
    this.camera.top = heightMeters / 2;
    this.camera.bottom = -heightMeters / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(element?.clientWidth, element?.clientHeight);
  }

  protected openSettingsDialog(): void {
    this.matDialog.open(SettingsDialogComponent, {
      width: '80vw',
      minWidth: '80vw',
    });
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }
}
