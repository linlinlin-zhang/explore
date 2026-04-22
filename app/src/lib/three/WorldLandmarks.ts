import * as THREE from 'three';
import { seededRandom } from './SimplexNoise';

const LandmarkVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vDist;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vDist = length(mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const LandmarkFragmentShader = `
  uniform vec3 uBaseColor;
  uniform vec3 uSkyColor;
  uniform vec3 uAccentColor;
  uniform float uProgress;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vDist;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(
      mix(0.82, -0.62, uProgress),
      mix(0.8, 0.36, smoothstep(0.45, 0.9, uProgress)),
      0.22
    ));

    float ndl = dot(normal, lightDir);
    float cel = 0.08;
    if (ndl > 0.68) cel = 1.08;
    else if (ndl > 0.32) cel = 0.62;
    else if (ndl > -0.06) cel = 0.3;

    vec3 color = uBaseColor * cel;

    float strata = 1.0 - smoothstep(0.012, 0.048, abs(fract(vWorldPos.y * 0.82 + sin(vWorldPos.x * 0.12) * 0.08) - 0.5));
    float panel = 1.0 - smoothstep(0.012, 0.04, abs(fract(vWorldPos.x * 0.18 + vWorldPos.z * 0.12) - 0.5));
    color += uAccentColor * strata * 0.08;
    color = mix(color, color * 0.68, panel * 0.1);

    float fog = smoothstep(82.0, 330.0, vDist);
    color = mix(color, uSkyColor * 0.82, fog * 0.72);

    gl_FragColor = vec4(color, 1.0);
  }
`;

type LandmarkKind =
  | 'saltGate'
  | 'wall'
  | 'cliffCity'
  | 'oasis'
  | 'rocketSite'
  | 'craterField'
  | 'corridor'
  | 'hangarCamp'
  | 'statueGarden'
  | 'ship'
  | 'beacon'
  | 'rib'
  | 'archive'
  | 'needle';

interface LandmarkPoi {
  id: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
}

interface LandmarkDef {
  kind: LandmarkKind;
  x: number;
  z: number;
  y: number;
  scale: number;
  rotation: number;
  seed: number;
  poi?: LandmarkPoi;
}

export interface LandmarkSemanticPoint {
  id: string;
  sceneId: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  x: number;
  y: number;
  depth: number;
  side: 'left' | 'right';
}

interface LandmarkSemanticAnchor {
  poi: LandmarkPoi;
  local: THREE.Vector3;
}

export class WorldLandmarks {
  private root = new THREE.Group();
  private materials: THREE.ShaderMaterial[] = [];
  private lineMaterials: THREE.LineBasicMaterial[] = [];
  private extraMaterials: THREE.Material[] = [];
  private defs: LandmarkDef[] = [];
  private groups: THREE.Group[] = [];
  private scrollOffset = 0;
  private progress = 0;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.root);
    this.generateLandmarks();
  }

  private createMaterial(color: number, opacity = 1) {
    const material = new THREE.ShaderMaterial({
      vertexShader: LandmarkVertexShader,
      fragmentShader: LandmarkFragmentShader,
      uniforms: {
        uBaseColor: { value: new THREE.Color(color) },
        uSkyColor: { value: new THREE.Color(0xaee9df) },
        uAccentColor: { value: new THREE.Color(0xe26f4a) },
        uProgress: { value: 0 },
      },
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
    });
    material.userData.baseColor = new THREE.Color(color);
    this.materials.push(material);
    return material;
  }

  private createLineMaterial(opacity = 0.42) {
    const material = new THREE.LineBasicMaterial({
      color: 0x20140f,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    this.lineMaterials.push(material);
    return material;
  }

  private createGlowMaterial(color: number, opacity = 0.55) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.extraMaterials.push(material);
    return material;
  }

  private weatherGeometry(geometry: THREE.BufferGeometry, seed: number, amount = 0.08, strata = 0.04) {
    const pos = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      const n1 = seededRandom(seed + i) - 0.5;
      const band = Math.sin(y * 3.2 + seed * 0.17) * 0.5 + 0.5;
      const warp = Math.sin((x + z) * 0.42 + seed * 0.07) * 0.5 + 0.5;
      pos[i] += (n1 * 0.8 + warp * 0.2 - 0.1) * amount * (0.7 + band * 0.4);
      pos[i + 1] += (band - 0.5) * strata + (seededRandom(seed + i + 3) - 0.5) * amount * 0.18;
      pos[i + 2] += (seededRandom(seed + i + 7) - 0.5) * amount;
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  private detailedBox(
    width: number,
    height: number,
    depth: number,
    seed: number,
    widthSegments = 5,
    heightSegments = 8,
    depthSegments = 4,
    amount = 0.08
  ) {
    return this.weatherGeometry(
      new THREE.BoxGeometry(width, height, depth, widthSegments, heightSegments, depthSegments),
      seed,
      amount,
      amount * 0.45
    );
  }

  private detailedCylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    radialSegments: number,
    heightSegments: number,
    seed: number,
    amount = 0.06
  ) {
    return this.weatherGeometry(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments),
      seed,
      amount,
      amount * 0.28
    );
  }

  private archFrameGeometry(
    span: number,
    height: number,
    depth: number,
    thickness: number,
    seed: number
  ) {
    const outer = new THREE.Shape();
    outer.moveTo(-span / 2, 0);
    outer.lineTo(-span / 2, height * 0.62);
    outer.quadraticCurveTo(-span * 0.48, height, 0, height);
    outer.quadraticCurveTo(span * 0.48, height, span / 2, height * 0.62);
    outer.lineTo(span / 2, 0);
    outer.lineTo(-span / 2, 0);

    const innerSpan = span - thickness * 2.15;
    const innerHeight = height - thickness * 1.3;
    const hole = new THREE.Path();
    hole.moveTo(-innerSpan / 2, thickness * 0.18);
    hole.lineTo(-innerSpan / 2, innerHeight * 0.58);
    hole.quadraticCurveTo(-innerSpan * 0.48, innerHeight, 0, innerHeight);
    hole.quadraticCurveTo(innerSpan * 0.48, innerHeight, innerSpan / 2, innerHeight * 0.58);
    hole.lineTo(innerSpan / 2, thickness * 0.18);
    hole.lineTo(-innerSpan / 2, thickness * 0.18);
    outer.holes.push(hole);

    const geometry = new THREE.ExtrudeGeometry(outer, {
      depth,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: thickness * 0.12,
      bevelThickness: thickness * 0.18,
      curveSegments: 28,
      steps: 1,
    });
    geometry.center();
    return this.weatherGeometry(geometry, seed, 0.035, 0.014);
  }

  private addCable(
    group: THREE.Group,
    start: THREE.Vector3,
    end: THREE.Vector3,
    sag: number,
    radius: number,
    material: THREE.Material
  ) {
    const control = start.clone().lerp(end, 0.5);
    control.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(start, control, end);
    this.mesh(
      group,
      new THREE.TubeGeometry(curve, 40, radius, 8, false),
      material,
      [0, 0, 0],
      1,
      [0, 0, 0],
      false
    );
  }

  private addBridge(
    group: THREE.Group,
    start: THREE.Vector3,
    end: THREE.Vector3,
    width: number,
    thickness: number,
    material: THREE.Material,
    railMaterial?: THREE.Material
  ) {
    const span = end.clone().sub(start);
    const length = span.length();
    const center = start.clone().add(end).multiplyScalar(0.5);
    const yaw = Math.atan2(span.x, span.z);
    this.mesh(
      group,
      this.detailedBox(width, thickness, length, Math.round(length * 11), 4, 2, 8, 0.012),
      material,
      [center.x, center.y, center.z],
      1,
      [0, yaw, 0],
      false
    );

    if (railMaterial) {
      const railOffset = width * 0.42;
      this.mesh(
        group,
        this.detailedBox(0.1, 0.16, length * 0.98, Math.round(length * 13), 1, 2, 8, 0.008),
        railMaterial,
        [center.x + Math.cos(yaw) * railOffset, center.y + 0.28, center.z - Math.sin(yaw) * railOffset],
        1,
        [0, yaw, 0],
        false
      );
      this.mesh(
        group,
        this.detailedBox(0.1, 0.16, length * 0.98, Math.round(length * 17), 1, 2, 8, 0.008),
        railMaterial,
        [center.x - Math.cos(yaw) * railOffset, center.y + 0.28, center.z + Math.sin(yaw) * railOffset],
        1,
        [0, yaw, 0],
        false
      );
    }
  }

  private addStairRun(
    group: THREE.Group,
    start: THREE.Vector3,
    direction: THREE.Vector3,
    steps: number,
    stepWidth: number,
    stepDepth: number,
    stepHeight: number,
    material: THREE.Material,
    seed: number
  ) {
    const dir = direction.clone().normalize();
    for (let i = 0; i < steps; i += 1) {
      const center = start.clone().add(dir.clone().multiplyScalar(i * stepDepth));
      center.y += i * stepHeight;
      this.mesh(
        group,
        this.detailedBox(stepWidth, stepHeight, stepDepth, seed + i * 7, 3, 2, 2, 0.014),
        material,
        [center.x, center.y, center.z],
        1,
        [0, Math.atan2(dir.x, dir.z), 0],
        false
      );
    }
  }

  private addWindowGrid(
    group: THREE.Group,
    origin: THREE.Vector3,
    cols: number,
    rows: number,
    colSpacing: number,
    rowSpacing: number,
    size: [number, number, number],
    material: THREE.Material,
    yaw = 0
  ) {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        this.mesh(
          group,
          this.detailedBox(size[0], size[1], size[2], 1200 + row * 37 + col * 13, 2, 2, 2, 0.005),
          material,
          [
            origin.x + (col - (cols - 1) / 2) * colSpacing,
            origin.y + row * rowSpacing,
            origin.z,
          ],
          1,
          [0, yaw, 0],
          false
        );
      }
    }
  }

  private addRecessedPortal(
    group: THREE.Group,
    center: THREE.Vector3,
    span: number,
    height: number,
    depth: number,
    frameMaterial: THREE.Material,
    insetMaterial: THREE.Material,
    seed: number,
    yaw = 0
  ) {
    this.mesh(
      group,
      this.archFrameGeometry(span, height, depth * 0.28, Math.max(0.24, span * 0.12), seed),
      frameMaterial,
      [center.x, center.y, center.z],
      1,
      [0, yaw, 0],
      false
    );
    this.mesh(
      group,
      this.detailedBox(span * 0.48, height * 0.78, depth, seed + 19, 3, 6, 4, 0.01),
      insetMaterial,
      [
        center.x,
        center.y - height * 0.08,
        center.z - Math.cos(yaw) * (depth * 0.5 + 0.02),
      ],
      1,
      [0, yaw, 0],
      false
    );
    this.mesh(
      group,
      this.detailedBox(span * 0.72, 0.22, depth * 0.58, seed + 31, 4, 2, 3, 0.008),
      frameMaterial,
      [
        center.x,
        center.y - height * 0.46,
        center.z - Math.cos(yaw) * (depth * 0.18),
      ],
      1,
      [0, yaw, 0],
      false
    );
  }

  private addButtressRow(
    group: THREE.Group,
    origin: THREE.Vector3,
    count: number,
    spacing: number,
    size: [number, number, number],
    material: THREE.Material,
    seed: number,
    yaw = 0,
    lean = 0
  ) {
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * spacing;
      this.mesh(
        group,
        this.detailedBox(size[0], size[1], size[2], seed + i * 17, 3, 8, 3, 0.02),
        material,
        [origin.x + offset, origin.y, origin.z],
        1,
        [0, yaw, lean * (i % 2 === 0 ? 1 : -1)],
        false
      );
    }
  }

  private addSkylinePins(
    group: THREE.Group,
    origin: THREE.Vector3,
    count: number,
    spacing: number,
    material: THREE.Material,
    accentMaterial: THREE.Material,
    seed: number,
    minHeight: number,
    maxHeight: number
  ) {
    for (let i = 0; i < count; i += 1) {
      const x = origin.x + (i - (count - 1) / 2) * spacing;
      const height = THREE.MathUtils.lerp(minHeight, maxHeight, seededRandom(seed + i * 17));
      const z = origin.z + (seededRandom(seed + 70 + i) - 0.5) * spacing * 0.42;
      this.mesh(
        group,
        this.detailedCylinder(0.08, 0.14, height, 7, 8, seed + i * 19, 0.02),
        material,
        [x, origin.y + height * 0.5, z],
        1,
        [0, seededRandom(seed + 120 + i) * 0.18, 0]
      );
      if (i % 2 === 0) {
        this.mesh(
          group,
          this.detailedBox(0.6 + seededRandom(seed + 150 + i) * 0.65, 0.08, 0.18, seed + 160 + i * 23, 2, 2, 2, 0.01),
          accentMaterial,
          [x, origin.y + height * (0.62 + seededRandom(seed + 180 + i) * 0.16), z],
          1,
          [0, seededRandom(seed + 220 + i) * 0.8 - 0.4, 0],
          false
        );
      }
    }
  }

  private addFloatingSlabs(
    group: THREE.Group,
    origin: THREE.Vector3,
    count: number,
    spacing: number,
    baseLength: number,
    material: THREE.Material,
    seed: number
  ) {
    for (let i = 0; i < count; i += 1) {
      const length = baseLength * (0.78 + seededRandom(seed + i * 13) * 0.42);
      const y = origin.y + i * spacing * 0.42;
      const z = origin.z + (seededRandom(seed + 80 + i) - 0.5) * spacing * 0.9;
      this.mesh(
        group,
        this.detailedBox(length, 0.16, 0.44, seed + 100 + i * 11, 5, 2, 2, 0.012),
        material,
        [origin.x + i * spacing, y, z],
        1,
        [0.03, seededRandom(seed + 140 + i) * 0.36 - 0.18, seededRandom(seed + 180 + i) * 0.08 - 0.04],
        false
      );
    }
  }

  private getPoiAnchor(kind: LandmarkKind, bounds: THREE.Box3) {
    const center = bounds.getCenter(new THREE.Vector3());
    switch (kind) {
      case 'saltGate':
        return new THREE.Vector3(0, Math.max(bounds.max.y * 0.9, 3.4), 0);
      case 'wall':
        return new THREE.Vector3(0, Math.max(bounds.max.y * 0.72, 6.6), 1.4);
      case 'cliffCity':
        return new THREE.Vector3(5.8, 4.6, 2.0);
      case 'oasis':
        return new THREE.Vector3(0.6, 2.6, -0.8);
      case 'rocketSite':
        return new THREE.Vector3(0.1, 6.8, 0.2);
      case 'craterField':
        return new THREE.Vector3(-0.4, 1.6, 0.4);
      case 'corridor':
        return new THREE.Vector3(0, 3.7, -6.8);
      case 'hangarCamp':
        return new THREE.Vector3(0.6, 3.4, 0.3);
      case 'statueGarden':
        return new THREE.Vector3(0, 4.1, 0);
      case 'ship':
        return new THREE.Vector3(-3.8, 2.7, 0.2);
      case 'beacon':
        return new THREE.Vector3(0, Math.max(bounds.max.y * 0.92, 8.8), 0);
      case 'rib':
        return new THREE.Vector3(0.4, 2.4, 0.1);
      case 'archive':
        return new THREE.Vector3(0.1, 5.2, 0.5);
      case 'needle':
        return new THREE.Vector3(0, Math.max(bounds.max.y * 0.88, 8.2), 0);
      default:
        return center;
    }
  }

  private semanticPoi(id: string, title: string, category: string, description: string, tags: string[]): LandmarkPoi {
    return { id, title, category, description, tags };
  }

  private semanticAnchor(poi: LandmarkPoi, local: [number, number, number]): LandmarkSemanticAnchor {
    return { poi, local: new THREE.Vector3(...local) };
  }

  private getPoiAnchors(kind: LandmarkKind, basePoi: LandmarkPoi, bounds: THREE.Box3) {
    const anchors: LandmarkSemanticAnchor[] = [
      this.semanticAnchor(basePoi, this.getPoiAnchor(kind, bounds).toArray() as [number, number, number]),
    ];

    switch (kind) {
      case 'saltGate':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-ring`, 'Blue Ring Gate', 'image', 'A turquoise threshold object that can expand an uploaded scene into a visual portal reference.', ['ring', 'portal', 'image']), [0, 3.9, 0]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-plain`, 'Salt Plain', 'terrain', 'A flat pale basin for connecting maps, climates, ground textures, and environmental references.', ['salt', 'terrain', 'map']), [-4.4, 0.5, 3.2])
        );
        break;
      case 'wall':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-towers`, 'Ruined High Towers', 'architecture', 'Vertical ruin silhouettes for linked architectural references and historical context.', ['tower', 'ruin', 'city']), [-9.6, 8.4, -0.8]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-cables`, 'Archive Cables', 'signal', 'Hanging data lines that can branch into sources, timelines, and relation graphs.', ['cable', 'data', 'relation']), [5.6, 6.8, 1.2]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-panel`, 'Inscribed Panel', 'knowledge', 'A marked surface for citations, image captions, and generated research notes.', ['panel', 'citation', 'note']), [1.2, 4.2, 2.1])
        );
        break;
      case 'rib':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-fossil`, 'Fossil Rib Field', 'creature', 'Bone-like forms that suggest extinct animals and ecological backstories.', ['fossil', 'animal', 'history']), [1.4, 2.4, 0.2]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-dust`, 'Dust Current', 'music', 'A wind path for ambient sound cues and generative music associations.', ['wind', 'ambient', 'music']), [-3.8, 1.4, 1.8])
        );
        break;
      case 'cliffCity':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-terrace`, 'Stepped Terraces', 'architecture', 'Layered city platforms where related images and urban fragments can unfold.', ['terrace', 'city', 'image']), [14.0, 3.8, 2.0]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-bridge`, 'Canyon Bridge', 'link', 'A crossing element that can connect the current input to external references.', ['bridge', 'link', 'route']), [14.4, 5.5, 2.5]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-strata`, 'Painted Strata', 'terrain', 'Striped canyon sediment for geological, color, and mood associations.', ['strata', 'rock', 'color']), [-12.4, 7.2, -2.8]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-window`, 'Occupied Window Grid', 'image', 'Small facade openings that can surface related frames and alternate views.', ['window', 'facade', 'image']), [18.0, 4.6, -0.2])
        );
        break;
      case 'ship':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-engine`, 'Cold Engine', 'music', 'A silent engine mouth for mechanical hums, sonic texture, and motion cues.', ['engine', 'sound', 'vehicle']), [-5.9, 2.0, 0]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-hull`, 'Broken Hull', 'vehicle', 'A wrecked fuselage that can open engineering sketches and speculative histories.', ['hull', 'wreck', 'diagram']), [-1.2, 2.4, 1.0]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-wing`, 'Buried Wing', 'image', 'A buried wing fragment for linked reference images and scene variations.', ['wing', 'debris', 'image']), [1.4, 0.7, -2.1])
        );
        break;
      case 'rocketSite':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-rocket`, 'Launch Rocket', 'vehicle', 'A vertical craft that can connect to flight, launch systems, and exploration media.', ['rocket', 'flight', 'engineering']), [0, 7.2, 0]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-gantry`, 'Service Gantry', 'architecture', 'A scaffold system for process diagrams, tools, and construction references.', ['gantry', 'tool', 'process']), [-2.2, 4.4, 0.6]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-fuel`, 'Fuel Tanks', 'link', 'Side tanks for related safety notes, technical references, and linked diagrams.', ['fuel', 'tank', 'link']), [4.4, 1.8, -1.2]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-pad`, 'Launch Pad', 'terrain', 'A circular pad that can map the scene into spatial coordinates and routes.', ['pad', 'map', 'route']), [0, 0.6, 0])
        );
        break;
      case 'oasis':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-pool`, 'Glass Pool', 'image', 'A reflective water basin for generated alternate images and mood boards.', ['water', 'reflection', 'image']), [0, 0.5, 0]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-palms`, 'Fan Palms', 'ecosystem', 'Sparse desert plants that can branch into botanical and climate context.', ['plant', 'ecology', 'climate']), [-4.0, 3.4, -1.8]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-grazers`, 'Grazing Animals', 'creature', 'Small animals that suggest ecology, behavior, and story expansions.', ['animal', 'life', 'story']), [3.8, 1.2, -3.4])
        );
        break;
      case 'craterField':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-crater`, 'Impact Crater', 'geology', 'A basin that can reveal geology links and alternate material studies.', ['crater', 'impact', 'geology']), [0, 0.8, 0]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-minerals`, 'Cyan Minerals', 'image', 'Glowing mineral clusters for palette extraction and image associations.', ['mineral', 'color', 'image']), [3.2, 1.4, 1.8]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-rover`, 'Survey Cart', 'vehicle', 'A small rover-like cart for tools, sensors, and exploration outputs.', ['rover', 'sensor', 'tool']), [-3.5, 0.8, -1.6])
        );
        break;
      case 'archive':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-stacks`, 'Archive Stacks', 'knowledge', 'Stepped knowledge blocks for citations, source cards, and reference clusters.', ['archive', 'citation', 'source']), [0, 4.8, 0.4]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-glyphs`, 'Glyph Rail', 'note', 'Linear markings that can become captions, summaries, and interpretation notes.', ['glyph', 'caption', 'note']), [-2.6, 2.5, -1.8])
        );
        break;
      case 'corridor':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-rails`, 'Signal Rails', 'signal', 'Parallel lines for data routes, audio links, and generated relation trails.', ['rail', 'signal', 'route']), [0, 0.8, -8.8]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-light`, 'Cyan Door Light', 'image', 'A glowing threshold that can reveal linked visual states and transitions.', ['light', 'door', 'image']), [4.9, 2.1, -13]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-arches`, 'Repeating Arches', 'architecture', 'A rhythm of arches for structural references and navigation context.', ['arch', 'building', 'route']), [0, 3.4, 4.8])
        );
        break;
      case 'hangarCamp':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-plane`, 'Folded Plane', 'vehicle', 'A small aircraft form for flight, diagrams, and motion references.', ['plane', 'flight', 'diagram']), [-4.2, 0.9, -1.4]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-rover`, 'Camp Rover', 'vehicle', 'A parked vehicle that can open tools, outputs, and local tasks.', ['car', 'rover', 'tool']), [3.5, 0.7, 1.6]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-wires`, 'Power Lines', 'signal', 'Utility wires for live links, graph edges, and connected media.', ['wire', 'power', 'link']), [0, 3.9, 1.2])
        );
        break;
      case 'needle':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-spire`, 'Needle Spire', 'terrain', 'A tall rock marker for topographic and scale references.', ['spire', 'terrain', 'scale']), [0, 8.2, 0]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-shadow`, 'Long Shadow', 'image', 'A shape cue for lighting, time-of-day, and composition variations.', ['shadow', 'light', 'image']), [-3.5, 0.6, 1.8])
        );
        break;
      case 'statueGarden':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-statues`, 'Twin Statues', 'culture', 'Ceremonial figures for myth, character, and story associations.', ['statue', 'ritual', 'story']), [0, 4.3, 0]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-pool`, 'Ceremonial Pool', 'music', 'A shallow pool for echo, ambience, and environmental sound generation.', ['pool', 'echo', 'music']), [0, 0.6, 0.6]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-plinth`, 'Stone Plinth', 'note', 'A grounded platform for short explanations and generated captions.', ['plinth', 'caption', 'note']), [3.2, 1.0, -0.6])
        );
        break;
      case 'beacon':
        anchors.push(
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-crystal`, 'Relay Crystal', 'signal', 'A bright relay point for audio, live data, and communication references.', ['crystal', 'signal', 'audio']), [0, 11.0, 0]),
          this.semanticAnchor(this.semanticPoi(`${basePoi.id}-rings`, 'Transmission Rings', 'music', 'Concentric signal rings that can unfold into sound and rhythm.', ['ring', 'music', 'signal']), [0, 9.4, 0])
        );
        break;
      default:
        break;
    }

    return anchors;
  }

  private mesh(
    group: THREE.Group,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number] | number = 1,
    rotation: [number, number, number] = [0, 0, 0],
    addEdges = true
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (typeof scale === 'number') mesh.scale.setScalar(scale);
    else mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    if (addEdges) {
      const edges = new THREE.EdgesGeometry(geometry, 16);
      const line = new THREE.LineSegments(edges, this.createLineMaterial(0.52));
      line.position.copy(mesh.position);
      line.scale.copy(mesh.scale);
      line.rotation.copy(mesh.rotation);
      group.add(line);
    }

    return mesh;
  }

  private addPolyline(group: THREE.Group, points: THREE.Vector3[], opacity = 0.34) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, this.createLineMaterial(opacity));
    group.add(line);
    return line;
  }

  private addPanelLines(
    group: THREE.Group,
    width: number,
    height: number,
    z: number,
    yOffset: number,
    count: number,
    opacity = 0.28
  ) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < count; i += 1) {
      const y = yOffset + (i / Math.max(count - 1, 1)) * height;
      points.push(new THREE.Vector3(-width / 2, y, z), new THREE.Vector3(width / 2, y + Math.sin(i * 1.7) * 0.08, z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.LineSegments(geometry, this.createLineMaterial(opacity));
    group.add(line);
  }

  private buildSaltGate(seed: number) {
    const group = new THREE.Group();
    const teal = this.createMaterial(0x32d3ce);
    const glow = this.createGlowMaterial(0x63fff0, 0.34);
    const stone = this.createMaterial(0xd8b38e);

    this.mesh(group, new THREE.TorusGeometry(3.2, 0.26, 10, 92, Math.PI * 1.18), teal, [0, 3.2, 0], [1, 1.28, 0.26], [0, 0, Math.PI * 0.91]);
    this.mesh(group, new THREE.TorusGeometry(4.0, 0.07, 6, 96, Math.PI * 1.12), glow, [0, 3.2, 0.04], [1, 1.28, 0.24], [0, 0, Math.PI * 0.91], false);
    this.mesh(group, this.detailedBox(0.65, 3.2, 0.78, seed + 1, 2, 7, 2, 0.03), stone, [-2.85, 1.55, 0], [1, 1, 1], [0, 0, -0.08]);
    this.mesh(group, this.detailedBox(0.65, 3.2, 0.78, seed + 2, 2, 7, 2, 0.03), stone, [2.85, 1.55, 0], [1, 1, 1], [0, 0, 0.08]);

    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 11) * Math.PI * 1.05 + Math.PI * 0.02;
      const x = Math.cos(angle) * 3.2;
      const y = 3.2 + Math.sin(angle) * 4.1;
      this.mesh(group, new THREE.BoxGeometry(0.1, 0.42, 0.12), stone, [x, y, -0.1], 1, [0, 0, -angle], i % 2 === 0);
    }

    this.addPanelLines(group, 8.8, 0.6, -0.18, 0.08, 6, 0.32);
    group.userData.kind = 'saltGate';
    group.userData.seed = seed;
    return group;
  }

  private buildWall(seed: number) {
    const group = new THREE.Group();
    const wall = this.createMaterial(0xd99268);
    const dark = this.createMaterial(0x6f4b39);
    const blush = this.createMaterial(0xe7a0a7);

    for (let side = -1; side <= 1; side += 2) {
      const sideGroup = new THREE.Group();
      sideGroup.position.x = side * 15.4;
      sideGroup.rotation.z = side * 0.04;
      group.add(sideGroup);

      this.mesh(sideGroup, this.detailedBox(4.5, 18, 26, seed + (side < 0 ? 10 : 20), 6, 20, 7, 0.12), wall, [0, 8.0, 0], [1, 1, 1], [0, side * 0.05, 0]);
      this.mesh(sideGroup, this.detailedBox(4.2, 6.5, 21, seed + (side < 0 ? 30 : 40), 4, 10, 5, 0.06), dark, [side * -0.1, 3.1, -3.0], [1, 1, 1], [0, side * 0.03, 0], false);
      this.mesh(sideGroup, this.detailedBox(4.62, 3.2, 25.8, seed + (side < 0 ? 50 : 60), 4, 6, 6, 0.04), blush, [0, 11.6, 0.2], [1, 1, 1], [0, side * 0.04, 0], false);
      this.mesh(sideGroup, this.detailedBox(1.18, 8.6, 6.8, seed + (side < 0 ? 70 : 80), 3, 12, 3, 0.05), dark, [side * -1.22, 4.2, 6.3], 1, [0, side * 0.08, side * -0.1], false);
      this.mesh(sideGroup, this.detailedBox(1.18, 8.6, 6.8, seed + (side < 0 ? 90 : 100), 3, 12, 3, 0.05), dark, [side * -1.22, 4.2, -6.3], 1, [0, side * 0.08, side * 0.1], false);
      for (let i = 0; i < 5; i += 1) {
        this.mesh(
          sideGroup,
          this.detailedBox(1.24, 0.36, 4.8, seed + 110 + i * 7 + (side < 0 ? 0 : 40), 3, 2, 3, 0.02),
          blush,
          [side * -0.05, 2.1 + i * 2.9, -8.8 + i * 4.4],
          1,
          [0, side * 0.03, 0],
          false
        );
      }
      this.addPanelLines(sideGroup, 4.7, 15.4, -13.12, 0.8, 21, 0.28);
      this.addPanelLines(sideGroup, 4.7, 15.4, 13.12, 0.8, 18, 0.22);
      this.addWindowGrid(
        sideGroup,
        new THREE.Vector3(side * -0.18, 3.0, 13.28),
        2,
        5,
        1.45,
        2.0,
        [0.28, 0.55, 0.14],
        dark,
        0
      );
      this.addButtressRow(
        sideGroup,
        new THREE.Vector3(side * -1.62, 2.8, -8.9),
        4,
        5.5,
        [0.54, 4.2, 1.1],
        dark,
        seed + (side < 0 ? 260 : 310),
        side * 0.03,
        side * 0.08
      );
    }

    for (let i = 0; i < 5; i += 1) {
      this.mesh(
        group,
        new THREE.BoxGeometry(2.4 + seededRandom(seed + i) * 2.3, 0.28, 4.5),
        i % 2 ? dark : wall,
        [(seededRandom(seed + 30 + i) - 0.5) * 18, 0.2 + i * 0.04, -9 + i * 4.2],
        1,
        [0.04, seededRandom(seed + 50 + i) * 0.8, (seededRandom(seed + 60 + i) - 0.5) * 0.12]
      );
    }

    for (let i = 0; i < 8; i += 1) {
      const flank = i < 4 ? -1 : 1;
      const lane = i % 4;
      this.mesh(
        group,
        this.detailedBox(1.25, 1.9 + seededRandom(seed + 140 + i) * 1.1, 1.25, seed + 160 + i * 11, 3, 4, 3, 0.04),
        i % 2 === 0 ? blush : wall,
        [flank * (3.6 + lane * 1.7), 1.05 + (i % 3) * 0.42, -0.9 + Math.sin(i) * 0.32],
        1,
        [0, seededRandom(seed + 190 + i) * 0.1, 0]
      );
    }

    this.addBridge(
      group,
      new THREE.Vector3(-12.8, 6.9, -1.6),
      new THREE.Vector3(12.8, 7.4, 0.6),
      1.35,
      0.18,
      blush,
      dark
    );
    this.addCable(group, new THREE.Vector3(-12.2, 8.1, -1.6), new THREE.Vector3(12.2, 8.3, 0.6), 2.6, 0.05, dark);
    this.addStairRun(
      group,
      new THREE.Vector3(-8.5, 0.34, 4.8),
      new THREE.Vector3(0.75, 0.28, 0.18),
      8,
      2.2,
      0.82,
      0.2,
      wall,
      seed + 210
    );
    this.mesh(group, this.archFrameGeometry(6.2, 5.4, 0.48, 0.46, seed + 240), dark, [0, 2.82, 9.72], [1, 1, 1], [0, 0, 0], false);
    this.mesh(group, this.detailedBox(8.2, 0.22, 0.44, seed + 250, 8, 2, 2, 0.008), dark, [0, 5.62, 9.55], 1, [0, 0, 0], false);
    this.addBridge(
      group,
      new THREE.Vector3(-4.2, 5.9, 9.42),
      new THREE.Vector3(4.2, 5.9, 9.42),
      0.62,
      0.08,
      dark,
      blush
    );
    this.addSkylinePins(
      group,
      new THREE.Vector3(0, 0.2, -10.4),
      9,
      2.35,
      dark,
      blush,
      seed + 280,
      4.8,
      10.8
    );
    this.addFloatingSlabs(group, new THREE.Vector3(-6.2, 6.8, -3.8), 5, 2.7, 4.2, dark, seed + 330);

    return group;
  }

  private buildCliffCity(seed: number) {
    const group = new THREE.Group();
    const rock = this.createMaterial(0xc88f98);
    const peach = this.createMaterial(0xf08a62);
    const stone = this.createMaterial(0xb78da0);
    const teal = this.createMaterial(0x87c9bd);
    const dark = this.createMaterial(0x4b444c);

    for (let i = 0; i < 5; i += 1) {
      const w = 8.2 + i * 2.4;
      const h = 7.4 + i * 2.7;
      const d = 4.0 + i * 1.5;
      this.mesh(
        group,
        this.detailedBox(w, h, d, seed + 100 + i * 17, 8, 18, 6, 0.16),
        rock,
        [-16.2 + i * 1.8, h * 0.5 - 0.32, -3.8 - i * 1.05],
        1,
        [0, -0.14 + i * 0.035, 0.02]
      );
      this.addPanelLines(group, w * 0.94, h * 0.8, -3.8 - i * 1.05 + d * 0.5, 0.66, 12 + i * 3, 0.22);
    }

    for (let i = 0; i < 4; i += 1) {
      const w = 4.6 + i * 1.3;
      const h = 9.2 + i * 2.4;
      const d = 3.8 + i * 0.95;
      this.mesh(
        group,
        this.detailedBox(w, h, d, seed + 210 + i * 19, 6, 20, 5, 0.14),
        i % 2 === 0 ? peach : stone,
        [13.2 + i * 2.1, h * 0.5 - 0.12, -2.6 + (i % 2) * 0.86],
        1,
        [0, 0.04 + i * 0.05, 0]
      );
      this.addPanelLines(group, w * 0.9, h * 0.78, -2.6 + (i % 2) * 0.86 + d * 0.5, 0.5, 11 + i * 3, 0.18);
    }

    for (let i = 0; i < 8; i += 1) {
      this.mesh(
        group,
        this.detailedBox(2.7, 0.2, 1.18, seed + 280 + i * 9, 5, 1, 3, 0.02),
        i % 2 ? teal : stone,
        [11.8 + i * 1.12, 1.08 + i * 0.52, 2.18],
        1,
        [0, 0.04, -0.02]
      );
      if (i < 7) {
        this.mesh(
          group,
          this.detailedBox(0.18, 0.56, 0.18, seed + 360 + i * 13, 2, 2, 2, 0.01),
          dark,
          [11.62 + i * 1.12, 1.62 + i * 0.52, 1.72],
          1,
          [0, 0, 0],
          false
        );
      }
    }

    for (let i = 0; i < 4; i += 1) {
      const x = 11.2 + i * 2.5;
      const y = 3.5 + (i % 2) * 1.25;
      const span = 2.6 + i * 0.38;
      const height = 3.2 + (i % 2) * 0.55;
      this.mesh(
        group,
        this.archFrameGeometry(span, height, 0.28, 0.34, seed + 420 + i * 17),
        teal,
        [x, y, 2.92],
        [1, 1.05, 1],
        [0, 0, 0],
        true
      );
      this.mesh(group, this.detailedBox(0.16, 2.3, 0.22, seed + 500 + i * 11, 2, 5, 2, 0.02), stone, [x - span * 0.46, y - 1.1, 2.92], 1, [0, 0, 0]);
      this.mesh(group, this.detailedBox(0.16, 2.3, 0.22, seed + 540 + i * 11, 2, 5, 2, 0.02), stone, [x + span * 0.46, y - 1.1, 2.92], 1, [0, 0, 0]);
      this.addCable(
        group,
        new THREE.Vector3(x - span * 0.38, y + 1.0, 2.84),
        new THREE.Vector3(x + span * 0.38, y + 1.06, 2.84),
        0.3,
        0.035,
        teal
      );
    }

    for (let i = 0; i < 9; i += 1) {
      const x = -12.8 + i * 1.35;
      const z = -0.8 + (i % 3) * 1.75;
      const y = 1.0 + (i % 4) * 0.88;
      const mat = i % 3 === 0 ? peach : stone;
      this.mesh(
        group,
        this.detailedBox(1.08, 1.5 + seededRandom(seed + i + 14), 1.08, seed + 600 + i * 9, 3, 5, 3, 0.04),
        mat,
        [x, y, z],
        1,
        [0, seededRandom(seed + i + 32) * 0.12, 0]
      );
    }

    this.addStairRun(
      group,
      new THREE.Vector3(11.8, 0.72, 1.88),
      new THREE.Vector3(0.92, 0.48, 0.04),
      11,
      1.9,
      0.78,
      0.2,
      stone,
      seed + 680
    );
    this.addBridge(
      group,
      new THREE.Vector3(10.9, 5.2, 2.5),
      new THREE.Vector3(16.1, 6.02, 2.5),
      0.74,
      0.08,
      dark,
      stone
    );
    this.addBridge(
      group,
      new THREE.Vector3(12.8, 4.6, 0.76),
      new THREE.Vector3(17.6, 5.42, -0.18),
      0.82,
      0.1,
      dark,
      teal
    );
    this.addCable(group, new THREE.Vector3(12.8, 5.34, 0.76), new THREE.Vector3(17.6, 6.2, -0.18), 0.6, 0.03, dark);
    this.addWindowGrid(
      group,
      new THREE.Vector3(14.8, 2.9, 1.1),
      2,
      5,
      1.45,
      1.18,
      [0.34, 0.44, 0.12],
      dark
    );
    this.addWindowGrid(
      group,
      new THREE.Vector3(18.2, 3.8, -0.2),
      2,
      4,
      1.28,
      1.22,
      [0.32, 0.42, 0.12],
      dark
    );
    this.addButtressRow(
      group,
      new THREE.Vector3(16.6, 2.4, 2.2),
      4,
      1.7,
      [0.42, 4.2, 0.88],
      dark,
      seed + 750,
      0.04,
      0.1
    );
    this.addRecessedPortal(
      group,
      new THREE.Vector3(11.6, 2.6, 2.18),
      4.8,
      5.0,
      0.8,
      dark,
      stone,
      seed + 820
    );
    this.mesh(group, this.detailedBox(6.0, 0.22, 0.32, seed + 850, 6, 2, 2, 0.008), dark, [11.6, 5.28, 2.08], 1, [0, 0, 0], false);
    this.addSkylinePins(
      group,
      new THREE.Vector3(17.6, 0.5, -4.8),
      8,
      1.65,
      dark,
      teal,
      seed + 880,
      5.6,
      11.8
    );
    this.addFloatingSlabs(group, new THREE.Vector3(13.2, 6.8, -2.8), 4, 2.5, 4.2, dark, seed + 940);
    for (let level = 0; level < 4; level += 1) {
      const y = 2.6 + level * 1.18;
      const x = -10.8 + level * 1.15;
      this.addBridge(
        group,
        new THREE.Vector3(x - 2.2, y, 2.38),
        new THREE.Vector3(x + 2.4, y + 0.18, 2.38),
        0.42,
        0.06,
        dark,
        level % 2 === 0 ? stone : teal
      );
      for (let post = 0; post < 5; post += 1) {
        this.mesh(
          group,
          this.detailedCylinder(0.025, 0.035, 0.68, 5, 3, seed + 980 + level * 20 + post, 0.004),
          dark,
          [x - 1.9 + post * 0.95, y + 0.42, 2.72],
          1,
          [0, 0, 0],
          false
        );
      }
    }
    for (let i = 0; i < 5; i += 1) {
      this.mesh(
        group,
        this.detailedBox(0.12, 2.3 + i * 0.42, 0.12, seed + 1080 + i, 2, 6, 2, 0.006),
        dark,
        [-6.6 + i * 1.5, 8.0 + i * 0.28, -2.4 + Math.sin(i) * 0.42],
        1,
        [0, 0, seededRandom(seed + 1090 + i) * 0.1 - 0.05],
        false
      );
      this.mesh(
        group,
        new THREE.SphereGeometry(0.18 + i * 0.03, 8, 5),
        teal,
        [-6.6 + i * 1.5, 9.28 + i * 0.52, -2.4 + Math.sin(i) * 0.42],
        [1, 0.78, 1],
        [0, 0, 0],
        false
      );
    }
    for (let i = 0; i < 9; i += 1) {
      this.mesh(
        group,
        new THREE.SphereGeometry(0.16 + i * 0.055, 8, 5),
        dark,
        [-2.8 + Math.sin(i * 0.8) * 0.38, 3.2 + i * 0.46, -1.2 + Math.cos(i * 0.7) * 0.24],
        [1.0 + i * 0.05, 0.72, 0.86],
        [0, 0, 0],
        true
      );
    }

    return group;
  }

  private palmLeafGeometry(scale: number, seed: number) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.34 * scale, 0.28 * scale, 0.52 * scale, 1.1 * scale);
    shape.quadraticCurveTo(0.12 * scale, 1.55 * scale, 0, 1.95 * scale);
    shape.quadraticCurveTo(-0.18 * scale, 1.48 * scale, -0.52 * scale, 1.08 * scale);
    shape.quadraticCurveTo(-0.28 * scale, 0.28 * scale, 0, 0);
    const geometry = new THREE.ShapeGeometry(shape, 12);
    const positions = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      const y = positions[i + 1] / Math.max(scale, 0.001);
      positions[i] += Math.sin(y * 3.1 + seed * 0.13) * 0.045 * scale;
      positions[i + 2] += Math.sin(y * 5.7 + seed * 0.21) * 0.05 * scale;
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  private buildPalm(seed: number, x: number, z: number, scale: number, mat: THREE.Material, leaf: THREE.Material) {
    const group = new THREE.Group();
    for (let i = 0; i < 5; i += 1) {
      this.mesh(
        group,
        this.detailedCylinder(0.095 * scale, 0.17 * scale, 0.72 * scale, 6, 3, seed + i * 9, 0.012),
        mat,
        [Math.sin(i * 0.75 + seed) * 0.05 * scale, (0.36 + i * 0.58) * scale, Math.cos(i * 0.61 + seed) * 0.04 * scale],
        1,
        [0.12 + i * 0.02, 0, 0.08]
      );
      this.mesh(
        group,
        new THREE.TorusGeometry(0.14 * scale, 0.012 * scale, 5, 18),
        mat,
        [Math.sin(i * 0.75 + seed) * 0.05 * scale, (0.72 + i * 0.58) * scale, Math.cos(i * 0.61 + seed) * 0.04 * scale],
        [1, 0.26, 1],
        [Math.PI / 2, 0, 0],
        false
      );
    }
    for (let i = 0; i < 11; i += 1) {
      const angle = (i / 11) * Math.PI * 2 + seededRandom(seed + i) * 0.18;
      this.mesh(
        group,
        this.palmLeafGeometry(0.82 * scale, seed + i * 13),
        leaf,
        [Math.cos(angle) * 0.45 * scale, 3.0 * scale + Math.sin(i) * 0.08, Math.sin(angle) * 0.45 * scale],
        [1, 1, 1],
        [Math.PI / 2.45, 0.18, -angle],
        true
      );
    }
    group.position.set(x, 0, z);
    return group;
  }

  private buildGrazer(seed: number, x: number, z: number, scale: number, body: THREE.Material, horn: THREE.Material) {
    const group = new THREE.Group();
    this.mesh(group, this.detailedBox(1.5, 0.68, 0.7, seed + 10, 4, 3, 3, 0.03), body, [0, 1.08 * scale, 0], [scale, scale, scale], [0, seededRandom(seed + 20) * 0.2 - 0.1, 0]);
    this.mesh(group, this.detailedBox(0.44, 0.42, 0.52, seed + 30, 2, 2, 2, 0.02), body, [0.78 * scale, 1.24 * scale, 0.1 * scale], [scale, scale, scale], [0.08, 0.12, 0]);
    for (let i = 0; i < 4; i += 1) {
      const lx = i < 2 ? -0.42 : 0.42;
      const lz = i % 2 === 0 ? -0.18 : 0.18;
      this.mesh(group, this.detailedCylinder(0.06, 0.08, 1.02 * scale, 5, 5, seed + 50 + i * 7, 0.01), body, [lx * scale, 0.5 * scale, lz * scale], 1, [0.04, 0, (i % 2 === 0 ? 0.08 : -0.08)]);
    }
    this.mesh(group, new THREE.ConeGeometry(0.08 * scale, 0.38 * scale, 5), horn, [0.98 * scale, 1.52 * scale, -0.08 * scale], [1, 1, 1], [0.7, 0.1, -0.25]);
    this.mesh(group, new THREE.ConeGeometry(0.08 * scale, 0.38 * scale, 5), horn, [0.98 * scale, 1.52 * scale, 0.12 * scale], [1, 1, 1], [0.7, -0.1, 0.25]);
    group.position.set(x, 0, z);
    return group;
  }

  private buildOasis(seed: number) {
    const group = new THREE.Group();
    const trunk = this.createMaterial(0x6c5146);
    const leaf = this.createMaterial(0x4b8f78);
    const water = this.createGlowMaterial(0x75dacd, 0.58);
    const blush = this.createMaterial(0xf1a9ac);
    const grazerBody = this.createMaterial(0x8a6c76);
    const grazerHorn = this.createMaterial(0xdcc9b1);

    this.mesh(group, new THREE.CircleGeometry(4.6, 88), water, [0, 0.08, 0], [1.55, 1, 0.82], [-Math.PI / 2, 0, 0.18], false);
    this.mesh(group, new THREE.TorusGeometry(4.8, 0.18, 6, 68), blush, [0, 0.16, 0], [1.55, 0.24, 0.82], [-Math.PI / 2, 0, 0.18]);

    for (let i = 0; i < 14; i += 1) {
      const angle = seededRandom(seed + i) * Math.PI * 2;
      const radius = 5.0 + seededRandom(seed + 20 + i) * 5.8;
      const palm = this.buildPalm(seed + i * 11, Math.cos(angle) * radius, Math.sin(angle) * radius, 0.8 + seededRandom(seed + i + 40) * 0.7, trunk, leaf);
      palm.rotation.y = seededRandom(seed + 60 + i) * Math.PI * 2;
      group.add(palm);
    }

    for (let i = 0; i < 20; i += 1) {
      this.mesh(
        group,
        new THREE.ConeGeometry(0.22 + seededRandom(seed + i) * 0.35, 0.75 + seededRandom(seed + 40 + i) * 0.75, 5),
        leaf,
        [(seededRandom(seed + 70 + i) - 0.5) * 18, 0.35, (seededRandom(seed + 100 + i) - 0.5) * 12],
        [1.2, 0.65, 1],
        [0, seededRandom(seed + 120 + i) * Math.PI, 0],
        i % 3 === 0
      );
    }

    group.add(this.buildGrazer(seed + 200, -3.4, 4.8, 1.05, grazerBody, grazerHorn));
    group.add(this.buildGrazer(seed + 240, 4.6, -3.8, 0.88, grazerBody, grazerHorn));

    return group;
  }

  private buildRocketSite(seed: number) {
    const group = new THREE.Group();
    const hull = this.createMaterial(0xe7ddc4);
    const rust = this.createMaterial(0xc88568);
    const dark = this.createMaterial(0x4c4448);
    const teal = this.createMaterial(0x7ccfc2);
    const glow = this.createGlowMaterial(0x76ead8, 0.42);

    this.mesh(group, new THREE.CircleGeometry(6.2, 56), dark, [0, 0.02, 0], [1.18, 1, 0.92], [-Math.PI / 2, 0, 0], false);
    this.mesh(group, new THREE.TorusGeometry(6.2, 0.18, 5, 52), rust, [0, 0.08, 0], [1.18, 0.2, 0.92], [-Math.PI / 2, 0, 0], false);
    this.mesh(group, this.detailedCylinder(0.8, 1.0, 9.8, 14, 14, seed + 20, 0.03), hull, [0, 5.1, 0], 1, [0, 0, 0]);
    for (let i = 0; i < 5; i += 1) {
      this.mesh(
        group,
        new THREE.TorusGeometry(0.92 - i * 0.018, 0.045, 6, 38),
        i % 2 === 0 ? rust : teal,
        [0, 1.85 + i * 1.55, 0],
        [1, 1, 1],
        [Math.PI / 2, 0, 0],
        false
      );
    }
    this.mesh(group, new THREE.ConeGeometry(0.84, 2.2, 14, 4), hull, [0, 11.18, 0], 1, [0, 0, 0]);
    this.mesh(group, new THREE.CylinderGeometry(0.34, 0.34, 0.82, 12), teal, [0, 3.2, 0.98], [1, 1, 1], [Math.PI / 2, 0, 0], false);
    this.mesh(group, new THREE.CircleGeometry(0.22, 20), teal, [0.48, 5.9, 0.77], [1, 1, 1], [0, 0.58, 0], false);
    this.mesh(group, new THREE.CircleGeometry(0.16, 18), dark, [-0.52, 7.25, 0.76], [1, 1, 1], [0, -0.58, 0], false);
    for (let i = 0; i < 3; i += 1) {
      const angle = i * ((Math.PI * 2) / 3);
      this.mesh(
        group,
        this.detailedBox(0.14, 1.6, 1.02, seed + 60 + i * 11, 2, 4, 2, 0.01),
        rust,
        [Math.cos(angle) * 0.74, 1.0, Math.sin(angle) * 0.74],
        1,
        [0, -angle, 0.14],
        false
      );
    }
    for (let i = 0; i < 3; i += 1) {
      const angle = i * ((Math.PI * 2) / 3) + 0.24;
      this.mesh(
        group,
        this.detailedCylinder(0.18, 0.26, 4.6, 10, 8, seed + 82 + i * 13, 0.02),
        i % 2 === 0 ? teal : rust,
        [Math.cos(angle) * 1.28, 3.2, Math.sin(angle) * 1.28],
        [1, 0.72, 1],
        [0.08, 0, 0.08]
      );
      this.addCable(
        group,
        new THREE.Vector3(Math.cos(angle) * 1.28, 5.4, Math.sin(angle) * 1.28),
        new THREE.Vector3(0.2, 8.1, 0.1),
        0.45,
        0.024,
        dark
      );
    }
    for (const side of [-1, 1]) {
      this.mesh(group, this.detailedBox(0.32, 10.2, 0.42, seed + 100 + side, 2, 12, 2, 0.02), dark, [side * 2.2, 5.2, -0.2], 1, [0, 0, 0]);
      this.mesh(group, this.detailedBox(0.28, 12.0, 0.3, seed + 120 + side, 2, 12, 2, 0.02), dark, [side * 3.8, 6.1, -0.8], 1, [0, 0, side * 0.08]);
      for (let rung = 0; rung < 9; rung += 1) {
        this.mesh(
          group,
          this.detailedBox(1.24, 0.05, 0.08, seed + 180 + side * 9 + rung, 2, 1, 1, 0.004),
          dark,
          [side * 3.0, 1.2 + rung * 0.86, -0.54],
          1,
          [0, 0, 0],
          false
        );
      }
    }
    this.addBridge(group, new THREE.Vector3(-2.2, 7.4, -0.1), new THREE.Vector3(2.2, 7.4, -0.1), 0.52, 0.08, dark, rust);
    this.addCable(group, new THREE.Vector3(-3.8, 8.6, -0.8), new THREE.Vector3(0.2, 5.2, -0.3), 1.0, 0.03, dark);
    this.addCable(group, new THREE.Vector3(3.8, 8.2, -0.8), new THREE.Vector3(0.2, 4.6, 0.2), 0.9, 0.03, dark);
    this.mesh(group, new THREE.CircleGeometry(1.6, 32), glow, [-4.2, 0.06, 2.8], [1.4, 1, 0.78], [-Math.PI / 2, 0, 0.18], false);
    this.mesh(group, this.detailedCylinder(0.36, 0.5, 2.8, 10, 6, seed + 150, 0.02), rust, [-4.0, 1.45, 2.4]);
    this.mesh(group, this.detailedCylinder(0.36, 0.5, 2.5, 10, 6, seed + 160, 0.02), rust, [-4.6, 1.3, 3.3]);
    this.addCable(group, new THREE.Vector3(-4.0, 2.7, 2.4), new THREE.Vector3(-1.2, 2.4, 0.6), 0.4, 0.03, dark);
    for (let i = 0; i < 7; i += 1) {
      this.mesh(
        group,
        new THREE.SphereGeometry(0.22 + i * 0.11, 9, 6),
        dark,
        [-1.1 + Math.sin(i * 1.4) * 0.35, 0.6 + i * 0.62, -1.2 + Math.cos(i * 0.9) * 0.24],
        [1.0 + i * 0.08, 0.72, 0.86],
        [0, seededRandom(seed + 220 + i) * Math.PI, 0],
        true
      );
    }
    for (let i = 0; i < 5; i += 1) {
      this.mesh(
        group,
        this.detailedBox(1.4 + i * 0.18, 0.36, 0.72, seed + 260 + i, 3, 2, 2, 0.015),
        i % 2 === 0 ? hull : rust,
        [-6.4 + i * 1.25, 0.24, -3.1 + Math.sin(i) * 0.28],
        1,
        [0, 0.15 + i * 0.04, 0],
        false
      );
    }

    return group;
  }

  private buildCraterField(seed: number) {
    const group = new THREE.Group();
    const rim = this.createMaterial(0xd7a56c);
    const dark = this.createMaterial(0x5a4f58);
    const mineral = this.createMaterial(0x7ec9c5);
    const rust = this.createMaterial(0xba7f7a);

    this.mesh(group, new THREE.TorusGeometry(4.8, 0.52, 6, 52), rim, [0, 0.26, 0], [1.6, 0.22, 1.0], [-Math.PI / 2, 0.18, 0]);
    this.mesh(group, new THREE.CircleGeometry(4.2, 48), dark, [0, 0.02, 0], [1.45, 1, 0.9], [-Math.PI / 2, 0.18, 0], false);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + seededRandom(seed + i) * 0.3;
      const radius = 5.8 + seededRandom(seed + 30 + i) * 2.6;
      const scale = 0.7 + seededRandom(seed + 60 + i) * 1.1;
      this.mesh(
        group,
        new THREE.ConeGeometry(0.32 * scale, 1.8 * scale, 5),
        i % 2 === 0 ? mineral : rust,
        [Math.cos(angle) * radius, 0.7 * scale, Math.sin(angle) * radius],
        [1, 1, 0.6],
        [0, angle, 0],
        true
      );
    }
    this.mesh(group, new THREE.DodecahedronGeometry(1.5, 0), dark, [2.4, 1.0, -1.4], [1.2, 0.8, 1.0], [0.5, 0.2, 0.1]);
    this.mesh(group, this.detailedBox(1.4, 0.42, 0.92, seed + 100, 3, 2, 2, 0.02), rust, [-5.8, 0.34, 2.6], 1, [0.02, 0.24, 0]);
    this.mesh(group, new THREE.CylinderGeometry(0.24, 0.24, 0.18, 12), dark, [-6.3, 0.18, 2.0], [1, 1, 1], [Math.PI / 2, 0, 0]);
    this.mesh(group, new THREE.CylinderGeometry(0.24, 0.24, 0.18, 12), dark, [-5.4, 0.18, 2.0], [1, 1, 1], [Math.PI / 2, 0, 0]);
    this.mesh(group, new THREE.CylinderGeometry(0.24, 0.24, 0.18, 12), dark, [-6.3, 0.18, 3.1], [1, 1, 1], [Math.PI / 2, 0, 0]);
    this.mesh(group, new THREE.CylinderGeometry(0.24, 0.24, 0.18, 12), dark, [-5.4, 0.18, 3.1], [1, 1, 1], [Math.PI / 2, 0, 0]);
    this.mesh(group, this.detailedCylinder(0.04, 0.05, 0.86, 6, 4, seed + 130, 0.01), mineral, [-5.7, 0.88, 2.62], 1, [0.2, 0, 0.1], false);
    this.mesh(group, new THREE.CircleGeometry(0.16, 18), mineral, [-5.62, 1.32, 2.75], [1, 1, 1], [0.1, 0, 0], false);

    return group;
  }

  private buildHangarCamp(seed: number) {
    const group = new THREE.Group();
    const hull = this.createMaterial(0xb7b9c1);
    const dark = this.createMaterial(0x37363d);
    const rust = this.createMaterial(0xc68068);
    const teal = this.createMaterial(0x7dcac1);

    this.mesh(group, this.archFrameGeometry(9.2, 5.8, 3.6, 0.46, seed + 10), dark, [0, 2.9, 0], [1, 1, 1], [0, 0, 0]);
    this.mesh(group, this.detailedBox(8.6, 1.8, 3.2, seed + 30, 6, 4, 4, 0.04), hull, [0, 0.95, -0.2], 1, [0, 0, 0], false);
    for (let i = 0; i < 5; i += 1) {
      this.mesh(
        group,
        this.archFrameGeometry(8.4 - i * 0.18, 4.9 - i * 0.1, 0.18, 0.18, seed + 35 + i),
        i % 2 === 0 ? hull : rust,
        [0, 2.55, -1.55 + i * 0.72],
        [1, 1, 1],
        [0, 0, 0],
        true
      );
    }
    this.addWindowGrid(group, new THREE.Vector3(0, 1.2, 1.72), 4, 2, 1.4, 0.82, [0.6, 0.9, 0.12], dark);
    this.mesh(group, this.detailedBox(2.8, 0.16, 5.8, seed + 60, 4, 2, 4, 0.02), rust, [-5.6, 0.18, -1.2], 1, [0, -0.08, -0.12]);
    for (let i = 0; i < 4; i += 1) {
      this.mesh(
        group,
        this.detailedCylinder(0.05, 0.08, 1.6, 6, 4, seed + 68 + i, 0.008),
        dark,
        [-6.7 + i * 0.72, 0.9, -3.2],
        1,
        [0.05, 0, 0.02],
        false
      );
    }
    this.mesh(group, this.detailedBox(3.4, 0.12, 2.2, seed + 76, 5, 1, 3, 0.012), rust, [-5.6, 1.72, -3.0], 1, [0.05, -0.08, 0.04], false);
    this.mesh(group, this.detailedCylinder(0.34, 0.54, 2.2, 12, 6, seed + 90, 0.02), dark, [-6.4, 1.15, -1.4], [1, 0.26, 1], [0, 0, Math.PI / 2 + 0.04]);
    this.mesh(group, new THREE.ConeGeometry(0.34, 1.2, 10, 3), hull, [-4.2, 0.86, -1.0], [1.8, 0.26, 1], [0, 0, -Math.PI / 2 + 0.06]);
    this.mesh(group, this.detailedBox(2.8, 0.08, 1.1, seed + 106, 3, 1, 2, 0.012), hull, [-5.0, 0.98, -1.0], 1, [0, 0, 0.08], false);
    this.mesh(group, this.detailedBox(0.12, 0.08, 2.4, seed + 108, 2, 1, 3, 0.006), dark, [-5.0, 1.02, -1.0], 1, [0, 0.08, 0], false);
    this.mesh(group, this.detailedBox(1.6, 0.34, 0.9, seed + 120, 3, 2, 2, 0.02), rust, [5.6, 0.28, 1.8], 1, [0, 0.2, 0]);
    this.mesh(group, new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), dark, [5.0, 0.16, 1.3], [1, 1, 1], [Math.PI / 2, 0, 0]);
    this.mesh(group, new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), dark, [6.2, 0.16, 1.3], [1, 1, 1], [Math.PI / 2, 0, 0]);
    this.mesh(group, new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), dark, [5.0, 0.16, 2.3], [1, 1, 1], [Math.PI / 2, 0, 0]);
    this.mesh(group, new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), dark, [6.2, 0.16, 2.3], [1, 1, 1], [Math.PI / 2, 0, 0]);
    this.mesh(group, this.detailedCylinder(0.08, 0.12, 4.8, 6, 6, seed + 150, 0.02), dark, [3.6, 2.4, -4.0]);
    this.mesh(group, this.detailedCylinder(0.08, 0.12, 4.4, 6, 6, seed + 160, 0.02), dark, [7.0, 2.2, -1.8]);
    this.addCable(group, new THREE.Vector3(3.6, 4.7, -4.0), new THREE.Vector3(7.0, 4.2, -1.8), 0.9, 0.03, dark);
    this.addCable(group, new THREE.Vector3(7.0, 4.2, -1.8), new THREE.Vector3(9.2, 3.4, 1.0), 0.6, 0.03, dark);
    this.mesh(group, new THREE.CircleGeometry(0.52, 28), teal, [3.5, 1.02, -2.8], [1.2, 1, 0.8], [-Math.PI / 2, 0, 0], false);
    for (let i = 0; i < 6; i += 1) {
      this.mesh(
        group,
        this.detailedBox(0.68 + seededRandom(seed + 190 + i) * 0.5, 0.42 + seededRandom(seed + 210 + i) * 0.36, 0.58, seed + 200 + i, 2, 2, 2, 0.012),
        i % 2 === 0 ? hull : rust,
        [-2.8 + i * 1.18, 0.28, 3.2 + Math.sin(i) * 0.22],
        1,
        [0, seededRandom(seed + 230 + i) * 0.4 - 0.2, 0],
        false
      );
    }
    for (let i = 0; i < 7; i += 1) {
      this.mesh(group, this.detailedCylinder(0.035, 0.05, 0.9, 5, 3, seed + 260 + i, 0.006), dark, [-4.8 + i * 1.42, 0.55, 3.95], 1, [0, 0, 0], false);
      if (i < 6) {
        this.addCable(group, new THREE.Vector3(-4.8 + i * 1.42, 1.02, 3.95), new THREE.Vector3(-4.8 + (i + 1) * 1.42, 1.02, 3.95), 0.06, 0.016, dark);
      }
    }

    return group;
  }

  private buildStatueGarden(seed: number) {
    const group = new THREE.Group();
    const stone = this.createMaterial(0xb69bb4);
    const dark = this.createMaterial(0x4a4452);
    const teal = this.createMaterial(0x7bcbbf);
    const water = this.createGlowMaterial(0x7ce2d2, 0.34);

    this.mesh(group, new THREE.CircleGeometry(4.6, 46), water, [0, 0.05, 0], [1.4, 1, 0.74], [-Math.PI / 2, 0, 0], false);
    this.mesh(group, new THREE.TorusGeometry(4.7, 0.14, 5, 48), dark, [0, 0.12, 0], [1.42, 0.16, 0.76], [-Math.PI / 2, 0, 0], false);
    for (const side of [-1, 1]) {
      this.mesh(group, this.detailedCylinder(0.42, 0.58, 4.6, 10, 10, seed + 20 + side, 0.03), stone, [side * 1.9, 2.3, 0], 1, [0, 0, 0]);
      this.mesh(group, this.detailedBox(1.2, 0.46, 0.8, seed + 50 + side, 3, 2, 2, 0.02), stone, [side * 1.9, 4.85, 0.08], 1, [0, side * 0.06, 0]);
      this.mesh(group, new THREE.ConeGeometry(0.12, 0.9, 5), dark, [side * 2.14, 5.4, -0.06], 1, [0.4, 0, side * -0.28]);
      this.mesh(group, new THREE.ConeGeometry(0.12, 0.9, 5), dark, [side * 1.66, 5.4, -0.06], 1, [0.4, 0, side * 0.28]);
    }
    this.addBridge(group, new THREE.Vector3(-4.4, 0.22, -1.8), new THREE.Vector3(4.4, 0.22, -1.8), 0.82, 0.08, dark, stone);
    this.addSkylinePins(group, new THREE.Vector3(0, 0.2, 4.8), 7, 1.5, dark, teal, seed + 80, 3.8, 7.8);

    return group;
  }

  private buildCorridor(seed: number) {
    const group = new THREE.Group();
    group.rotation.x = (seededRandom(seed) - 0.5) * 0.015;
    const concrete = this.createMaterial(0xa9c4c0);
    const slate = this.createMaterial(0x52636b);
    const dark = this.createMaterial(0x20212a);
    const glow = this.createGlowMaterial(0x4ff2d2, 0.5);

    this.mesh(group, this.detailedBox(19, 0.28, 34, seed + 300, 18, 1, 28, 0.025), slate, [0, 0.05, 0], 1, [0, 0, 0]);
    for (let i = 0; i < 11; i += 1) {
      const z = -15 + i * 3.0;
      this.mesh(group, this.detailedBox(18, 0.055, 0.1, seed + 560 + i, 18, 1, 1, 0.004), dark, [0, 0.24, z], 1, [0, 0, 0], false);
      this.mesh(group, this.detailedBox(0.055, 0.08, 2.5, seed + 590 + i, 1, 1, 4, 0.004), dark, [-4.2, 0.25, z + 1.1], 1, [0, 0, 0], false);
      this.mesh(group, this.detailedBox(0.055, 0.08, 2.5, seed + 620 + i, 1, 1, 4, 0.004), dark, [4.2, 0.25, z + 1.1], 1, [0, 0, 0], false);
    }

    for (let i = 0; i < 7; i += 1) {
      const z = -13.5 + i * 5;
      this.mesh(group, this.detailedBox(0.42, 5.4, 0.55, seed + 340 + i * 7, 2, 10, 2, 0.03), concrete, [-6.4, 2.7, z], 1, [0, 0, 0]);
      this.mesh(group, this.detailedBox(0.42, 5.4, 0.55, seed + 380 + i * 7, 2, 10, 2, 0.03), concrete, [6.4, 2.7, z], 1, [0, 0, 0]);
      this.mesh(group, this.archFrameGeometry(13.1, 5.8, 0.46, 0.42, seed + 650 + i * 19), concrete, [0, 2.62, z], 1, [0, 0, 0]);
      if (i % 2 === 0) {
        this.mesh(group, new THREE.BoxGeometry(1.1, 1.9, 0.08), glow, [0, 2.7, z - 0.32], 1, [0, 0, 0], false);
      }
      for (let beam = 0; beam < 7; beam += 1) {
        this.mesh(
          group,
          this.detailedBox(0.18, 0.14, 12.2, seed + 780 + i * 17 + beam, 2, 2, 6, 0.01),
          dark,
          [-5.4 + beam * 1.8, 5.42, z],
          1,
          [0, 0, 0],
          false
        );
      }
    }

    this.mesh(group, new THREE.BoxGeometry(1.0, 1.9, 0.25), glow, [4.9, 2.0, -13], 1, [0, 0, 0], false);
    this.mesh(group, new THREE.BoxGeometry(1.0, 1.9, 0.25), glow, [-4.9, 2.0, 9], 1, [0, 0, 0], false);
    this.addPanelLines(group, 14.0, 5.4, -16.8, 0.6, 14, 0.24);

    for (let i = 0; i < 6; i += 1) {
      const z = -11.5 + i * 5;
      this.mesh(group, this.detailedBox(1.9, 0.38, 2.2, seed + 900 + i * 11, 3, 2, 3, 0.02), concrete, [-9.2, 0.28, z], 1, [0, 0.12, 0], false);
      this.mesh(group, this.detailedBox(1.9, 0.38, 2.2, seed + 940 + i * 11, 3, 2, 3, 0.02), concrete, [9.2, 0.28, z], 1, [0, -0.12, 0], false);
    }

    this.addBridge(
      group,
      new THREE.Vector3(-6.1, 3.7, -9.4),
      new THREE.Vector3(6.1, 3.7, -9.4),
      0.88,
      0.1,
      dark,
      concrete
    );
    this.addBridge(
      group,
      new THREE.Vector3(-6.1, 3.7, 6.2),
      new THREE.Vector3(6.1, 3.7, 6.2),
      0.88,
      0.1,
      dark,
      concrete
    );
    this.addStairRun(
      group,
      new THREE.Vector3(-8.4, 0.28, -12.4),
      new THREE.Vector3(0.44, 0.5, 0.72),
      7,
      1.8,
      0.78,
      0.2,
      concrete,
      seed + 980
    );
    this.addStairRun(
      group,
      new THREE.Vector3(8.4, 0.28, 8.6),
      new THREE.Vector3(-0.44, 0.5, -0.72),
      6,
      1.8,
      0.78,
      0.2,
      concrete,
      seed + 1030
    );
    this.addWindowGrid(
      group,
      new THREE.Vector3(-8.6, 1.1, -6.3),
      1,
      4,
      0,
      1.2,
      [0.55, 0.65, 0.16],
      dark,
      0
    );
    this.addWindowGrid(
      group,
      new THREE.Vector3(8.6, 1.1, 3.8),
      1,
      4,
      0,
      1.2,
      [0.55, 0.65, 0.16],
      dark,
      0
    );
    this.addRecessedPortal(
      group,
      new THREE.Vector3(0, 2.1, -15.6),
      3.8,
      4.2,
      0.8,
      concrete,
      dark,
      seed + 1080
    );

    group.userData.kind = 'corridor';
    return group;
  }

  private buildShip(seed: number) {
    const group = new THREE.Group();
    const hull = this.createMaterial(0xe6d7bd);
    const shadow = this.createMaterial(0x4d5557);
    const teal = this.createMaterial(0x70cfc2);
    const rust = this.createMaterial(0xbe8d78);
    const glow = this.createGlowMaterial(0x79fff0, 0.38);

    this.mesh(
      group,
      this.detailedCylinder(1.08, 1.42, 8.4, 18, 10, seed + 10, 0.035),
      hull,
      [-3.1, 2.05, 0.12],
      [1.34, 0.34, 1],
      [0.1, 0, Math.PI / 2 + 0.05]
    );
    this.mesh(
      group,
      this.detailedCylinder(0.94, 1.18, 7.2, 16, 8, seed + 30, 0.025),
      shadow,
      [-3.2, 1.58, 0.16],
      [1.18, 0.24, 1],
      [0.1, 0, Math.PI / 2 + 0.05]
    );
    this.mesh(group, new THREE.TorusGeometry(1.0, 0.075, 5, 52), teal, [-5.9, 2.02, 0], [1, 0.28, 1], [0.08, Math.PI / 2, 0]);
    this.mesh(group, this.detailedCylinder(0.72, 0.88, 0.72, 16, 5, seed + 45, 0.02), shadow, [-6.85, 2.02, 0], [1, 0.42, 1], [0.08, 0, Math.PI / 2], false);
    this.mesh(group, new THREE.ConeGeometry(1.08, 2.5, 18, 4), hull, [4.1, 1.92, 0.62], [1.08, 0.44, 1], [0.18, 0.08, -Math.PI / 2 + 0.1]);
    this.mesh(group, this.detailedCylinder(0.24, 0.38, 2.6, 12, 4, seed + 60, 0.03), shadow, [1.05, 1.7, 0.18], [1, 0.26, 1], [0.08, 0, Math.PI / 2 + 0.08]);

    for (let i = 0; i < 4; i += 1) {
      const rib = new THREE.TorusGeometry(1.42 + i * 0.08, 0.05, 4, 44, Math.PI * (0.86 + seededRandom(seed + 70 + i) * 0.08));
      this.mesh(
        group,
        rib,
        hull,
        [-4.1 + i * 1.55, 2.02 + Math.sin(i) * 0.06, 0.02],
        [1, 0.92, 0.68],
        [Math.PI / 2, 0, 0.3 + i * 0.05]
      );
    }

    for (let i = 0; i < 5; i += 1) {
      this.mesh(
        group,
        this.detailedBox(0.12, 0.16, 2.6, seed + 110 + i * 13, 2, 2, 4, 0.01),
        shadow,
        [-4.8 + i * 1.25, 2.12 + (i % 2) * 0.08, 0.04],
        1,
        [0.04, 0, 0],
        false
      );
    }

    this.mesh(group, this.detailedBox(0.14, 2.45, 1.18, seed + 180, 2, 6, 2, 0.025), rust, [-1.1, 2.95, 1.34], 1, [0.14, 0.18, -0.16]);
    this.mesh(group, this.detailedBox(2.9, 0.14, 1.16, seed + 190, 4, 2, 3, 0.02), rust, [0.15, 0.2, -2.28], 1, [0.06, 0.32, -0.22]);
    this.mesh(group, this.detailedBox(2.1, 0.12, 1.02, seed + 200, 4, 2, 3, 0.02), hull, [-3.6, 0.24, 2.26], 1, [-0.04, -0.22, 0.16]);
    this.mesh(group, new THREE.CircleGeometry(0.44, 28), glow, [-4.72, 2.0, 0], 1, [0, Math.PI / 2, 0], false);
    this.addCable(group, new THREE.Vector3(-2.6, 3.28, 0.94), new THREE.Vector3(1.7, 2.74, 0.3), 0.52, 0.03, shadow);
    this.addPolyline(
      group,
      [
        new THREE.Vector3(-5.2, 2.18, -0.7),
        new THREE.Vector3(-1.8, 2.56, -1.24),
        new THREE.Vector3(1.2, 2.32, -1.82),
        new THREE.Vector3(3.8, 1.92, -2.08),
      ],
      0.28
    );

    return group;
  }

  private buildBeacon(seed: number) {
    const group = new THREE.Group();
    const stone = this.createMaterial(0x8d6671);
    const signal = this.createMaterial(0x55ddd0);
    const glow = this.createGlowMaterial(0x6fffe6, 0.42);

    const height = 10 + seededRandom(seed) * 5;
    this.mesh(group, new THREE.CylinderGeometry(0.28, 0.8, height, 5), stone, [0, height * 0.5, 0]);
    this.mesh(group, new THREE.OctahedronGeometry(1.05, 1), signal, [0, height + 0.8, 0], [1, 1.4, 1], [0.2, 0.5, 0.1]);
    this.mesh(group, new THREE.TorusGeometry(1.9, 0.055, 4, 64), glow, [0, height + 0.8, 0], [1, 0.28, 1], [Math.PI / 2, 0.2, 0], false);
    this.mesh(group, new THREE.TorusGeometry(3.0, 0.04, 4, 72), glow, [0, height + 0.2, 0], [1, 0.22, 1], [Math.PI / 2.15, -0.4, 0], false);

    for (let i = 0; i < 5; i += 1) {
      this.mesh(group, new THREE.BoxGeometry(1.6, 0.2, 0.7), stone, [0, 1.5 + i * 1.55, 0], 1, [0, i * 0.7, 0]);
    }

    return group;
  }

  private buildRib(seed: number) {
    const group = new THREE.Group();
    const mat = this.createMaterial(0xdfbf83);

    for (let i = 0; i < 10; i += 1) {
      const rib = new THREE.TorusGeometry(2.2 + i * 0.08, 0.08, 5, 34, Math.PI * (0.64 + seededRandom(seed + i) * 0.15));
      this.mesh(
        group,
        rib,
        mat,
        [(i - 4.5) * 1.1, 1.55 + seededRandom(seed + i + 10) * 0.4, seededRandom(seed + i + 20) * 0.8],
        [1, 1.45, 0.42],
        [Math.PI / 2, 0.15, Math.PI * (0.92 + seededRandom(seed + i + 30) * 0.1)]
      );
    }

    return group;
  }

  private buildArchive(seed: number) {
    const group = new THREE.Group();
    const mat = this.createMaterial(0xbb7a8c);
    const teal = this.createMaterial(0x86c8bc);
    const dark = this.createMaterial(0x4b444c);

    for (let i = 0; i < 5; i += 1) {
      const size = 4.5 - i * 0.55;
      this.mesh(group, this.detailedBox(size * 2.2, 0.46, size, seed + 460 + i * 7, 8, 2, 6, 0.03), i % 2 === 0 ? mat : teal, [0, i * 0.52, 0], 1, [0, seededRandom(seed + i) * 0.18, 0]);
    }

    this.mesh(group, this.detailedCylinder(0.45, 0.65, 5.4, 12, 10, seed + 510, 0.04), mat, [-3.5, 3.1, -1.5]);
    this.mesh(group, this.detailedCylinder(0.45, 0.65, 5.8, 12, 10, seed + 520, 0.04), mat, [3.2, 3.3, 1.4]);
    this.mesh(group, this.detailedBox(7.4, 0.36, 0.58, seed + 530, 8, 2, 3, 0.02), teal, [0, 5.25, 0.2], 1, [0, 0.08, 0]);
    this.mesh(group, this.archFrameGeometry(5.6, 3.1, 0.32, 0.34, seed + 970), dark, [0, 1.7, 0.46], 1, [0, 0, 0]);
    this.addPanelLines(group, 8.0, 4.8, 2.6, 0.25, 12, 0.26);

    for (let i = 0; i < 6; i += 1) {
      this.mesh(
        group,
        this.detailedBox(0.22, 2.8 + i * 0.22, 0.3, seed + 1000 + i * 13, 2, 6, 2, 0.02),
        teal,
        [-2.6 + i * 1.04, 1.58 + i * 0.1, -1.7],
        1,
        [0, 0, 0],
        false
      );
    }

    this.addStairRun(
      group,
      new THREE.Vector3(-2.6, 0.34, 1.8),
      new THREE.Vector3(0.58, 0.52, -0.12),
      8,
      1.6,
      0.7,
      0.18,
      teal,
      seed + 1070
    );
    this.addBridge(
      group,
      new THREE.Vector3(-1.4, 3.0, -0.9),
      new THREE.Vector3(2.7, 3.45, 0.9),
      0.7,
      0.09,
      dark,
      teal
    );
    this.addWindowGrid(
      group,
      new THREE.Vector3(0, 1.0, 2.32),
      4,
      3,
      1.2,
      0.95,
      [0.32, 0.34, 0.1],
      dark
    );
    this.addButtressRow(
      group,
      new THREE.Vector3(0, 1.3, -1.96),
      5,
      1.36,
      [0.24, 2.1, 0.48],
      dark,
      seed + 1098,
      0.03,
      0.06
    );
    this.addSkylinePins(
      group,
      new THREE.Vector3(-0.4, 0.2, 4.8),
      6,
      1.9,
      dark,
      teal,
      seed + 1120,
      3.8,
      7.2
    );

    return group;
  }

  private buildNeedle(seed: number) {
    const group = new THREE.Group();
    const mat = this.createMaterial(0xd9b06c);
    const pink = this.createMaterial(0xdb858f);

    for (let i = 0; i < 16; i += 1) {
      const h = 1.5 + seededRandom(seed + i) * 7.2;
      this.mesh(
        group,
        new THREE.ConeGeometry(0.18 + seededRandom(seed + 50 + i) * 0.42, h, 5),
        i % 4 === 0 ? pink : mat,
        [(seededRandom(seed + i + 10) - 0.5) * 12, h * 0.5, (seededRandom(seed + i + 20) - 0.5) * 6],
        [1, 1, 0.7],
        [0, seededRandom(seed + i + 30) * Math.PI, 0],
        i % 3 === 0
      );
    }

    return group;
  }

  private createLandmark(def: LandmarkDef) {
    let group: THREE.Group;
    switch (def.kind) {
      case 'saltGate':
        group = this.buildSaltGate(def.seed);
        break;
      case 'wall':
        group = this.buildWall(def.seed);
        break;
      case 'cliffCity':
        group = this.buildCliffCity(def.seed);
        break;
      case 'oasis':
        group = this.buildOasis(def.seed);
        break;
      case 'rocketSite':
        group = this.buildRocketSite(def.seed);
        break;
      case 'craterField':
        group = this.buildCraterField(def.seed);
        break;
      case 'corridor':
        group = this.buildCorridor(def.seed);
        break;
      case 'hangarCamp':
        group = this.buildHangarCamp(def.seed);
        break;
      case 'statueGarden':
        group = this.buildStatueGarden(def.seed);
        break;
      case 'ship':
        group = this.buildShip(def.seed);
        break;
      case 'beacon':
        group = this.buildBeacon(def.seed);
        break;
      case 'rib':
        group = this.buildRib(def.seed);
        break;
      case 'archive':
        group = this.buildArchive(def.seed);
        break;
      case 'needle':
      default:
        group = this.buildNeedle(def.seed);
        break;
    }

    group.position.set(def.x, def.y, -def.z);
    group.scale.setScalar(def.scale);
    group.rotation.y = def.rotation;
    group.userData.poi = def.poi;
    group.userData.kind = def.kind;
    if (def.poi) {
      const bounds = new THREE.Box3().setFromObject(group);
      group.userData.poiAnchor = this.getPoiAnchor(def.kind, bounds);
      group.userData.poiAnchors = this.getPoiAnchors(def.kind, def.poi, bounds);
    }
    this.root.add(group);
    this.groups.push(group);
  }

  private generateLandmarks() {
    this.defs = [
      { kind: 'saltGate', x: 11, y: 0.2, z: 24, scale: 1.62, rotation: -0.22, seed: 10, poi: { id: 'threshold-gate', title: 'Threshold Gate', category: 'portal', description: 'The opening glyph gate that introduces the journey and the idea of entering a new context space.', tags: ['portal', 'entry', 'symbol'] } },
      { kind: 'wall', x: -5.8, y: 0.2, z: 62, scale: 1.35, rotation: 0.08, seed: 20, poi: { id: 'archive-wall', title: 'Memory Wall', category: 'architecture', description: 'A monumental wall city that can later reveal linked references, research threads, and urban context.', tags: ['wall', 'city', 'research'] } },
      { kind: 'rib', x: -14, y: 0.55, z: 102, scale: 1.9, rotation: 0.46, seed: 30, poi: { id: 'bone-dunes', title: 'Bone Dunes', category: 'creature', description: 'A skeletal landmark suggesting ecology, history, and extinct life forms for image-to-story expansions.', tags: ['skeleton', 'creature', 'history'] } },
      { kind: 'cliffCity', x: 8.2, y: 0.2, z: 142, scale: 1.52, rotation: -0.28, seed: 40, poi: { id: 'cliff-city', title: 'Cliff City', category: 'architecture', description: 'Layered canyon architecture that can anchor related images, maps, music, and contextual story threads.', tags: ['city', 'canyon', 'architecture'] } },
      { kind: 'ship', x: -13.5, y: 0.9, z: 184, scale: 1.34, rotation: -0.12, seed: 50, poi: { id: 'wreck-site', title: 'Wreck Site', category: 'vehicle', description: 'A crashed vessel for surfacing speculative history, engineering diagrams, and sound cues.', tags: ['spaceship', 'wreck', 'vehicle'] } },
      { kind: 'rocketSite', x: 13.8, y: 0.18, z: 216, scale: 1.26, rotation: -0.18, seed: 55, poi: { id: 'launch-yard', title: 'Launch Yard', category: 'vehicle', description: 'A rocket pad and fueling rig intended to reveal linked media about launch systems, flight, and exploration.', tags: ['rocket', 'launch', 'engineering'] } },
      { kind: 'oasis', x: 4, y: 0.05, z: 252, scale: 1.65, rotation: 0.32, seed: 60, poi: { id: 'oasis-habitat', title: 'Oasis Habitat', category: 'ecosystem', description: 'A living oasis with plants and grazing creatures to connect environmental references, music, and ecology.', tags: ['oasis', 'plants', 'animals'] } },
      { kind: 'craterField', x: -14.6, y: 0.08, z: 290, scale: 1.36, rotation: 0.22, seed: 65, poi: { id: 'impact-basin', title: 'Impact Basin', category: 'geology', description: 'A crater and mineral field suited for revealing geological links, material studies, and alternate-scene imagery.', tags: ['crater', 'minerals', 'geology'] } },
      { kind: 'archive', x: -15.2, y: 0.55, z: 332, scale: 1.42, rotation: 0.46, seed: 70, poi: { id: 'open-archive', title: 'Open Archive', category: 'knowledge', description: 'A stepped archive ruin designed for future content cards, citations, and reference clusters.', tags: ['archive', 'knowledge', 'references'] } },
      { kind: 'corridor', x: 0, y: 0.2, z: 372, scale: 1.42, rotation: 0.04, seed: 80, poi: { id: 'signal-corridor', title: 'Signal Corridor', category: 'infrastructure', description: 'A transit corridor where linked audio, feeds, and data routes can materialize around the traveler.', tags: ['corridor', 'signal', 'infrastructure'] } },
      { kind: 'hangarCamp', x: 12.8, y: 0.12, z: 412, scale: 1.24, rotation: -0.22, seed: 85, poi: { id: 'hangar-camp', title: 'Hangar Camp', category: 'mobility', description: 'A mobile outpost with vehicles, cables, and shelters that can introduce connected tools and generated outputs.', tags: ['hangar', 'rover', 'plane'] } },
      { kind: 'needle', x: 13, y: 0.4, z: 456, scale: 2.0, rotation: -0.42, seed: 90, poi: { id: 'needle-field', title: 'Needle Field', category: 'terrain', description: 'A needle-rock landscape meant to broaden the terrain language and support terrain-linked media reveals.', tags: ['spires', 'terrain', 'desert'] } },
      { kind: 'statueGarden', x: -12.8, y: 0.1, z: 504, scale: 1.28, rotation: 0.28, seed: 95, poi: { id: 'statue-garden', title: 'Statue Garden', category: 'culture', description: 'A ceremonial statue court where associated images, myths, and music can emerge as part of the journey.', tags: ['statue', 'pool', 'ritual'] } },
      { kind: 'beacon', x: -11, y: 0.45, z: 548, scale: 1.85, rotation: 0.2, seed: 100, poi: { id: 'relay-beacon', title: 'Relay Beacon', category: 'signal', description: 'A transmission marker for future linked audio, live data, and communication-oriented content.', tags: ['beacon', 'signal', 'audio'] } },
      { kind: 'saltGate', x: -12, y: 0.15, z: 596, scale: 1.45, rotation: 0.38, seed: 120, poi: { id: 'return-gate', title: 'Return Gate', category: 'portal', description: 'The closing threshold where the immersive journey hands back into the product interface.', tags: ['portal', 'return', 'cta'] } },
    ];

    this.defs.forEach((def) => this.createLandmark(def));
  }

  update(scrollOffset: number, dt: number, progress: number) {
    const offsetDelta = scrollOffset - this.scrollOffset;
    const progressDelta = progress - this.progress;
    const offsetCatchup = Math.min(dt * (Math.abs(offsetDelta) > 36 ? 14 : 8), 1);
    const progressCatchup = Math.min(dt * (Math.abs(progressDelta) > 0.08 ? 10 : 6), 1);
    this.scrollOffset += offsetDelta * offsetCatchup;
    this.progress += progressDelta * progressCatchup;

    this.groups.forEach((group, i) => {
      const def = this.defs[i];
      const depthBias =
        def.kind === 'wall' || def.kind === 'corridor'
          ? 42
          : def.kind === 'archive'
            ? 44
            : def.kind === 'rocketSite' || def.kind === 'hangarCamp'
              ? 32
            : def.kind === 'cliffCity'
              ? 56
              : 16;
      const travelSpeed =
        def.kind === 'wall' || def.kind === 'corridor'
          ? 0.92
          : def.kind === 'archive'
            ? 0.98
            : def.kind === 'rocketSite' || def.kind === 'hangarCamp'
              ? 1.0
            : 1.02;
      const z = -def.z + this.scrollOffset * travelSpeed - depthBias;
      const wideParallax =
        def.kind === 'wall' || def.kind === 'corridor'
          ? 0.18
          : def.kind === 'archive'
            ? 0.14
            : def.kind === 'rocketSite' || def.kind === 'craterField' || def.kind === 'hangarCamp' || def.kind === 'statueGarden'
              ? 0.28
            : def.kind === 'cliffCity'
              ? 0.22
              : 0.82;
      group.position.z = z;
      group.position.x = def.x + Math.sin(this.progress * Math.PI * 2 + def.seed) * 1.2 * wideParallax;
      group.rotation.y = def.rotation + Math.sin(this.progress * 3 + def.seed) * 0.04;

      if (def.kind === 'corridor') {
        group.position.y = def.y - THREE.MathUtils.smoothstep(this.progress, 0.58, 0.72) * 0.2;
      }

      const distanceFade = THREE.MathUtils.smoothstep(z, -320, -120) * (1 - THREE.MathUtils.smoothstep(z, 8, 38));
      group.visible = distanceFade > 0.01;
      group.traverse((child) => {
        if (child instanceof THREE.LineSegments || child instanceof THREE.Line) {
          const mat = child.material as THREE.LineBasicMaterial;
          mat.opacity = Math.min(0.62, (0.16 + (1 - this.progress) * 0.18) * distanceFade + 0.1);
        }
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
          child.material.opacity = child.material.opacity < 0.4 ? child.material.opacity : 0.38 + Math.sin(this.progress * Math.PI * 5 + def.seed) * 0.08;
        }
      });
    });

    this.materials.forEach((material) => {
      material.uniforms.uProgress.value = this.progress;
    });
  }

  getSemanticPoints(camera: THREE.PerspectiveCamera, viewport: THREE.Vector2) {
    const points: LandmarkSemanticPoint[] = [];

    this.groups.forEach((group) => {
      const anchors = group.userData.poiAnchors as LandmarkSemanticAnchor[] | undefined;
      if (!anchors || !group.visible) return;
      const scenePoi = group.userData.poi as LandmarkPoi | undefined;

      anchors.forEach((anchor) => {
        const world = group.localToWorld(anchor.local.clone());
        const projected = world.clone().project(camera);
        if (projected.z < -1 || projected.z > 1) return;
        if (Math.abs(projected.x) > 1.22 || Math.abs(projected.y) > 1.14) return;

        points.push({
          id: anchor.poi.id,
          sceneId: scenePoi?.id ?? anchor.poi.id,
          title: anchor.poi.title,
          category: anchor.poi.category,
          description: anchor.poi.description,
          tags: anchor.poi.tags,
          x: (projected.x * 0.5 + 0.5) * viewport.x,
          y: (-projected.y * 0.5 + 0.5) * viewport.y,
          depth: projected.z,
          side: projected.x < 0 ? 'left' : 'right',
        });
      });
    });

    return points.sort((a, b) => a.depth - b.depth);
  }

  setPalette(base: THREE.Color, sky: THREE.Color, accent: THREE.Color) {
    this.materials.forEach((material, i) => {
      const source = material.userData.baseColor instanceof THREE.Color
        ? material.userData.baseColor
        : base;
      const shifted = source.clone().lerp(base, 0.18 + (i % 3) * 0.03);
      shifted.offsetHSL((i % 7) * 0.012 - 0.025, 0.04, (i % 5) * 0.018 - 0.025);
      material.uniforms.uBaseColor.value.copy(shifted);
      material.uniforms.uSkyColor.value.copy(sky);
      material.uniforms.uAccentColor.value.copy(accent);
    });

    this.lineMaterials.forEach((material) => {
      material.color.copy(new THREE.Color(0x21140e).lerp(base, this.progress * 0.08));
    });
  }

  dispose() {
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
        child.geometry.dispose();
      }
    });
    this.materials.forEach((material) => material.dispose());
    this.lineMaterials.forEach((material) => material.dispose());
    this.extraMaterials.forEach((material) => material.dispose());
    this.scene.remove(this.root);
  }
}
