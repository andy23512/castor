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
  AmbientLight,
  DirectionalLight,
  GridHelper,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from 'three';
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
    this.camera.position.set(0, 0, 5);
    const gridHelper = new GridHelper(1, 100);
    this.scene.add(gridHelper);
    gridHelper.rotation.x = Math.PI / 2;
    this.scene.add(new AmbientLight(0xffffff, 1.0));
    const light = new DirectionalLight(0xffffff, 0.8);
    light.position.set(5, 10, 7);
    this.scene.add(light);
    const loader = new GLTFLoader();
    loader.load(
      'charachorder-models/CC2 Full Assembly.glb',
      (gltf) => {
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
