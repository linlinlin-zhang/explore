import * as THREE from 'three';
import { SimplexNoise } from './SimplexNoise';

const TerrainVertexShader = `
  uniform float uWorldOffset;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vHeight;
  varying float vDist;
  
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz - vec3(0.0, 0.0, uWorldOffset);
    vNormal = normalize(normalMatrix * normal);
    vHeight = position.y;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vDist = length(mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const TerrainFragmentShader = `
  uniform vec3 uBaseColor;
  uniform vec3 uSkyColor;
  uniform vec3 uInkColor;
  uniform vec3 uAccentColor;
  uniform float uTime;
  uniform float uProgress;
  
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vHeight;
  varying float vDist;
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(
      mix(0.72, -0.48, uProgress),
      mix(0.82, 0.38, smoothstep(0.5, 0.95, uProgress)),
      0.25
    ));
    vec3 halfDir = normalize(lightDir + vec3(0,0,1));
    
    float NdotL = dot(normal, lightDir);
    
    // Sable-style cel shading: 4 clear discrete bands
    float lit = 0.0;
    if (NdotL > 0.65) lit = 1.0;
    else if (NdotL > 0.25) lit = 0.55;
    else if (NdotL > -0.15) lit = 0.22;
    else lit = 0.06;
    
    // Specular highlight on dune crests (subtle)
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
    spec = step(0.6, spec) * 0.15;
    
    // Height-based color: deeper valleys = darker
    vec3 sandColor = uBaseColor;
    float heightNorm = smoothstep(-4.0, 8.0, vHeight);
    sandColor = mix(sandColor * 0.58, sandColor * 1.18, heightNorm);

    // The middle of the journey opens into the almost-white salt flats seen in Sable.
    float saltMask = smoothstep(0.28, 0.42, uProgress) * (1.0 - smoothstep(0.54, 0.68, uProgress));
    vec3 saltColor = mix(vec3(0.94, 0.92, 0.86), vec3(1.0, 0.98, 0.92), heightNorm);
    sandColor = mix(sandColor, saltColor, saltMask);
    
    // Dune crest warmth (Sable's peachy highlights)
    float crest = smoothstep(1.7, 7.0, vHeight);
    sandColor += uAccentColor * 0.11 * crest;
    float slope = 1.0 - abs(normal.y);
    sandColor = mix(sandColor, sandColor * 0.68, smoothstep(0.28, 0.86, slope) * 0.22);
    sandColor = mix(sandColor, sandColor * 1.08 + uSkyColor * 0.05, smoothstep(-2.4, 1.2, vHeight) * 0.08);

    // Long graphic hatch lines and salt-flat contour marks.
    float hatchCoord = vWorldPos.x * 0.11 + vWorldPos.z * 0.045 + vHeight * 0.16;
    float hatch = 1.0 - smoothstep(0.012, 0.055, abs(fract(hatchCoord) - 0.5));
    float contourCoord = vHeight * 0.42 + sin(vWorldPos.z * 0.035) * 0.12;
    float contour = 1.0 - smoothstep(0.01, 0.04, abs(fract(contourCoord) - 0.5));
    float saltCracks = 1.0 - smoothstep(0.006, 0.026, abs(fract(vWorldPos.x * 0.19 + sin(vWorldPos.z * 0.06) * 0.3) - 0.5));
    float terraceCoord = vWorldPos.x * 0.07 - vWorldPos.z * 0.03 + slope * 0.8;
    float terraces = 1.0 - smoothstep(0.018, 0.062, abs(fract(terraceCoord) - 0.5));
    float graphicLines = clamp(hatch * 0.42 + contour * 0.32 + saltCracks * saltMask * 0.36 + terraces * slope * 0.18, 0.0, 1.0);
    float paperNoise = fract(sin(dot(floor(vWorldPos.xz * 2.8 + vHeight), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    
    // Apply cel shading
    sandColor *= lit;
    sandColor += vec3(spec);
    sandColor = mix(sandColor, uInkColor, graphicLines * mix(0.08, 0.14, saltMask));
    sandColor += paperNoise * 0.035;
    
    // Atmospheric perspective: distant terrain fades to sky color
    float fogAmount = smoothstep(52.0, 310.0, vDist);
    sandColor = mix(sandColor, uSkyColor * 0.82, fogAmount * 0.62);
    
    gl_FragColor = vec4(sandColor, 1.0);
  }
`;

export class TerrainGenerator {
  private mesh!: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private noise: SimplexNoise;
  private geometry!: THREE.PlaneGeometry;
  private lastSampleOffset = Number.NaN;
  private lastProgress = Number.NaN;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.noise = new SimplexNoise(42);

    this.material = new THREE.ShaderMaterial({
      vertexShader: TerrainVertexShader,
      fragmentShader: TerrainFragmentShader,
      uniforms: {
        uBaseColor: { value: new THREE.Color(0xD4A86A) },
        uSkyColor: { value: new THREE.Color(0x7EC8C8) },
        uInkColor: { value: new THREE.Color(0x25160f) },
        uAccentColor: { value: new THREE.Color(0xE07A5F) },
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uWorldOffset: { value: 0 },
      },
      side: THREE.DoubleSide,
    });

    this.generateTerrain();
  }

  private fbm(x: number, z: number, octaves: number): number {
    let val = 0;
    let amp = 1;
    let freq = 1;
    let maxVal = 0;
    for (let i = 0; i < octaves; i++) {
      val += this.noise.noise2D(x * freq, z * freq) * amp;
      maxVal += amp;
      amp *= 0.48;
      freq *= 2.15;
    }
    return val / maxVal;
  }

  private ridged(value: number): number {
    return 1 - Math.abs(value);
  }

  private getDunes(x: number, z: number): number {
    let h = 0;

    h += this.fbm(x * 0.006, z * 0.006, 5) * 5.5;
    h += this.fbm(x * 0.018 + 50, z * 0.018, 5) * 3.6;
    h += this.fbm(x * 0.032 - 90, z * 0.032 + 70, 4) * 1.15;

    const ridgeAngle = 0.6;
    const ridgeX = x * Math.cos(ridgeAngle) + z * Math.sin(ridgeAngle);
    const ridgeNoise = this.noise.noise2D(x * 0.006, z * 0.006);
    const ridge = Math.sin(ridgeX * 0.025 + ridgeNoise * 2.0) * 2.9;
    h += ridge * (0.5 + 0.5 * this.noise.noise2D(x * 0.01, z * 0.01));

    h += this.fbm(x * 0.04 + 200, z * 0.04 + 100, 3) * 1.5;

    const crossAngle = ridgeAngle + Math.PI / 2;
    const crossX = x * Math.cos(crossAngle) + z * Math.sin(crossAngle);
    h += Math.sin(crossX * 0.06) * 0.4 * this.noise.noise2D(x * 0.02, z * 0.02);

    h += this.fbm(x * 0.15, z * 0.15, 2) * 0.3;
    h += this.fbm(x * 0.28 + 120, z * 0.28 - 60, 2) * 0.12;
    return h;
  }

  private getBadlands(x: number, z: number): number {
    const base = this.getDunes(x, z) * 0.42;
    const ridge = Math.pow(Math.max(0, this.ridged(this.noise.noise2D(x * 0.025, z * 0.025))), 2.6) * 9.5;
    const terraces = Math.floor((base + ridge) * 1.55) / 1.55;
    const canyonWall = Math.pow(Math.max(0, Math.abs(x) - 22) / 35, 1.9) * 14;
    const etched = this.fbm(x * 0.075 - 30, z * 0.075 + 80, 3) * 0.85;
    return terraces + canyonWall + this.fbm(x * 0.05 + 90, z * 0.05, 3) * 1.1 + etched;
  }

  private getSaltFlat(x: number, z: number): number {
    const basin = this.fbm(x * 0.01 + 300, z * 0.012 - 180, 4) * 1.4;
    const cracks =
      Math.abs(Math.sin(x * 0.17 + this.noise.noise2D(x * 0.025, z * 0.025) * 2.0)) *
      Math.abs(Math.sin(z * 0.13));
    return basin + Math.pow(cracks, 16) * 1.8 - 1.1;
  }

  private getOasisValley(x: number, z: number): number {
    const radial = Math.sqrt((x * 0.72) * (x * 0.72) + (z * 0.12) * (z * 0.12));
    const basin = -Math.pow(Math.max(0, 1 - radial / 24), 2.1) * 7.4;
    const rim = Math.pow(Math.max(0, 1 - Math.abs(radial - 22) / 14), 1.8) * 3.4;
    const terraces = Math.floor((this.fbm(x * 0.05 + 240, z * 0.04 - 120, 4) * 2.8 + 3.0)) / 2.8;
    const meander = Math.sin(z * 0.05 + this.fbm(x * 0.02, z * 0.02, 3) * 3.5) * 0.9;
    const palmshelf = Math.pow(Math.max(0, 1 - Math.abs(x + meander * 2.2) / 10.5), 2.4) * 1.2;
    return terraces + basin + rim + palmshelf;
  }

  private getCanyonPass(x: number, z: number): number {
    const trench = -Math.pow(Math.max(0, 1 - Math.abs(x) / 11.5), 2.2) * 6.4;
    const walls = Math.pow(Math.max(0, (Math.abs(x) - 8.5) / 18.5), 1.7) * 11.8;
    const switchback = Math.sin(z * 0.032 + this.fbm(x * 0.018, z * 0.02, 3) * 2.8) * 1.4;
    const shelves = Math.floor((this.getBadlands(x, z) * 0.5 + walls) * 1.75) / 1.75;
    const cut = Math.pow(Math.max(0, 1 - Math.abs(x + switchback) / 16.5), 1.4) * 1.6;
    return shelves + trench + cut;
  }

  private getRuinsPlateau(x: number, z: number): number {
    const mesa = this.getBadlands(x, z) * 0.48;
    const platform =
      (1 - THREE.MathUtils.smoothstep(Math.abs(x), 8, 22)) *
      (1 - THREE.MathUtils.smoothstep(Math.abs(z % 52), 10, 22)) *
      2.2;
    const buriedWalls =
      Math.max(0, 1 - Math.abs(Math.sin(x * 0.09) * Math.sin(z * 0.06))) * 0.5;
    return mesa + platform + buriedWalls;
  }

  private getHighlands(x: number, z: number): number {
    const mountain =
      Math.pow(Math.max(0, this.fbm(x * 0.012 - 120, z * 0.012 + 80, 6)), 1.7) * 17;
    const ravines = Math.pow(Math.abs(this.noise.noise2D(x * 0.045, z * 0.045)), 3) * -4;
    const crag = this.fbm(x * 0.08 + 220, z * 0.08 - 170, 3) * 1.35;
    return this.getDunes(x, z) * 0.25 + mountain + ravines + crag;
  }

  private getHeight(x: number, z: number, progress: number): number {
    const dunes = this.getDunes(x, z);
    const badlands = this.getBadlands(x, z);
    const salt = this.getSaltFlat(x, z);
    const ruins = this.getRuinsPlateau(x, z);
    const oasis = this.getOasisValley(x, z);
    const canyon = this.getCanyonPass(x, z);
    const highlands = this.getHighlands(x, z);

    let h = dunes;

    const toBadlands = THREE.MathUtils.smoothstep(progress, 0.12, 0.28);
    const toSalt = THREE.MathUtils.smoothstep(progress, 0.34, 0.48);
    const toRuins = THREE.MathUtils.smoothstep(progress, 0.52, 0.68);
    const toOasis = THREE.MathUtils.smoothstep(progress, 0.6, 0.76);
    const toCanyon = THREE.MathUtils.smoothstep(progress, 0.7, 0.86);
    const toHighlands = THREE.MathUtils.smoothstep(progress, 0.76, 0.94);

    h = THREE.MathUtils.lerp(h, badlands, toBadlands);
    h = THREE.MathUtils.lerp(h, salt, toSalt);
    h = THREE.MathUtils.lerp(h, ruins, toRuins);
    h = THREE.MathUtils.lerp(h, oasis, toOasis * (1 - THREE.MathUtils.smoothstep(progress, 0.78, 0.9)));
    h = THREE.MathUtils.lerp(h, canyon, toCanyon);
    h = THREE.MathUtils.lerp(h, highlands, toHighlands);

    // Extra mesh detail so the terrain reads less like a coarse heightfield.
    h += this.fbm(x * 0.18, z * 0.18, 2) * 0.22;
    h += this.fbm(x * 0.36 + 140, z * 0.36 - 90, 2) * 0.1;
    h += this.fbm(x * 0.58 - 30, z * 0.58 + 70, 2) * 0.05;

    const outcropNoise = this.fbm(x * 0.03 + 500, z * 0.03, 3);
    if (outcropNoise > 0.55) {
      const outcropStrength = (outcropNoise - 0.55) / 0.45;
      h += outcropStrength * outcropStrength * THREE.MathUtils.lerp(2.5, 8.0, progress);
    }

    const striatedEdge = Math.pow(Math.max(0, 1 - Math.abs(x) / 54), 2.0) * this.fbm(x * 0.08 + 620, z * 0.08 - 310, 3);
    h += striatedEdge * THREE.MathUtils.lerp(0.22, 1.2, THREE.MathUtils.smoothstep(progress, 0.18, 0.84));

    const pathWidth = THREE.MathUtils.lerp(6, 10, Math.sin(progress * Math.PI));
    const distFromPath = Math.abs(x) * 0.35;
    if (distFromPath < pathWidth) {
      const pathBlend = distFromPath / pathWidth;
      h *= pathBlend * pathBlend * 0.35 + 0.65;
    }

    return h;
  }

  private generateTerrain() {
    const size = 520;
    const segments = 380;
    this.geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    this.geometry.rotateX(-Math.PI / 2);

    this.resampleTerrain(0, 0);

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(0, -1.8, -34);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.scene.add(this.mesh);
  }

  private resampleTerrain(scrollOffset: number, progress: number) {
    const positions = this.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2] - scrollOffset;
      positions[i + 1] = this.getHeight(x, z, progress);
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  update(scrollOffset: number, dt: number, progress: number) {
    const shouldResample =
      !Number.isFinite(this.lastSampleOffset) ||
      Math.abs(scrollOffset - this.lastSampleOffset) > 0.18 ||
      Math.abs(progress - this.lastProgress) > 0.0018;

    if (shouldResample) {
      this.resampleTerrain(scrollOffset, progress);
      this.lastSampleOffset = scrollOffset;
      this.lastProgress = progress;
    }

    this.material.uniforms.uTime.value += dt;
    this.material.uniforms.uProgress.value = progress;
    this.material.uniforms.uWorldOffset.value = scrollOffset;
  }

  setColor(color: THREE.Color) {
    this.material.uniforms.uBaseColor.value.copy(color);
  }

  setSkyColor(color: THREE.Color) {
    this.material.uniforms.uSkyColor.value.copy(color);
  }

  setAccentColor(color: THREE.Color) {
    this.material.uniforms.uAccentColor.value.copy(color);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.mesh);
  }
}
