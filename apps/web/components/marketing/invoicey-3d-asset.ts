import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_PATH = "/brand/models/invoicey.glb";
const MODEL_HEIGHT = 6.35;
const MODEL_FLOOR_Y = -3.2;

export type InvoiceyModelBounds = Readonly<{
  max: Readonly<{ x: number; y: number; z: number }>;
  min: Readonly<{ x: number; y: number; z: number }>;
}>;

export type InvoiceyModelTransform = Readonly<{
  position: Readonly<{ x: number; y: number; z: number }>;
  scale: number;
}>;

export function calculateInvoiceyModelTransform(
  bounds: InvoiceyModelBounds,
): InvoiceyModelTransform {
  const height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error("Invoicey model must have a positive finite height");
  }

  const scale = MODEL_HEIGHT / height;
  return {
    position: {
      x: -((bounds.min.x + bounds.max.x) / 2) * scale,
      y: MODEL_FLOOR_Y - bounds.min.y * scale,
      z: -((bounds.min.z + bounds.max.z) / 2) * scale,
    },
    scale,
  };
}

function configureMesh(mesh: THREE.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;

  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  for (const material of materials) {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.envMapIntensity = 0.65;
      material.needsUpdate = true;
    }
  }
}

export async function loadInvoiceyModel() {
  const { scene } = await new GLTFLoader().loadAsync(MODEL_PATH);
  scene.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(scene);
  const transform = calculateInvoiceyModelTransform({
    max: bounds.max,
    min: bounds.min,
  });
  scene.scale.setScalar(transform.scale);
  scene.position.set(
    transform.position.x,
    transform.position.y,
    transform.position.z,
  );
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) configureMesh(object);
  });

  const root = new THREE.Group();
  root.name = "Invoicey";
  root.add(scene);
  return root;
}

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

export function disposeInvoiceyModel(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    if (Array.isArray(object.material)) {
      object.material.forEach(disposeMaterial);
      return;
    }
    disposeMaterial(object.material);
  });
}
