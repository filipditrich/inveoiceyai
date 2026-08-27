import * as THREE from "three";

export type InvoiceyRig = Readonly<{
  eyes: readonly [THREE.Object3D, THREE.Object3D];
  root: THREE.Group;
  rightArm: THREE.Group;
  token: THREE.Group;
}>;

type InvoiceyMaterials = ReturnType<typeof createMaterials>;

const COLORS = {
  copper: 0xd77d4f,
  copperLight: 0xf2a06f,
  cream: 0xfffbf2,
  darkBrown: 0x3e2119,
  line: 0xcfc4b9,
  peach: 0xf2a07f,
  sole: 0xf5efe5,
  white: 0xffffff,
} as const;

function createMaterials() {
  return {
    copper: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.55,
      color: COLORS.copper,
      metalness: 0.42,
      roughness: 0.3,
    }),
    copperLight: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.45,
      color: COLORS.copperLight,
      metalness: 0.32,
      roughness: 0.32,
    }),
    cream: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.28,
      color: COLORS.cream,
      roughness: 0.46,
    }),
    dark: new THREE.MeshPhysicalMaterial({
      clearcoat: 0.2,
      color: COLORS.darkBrown,
      roughness: 0.5,
    }),
    line: new THREE.MeshStandardMaterial({
      color: COLORS.line,
      roughness: 0.72,
    }),
    peach: new THREE.MeshStandardMaterial({
      color: COLORS.peach,
      roughness: 0.62,
    }),
    sole: new THREE.MeshStandardMaterial({
      color: COLORS.sole,
      roughness: 0.62,
    }),
    white: new THREE.MeshStandardMaterial({
      color: COLORS.white,
      roughness: 0.34,
    }),
  };
}

function roundedRectangleShape(width: number, height: number, radius: number) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  return shape;
}

function createRoundedPanel(
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: THREE.Material,
) {
  const geometry = new THREE.ExtrudeGeometry(
    roundedRectangleShape(width, height, radius),
    {
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: Math.min(radius * 0.18, 0.08),
      bevelThickness: Math.min(depth * 0.25, 0.06),
      curveSegments: 10,
      depth,
      steps: 1,
    },
  );
  geometry.center();
  return new THREE.Mesh(geometry, material);
}

function createCapsule(
  radius: number,
  length: number,
  material: THREE.Material,
) {
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 6, 12, 1),
    material,
  );
}

function createTube(
  points: readonly THREE.Vector3[],
  radius: number,
  material: THREE.Material,
) {
  const curve = new THREE.CatmullRomCurve3([...points]);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, radius, 8, false),
    material,
  );
}

function createPaperBody(materials: InvoiceyMaterials) {
  const group = new THREE.Group();
  const rim = createRoundedPanel(3.32, 4.34, 0.34, 0.34, materials.dark);
  rim.position.z = -0.1;

  const paper = createRoundedPanel(3.14, 4.16, 0.3, 0.3, materials.cream);
  paper.position.z = 0.08;

  const foldGeometry = new THREE.BufferGeometry();
  foldGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 1.08, 0, 0, 1.08, -1.08, 0], 3),
  );
  foldGeometry.setIndex([0, 1, 2]);
  foldGeometry.computeVertexNormals();
  const fold = new THREE.Mesh(foldGeometry, materials.copperLight);
  fold.position.set(0.47, 2.08, 0.29);

  group.add(rim, paper, fold);
  addInvoiceMarks(group, materials);
  return group;
}

function addInvoiceMarks(group: THREE.Group, materials: InvoiceyMaterials) {
  const marks = [
    { width: 0.92, x: -0.74, y: 1.72, material: materials.dark },
    { width: 0.56, x: -0.92, y: 1.44, material: materials.copper },
    { width: 1.74, x: -0.34, y: -0.22, material: materials.line },
    { width: 2.12, x: 0, y: -0.55, material: materials.line },
    { width: 1.02, x: -0.54, y: -0.88, material: materials.line },
    { width: 1.7, x: -0.22, y: -1.2, material: materials.line },
  ];

  for (const mark of marks) {
    const mesh = createRoundedPanel(
      mark.width,
      0.13,
      0.07,
      0.065,
      mark.material,
    );
    mesh.position.set(mark.x, mark.y, 0.31);
    group.add(mesh);
  }
}

function createEye(materials: InvoiceyMaterials, x: number) {
  const eye = new THREE.Group();
  eye.position.set(x, 0.78, 0.34);

  const white = new THREE.Mesh(
    new THREE.SphereGeometry(0.39, 24, 18),
    materials.white,
  );
  white.scale.set(0.9, 1.14, 0.34);

  const pupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 16),
    materials.dark,
  );
  pupil.position.z = 0.23;
  pupil.scale.z = 0.4;

  const highlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 12, 8),
    materials.white,
  );
  highlight.position.set(-0.07, 0.09, 0.37);

  eye.add(white, pupil, highlight);
  return eye;
}

function createFace(materials: InvoiceyMaterials) {
  const group = new THREE.Group();
  const leftEye = createEye(materials, -0.62);
  const rightEye = createEye(materials, 0.62);

  const leftBrow = createTube(
    [
      new THREE.Vector3(-0.9, 1.35, 0.59),
      new THREE.Vector3(-0.65, 1.48, 0.64),
      new THREE.Vector3(-0.4, 1.38, 0.6),
    ],
    0.055,
    materials.dark,
  );
  const rightBrow = createTube(
    [
      new THREE.Vector3(0.4, 1.38, 0.6),
      new THREE.Vector3(0.65, 1.48, 0.64),
      new THREE.Vector3(0.9, 1.35, 0.59),
    ],
    0.055,
    materials.dark,
  );
  const smile = createTube(
    [
      new THREE.Vector3(-0.34, 0.08, 0.61),
      new THREE.Vector3(0, -0.12, 0.66),
      new THREE.Vector3(0.34, 0.08, 0.61),
    ],
    0.05,
    materials.dark,
  );

  const leftCheek = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 16, 10),
    materials.peach,
  );
  leftCheek.position.set(-1.08, 0.18, 0.53);
  leftCheek.scale.set(1.25, 0.58, 0.25);
  const rightCheek = leftCheek.clone();
  rightCheek.position.x = 1.08;

  group.add(
    leftEye,
    rightEye,
    leftBrow,
    rightBrow,
    smile,
    leftCheek,
    rightCheek,
  );
  return { eyes: [leftEye, rightEye] as const, group };
}

function createGlove(materials: InvoiceyMaterials) {
  const glove = new THREE.Group();
  const palm = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 18, 14),
    materials.cream,
  );
  palm.scale.set(1.05, 1.2, 0.72);

  for (const [index, x] of [-0.19, 0, 0.19].entries()) {
    const finger = createCapsule(0.085, 0.2, materials.cream);
    finger.position.set(x, 0.28 + Math.abs(index - 1) * -0.04, 0.08);
    finger.rotation.z = (index - 1) * -0.08;
    glove.add(finger);
  }

  glove.add(palm);
  return glove;
}

function createApprovalToken(materials: InvoiceyMaterials) {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.18, 36),
    materials.dark,
  );
  disc.rotation.x = Math.PI / 2;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.51, 0.09, 10, 36),
    materials.copperLight,
  );
  ring.position.z = 0.13;

  const check = createTube(
    [
      new THREE.Vector3(-0.24, 0.02, 0.24),
      new THREE.Vector3(-0.06, -0.18, 0.24),
      new THREE.Vector3(0.3, 0.23, 0.24),
    ],
    0.075,
    materials.copperLight,
  );
  group.add(disc, ring, check);
  return group;
}

function createRightArm(materials: InvoiceyMaterials) {
  const pivot = new THREE.Group();
  pivot.position.set(1.36, 0.1, 0.02);

  const arm = createCapsule(0.19, 0.78, materials.dark);
  arm.position.set(0.35, 0.3, -0.04);
  arm.rotation.z = -0.66;

  const glove = createGlove(materials);
  glove.position.set(0.74, 0.76, 0.25);
  glove.rotation.z = -0.28;

  const token = createApprovalToken(materials);
  token.position.set(0.78, 1.46, 0.18);
  token.rotation.z = -0.08;

  pivot.add(arm, glove, token);
  return { pivot, token };
}

function createClipboard(materials: InvoiceyMaterials) {
  const group = new THREE.Group();
  const board = createRoundedPanel(1.12, 1.48, 0.18, 0.16, materials.dark);
  const clip = createRoundedPanel(0.55, 0.2, 0.14, 0.08, materials.copperLight);
  clip.position.set(0, 0.76, 0.08);

  const markOne = createRoundedPanel(
    0.3,
    0.1,
    0.05,
    0.05,
    materials.copperLight,
  );
  markOne.position.set(-0.08, 0.18, 0.13);
  markOne.rotation.z = -0.62;
  const markTwo = markOne.clone();
  markTwo.position.set(0.12, 0.02, 0.13);

  group.add(board, clip, markOne, markTwo);
  return group;
}

function createLeftArm(materials: InvoiceyMaterials) {
  const pivot = new THREE.Group();
  pivot.position.set(-1.36, 0, 0);

  const arm = createCapsule(0.2, 0.8, materials.dark);
  arm.position.set(-0.38, -0.34, -0.03);
  arm.rotation.z = -0.72;

  const clipboard = createClipboard(materials);
  clipboard.position.set(-0.55, -0.46, 0.42);
  clipboard.rotation.z = 0.12;

  const glove = createGlove(materials);
  glove.position.set(-0.42, -0.58, 0.62);
  glove.scale.setScalar(0.88);
  glove.rotation.z = 0.8;

  pivot.add(arm, clipboard, glove);
  return pivot;
}

function createLegs(materials: InvoiceyMaterials) {
  const group = new THREE.Group();

  for (const side of [-1, 1]) {
    const leg = createCapsule(0.23, 0.68, materials.dark);
    leg.position.set(side * 0.68, -2.31, -0.04);

    const shoe = createCapsule(0.28, 0.72, materials.dark);
    shoe.position.set(side * 0.68, -2.92, 0.12);
    shoe.rotation.z = Math.PI / 2 + side * 0.05;
    shoe.scale.set(1.08, 1, 0.76);

    const sole = createRoundedPanel(0.92, 0.14, 0.21, 0.07, materials.sole);
    sole.position.set(side * 0.68, -3.16, 0.15);
    sole.rotation.z = side * 0.05;

    const buckle = createRoundedPanel(
      0.36,
      0.14,
      0.08,
      0.05,
      materials.copperLight,
    );
    buckle.position.set(side * 0.68, -2.72, 0.47);
    buckle.rotation.z = side * 0.05;

    group.add(leg, shoe, sole, buckle);
  }

  return group;
}

function prepareMeshes(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

export function createInvoiceyModel(): InvoiceyRig {
  const materials = createMaterials();
  const root = new THREE.Group();
  const body = createPaperBody(materials);
  const face = createFace(materials);
  const rightArm = createRightArm(materials);

  root.add(
    createLegs(materials),
    body,
    face.group,
    createLeftArm(materials),
    rightArm.pivot,
  );
  root.rotation.x = -0.03;
  root.scale.setScalar(0.92);
  prepareMeshes(root);

  return {
    eyes: face.eyes,
    rightArm: rightArm.pivot,
    root,
    token: rightArm.token,
  };
}

export function disposeInvoiceyModel(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) material.dispose();
  });
}
