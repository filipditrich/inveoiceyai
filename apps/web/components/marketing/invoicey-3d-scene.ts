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
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  return renderer;
}

function addLighting(scene: THREE.Scene) {
  const hemisphere = new THREE.HemisphereLight(0xfff8ee, 0x5a3326, 2.15);
  const key = new THREE.DirectionalLight(0xffe5cf, 3.25);
  key.position.set(-4.5, 6.5, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 24;
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -5;

  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;

  const rim = new THREE.DirectionalLight(0xd88050, 1.65);
  rim.position.set(5, 2.5, 2);
  const fill = new THREE.PointLight(0xffffff, 1.15, 18);
  fill.position.set(0, -1, 7);
  scene.add(hemisphere, key, rim, fill);
}

function addGroundShadow(scene: THREE.Scene) {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.15, 48),
    new THREE.MeshBasicMaterial({
      color: 0x2e1a14,
      depthWrite: false,
      opacity: 0.09,
      transparent: true,
    }),
  );
  shadow.position.set(0, -3.3, -0.45);
  shadow.scale.set(1.18, 0.25, 1);
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
  const tokenRestY = rig.token.position.y;
  scene.add(rig.root);

  let active = true;
  let celebrationStartedAt: number | null = null;
  let currentPointer: InvoiceyPointer = { x: 0, y: 0 };
  let currentScale = 0.92;
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
    rig.root.rotation.z = pose.bodyRotationZ;
    rig.leftArm.rotation.z = pose.leftArmRotationZ;
    rig.rightArm.rotation.z = pose.rightArmRotationZ;
    rig.legs[0].rotation.z = pose.legSwing;
    rig.legs[1].rotation.z = -pose.legSwing;
    rig.token.position.y = tokenRestY + pose.tokenPositionY;
    rig.token.rotation.y = pose.tokenRotationY;
    rig.token.rotation.z = pose.tokenRotationZ;
    for (const [index, eye] of rig.eyes.entries()) {
      eye.scale.y = pose.eyeScaleY;
      const pupil = rig.pupils[index];
      if (!pupil) continue;
      pupil.position.x = pose.eyeX;
      pupil.position.y = pose.eyeY;
    }
    const targetScale = hovered ? 0.95 : 0.92;
    currentScale = THREE.MathUtils.lerp(
      currentScale,
      targetScale,
      smoothingFactor(deltaSeconds, 8),
    );
    rig.root.scale.set(
      currentScale * pose.bodyScaleX,
      currentScale * pose.bodyScaleY,
      currentScale,
    );

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
