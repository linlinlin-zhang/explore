import * as THREE from 'three';
import { seededRandom } from './SimplexNoise';

type LayerRole = 'terrain' | 'rock' | 'accent' | 'sky' | 'ink' | 'plant' | 'paper';

interface LayerItem {
  group: THREE.Group;
  baseX: number;
  baseY: number;
  baseZ: number;
  speed: number;
  sway: number;
  scale: number;
}

interface PaletteInput {
  terrain: THREE.Color;
  rock: THREE.Color;
  sky: THREE.Color;
  accent: THREE.Color;
}

export class GraphicNovelLayers {
  private root = new THREE.Group();
  private scene: THREE.Scene;
  private items: LayerItem[] = [];
  private materials: Array<THREE.MeshBasicMaterial | THREE.LineBasicMaterial> = [];
  private time = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.root.name = 'graphic-novel-layers';
    this.scene.add(this.root);
    this.build();
  }

  private material(color: number, opacity: number, role: LayerRole) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    });
    mat.userData.baseColor = new THREE.Color(color);
    mat.userData.baseOpacity = opacity;
    mat.userData.role = role;
    this.materials.push(mat);
    return mat;
  }

  private lineMaterial(color: number, opacity: number, role: LayerRole) {
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthTest: true,
      depthWrite: false,
    });
    mat.userData.baseColor = new THREE.Color(color);
    mat.userData.baseOpacity = opacity;
    mat.userData.role = role;
    this.materials.push(mat);
    return mat;
  }

  private shapeFromPoints(points: THREE.Vector2[]) {
    const shape = new THREE.Shape();
    points.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    return shape;
  }

  private meshFromPoints(
    group: THREE.Group,
    points: THREE.Vector2[],
    mat: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number] | number = 1,
    rotation: [number, number, number] = [0, 0, 0]
  ) {
    const geometry = new THREE.ShapeGeometry(this.shapeFromPoints(points), 18);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    if (typeof scale === 'number') mesh.scale.setScalar(scale);
    else mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.renderOrder = -4;
    group.add(mesh);
    return mesh;
  }

  private lineFromPoints(
    group: THREE.Group,
    points: THREE.Vector3[],
    mat: THREE.Material
  ) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, mat);
    line.renderOrder = -3;
    group.add(line);
    return line;
  }

  private mesaPoints(width: number, height: number, seed: number) {
    const points: THREE.Vector2[] = [new THREE.Vector2(-width / 2, 0)];
    const leftInset = width * (0.08 + seededRandom(seed + 1) * 0.12);
    points.push(new THREE.Vector2(-width / 2 + leftInset * 0.35, height * 0.28));
    points.push(new THREE.Vector2(-width / 2 + leftInset, height * 0.72));
    const steps = 9;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = -width / 2 + leftInset + t * (width - leftInset * 1.8);
      const shelf =
        Math.sin(t * Math.PI * 4 + seed * 0.17) * height * 0.035 +
        Math.sin(t * Math.PI * 9 + seed * 0.09) * height * 0.018;
      const notch = i === 3 || i === 7 ? -height * (0.08 + seededRandom(seed + i) * 0.05) : 0;
      points.push(new THREE.Vector2(x, height + shelf + notch));
    }
    points.push(new THREE.Vector2(width / 2 - leftInset * 0.5, height * 0.58));
    points.push(new THREE.Vector2(width / 2, 0));
    return points;
  }

  private cloudPoints(width: number, height: number, seed: number) {
    const points: THREE.Vector2[] = [];
    const steps = 18;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = -width / 2 + t * width;
      const y =
        Math.sin(t * Math.PI * 3 + seed) * height * 0.24 +
        Math.sin(t * Math.PI * 8 + seed * 0.7) * height * 0.09 +
        height * 0.5;
      points.push(new THREE.Vector2(x, y));
    }
    for (let i = steps; i >= 0; i -= 1) {
      const t = i / steps;
      const x = -width / 2 + t * width;
      const y =
        Math.sin(t * Math.PI * 2 + seed * 0.3) * height * 0.12 -
        Math.sin(t * Math.PI * 7 + seed * 0.4) * height * 0.05 -
        height * 0.42;
      points.push(new THREE.Vector2(x, y));
    }
    return points;
  }

  private leafPoints(scale: number, seed: number) {
    const lean = seededRandom(seed) * 0.24 - 0.12;
    return [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(scale * (0.28 + lean), scale * 0.16),
      new THREE.Vector2(scale * 0.48, scale * 0.82),
      new THREE.Vector2(scale * 0.16, scale * 1.28),
      new THREE.Vector2(0, scale * 1.46),
      new THREE.Vector2(-scale * 0.2, scale * 1.08),
      new THREE.Vector2(-scale * 0.48, scale * 0.68),
      new THREE.Vector2(-scale * 0.24, scale * 0.14),
    ];
  }

  private addStrata(group: THREE.Group, width: number, height: number, count: number, z: number, seed: number, opacity = 0.2) {
    const mat = this.lineMaterial(0x2a1a12, opacity, 'ink');
    for (let i = 0; i < count; i += 1) {
      const y = height * (0.16 + (i / Math.max(1, count - 1)) * 0.72);
      const points: THREE.Vector3[] = [];
      const segments = 12;
      for (let s = 0; s <= segments; s += 1) {
        const t = s / segments;
        const x = -width / 2 + t * width;
        points.push(new THREE.Vector3(
          x,
          y + Math.sin(t * Math.PI * 5 + seed + i) * 0.06 * height,
          z
        ));
      }
      this.lineFromPoints(group, points, mat);
    }
  }

  private addMesaCluster(baseZ: number, seed: number, side: -1 | 1, scale = 1) {
    const group = new THREE.Group();
    const matA = this.material(0xd79b9f, 0.32, 'rock');
    const matB = this.material(0xf2b37d, 0.22, 'terrain');
    const matC = this.material(0xa58598, 0.26, 'rock');

    for (let i = 0; i < 4; i += 1) {
      const width = (7 + seededRandom(seed + i) * 8) * scale;
      const height = (5 + seededRandom(seed + 20 + i) * 11) * scale;
      const x = side * (14 + i * 5.4 + seededRandom(seed + 40 + i) * 4);
      const z = -i * 0.35;
      const mat = i % 3 === 0 ? matA : i % 3 === 1 ? matB : matC;
      this.meshFromPoints(group, this.mesaPoints(width, height, seed + i * 13), mat, [x, 0, z], 1, [0, 0, (seededRandom(seed + 70 + i) - 0.5) * 0.035]);
      this.addStrata(group, width * 0.86, height, 9 + i * 3, z + 0.018, seed + i * 17, 0.075 + i * 0.012);
    }

    this.addItem(group, side * 2.5, 0.2, baseZ, 0.55 + seededRandom(seed + 80) * 0.08, 0.18, 1);
  }

  private addCloudBand(baseZ: number, seed: number, y: number, width: number, opacity: number) {
    const group = new THREE.Group();
    const cloud = this.material(0xfff2dc, opacity, 'paper');
    const shadow = this.lineMaterial(0x2a1a12, opacity * 0.34, 'ink');
    for (let i = 0; i < 3; i += 1) {
      const w = width * (0.72 + seededRandom(seed + i) * 0.44);
      const h = 0.5 + seededRandom(seed + 20 + i) * 0.55;
      const x = (seededRandom(seed + 40 + i) - 0.5) * 32;
      const points = this.cloudPoints(w, h, seed + i * 7);
      this.meshFromPoints(group, points, cloud, [x, y + i * 0.42, -i * 0.12], 1, [0, 0, (seededRandom(seed + 60 + i) - 0.5) * 0.018]);
      this.lineFromPoints(group, points.map((p) => new THREE.Vector3(p.x + x, p.y + y + i * 0.42, -i * 0.12 + 0.01)), shadow);
    }
    this.addItem(group, 0, 0, baseZ, 0.34, 0.1, 1);
  }

  private addPlantPatch(baseZ: number, seed: number, side: -1 | 1) {
    const group = new THREE.Group();
    const trunk = this.lineMaterial(0x34231a, 0.5, 'ink');
    const leafA = this.material(0x5aa384, 0.72, 'plant');
    const leafB = this.material(0x9fd0a3, 0.58, 'plant');
    const bloom = this.material(0xe86648, 0.62, 'accent');

    for (let p = 0; p < 7; p += 1) {
      const x = side * (9 + p * 2.2 + seededRandom(seed + p) * 2.2);
      const stemHeight = 1.8 + seededRandom(seed + 20 + p) * 2.6;
      this.lineFromPoints(
        group,
        [
          new THREE.Vector3(x, 0, 0),
          new THREE.Vector3(x + side * 0.18, stemHeight * 0.5, 0.02),
          new THREE.Vector3(x + side * 0.05, stemHeight, 0.02),
        ],
        trunk
      );
      for (let l = 0; l < 7; l += 1) {
        const angle = -0.92 + l * 0.31 + seededRandom(seed + 60 + p * 11 + l) * 0.18;
        const mat = l % 2 === 0 ? leafA : leafB;
        this.meshFromPoints(
          group,
          this.leafPoints(0.56 + seededRandom(seed + 90 + l) * 0.32, seed + p * 13 + l),
          mat,
          [x + Math.cos(angle) * 0.45, stemHeight - 0.16 + Math.sin(l) * 0.08, 0.04 + l * 0.01],
          [side, 1, 1],
          [0, 0, angle * side]
        );
      }
      if (p % 2 === 0) {
        this.meshFromPoints(
          group,
          this.leafPoints(0.26, seed + 170 + p),
          bloom,
          [x + side * 0.18, stemHeight + 0.16, 0.1],
          [1.2, 0.55, 1],
          [0, 0, side * 1.1]
        );
      }

      const undergrowthCount = 3 + (p % 3);
      for (let u = 0; u < undergrowthCount; u += 1) {
        const spread = (u - (undergrowthCount - 1) * 0.5) * 0.34;
        this.meshFromPoints(
          group,
          this.leafPoints(0.22 + seededRandom(seed + 210 + p * 13 + u) * 0.14, seed + 240 + p * 17 + u),
          u % 2 === 0 ? leafA : leafB,
          [x + spread * side, 0.1 + seededRandom(seed + 260 + p + u) * 0.12, 0.02 + u * 0.01],
          [1.2, 0.52, 1],
          [0, 0, side * (-0.7 + u * 0.44)]
        );
      }
    }

    this.addItem(group, 0, 0.08, baseZ, 0.86 + seededRandom(seed + 120) * 0.05, 0.45, 1);
  }

  private addWireRun(baseZ: number, seed: number, side: -1 | 1) {
    const group = new THREE.Group();
    const pole = this.material(0x5a4c48, 0.46, 'ink');
    const wire = this.lineMaterial(0x2a1a12, 0.32, 'ink');
    const flag = this.material(0x7fd0c4, 0.48, 'accent');
    const startX = side * (10 + seededRandom(seed) * 5);

    for (let i = 0; i < 5; i += 1) {
      const x = startX + side * i * 4.6;
      const h = 3.6 + seededRandom(seed + i * 5) * 2.2;
      this.meshFromPoints(
        group,
        [
          new THREE.Vector2(-0.07, 0),
          new THREE.Vector2(0.08, 0),
          new THREE.Vector2(0.05, h),
          new THREE.Vector2(-0.05, h),
        ],
        pole,
        [x, 0, 0],
        1,
        [0, 0, (seededRandom(seed + 30 + i) - 0.5) * 0.04]
      );
      this.meshFromPoints(
        group,
        [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(side * 1.1, 0.18),
          new THREE.Vector2(side * 0.9, -0.22),
        ],
        flag,
        [x, h * 0.7, 0.06],
        1,
        [0, 0, side * 0.06]
      );
      if (i > 0) {
        const prevX = startX + side * (i - 1) * 4.6;
        this.lineFromPoints(
          group,
          [
            new THREE.Vector3(prevX, h + Math.sin(i) * 0.14, 0.04),
            new THREE.Vector3((prevX + x) * 0.5, h - 0.46, 0.04),
            new THREE.Vector3(x, h + Math.cos(i) * 0.14, 0.04),
          ],
          wire
        );
      }
    }

    this.addItem(group, 0, 0.15, baseZ, 0.78, 0.28, 1);
  }

  private addRingField(baseZ: number, seed: number, side: -1 | 1) {
    const group = new THREE.Group();
    const ring = this.material(0x8ed9d0, 0.34, 'accent');
    const stone = this.material(0xe7c89f, 0.22, 'terrain');
    const ink = this.lineMaterial(0x2a1a12, 0.2, 'ink');

    for (let i = 0; i < 3; i += 1) {
      const span = 2.4 + seededRandom(seed + i) * 1.6;
      const height = 2.8 + seededRandom(seed + 20 + i) * 1.8;
      const x = side * (10 + i * 4.8 + seededRandom(seed + 40 + i) * 1.4);
      const outer: THREE.Vector2[] = [];
      const segments = 16;
      for (let s = 0; s <= segments; s += 1) {
        const t = s / segments;
        const angle = Math.PI * (1 - t);
        outer.push(new THREE.Vector2(Math.cos(angle) * span * 0.5, Math.sin(angle) * height));
      }
      outer.push(new THREE.Vector2(span * 0.5, 0));
      outer.push(new THREE.Vector2(span * 0.3, 0));
      for (let s = segments; s >= 0; s -= 1) {
        const t = s / segments;
        const angle = Math.PI * (1 - t);
        outer.push(new THREE.Vector2(Math.cos(angle) * span * 0.3, Math.sin(angle) * height * 0.78 + 0.2));
      }
      outer.push(new THREE.Vector2(-span * 0.3, 0));
      outer.push(new THREE.Vector2(-span * 0.5, 0));
      this.meshFromPoints(group, outer, i === 1 ? ring : stone, [x, 0.2, -i * 0.16], 1, [0, 0, side * (0.03 + i * 0.02)]);
      this.lineFromPoints(group, outer.map((p) => new THREE.Vector3(p.x + x, p.y + 0.2, -i * 0.16 + 0.02)), ink);
    }

    this.addItem(group, 0, 0.1, baseZ, 0.62, 0.24, 1);
  }

  private addTowerSettlement(baseZ: number, seed: number, side: -1 | 1) {
    const group = new THREE.Group();
    const wall = this.material(0xdd9ea9, 0.28, 'rock');
    const tower = this.material(0xe9b88a, 0.22, 'terrain');
    const dome = this.material(0x85c7bf, 0.26, 'accent');
    const ink = this.lineMaterial(0x2a1a12, 0.18, 'ink');

    for (let i = 0; i < 5; i += 1) {
      const w = 1.5 + seededRandom(seed + i) * 1.7;
      const h = 4.4 + seededRandom(seed + 40 + i) * 5.4;
      const x = side * (11 + i * 2.8 + seededRandom(seed + 60 + i) * 1.4);
      const y = seededRandom(seed + 80 + i) * 0.34;
      const body = [
        new THREE.Vector2(-w / 2, 0),
        new THREE.Vector2(-w / 2 + 0.12, h * 0.72),
        new THREE.Vector2(-w * 0.24, h),
        new THREE.Vector2(w * 0.18, h * 0.96),
        new THREE.Vector2(w / 2 - 0.16, h * 0.68),
        new THREE.Vector2(w / 2, 0),
      ];
      this.meshFromPoints(group, body, i % 2 === 0 ? wall : tower, [x, y, -i * 0.2], 1, [0, 0, side * 0.02]);
      this.lineFromPoints(group, [...body, body[0]].map((p) => new THREE.Vector3(p.x + x, p.y + y, -i * 0.2 + 0.01)), ink);
      if (i % 2 === 1) {
        const roof = [
          new THREE.Vector2(-w * 0.3, 0),
          new THREE.Vector2(0, w * 0.42),
          new THREE.Vector2(w * 0.3, 0),
        ];
        this.meshFromPoints(group, roof, dome, [x, y + h, 0.06 - i * 0.2], [1.1, 0.8, 1], [0, 0, 0]);
      }
      if (i < 4) {
        const deckW = 1.2 + seededRandom(seed + 100 + i) * 1.4;
        const deck = [
          new THREE.Vector2(-deckW / 2, 0),
          new THREE.Vector2(deckW / 2, 0),
          new THREE.Vector2(deckW / 2 - 0.14, 0.22),
          new THREE.Vector2(-deckW / 2 + 0.14, 0.22),
        ];
        const deckY = 2.2 + i * 0.82;
        this.meshFromPoints(group, deck, tower, [x + side * (1.2 + i * 0.4), deckY, 0.04], 1, [0, 0, side * 0.06]);
      }
    }

    this.addItem(group, 0, 0.18, baseZ, 0.58, 0.16, 1);
  }

  private addWreckSilhouette(baseZ: number, seed: number, side: -1 | 1) {
    const group = new THREE.Group();
    const hull = this.material(0xbaa195, 0.24, 'rock');
    const accent = this.material(0x6fd5ca, 0.2, 'accent');
    const ink = this.lineMaterial(0x2a1a12, 0.18, 'ink');
    const x = side * (12 + seededRandom(seed) * 6);

    const hullPoints = [
      new THREE.Vector2(-4.6, 0),
      new THREE.Vector2(-2.2, 0.86),
      new THREE.Vector2(1.8, 1.14),
      new THREE.Vector2(4.8, 0.38),
      new THREE.Vector2(4.3, -0.18),
      new THREE.Vector2(-3.9, -0.28),
    ];
    this.meshFromPoints(group, hullPoints, hull, [x, 1.0, 0], [1.1, 0.9, 1], [0, 0, side * 0.08]);
    this.lineFromPoints(group, [...hullPoints, hullPoints[0]].map((p) => new THREE.Vector3(p.x + x, p.y + 1.0, 0.02)), ink);

    const fin = [
      new THREE.Vector2(-0.18, 0),
      new THREE.Vector2(0.2, 2.8),
      new THREE.Vector2(0.56, 0),
    ];
    this.meshFromPoints(group, fin, hull, [x - side * 0.5, 1.4, 0.04], [1.2, 1.1, 1], [0, 0, side * 0.28]);
    this.meshFromPoints(group, fin, hull, [x + side * 2.0, 1.0, 0.08], [0.8, 0.7, 1], [0, 0, -side * 0.42]);

    const glow = [
      new THREE.Vector2(-0.34, 0),
      new THREE.Vector2(0, 0.38),
      new THREE.Vector2(0.34, 0),
      new THREE.Vector2(0, -0.18),
    ];
    this.meshFromPoints(group, glow, accent, [x - side * 3.6, 1.4, 0.08], [1.3, 1, 1], [0, 0, 0]);

    this.addItem(group, 0, 0.16, baseZ, 0.68, 0.2, 1);
  }

  private addSkyDebris(baseZ: number, seed: number) {
    const group = new THREE.Group();
    const stone = this.material(0xddd3c6, 0.26, 'paper');
    const ink = this.lineMaterial(0x2a1a12, 0.12, 'ink');

    for (let i = 0; i < 12; i += 1) {
      const sides = 5 + Math.floor(seededRandom(seed + i) * 4);
      const radius = 0.16 + seededRandom(seed + 30 + i) * 0.52;
      const points: THREE.Vector2[] = [];
      for (let s = 0; s < sides; s += 1) {
        const angle = (s / sides) * Math.PI * 2;
        const r = radius * (0.72 + seededRandom(seed + i * 20 + s) * 0.55);
        points.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
      }
      const x = (seededRandom(seed + 80 + i) - 0.5) * 48;
      const y = 8 + seededRandom(seed + 120 + i) * 13;
      const z = (seededRandom(seed + 160 + i) - 0.5) * 3;
      this.meshFromPoints(group, points, stone, [x, y, z], [1.3, 0.84, 1], [0, 0, seededRandom(seed + i) * Math.PI]);
      this.lineFromPoints(group, [...points, points[0]].map((p) => new THREE.Vector3(p.x + x, p.y + y, z + 0.02)), ink);
    }

    this.addItem(group, 0, 0, baseZ, 0.42, 0.16, 1);
  }

  private addHabitatCluster(baseZ: number, seed: number, side: -1 | 1) {
    const group = new THREE.Group();
    const wall = this.material(0xe7b3b8, 0.28, 'rock');
    const terrace = this.material(0xf1c688, 0.2, 'terrain');
    const dome = this.material(0x8fd7cb, 0.26, 'accent');
    const ink = this.lineMaterial(0x2a1a12, 0.18, 'ink');

    for (let i = 0; i < 4; i += 1) {
      const deckW = 3.8 + seededRandom(seed + i) * 2.2;
      const deckH = 0.42 + seededRandom(seed + 20 + i) * 0.22;
      const deckX = side * (10.5 + i * 3.9 + seededRandom(seed + 40 + i) * 1.6);
      const deckY = i * (0.44 + seededRandom(seed + 60 + i) * 0.22);
      const deck = [
        new THREE.Vector2(-deckW / 2, 0),
        new THREE.Vector2(deckW / 2, 0),
        new THREE.Vector2(deckW / 2 - 0.28, deckH),
        new THREE.Vector2(-deckW / 2 + 0.36, deckH),
      ];
      this.meshFromPoints(group, deck, terrace, [deckX, deckY, -i * 0.14], 1, [0, 0, side * 0.04]);

      const bodyW = 1.4 + seededRandom(seed + 80 + i) * 1.3;
      const bodyH = 2.8 + seededRandom(seed + 100 + i) * 2.4;
      const body = [
        new THREE.Vector2(-bodyW / 2, 0),
        new THREE.Vector2(-bodyW / 2 + 0.08, bodyH * 0.72),
        new THREE.Vector2(-bodyW * 0.24, bodyH),
        new THREE.Vector2(bodyW * 0.22, bodyH * 0.96),
        new THREE.Vector2(bodyW / 2 - 0.1, bodyH * 0.72),
        new THREE.Vector2(bodyW / 2, 0),
      ];
      const bodyX = deckX + side * (-0.8 + seededRandom(seed + 120 + i) * 1.6);
      this.meshFromPoints(group, body, wall, [bodyX, deckY + deckH * 0.3, 0.08 - i * 0.12], 1, [0, 0, side * 0.03]);
      this.lineFromPoints(group, [...body, body[0]].map((p) => new THREE.Vector3(p.x + bodyX, p.y + deckY + deckH * 0.3, 0.1 - i * 0.12)), ink);

      const awning = [
        new THREE.Vector2(-0.9, 0),
        new THREE.Vector2(0.9, 0.06),
        new THREE.Vector2(0.64, 0.34),
        new THREE.Vector2(-0.74, 0.3),
      ];
      this.meshFromPoints(group, awning, i % 2 === 0 ? dome : terrace, [bodyX + side * 0.06, deckY + deckH + bodyH * 0.62, 0.16], 1, [0, 0, side * (0.08 + i * 0.02)]);
      if (i % 2 === 1) {
        const cap = [
          new THREE.Vector2(-bodyW * 0.28, 0),
          new THREE.Vector2(0, bodyW * 0.4),
          new THREE.Vector2(bodyW * 0.28, 0),
        ];
        this.meshFromPoints(group, cap, dome, [bodyX, deckY + deckH + bodyH, 0.2], [1.1, 0.8, 1], [0, 0, 0]);
      }

      const portal = [
        new THREE.Vector2(-0.22, 0),
        new THREE.Vector2(-0.18, 0.78),
        new THREE.Vector2(0, 1.02),
        new THREE.Vector2(0.18, 0.78),
        new THREE.Vector2(0.22, 0),
      ];
      this.meshFromPoints(group, portal, this.material(0xf4ead6, 0.18, 'paper'), [bodyX + side * 0.16, deckY + deckH * 0.3, 0.14], [0.78, 0.92, 1], [0, 0, 0]);
    }

    for (let i = 0; i < 3; i += 1) {
      const aX = side * (9.4 + i * 5.2);
      const bX = side * (13.5 + i * 5.4);
      const y = 3.4 + i * 0.64;
      this.lineFromPoints(
        group,
        [
          new THREE.Vector3(aX, y, 0.02),
          new THREE.Vector3((aX + bX) * 0.5, y - 0.42, 0.02),
          new THREE.Vector3(bX, y + 0.08, 0.02),
        ],
        ink
      );
    }

    this.addItem(group, 0, 0.12, baseZ, 0.64 + seededRandom(seed + 300) * 0.05, 0.18, 1);
  }

  private addCausewayScaffold(baseZ: number, seed: number, side: -1 | 1) {
    const group = new THREE.Group();
    const frame = this.material(0x7f6a63, 0.24, 'ink');
    const deck = this.material(0xf0b98b, 0.2, 'terrain');
    const accent = this.material(0x91d8cf, 0.24, 'accent');
    const ink = this.lineMaterial(0x2a1a12, 0.2, 'ink');

    for (let i = 0; i < 4; i += 1) {
      const x = side * (11 + i * 4.8 + seededRandom(seed + i) * 1.2);
      const h = 4.4 + seededRandom(seed + 18 + i) * 3.6;
      const tower = [
        new THREE.Vector2(-0.16, 0),
        new THREE.Vector2(0.18, 0),
        new THREE.Vector2(0.12, h),
        new THREE.Vector2(-0.12, h),
      ];
      this.meshFromPoints(group, tower, frame, [x, 0, -i * 0.06], 1, [0, 0, side * (0.02 + i * 0.01)]);
      this.lineFromPoints(group, [
        new THREE.Vector3(x - 0.18, 0, 0.02),
        new THREE.Vector3(x + 0.18, h * 0.42, 0.02),
        new THREE.Vector3(x - 0.18, h * 0.9, 0.02),
      ], ink);
      this.lineFromPoints(group, [
        new THREE.Vector3(x + 0.18, 0, 0.02),
        new THREE.Vector3(x - 0.18, h * 0.42, 0.02),
        new THREE.Vector3(x + 0.18, h * 0.9, 0.02),
      ], ink);

      const platform = [
        new THREE.Vector2(-1.1, 0),
        new THREE.Vector2(1.1, 0.06),
        new THREE.Vector2(0.92, 0.3),
        new THREE.Vector2(-0.96, 0.28),
      ];
      this.meshFromPoints(group, platform, deck, [x, h * 0.68, 0.06], 1, [0, 0, side * 0.03]);
      this.meshFromPoints(group, [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(side * 0.9, 0.16),
        new THREE.Vector2(side * 0.74, -0.18),
      ], accent, [x, h * 0.86, 0.1], 1, [0, 0, side * 0.08]);

      if (i > 0) {
        const prevX = side * (11 + (i - 1) * 4.8 + seededRandom(seed + i - 1) * 1.2);
        this.lineFromPoints(group, [
          new THREE.Vector3(prevX, h * 0.68 + 0.08, 0.03),
          new THREE.Vector3((prevX + x) * 0.5, h * 0.68 - 0.26, 0.03),
          new THREE.Vector3(x, h * 0.68 + 0.04, 0.03),
        ], ink);
      }
    }

    this.addItem(group, 0, 0.16, baseZ, 0.74 + seededRandom(seed + 220) * 0.05, 0.12, 1);
  }

  private addMonolithGarden(baseZ: number, seed: number, side: -1 | 1) {
    const group = new THREE.Group();
    const stoneA = this.material(0xde9aa4, 0.24, 'rock');
    const stoneB = this.material(0xe8ba8a, 0.2, 'terrain');
    const plant = this.material(0x89c8a0, 0.28, 'plant');
    const ink = this.lineMaterial(0x2a1a12, 0.18, 'ink');

    for (let i = 0; i < 6; i += 1) {
      const h = 4.8 + seededRandom(seed + i) * 6.2;
      const w = 0.9 + seededRandom(seed + 24 + i) * 1.4;
      const x = side * (9.6 + i * 3.7 + seededRandom(seed + 48 + i) * 1.6);
      const body = [
        new THREE.Vector2(-w / 2, 0),
        new THREE.Vector2(-w * 0.42, h * 0.76),
        new THREE.Vector2(-w * 0.1, h),
        new THREE.Vector2(w * 0.22, h * 0.94),
        new THREE.Vector2(w * 0.5, h * 0.68),
        new THREE.Vector2(w / 2, 0),
      ];
      this.meshFromPoints(group, body, i % 2 === 0 ? stoneA : stoneB, [x, 0.1, -i * 0.08], 1, [0, 0, side * (0.02 + i * 0.015)]);
      this.addStrata(group, w * 0.86, h, 7 + i, -i * 0.08 + 0.02, seed + 90 + i * 13, 0.06);
      this.lineFromPoints(group, [...body, body[0]].map((p) => new THREE.Vector3(p.x + x, p.y + 0.1, -i * 0.08 + 0.03)), ink);

      if (i % 3 === 0) {
        this.meshFromPoints(
          group,
          this.leafPoints(0.34 + seededRandom(seed + 180 + i) * 0.12, seed + 220 + i),
          plant,
          [x + side * 0.32, 0.12, 0.12],
          [1.2, 0.66, 1],
          [0, 0, side * 0.72]
        );
      }
    }

    this.addItem(group, 0, 0.12, baseZ, 0.6 + seededRandom(seed + 300) * 0.05, 0.14, 1);
  }

  private addItem(group: THREE.Group, baseX: number, baseY: number, baseZ: number, speed: number, sway: number, scale: number) {
    group.position.set(baseX, baseY, -baseZ);
    group.scale.setScalar(scale);
    this.root.add(group);
    this.items.push({ group, baseX, baseY, baseZ, speed, sway, scale });
  }

  private build() {
    for (let i = 0; i < 11; i += 1) {
      this.addMesaCluster(72 + i * 68, 1000 + i * 23, i % 2 === 0 ? -1 : 1, 0.82 + (i % 3) * 0.14);
    }

    for (let i = 0; i < 12; i += 1) {
      this.addCloudBand(52 + i * 58, 1600 + i * 19, 12 + (i % 4) * 2.5, 18 + (i % 3) * 8, 0.28 + (i % 3) * 0.04);
    }

    for (let i = 0; i < 9; i += 1) {
      this.addPlantPatch(96 + i * 72, 2200 + i * 31, i % 2 === 0 ? -1 : 1);
    }

    for (let i = 0; i < 8; i += 1) {
      this.addWireRun(128 + i * 84, 2600 + i * 37, i % 2 === 0 ? 1 : -1);
    }

    for (let i = 0; i < 5; i += 1) {
      this.addRingField(88 + i * 128, 2900 + i * 23, i % 2 === 0 ? 1 : -1);
    }

    for (let i = 0; i < 6; i += 1) {
      this.addTowerSettlement(120 + i * 110, 3400 + i * 29, i % 2 === 0 ? -1 : 1);
    }

    for (let i = 0; i < 5; i += 1) {
      this.addWreckSilhouette(146 + i * 142, 3900 + i * 31, i % 2 === 0 ? -1 : 1);
    }

    for (let i = 0; i < 6; i += 1) {
      this.addSkyDebris(116 + i * 104, 3100 + i * 41);
    }

    for (let i = 0; i < 6; i += 1) {
      this.addHabitatCluster(164 + i * 86, 4400 + i * 33, i % 2 === 0 ? 1 : -1);
    }

    for (let i = 0; i < 5; i += 1) {
      this.addCausewayScaffold(138 + i * 112, 5000 + i * 27, i % 2 === 0 ? -1 : 1);
    }

    for (let i = 0; i < 6; i += 1) {
      this.addMonolithGarden(102 + i * 94, 5600 + i * 25, i % 2 === 0 ? -1 : 1);
    }
  }

  update(scrollOffset: number, dt: number, progress: number) {
    this.time += dt;
    this.items.forEach((item, index) => {
      const z = -item.baseZ + scrollOffset * item.speed;
      item.group.position.z = z;
      item.group.position.x =
        item.baseX +
        Math.sin(this.time * 0.28 + progress * Math.PI * 2 + index * 1.7) * item.sway;
      item.group.position.y =
        item.baseY +
        Math.sin(this.time * 0.2 + index) * item.sway * 0.18;

      const fadeIn = THREE.MathUtils.smoothstep(z, -420, -225);
      const fadeOut = 1 - THREE.MathUtils.smoothstep(z, 26, 92);
      const nearCamera = 1 - THREE.MathUtils.smoothstep(z, -118, -18);
      const centerClear = THREE.MathUtils.smoothstep(Math.abs(item.group.position.x), 4.8, 9.3);
      const travelLanePreserve = THREE.MathUtils.lerp(1, centerClear, nearCamera * 0.66);
      const fade = THREE.MathUtils.clamp(fadeIn * fadeOut * travelLanePreserve, 0, 1);
      item.group.visible = fade > 0.015;
      item.group.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          const mat = child.material as THREE.Material & { opacity?: number };
          if (typeof mat.opacity === 'number') {
            const baseOpacity = Number(mat.userData.baseOpacity ?? 1);
            mat.opacity = baseOpacity * fade;
          }
        }
      });
    });
  }

  setDepthPassVisible(visible: boolean) {
    this.root.visible = visible;
  }

  setPalette({ terrain, rock, sky, accent }: PaletteInput) {
    this.materials.forEach((material, index) => {
      const base = material.userData.baseColor instanceof THREE.Color
        ? material.userData.baseColor.clone()
        : new THREE.Color(0xffffff);
      const role = material.userData.role as LayerRole | undefined;
      if (role === 'terrain') base.lerp(terrain, 0.42);
      else if (role === 'rock') base.lerp(rock, 0.48);
      else if (role === 'accent') base.lerp(accent, 0.5);
      else if (role === 'sky' || role === 'paper') base.lerp(sky, 0.18);
      else if (role === 'plant') base.lerp(accent, 0.1).offsetHSL(0.18, 0.02, -0.02);
      else base.lerp(new THREE.Color(0x24170f), 0.2);
      base.offsetHSL((index % 5) * 0.006 - 0.012, 0.015, (index % 7) * 0.006 - 0.018);
      material.color.copy(base);
    });
  }

  dispose() {
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
      }
    });
    this.materials.forEach((material) => material.dispose());
    this.scene.remove(this.root);
  }
}
