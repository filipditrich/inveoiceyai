import * as THREE from "three";

import {
  calculateInvoiceyPose,
  resolveCelebrationProgress,
  type InvoiceyPointer,
} from "./invoicey-3d-motion";
import { createInvoiceyModel, disposeInvoiceyModel } from "./invoicey-3d-model";

export type Invoicey3DScene = Readonly<{
  celebrate: () => void;
  dispose: () => void;
  resize: () => void;
  setActive: (active: boolean) => void;
  setHovered: (hovered: boolean) => void;
  setPointer: (pointer: InvoiceyPointer) => void;
  setScrollProgress: (progress: number) => void;
}>;

function smoothingFactor(deltaSeconds: number, speed: number) {
  return 1 - Math.exp(-deltaSeconds * speed);
}

function createRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    powerPreference: "high-performance",
    premultipliedAlpha: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  return renderer;
}

function addLighting(scene: THREE.Scene) {
  const hemisphere = new THREE.HemisphereLight(0xfff7eb, 0x47271d, 2.4);
  const key = new THREE.DirectionalLight(0xffe1c6, 5.2);
  key.position.set(-4.5, 6.5, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 24;
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -5;

  const rim = new THREE.DirectionalLight(0xd88050, 3.2);
  rim.position.set(5, 2.5, 2);
  const fill = new THREE.PointLight(0xffffff, 1.8, 18);
  fill.position.set(0, -1, 7);
  scene.add(hemisphere, key, rim, fill);
}

function addGroundShadow(scene: THREE.Scene) {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.15, 48),
    new THREE.MeshBasicMaterial({
      color: 0x2e1a14,
      depthWrite: false,
      opacity: 0.13,
      transparent: true,
    }),
  );
  shadow.position.set(0, -3.3, -0.45);
  shadow.scale.set(1.35, 0.3, 1);
  scene.add(shadow);
  return shadow;
}

export function createInvoicey3DScene(
  canvas: HTMLCanvasElement,
): Invoicey3DScene {
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  camera.position.set(0, 0.08, 10.4);
  camera.lookAt(0, -0.15, 0);

  addLighting(scene);
  const groundShadow = addGroundShadow(scene);
  const rig = createInvoiceyModel();
  scene.add(rig.root);

  let active = true;
  let celebrationStartedAt: number | null = null;
  let currentPointer: InvoiceyPointer = { x: 0, y: 0 };
  let frameId: number | null = null;
  let hovered = false;
  let lastFrameAt = performance.now();
  let scrollProgress = 0;
  let targetPointer: InvoiceyPointer = { x: 0, y: 0 };
  let targetScrollProgress = 0;

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const renderFrame = (now: number) => {
    const deltaSeconds = Math.min((now - lastFrameAt) / 1_000, 0.05);
    lastFrameAt = now;
    const pointerEase = smoothingFactor(deltaSeconds, 7.5);
    currentPointer = {
      x: THREE.MathUtils.lerp(currentPointer.x, targetPointer.x, pointerEase),
      y: THREE.MathUtils.lerp(currentPointer.y, targetPointer.y, pointerEase),
    };
    scrollProgress = THREE.MathUtils.lerp(
      scrollProgress,
      targetScrollProgress,
      smoothingFactor(deltaSeconds, 4),
    );

    const celebrationProgress = resolveCelebrationProgress(
      now,
      celebrationStartedAt,
    );
    const pose = calculateInvoiceyPose({
      celebrationProgress,
      elapsedSeconds: now / 1_000,
      pointer: currentPointer,
      scrollProgress,
    });

    rig.root.position.y = pose.bodyPositionY;
    rig.root.rotation.x = -0.03 + pose.bodyRotationX;
    rig.root.rotation.y = pose.bodyRotationY;
    rig.rightArm.rotation.z = -pose.handLift;
    rig.token.rotation.z = pose.tokenRotationZ;
    for (const eye of rig.eyes) {
      eye.rotation.x = pose.eyeY;
      eye.rotation.y = pose.eyeX;
    }
    const targetScale = hovered ? 0.95 : 0.92;
    const scale = THREE.MathUtils.lerp(
      rig.root.scale.x,
      targetScale,
      smoothingFactor(deltaSeconds, 8),
    );
    rig.root.scale.setScalar(scale);

    renderer.render(scene, camera);
    if (active) frameId = window.requestAnimationFrame(renderFrame);
  };

  const start = () => {
    if (frameId !== null) return;
    lastFrameAt = performance.now();
    frameId = window.requestAnimationFrame(renderFrame);
  };

  resize();
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  start();

  return {
    celebrate: () => {
      celebrationStartedAt = performance.now();
      start();
    },
    dispose: () => {
      active = false;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      disposeInvoiceyModel(rig.root);
      groundShadow.geometry.dispose();
      groundShadow.material.dispose();
      renderer.dispose();
    },
    resize,
    setActive: (nextActive) => {
      active = nextActive;
      if (active) start();
      if (!active && frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
    },
    setHovered: (nextHovered) => {
      hovered = nextHovered;
    },
    setPointer: (pointer) => {
      targetPointer = pointer;
    },
    setScrollProgress: (progress) => {
      targetScrollProgress = Math.min(1, Math.max(0, progress));
    },
  };
}
