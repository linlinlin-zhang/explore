import * as THREE from 'three';

export interface BikeSemanticPoint {
  id: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  world: THREE.Vector3;
}

const CelVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vLocalPos;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CelFragmentShader = `
  uniform vec3 uBaseColor;
  uniform vec3 uInkColor;
  uniform float uProgress;

  varying vec3 vNormal;
  varying vec3 vLocalPos;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(
      mix(0.75, -0.45, uProgress),
      0.72,
      0.22
    ));

    float ndl = dot(normal, lightDir);
    float cel = 0.08;
    if (ndl > 0.72) cel = 1.05;
    else if (ndl > 0.38) cel = 0.62;
    else if (ndl > -0.04) cel = 0.28;

    vec3 color = uBaseColor * cel;
    float localLine = smoothstep(0.48, 0.5, sin(vLocalPos.x * 22.0 + vLocalPos.z * 7.0) * 0.5 + 0.5);
    color = mix(color, uInkColor, localLine * 0.055);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const RibbonVertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float flutter = sin(vUv.x * 18.0 + uTime * 4.2) * 0.18 + sin(vUv.x * 8.0 + uTime * 2.3) * 0.08;
    pos.x += flutter * vUv.x;
    pos.y += sin(vUv.x * 11.0 + uTime * 3.6) * 0.22 * vUv.x;
    pos.z += sin(vUv.x * 7.0 + uTime * 2.0) * 0.12 * vUv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const RibbonFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    float torn = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
    float wave = sin(vUv.x * 28.0 + uTime * 3.0) * 0.5 + 0.5;
    float alpha = (0.92 - vUv.x * 0.24) * torn;
    vec3 color = mix(uColor * 0.75, uColor * 1.25, wave * 0.2);
    gl_FragColor = vec4(color, alpha);
  }
`;

export class HoverBike {
  private group = new THREE.Group();
  private scene: THREE.Scene;
  private materials: THREE.ShaderMaterial[] = [];
  private edgeLines: THREE.LineSegments[] = [];
  private ribbonMaterial: THREE.ShaderMaterial;
  private ribbonCoreMaterial: THREE.ShaderMaterial;
  private glowMaterial: THREE.ShaderMaterial;
  private basePosition = new THREE.Vector3(0, 2.15, 3.4);

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.ribbonMaterial = new THREE.ShaderMaterial({
      vertexShader: RibbonVertexShader,
      fragmentShader: RibbonFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(0xf01820) },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.ribbonCoreMaterial = new THREE.ShaderMaterial({
      vertexShader: RibbonVertexShader,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float torn = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
          float pulse = 0.7 + sin(vUv.x * 18.0 - uTime * 5.0) * 0.16;
          float alpha = (0.78 - vUv.x * 0.42) * torn * pulse;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      uniforms: {
        uColor: { value: new THREE.Color(0xff3438) },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.glowMaterial = new THREE.ShaderMaterial({
      vertexShader: RibbonVertexShader,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5);
          float alpha = smoothstep(0.5, 0.0, d) * (0.44 + sin(uTime * 6.0) * 0.08);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      uniforms: {
        uColor: { value: new THREE.Color(0x79fff0) },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.buildBike();
    this.scene.add(this.group);
  }

  private makeMaterial(color: number) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: CelVertexShader,
      fragmentShader: CelFragmentShader,
      uniforms: {
        uBaseColor: { value: new THREE.Color(color) },
        uInkColor: { value: new THREE.Color(0x1b1512) },
        uProgress: { value: 0 },
      },
      side: THREE.DoubleSide,
    });
    this.materials.push(mat);
    return mat;
  }

  private addEdges(mesh: THREE.Mesh, opacity = 0.72) {
    const edges = new THREE.EdgesGeometry(mesh.geometry, 14);
    const lines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: 0x1b1512,
        transparent: true,
        opacity,
        depthWrite: false,
      })
    );
    lines.position.copy(mesh.position);
    lines.rotation.copy(mesh.rotation);
    lines.scale.copy(mesh.scale);
    mesh.parent?.add(lines);
    this.edgeLines.push(lines);
  }

  private addMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number] | number = 1,
    rotation: [number, number, number] = [0, 0, 0],
    edgeOpacity = 0.72
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (typeof scale === 'number') mesh.scale.setScalar(scale);
    else mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.addEdges(mesh, edgeOpacity);
    return mesh;
  }

  private makeWingShape(side: -1 | 1) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(side * 2.45, 0.58);
    shape.lineTo(side * 3.25, 0.1);
    shape.lineTo(side * 2.2, -0.48);
    shape.lineTo(side * 0.35, -0.28);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape, 24);
    const positions = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      positions[i + 2] += Math.sin(x * 1.4 + y * 4.1) * 0.06;
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  private makeRibbonGeometry() {
    const geometry = new THREE.BufferGeometry();
    const widthNear = 0.16;
    const widthFar = 0.82;
    const length = 30;
    const segments = 84;
    const positions = new Float32Array((segments + 1) * 2 * 3);
    const uvs = new Float32Array((segments + 1) * 2 * 2);
    const indices: number[] = [];

    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const tornEdge = Math.sin(t * 37.0) * 0.045 + Math.sin(t * 81.0) * 0.018;
      const width = THREE.MathUtils.lerp(widthNear, widthFar, t) * (1 + tornEdge);
      const z = length * t;
      const centerX = Math.sin(t * Math.PI * 1.3) * 0.24 * t;
      const centerY = Math.sin(t * 4.0) * 0.05 + Math.sin(t * 11.0) * 0.018 * t;
      const offset = i * 6;
      positions[offset] = centerX - width * (1 + Math.sin(t * 23.0) * 0.06);
      positions[offset + 1] = centerY;
      positions[offset + 2] = z;
      positions[offset + 3] = centerX + width * (0.86 + Math.cos(t * 29.0) * 0.08);
      positions[offset + 4] = centerY + Math.sin(t * 19.0) * 0.02;
      positions[offset + 5] = z;

      const uvOffset = i * 4;
      uvs[uvOffset] = t;
      uvs[uvOffset + 1] = 0;
      uvs[uvOffset + 2] = t;
      uvs[uvOffset + 3] = 1;

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  private buildBike() {
    const body = this.makeMaterial(0xe8dec3);
    const teal = this.makeMaterial(0x78c7bd);
    const dark = this.makeMaterial(0x322a26);
    const cloth = this.makeMaterial(0xf3d791);
    const red = this.makeMaterial(0xc0242c);
    const skin = this.makeMaterial(0xad7955);
    const pale = this.makeMaterial(0xd9e2db);
    const slate = this.makeMaterial(0x58706f);

    // Main forward cylinder, Sable-like hoverbike body.
    this.addMesh(
      new THREE.CylinderGeometry(0.48, 0.64, 2.55, 34, 8),
      body,
      [0, 0.05, 0.05],
      [1, 1, 1],
      [Math.PI / 2, 0, 0]
    );

    this.addMesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.42, 30, 4),
      dark,
      [0, 0.05, 1.52],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
      0.92
    );

    this.addMesh(
      new THREE.TorusGeometry(0.51, 0.045, 10, 52),
      teal,
      [0, 0.05, 0.62],
      [1, 1, 0.8],
      [0, 0, 0]
    );
    this.addMesh(new THREE.TorusGeometry(0.43, 0.022, 8, 42), body, [0, 0.05, 1.28], [1, 1, 0.72], [0, 0, 0], 0.78);
    this.addMesh(new THREE.TorusGeometry(0.31, 0.018, 8, 36), teal, [0, 0.05, 1.47], [1, 1, 0.72], [0, 0, 0], 0.7);
    this.addMesh(new THREE.CylinderGeometry(0.2, 0.26, 0.12, 18, 2), dark, [0, 0.05, 1.72], [1, 1, 1], [Math.PI / 2, 0, 0], 0.88);
    this.addMesh(new THREE.CylinderGeometry(0.06, 0.08, 0.38, 12, 2), teal, [0, 0.05, 1.86], [1, 1, 1], [Math.PI / 2, 0, 0], 0.76);
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      this.addMesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.32, 6),
        dark,
        [Math.cos(angle) * 0.34, Math.sin(angle) * 0.24 + 0.05, 1.44],
        1,
        [0.3 + Math.sin(angle) * 0.22, 0, Math.cos(angle)],
        0.64
      );
    }

    this.addMesh(
      new THREE.ConeGeometry(0.48, 0.78, 30, 4),
      body,
      [0, 0.05, -1.58],
      [1, 1, 1],
      [-Math.PI / 2, 0, 0]
    );

    // Wing struts.
    this.addMesh(
      new THREE.BoxGeometry(4.7, 0.08, 0.16, 8, 1, 2),
      body,
      [0, -0.08, -0.25],
      [1, 1, 1],
      [0, 0, 0.02],
      0.58
    );

    this.addMesh(
      new THREE.TorusGeometry(0.68, 0.04, 8, 42),
      dark,
      [0, 0.03, -0.52],
      [1.1, 0.26, 0.92],
      [Math.PI / 2, 0, 0],
      0.6
    );
    this.addMesh(
      new THREE.BoxGeometry(0.42, 0.1, 0.82, 3, 1, 4),
      body,
      [0, 0.14, -0.86],
      [1, 1, 1],
      [0.12, 0, 0],
      0.66
    );
    this.addMesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.54, 2, 2, 3),
      dark,
      [0, 0.28, -0.48],
      [1, 1, 1],
      [0.18, 0, 0],
      0.72
    );

    this.addMesh(
      new THREE.CylinderGeometry(0.08, 0.11, 0.95, 10, 3),
      dark,
      [-0.48, 0.22, 0.32],
      1,
      [0.9, 0, 0.28],
      0.74
    );
    this.addMesh(
      new THREE.CylinderGeometry(0.08, 0.11, 0.95, 10, 3),
      dark,
      [0.48, 0.22, 0.32],
      1,
      [0.9, 0, -0.28],
      0.74
    );
    this.addMesh(
      new THREE.BoxGeometry(0.62, 0.05, 0.18, 3, 1, 1),
      dark,
      [0, 0.3, -1.52],
      1,
      [0.1, 0, 0],
      0.7
    );
    this.addMesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.02, 6),
      dark,
      [-0.52, -0.08, -0.76],
      1,
      [1.2, 0.12, 0.36],
      0.6
    );
    this.addMesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.02, 6),
      dark,
      [0.52, -0.08, -0.76],
      1,
      [1.2, -0.12, -0.36],
      0.6
    );

    // Beige cloth-like side wings.
    const leftWing = this.addMesh(
      this.makeWingShape(-1),
      cloth,
      [-0.25, -0.28, 0.85],
      [1, 1, 1],
      [Math.PI / 2.08, 0.08, -0.2],
      0.78
    );
    leftWing.geometry.computeVertexNormals();

    const rightWing = this.addMesh(
      this.makeWingShape(1),
      cloth,
      [0.25, -0.28, 0.85],
      [1, 1, 1],
      [Math.PI / 2.08, -0.08, 0.2],
      0.78
    );
    rightWing.geometry.computeVertexNormals();

    this.addMesh(
      new THREE.BoxGeometry(0.88, 0.12, 0.52, 4, 2, 3),
      dark,
      [0, 0.42, 0.38],
      1,
      [0.04, 0, 0],
      0.76
    );
    this.addMesh(
      new THREE.BoxGeometry(0.32, 0.08, 0.38, 2, 1, 2),
      teal,
      [0, 0.52, 0.92],
      [1, 1, 1],
      [0.12, 0, 0],
      0.72
    );
    this.addMesh(
      new THREE.BoxGeometry(0.82, 0.04, 0.12, 3, 1, 1),
      body,
      [0, 0.58, 0.52],
      [1, 1, 1],
      [0.08, 0, 0],
      0.72
    );

    this.addMesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.78, 8),
      dark,
      [-0.28, 0.92, -0.12],
      1,
      [Math.PI / 2.65, 0, -0.3],
      0.86
    );
    this.addMesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.78, 8),
      dark,
      [0.28, 0.92, -0.12],
      1,
      [Math.PI / 2.65, 0, 0.3],
      0.86
    );
    this.addMesh(
      new THREE.BoxGeometry(0.66, 0.05, 0.05),
      dark,
      [0, 1.14, -0.42],
      1,
      [0, 0, 0],
      0.88
    );
    this.addMesh(
      new THREE.BoxGeometry(0.42, 0.06, 0.2, 2, 1, 1),
      dark,
      [0, 1.02, -0.26],
      [1, 1, 1],
      [0.04, 0, 0],
      0.88
    );
    this.addMesh(
      new THREE.BoxGeometry(0.22, 0.08, 0.12, 2, 1, 1),
      teal,
      [0, 1.05, -0.42],
      [1, 1, 1],
      [0.08, 0, 0],
      0.82
    );
    this.addMesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.28, 0.9, -0.22),
          new THREE.Vector3(-1.1, 0.26, 0.1),
          new THREE.Vector3(-2.45, -0.18, 0.7),
        ]),
        18,
        0.018,
        6,
        false
      ),
      body,
      [0, 0, 0],
      1,
      [0, 0, 0],
      0.54
    );
    this.addMesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.28, 0.9, -0.22),
          new THREE.Vector3(1.1, 0.26, 0.1),
          new THREE.Vector3(2.45, -0.18, 0.7),
        ]),
        18,
        0.018,
        6,
        false
      ),
      body,
      [0, 0, 0],
      1,
      [0, 0, 0],
      0.54
    );

    // Rider silhouette and mask horns.
    this.addMesh(new THREE.CylinderGeometry(0.22, 0.32, 0.62, 8), dark, [0, 0.74, 0.0], [0.8, 1, 0.7], [0.12, 0, 0], 0.9);
    this.addMesh(new THREE.SphereGeometry(0.25, 16, 10), pale, [0, 1.2, -0.03], [1, 1.22, 0.92], [0, 0, 0], 0.9);
    this.addMesh(new THREE.ConeGeometry(0.055, 0.44, 6), dark, [-0.18, 1.44, -0.04], [1, 1, 1], [0.5, 0, -0.28], 0.9);
    this.addMesh(new THREE.ConeGeometry(0.055, 0.44, 6), dark, [0.18, 1.44, -0.04], [1, 1, 1], [0.5, 0, 0.28], 0.9);
    this.addMesh(new THREE.BoxGeometry(0.38, 0.045, 0.055, 2, 1, 1), dark, [0, 1.22, -0.25], 1, [0, 0, 0], 0.88);
    this.addMesh(new THREE.BoxGeometry(0.22, 0.026, 0.035, 2, 1, 1), teal, [0, 1.23, -0.29], 1, [0, 0, 0], 0.72);
    this.addMesh(new THREE.BoxGeometry(0.08, 0.2, 0.06, 1, 2, 1), pale, [-0.24, 1.17, -0.12], [1, 1, 0.8], [0, 0, -0.08], 0.72);
    this.addMesh(new THREE.BoxGeometry(0.08, 0.2, 0.06, 1, 2, 1), pale, [0.24, 1.17, -0.12], [1, 1, 0.8], [0, 0, 0.08], 0.72);
    this.addMesh(new THREE.BoxGeometry(0.54, 0.16, 0.34, 3, 2, 2), red, [0, 0.93, 0.03], [1, 0.9, 0.72], [0.2, 0, 0], 0.78);
    this.addMesh(new THREE.BoxGeometry(0.68, 0.12, 0.42, 3, 1, 2), dark, [0, 0.62, 0.12], [1, 0.8, 0.72], [0.12, 0, 0], 0.78);
    this.addMesh(new THREE.BoxGeometry(0.26, 0.42, 0.24, 3, 3, 2), teal, [0, 0.78, 0.36], [1, 1, 0.8], [0.18, 0, 0], 0.72);
    this.addMesh(new THREE.BoxGeometry(0.44, 0.36, 0.22, 3, 3, 2), dark, [0, 0.82, 0.52], [1, 0.9, 0.8], [0.16, 0, 0], 0.68);
    this.addMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 10, 2), cloth, [0, 0.92, 0.28], [1.05, 0.8, 1], [Math.PI / 2 + 0.12, 0, 0], 0.68);
    this.addMesh(new THREE.BoxGeometry(0.52, 0.05, 0.14, 2, 1, 1), dark, [0, 0.74, 0.72], [1, 1, 1], [0.16, 0, 0], 0.7);
    this.addMesh(new THREE.BoxGeometry(0.34, 0.09, 0.22, 2, 1, 1), slate, [-0.32, 0.98, 0.1], [1, 1, 0.8], [0.1, 0, -0.22], 0.72);
    this.addMesh(new THREE.BoxGeometry(0.34, 0.09, 0.22, 2, 1, 1), slate, [0.32, 0.98, 0.1], [1, 1, 0.8], [0.1, 0, 0.22], 0.72);
    this.addMesh(new THREE.CylinderGeometry(0.04, 0.055, 0.62, 8, 3), dark, [-0.42, 0.82, -0.2], 1, [1.2, 0.18, 0.8], 0.82);
    this.addMesh(new THREE.CylinderGeometry(0.04, 0.055, 0.62, 8, 3), dark, [0.42, 0.82, -0.2], 1, [1.2, -0.18, -0.8], 0.82);
    this.addMesh(new THREE.SphereGeometry(0.055, 8, 6), skin, [-0.54, 0.58, -0.3], [1, 0.8, 1], [0, 0, 0], 0.8);
    this.addMesh(new THREE.SphereGeometry(0.055, 8, 6), skin, [0.54, 0.58, -0.3], [1, 0.8, 1], [0, 0, 0], 0.8);
    this.addMesh(new THREE.CylinderGeometry(0.05, 0.055, 0.62, 8, 3), this.makeMaterial(0x274746), [-0.24, 0.42, 0.05], 1, [0.3, 0.1, -0.42], 0.76);
    this.addMesh(new THREE.CylinderGeometry(0.05, 0.055, 0.62, 8, 3), this.makeMaterial(0x274746), [0.24, 0.42, 0.05], 1, [0.3, -0.1, 0.42], 0.76);
    this.addMesh(new THREE.BoxGeometry(0.12, 0.05, 0.24, 1, 1, 2), slate, [-0.26, 0.35, -0.12], [1, 1, 1], [0.18, 0, -0.34], 0.72);
    this.addMesh(new THREE.BoxGeometry(0.12, 0.05, 0.24, 1, 1, 2), slate, [0.26, 0.35, -0.12], [1, 1, 1], [0.18, 0, 0.34], 0.72);
    this.addMesh(new THREE.BoxGeometry(0.15, 0.1, 0.44, 2, 1, 2), dark, [-0.3, 0.16, -0.08], 1, [0.08, 0, -0.2], 0.74);
    this.addMesh(new THREE.BoxGeometry(0.15, 0.1, 0.44, 2, 1, 2), dark, [0.3, 0.16, -0.08], 1, [0.08, 0, 0.2], 0.74);
    this.addMesh(new THREE.BoxGeometry(0.22, 0.05, 0.18, 2, 1, 1), slate, [-0.18, 0.5, 0.18], [1, 1, 1], [0.2, 0, -0.1], 0.68);
    this.addMesh(new THREE.BoxGeometry(0.22, 0.05, 0.18, 2, 1, 1), slate, [0.18, 0.5, 0.18], [1, 1, 1], [0.2, 0, 0.1], 0.68);

    this.addMesh(
      new THREE.BoxGeometry(0.08, 0.42, 0.14),
      slate,
      [-0.18, 0.68, 0.18],
      1,
      [0.22, 0, -0.08],
      0.82
    );
    this.addMesh(
      new THREE.BoxGeometry(0.08, 0.42, 0.14),
      slate,
      [0.18, 0.68, 0.18],
      1,
      [0.22, 0, 0.08],
      0.82
    );
    this.addMesh(
      this.makeWingShape(-1),
      red,
      [-0.22, 0.98, 0.58],
      [0.22, 0.28, 1],
      [Math.PI / 2.12, 0.08, -0.56],
      0.58
    );
    this.addMesh(
      this.makeWingShape(1),
      red,
      [0.22, 0.98, 0.58],
      [0.22, 0.28, 1],
      [Math.PI / 2.12, -0.08, 0.56],
      0.58
    );

    // Cape and the iconic red streak.
    this.addMesh(new THREE.PlaneGeometry(0.7, 1.1, 6, 8), red, [0, 0.72, 0.62], [1, 1, 1], [0.25, 0, 0], 0.54);
    const ribbon = new THREE.Mesh(this.makeRibbonGeometry(), this.ribbonMaterial);
    ribbon.position.set(0, 0.5, 1.66);
    ribbon.rotation.x = -0.08;
    this.group.add(ribbon);
    const ribbonCore = new THREE.Mesh(this.makeRibbonGeometry(), this.ribbonCoreMaterial);
    ribbonCore.position.set(0, 0.54, 1.7);
    ribbonCore.scale.set(0.46, 0.82, 1.02);
    ribbonCore.rotation.x = -0.085;
    this.group.add(ribbonCore);
    const ribbonEcho = new THREE.Mesh(this.makeRibbonGeometry(), this.ribbonMaterial);
    ribbonEcho.position.set(0.04, 0.42, 1.58);
    ribbonEcho.scale.set(0.68, 0.46, 0.9);
    ribbonEcho.rotation.x = -0.12;
    this.group.add(ribbonEcho);
    const ribbonFilamentLeft = new THREE.Mesh(this.makeRibbonGeometry(), this.ribbonCoreMaterial);
    ribbonFilamentLeft.position.set(-0.14, 0.58, 1.42);
    ribbonFilamentLeft.scale.set(0.18, 0.22, 0.84);
    ribbonFilamentLeft.rotation.set(-0.16, 0.12, -0.1);
    this.group.add(ribbonFilamentLeft);
    const ribbonFilamentRight = new THREE.Mesh(this.makeRibbonGeometry(), this.ribbonCoreMaterial);
    ribbonFilamentRight.position.set(0.14, 0.48, 1.48);
    ribbonFilamentRight.scale.set(0.16, 0.18, 0.76);
    ribbonFilamentRight.rotation.set(-0.14, -0.08, 0.06);
    this.group.add(ribbonFilamentRight);

    // Engine glow.
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.48, 34), this.glowMaterial);
    glow.position.set(0, 0.05, 1.75);
    glow.rotation.x = 0;
    this.group.add(glow);
    const outerGlow = new THREE.Mesh(new THREE.CircleGeometry(0.76, 42), this.glowMaterial);
    outerGlow.position.set(0, 0.05, 1.72);
    outerGlow.scale.set(1, 0.78, 1);
    this.group.add(outerGlow);

    this.group.position.copy(this.basePosition);
    this.group.rotation.set(-0.05, 0, 0);
    this.group.scale.setScalar(1.08);
  }

  setPosition(x: number, y: number, z: number) {
    this.basePosition.set(x, y, z);
    this.group.position.copy(this.basePosition);
  }

  getSemanticPoints(): BikeSemanticPoint[] {
    return [
      {
        id: 'hoverbike-rider',
        title: 'Hoverbike Rider',
        category: 'vehicle',
        description: 'A hand-built travel companion: mask, rider posture, cloth wing, engine glow, and the red signal trail that can later branch into related media.',
        tags: ['hoverbike', 'rider', 'travel'],
        world: this.group.localToWorld(new THREE.Vector3(0, 1.24, -0.2)),
      },
      {
        id: 'signal-ribbon',
        title: 'Signal Ribbon',
        category: 'music',
        description: 'The trailing red wake is treated like a data ribbon, ready to unfold into music, image, link, or short scene notes.',
        tags: ['signal', 'trail', 'music'],
        world: this.group.localToWorld(new THREE.Vector3(0.25, 0.56, 8.4)),
      },
    ];
  }

  private sampleRoute(progress: number) {
    const points = [
      { t: 0.0, x: 0.08, z: 2.94 },
      { t: 0.18, x: 0.04, z: 2.86 },
      { t: 0.34, x: -0.18, z: 2.72 },
      { t: 0.48, x: -0.94, z: 2.78 },
      { t: 0.62, x: -0.38, z: 2.96 },
      { t: 0.8, x: -0.02, z: 2.78 },
      { t: 0.92, x: 0.08, z: 2.88 },
      { t: 1.0, x: 0.18, z: 3.02 },
    ];

    const clamped = THREE.MathUtils.clamp(progress, 0, 1);
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (clamped <= b.t) {
        const rawT = (clamped - a.t) / (b.t - a.t);
        const t = THREE.MathUtils.smoothstep(rawT, 0, 1);
        return {
          x: THREE.MathUtils.lerp(a.x, b.x, t),
          z: THREE.MathUtils.lerp(a.z, b.z, t),
        };
      }
    }

    const last = points[points.length - 1];
    return { x: last.x, z: last.z };
  }

  update(time: number, _dt: number, progress = 0) {
    const route = this.sampleRoute(progress);
    const prevRoute = this.sampleRoute(Math.max(0, progress - 0.012));
    const nextRoute = this.sampleRoute(Math.min(1, progress + 0.012));
    const routeX = route.x + Math.sin(progress * Math.PI * 4.2) * 0.04;
    const routeZ = route.z;
    const routeHeading = nextRoute.x - prevRoute.x;
    this.group.position.set(
      this.basePosition.x + routeX,
      this.basePosition.y + Math.sin(time * 1.6) * 0.13 + Math.sin(time * 2.7) * 0.04,
      routeZ
    );

    this.group.rotation.x = -0.08 + Math.sin(time * 0.9) * 0.018;
    this.group.rotation.z = routeHeading * 0.65 + Math.sin(time * 0.5 + progress * 4) * 0.045;
    this.group.rotation.y = routeHeading * 1.45 + Math.sin(progress * Math.PI * 2.1) * 0.06;

    this.materials.forEach((material) => {
      material.uniforms.uProgress.value = progress;
    });
    this.ribbonMaterial.uniforms.uTime.value = time;
    this.ribbonCoreMaterial.uniforms.uTime.value = time;
    this.glowMaterial.uniforms.uTime.value = time;
  }

  dispose() {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
      }
    });
    this.materials.forEach((material) => material.dispose());
    this.edgeLines.forEach((line) => {
      (line.material as THREE.Material).dispose();
    });
    this.ribbonMaterial.dispose();
    this.ribbonCoreMaterial.dispose();
    this.glowMaterial.dispose();
    this.scene.remove(this.group);
  }
}
