import * as THREE from 'three';
import { SimplexNoise, seededRandom } from './SimplexNoise';

const noise = new SimplexNoise(137);

// Sable-style cel-shaded rock material
const RockVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying float vDist;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vDist = length(mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const RockFragmentShader = `
  uniform vec3 uBaseColor;
  uniform vec3 uSkyColor;
  
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying float vDist;
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(0.6, 0.75, 0.25));
    
    float NdotL = dot(normal, lightDir);
    
    // Sable cel-shading: dramatic 4-level
    float cel = 0.0;
    if (NdotL > 0.7) cel = 1.0;
    else if (NdotL > 0.3) cel = 0.5;
    else if (NdotL > -0.1) cel = 0.18;
    else cel = 0.04;
    
    // Rock surface variation
    float surfNoise = fract(sin(dot(vUv * 3.0, vec2(12.9898, 78.233))) * 43758.5453);
    surfNoise += fract(sin(dot(vUv * 7.0 + 50.0, vec2(39.3468, 27.156))) * 54172.3613) * 0.5;
    
    // Horizontal strata layers (Sable's signature banding)
    float strata = sin(vWorldPos.y * 8.0) * 0.5 + 0.5;
    strata = smoothstep(0.4, 0.6, strata) * 0.08;
    
    vec3 color = uBaseColor * (0.88 + surfNoise * 0.15);
    color += vec3(strata * 0.1, strata * 0.05, 0.0);
    color *= cel;
    
    // Atmospheric fog
    float fogAmount = smoothstep(24.0, 180.0, vDist);
    color = mix(color, uSkyColor * 0.68, fogAmount * 0.82);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

interface RockDef {
  type: 'arch' | 'mesas' | 'pillar' | 'ruins' | 'spire' | 'balanced' | 'debris';
  x: number;
  z: number;
  seed: number;
  scale: number;
}

export class ProceduralRocks {
  private rocks: THREE.Mesh[] = [];
  private materials: THREE.ShaderMaterial[] = [];
  private instances: RockDef[] = [];
  private scrollOffset = 0;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.generateRocks();
  }

  private weatherGeometry(geometry: THREE.BufferGeometry, seed: number, amount = 0.18, strataAmount = 0.08) {
    const pos = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      const ridge = noise.noise2D(x * 0.72 + seed * 0.11, z * 0.72 - seed * 0.09);
      const chip = noise.noise2D(x * 1.85 - seed * 0.07, y * 1.55 + seed * 0.05);
      const sway = noise.noise2D(z * 1.2 + seed * 0.04, x * 1.2 - seed * 0.06);
      const band = Math.sin(y * 3.4 + seed * 0.18) * 0.5 + 0.5;
      pos[i] += ridge * amount * (0.72 + band * 0.32);
      pos[i + 1] += chip * amount * 0.34 + (band - 0.5) * strataAmount;
      pos[i + 2] += sway * amount * 0.9;
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  // === GEOMETRY GENERATORS ===

  private createArchGeo(): THREE.BufferGeometry {
    // Create a monumental natural arch using lathe + CSG-like approach
    const shape = new THREE.Shape();
    // Left pillar
    shape.moveTo(-2.5, 0);
    shape.lineTo(-2.2, 0);
    shape.lineTo(-2.0, 4);
    // Inner curve
    shape.quadraticCurveTo(-1.5, 6.5, 0, 7);
    // Right pillar
    shape.quadraticCurveTo(1.5, 6.5, 2.0, 4);
    shape.lineTo(2.2, 0);
    shape.lineTo(2.5, 0);
    // Thickness
    shape.lineTo(2.8, 0);
    shape.lineTo(2.5, 4);
    shape.quadraticCurveTo(1.8, 7.2, 0, 8);
    shape.quadraticCurveTo(-1.8, 7.2, -2.5, 4);
    shape.lineTo(-2.8, 0);
    shape.closePath();

    const extrudeSettings = {
      depth: 1.2,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.2,
      bevelSegments: 5,
      curveSegments: 16,
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    // Add some organic deformation
    const pos = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      const deform = noise.noise2D(pos[i] * 0.5 + 100, pos[i + 1] * 0.5) * 0.15;
      pos[i] += deform;
      pos[i + 2] += deform * 0.5;
    }
    return this.weatherGeometry(geo, 14, 0.16, 0.09);
  }

  private createMesasGeo(): THREE.BufferGeometry {
    // Layered mesa/terrace like Sable's cake-layer rocks
    const group = new THREE.Group();

    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const radius = 3.8 - i * 0.32 + Math.sin(i * 1.7) * 0.24;
      const height = 0.42 + (i % 3) * 0.08;
      const geo = new THREE.CylinderGeometry(radius * (0.78 + t * 0.12), radius, height, 22, 5);
      const mesh = new THREE.Mesh(geo);
      mesh.position.y = i * (height + 0.11);
      // Add organic deformation
      const pos = geo.attributes.position.array as Float32Array;
      for (let j = 0; j < pos.length; j += 3) {
        const angle = Math.atan2(pos[j + 2], pos[j]);
        const deform = noise.noise2D(Math.cos(angle) * 2 + i * 10, Math.sin(angle) * 2) * 0.3;
        const r = Math.sqrt(pos[j] * pos[j] + pos[j + 2] * pos[j + 2]);
        if (r > 0.1) {
          const ledge = i % 2 === 0 && Math.abs(pos[j + 1]) > height * 0.35 ? 0.16 : 0;
          pos[j] += (pos[j] / r) * (deform + ledge);
          pos[j + 2] += (pos[j + 2] / r) * (deform + ledge);
        }
      }
      this.weatherGeometry(geo, 60 + i * 13, 0.16, 0.08);
      group.add(mesh);
    }

    return this.mergeGroup(group);
  }

  private createPillarGeo(): THREE.Group {
    const group = new THREE.Group();
    // Main column
    const mainGeo = new THREE.CylinderGeometry(0.4, 0.6, 5.2, 12, 14);
    // Deform for ancient look
    const pos = mainGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      const y = pos[i + 1];
      // Slight lean
      pos[i] += y * 0.03;
      // Fluting (vertical grooves)
      const angle = Math.atan2(pos[i + 2], pos[i]);
      const flute = Math.sin(angle * 6) * 0.04;
      pos[i] += Math.cos(angle) * flute;
      pos[i + 2] += Math.sin(angle) * flute;
      // Top break (ruined)
      if (y > 1.8) {
        pos[i + 1] = 1.8 + (y - 1.8) * 0.2 + noise.noise2D(pos[i] * 2, pos[i + 2] * 2) * 0.3;
      }
    }
    this.weatherGeometry(mainGeo, 125, 0.08, 0.04);
    const main = new THREE.Mesh(mainGeo);
    group.add(main);

    // Optional broken top piece on ground
    if (seededRandom(141) > 0.18) {
      const topGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.6, 10, 4);
      this.weatherGeometry(topGeo, 149, 0.07, 0.03);
      const top = new THREE.Mesh(topGeo);
      top.position.set(1.5 + seededRandom(151), 0.3, 1 + seededRandom(152));
      top.rotation.z = 0.4 + seededRandom(153) * 0.5;
      top.rotation.x = seededRandom(154) * 0.5;
      group.add(top);
    }

    return group;
  }

  private createSpireGeo(): THREE.BufferGeometry {
    // Tall dramatic spire/totem
    const group = new THREE.Group();
    const height = 9.4;
    const segments = 24;

    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const radius = (1 - t * 0.68) * (0.62 + Math.sin(i * 1.9) * 0.09);
      const h = height / segments;
      const geo = new THREE.CylinderGeometry(
        radius * (0.82 + Math.sin(i * 1.3) * 0.08), radius, h, 10, 3
      );
      this.weatherGeometry(geo, 210 + i * 7, 0.08, 0.035);
      const mesh = new THREE.Mesh(geo);
      mesh.position.y = i * h + h / 2;
      // Slight twist
      mesh.rotation.y = t * 0.46 + Math.sin(i) * 0.08;
      mesh.position.x = Math.sin(t * Math.PI * 1.2) * 0.18;
      group.add(mesh);
      if (i % 5 === 1) {
        const shelf = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.25, radius * 1.42, 0.09, 10, 1));
        shelf.position.y = mesh.position.y + h * 0.36;
        shelf.position.x = mesh.position.x;
        shelf.rotation.y = mesh.rotation.y + 0.1;
        group.add(shelf);
      }
    }

    return this.mergeGroup(group);
  }

  private createBalancedGeo(): THREE.BufferGeometry {
    // Balanced rock formation (large boulder on narrow stem)
    const group = new THREE.Group();
    // Stem
    const stemGeo = new THREE.CylinderGeometry(0.3, 0.8, 2.5, 6);
    const stem = new THREE.Mesh(stemGeo);
    stem.position.y = 1.25;
    group.add(stem);

    // Balanced boulder
    const boulderGeo = new THREE.IcosahedronGeometry(1.8, 3);
    const pos = boulderGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] *= 1.0 + noise.noise2D(pos[i + 1], pos[i + 2]) * 0.25;
      pos[i + 1] *= 0.7;
      pos[i + 2] *= 1.0 + noise.noise2D(pos[i], pos[i + 1] + 50) * 0.25;
    }
    this.weatherGeometry(boulderGeo, 310, 0.1, 0.03);
    const boulder = new THREE.Mesh(boulderGeo);
    boulder.position.y = 3.2;
    boulder.rotation.set(0.1, 0.5, 0.05);
    group.add(boulder);

    return this.mergeGroup(group);
  }

  private createDebrisGeo(): THREE.BufferGeometry {
    // Scattered ancient fragments
    const group = new THREE.Group();
    const fragmentCount = 5;

    for (let i = 0; i < fragmentCount; i++) {
      const geo = new THREE.BoxGeometry(
        0.3 + seededRandom(400 + i) * 0.8,
        0.1 + seededRandom(430 + i) * 0.3,
        0.2 + seededRandom(460 + i) * 0.5,
        2,
        2,
        2
      );
      this.weatherGeometry(geo, 500 + i * 9, 0.05, 0.01);
      const mesh = new THREE.Mesh(geo);
      mesh.position.set(
        (seededRandom(520 + i) - 0.5) * 3,
        0.1,
        (seededRandom(540 + i) - 0.5) * 3
      );
      mesh.rotation.set(
        seededRandom(560 + i) * 0.3,
        seededRandom(580 + i) * Math.PI,
        seededRandom(600 + i) * 0.4
      );
      group.add(mesh);
    }

    return this.mergeGroup(group);
  }

  private mergeGroup(group: THREE.Group): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const clone = child.geometry.clone();
        child.updateMatrixWorld();
        clone.applyMatrix4(child.matrixWorld);
        geometries.push(clone);
      }
    });

    const merged = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    geometries.forEach((g) => {
      const posAttr = g.attributes.position;
      const normAttr = g.attributes.normal;
      const uvAttr = g.attributes.uv;
      for (let i = 0; i < posAttr.count; i++) {
        positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        if (normAttr) {
          normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
        }
        if (uvAttr) {
          uvs.push(uvAttr.getX(i), uvAttr.getY(i));
        }
      }
    });

    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (normals.length > 0) {
      merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    }
    if (uvs.length > 0) {
      merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    }
    merged.computeVertexNormals();
    return merged;
  }

  // === MAIN GENERATION ===

  private generateRocks() {
    const rockDefs: { type: RockDef['type']; count: number; minZ: number; maxZ: number; minX: number; maxX: number }[] = [
      { type: 'arch', count: 10, minZ: -35, maxZ: 385, minX: -62, maxX: 62 },
      { type: 'mesas', count: 18, minZ: -45, maxZ: 420, minX: -74, maxX: 74 },
      { type: 'pillar', count: 24, minZ: -30, maxZ: 360, minX: -52, maxX: 52 },
      { type: 'spire', count: 16, minZ: 10, maxZ: 415, minX: -66, maxX: 66 },
      { type: 'balanced', count: 10, minZ: 0, maxZ: 330, minX: -45, maxX: 45 },
      { type: 'ruins', count: 22, minZ: -10, maxZ: 390, minX: -58, maxX: 58 },
      { type: 'debris', count: 42, minZ: -45, maxZ: 430, minX: -72, maxX: 72 },
    ];

    const materialCache = new Map<string, THREE.ShaderMaterial>();

    rockDefs.forEach(({ type, count, minZ, maxZ, minX, maxX }) => {
      // Get or create shared geometry for this type
      let baseGeo: THREE.BufferGeometry | THREE.Group | null = null;

      switch (type) {
        case 'arch': baseGeo = this.createArchGeo(); break;
        case 'mesas': baseGeo = this.createMesasGeo(); break;
        case 'pillar': baseGeo = this.createPillarGeo(); break;
        case 'spire': baseGeo = this.createSpireGeo(); break;
        case 'balanced': baseGeo = this.createBalancedGeo(); break;
        case 'ruins': baseGeo = this.createDebrisGeo(); break;
        case 'debris': baseGeo = this.createDebrisGeo(); break;
      }

      // Create shared material
      let mat = materialCache.get(type);
      if (!mat) {
        mat = new THREE.ShaderMaterial({
          vertexShader: RockVertexShader,
          fragmentShader: RockFragmentShader,
          uniforms: {
            uBaseColor: { value: new THREE.Color(0xC89868) },
            uSkyColor: { value: new THREE.Color(0x7EC8C8) },
          },
        });
        materialCache.set(type, mat);
        this.materials.push(mat);
      }

      for (let i = 0; i < count; i++) {
        const seed = i * 137 + type.length * 31;
        let x = minX + seededRandom(seed) * (maxX - minX);
        const z = minZ + seededRandom(seed + 1) * (maxZ - minZ);
        const corridorHalfWidth =
          z > 65 && z < 330
            ? type === 'arch' || type === 'mesas' || type === 'pillar' || type === 'balanced'
              ? 23
              : 17
            : type === 'debris'
              ? 10
              : 14;

        if ((type === 'balanced' || type === 'arch' || type === 'spire') && z < 78 && Math.abs(x) < 48) {
          const side = x < 0 ? -1 : 1;
          x = side * (48 + seededRandom(seed + 9) * 12);
        }

        // STRICT CENTER CLEARANCE: no rocks in the view center
        if (Math.abs(x) < corridorHalfWidth && z > -22 && z < 346) {
          const side = x < 0 ? -1 : 1;
          x = side * (corridorHalfWidth + 2 + seededRandom(seed + 5) * 12);
        }

        // Create mesh
        let geo: THREE.BufferGeometry;
        if (baseGeo instanceof THREE.Group) {
          geo = this.mergeGroup(baseGeo.clone());
        } else {
          geo = (baseGeo as THREE.BufferGeometry).clone();
        }

        const instanceMaterial = mat.clone();
        instanceMaterial.uniforms.uBaseColor.value.copy(mat.uniforms.uBaseColor.value);
        instanceMaterial.uniforms.uSkyColor.value.copy(mat.uniforms.uSkyColor.value);
        this.materials.push(instanceMaterial);

        const mesh = new THREE.Mesh(geo, instanceMaterial);

        mesh.position.set(x, -0.8, -z);

        // Variation
        let scaleBase = 0.6 + seededRandom(seed + 2) * 1.8;
        if (z < 90 && (type === 'balanced' || type === 'spire')) {
          scaleBase *= 0.72;
        }
        if (type === 'pillar') {
          mesh.scale.set(scaleBase * 0.7, scaleBase * (0.8 + seededRandom(seed + 3)), scaleBase * 0.7);
        } else if (type === 'spire') {
          mesh.scale.set(scaleBase, scaleBase * (1.2 + seededRandom(seed + 3)), scaleBase);
        } else {
          mesh.scale.setScalar(scaleBase);
        }

        mesh.rotation.y = seededRandom(seed + 4) * Math.PI * 2;
        if (type === 'balanced') {
          mesh.rotation.z = (seededRandom(seed + 5) - 0.5) * 0.15;
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.scene.add(mesh);
        this.rocks.push(mesh);
        this.instances.push({ type, x, z, seed, scale: scaleBase });
      }
    });
  }

  update(scrollOffset: number, dt: number, progress: number) {
    this.scrollOffset += (scrollOffset - this.scrollOffset) * Math.min(dt * 5, 1);

    this.rocks.forEach((rock, i) => {
      const inst = this.instances[i];
      const z = -inst.z + this.scrollOffset * 0.98 - 10;
      const wobble = Math.max(0.14, Math.min(1.15, (Math.abs(inst.x) - 16) * 0.05));
      rock.position.z = z;
      rock.position.x = inst.x + Math.sin(progress * Math.PI * 3 + inst.seed) * wobble;
      rock.position.y = -0.85 + Math.sin(progress * Math.PI * 2 + inst.seed * 0.1) * 0.08;
      rock.rotation.y += dt * 0.015 * (i % 2 === 0 ? 1 : -1);
      rock.visible = z > -285 && z < 42;
    });
  }

  setColor(color: THREE.Color) {
    this.materials.forEach((mat) => {
      mat.uniforms.uBaseColor.value.copy(color);
    });
  }

  setSkyColor(color: THREE.Color) {
    this.materials.forEach((mat) => {
      mat.uniforms.uSkyColor.value.copy(color);
    });
  }

  dispose() {
    this.rocks.forEach((rock) => {
      this.scene.remove(rock);
      rock.geometry.dispose();
    });
    this.materials.forEach((mat) => mat.dispose());
  }
}
