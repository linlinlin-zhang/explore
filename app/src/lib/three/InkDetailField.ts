import * as THREE from 'three';
import { seededRandom } from './SimplexNoise';

const DotVertexShader = `
  uniform float uScrollOffset;
  uniform float uProgress;

  attribute float aSize;
  attribute float aSeed;
  attribute float aTone;

  varying float vAlpha;
  varying float vTone;

  void main() {
    vec3 pos = position;
    pos.z = mod(pos.z + uScrollOffset * 1.28 + 140.0, 280.0) - 118.0;

    float nearFade = smoothstep(-95.0, -55.0, pos.z);
    float farFade = 1.0 - smoothstep(36.0, 115.0, pos.z);
    vAlpha = nearFade * farFade * (0.28 + aTone * 0.46);
    vAlpha *= mix(1.25, 0.65, smoothstep(0.72, 1.0, uProgress));
    vTone = aTone;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float dist = length(mvPosition.xyz);
    gl_PointSize = clamp(aSize * (120.0 / dist), 1.0, 3.4);
  }
`;

const DotFragmentShader = `
  uniform vec3 uInkColor;
  varying float vAlpha;
  varying float vTone;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.18, d);
    vec3 color = mix(uInkColor * 0.55, uInkColor, vTone);
    gl_FragColor = vec4(color, edge * vAlpha);
  }
`;

export class InkDetailField {
  private dots: THREE.Points;
  private dotGeometry: THREE.BufferGeometry;
  private dotMaterial: THREE.ShaderMaterial;
  private strokes: THREE.LineSegments;
  private strokeGeometry: THREE.BufferGeometry;
  private strokeMaterial: THREE.LineBasicMaterial;
  private smoothedOffset = 0;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.dotGeometry = new THREE.BufferGeometry();
    this.strokeGeometry = new THREE.BufferGeometry();

    const dotCount = 5200;
    const positions = new Float32Array(dotCount * 3);
    const sizes = new Float32Array(dotCount);
    const seeds = new Float32Array(dotCount);
    const tones = new Float32Array(dotCount);

    for (let i = 0; i < dotCount; i += 1) {
      const sideBias = seededRandom(i + 4) < 0.62 ? 1 : 0;
      const x = (seededRandom(i + 10) - 0.5) * (sideBias ? 150 : 86);
      const z = seededRandom(i + 20) * 280 - 120;
      const y = -1.05 + seededRandom(i + 30) * 0.08;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      sizes[i] = 0.55 + seededRandom(i + 40) * 1.9;
      seeds[i] = seededRandom(i + 50);
      tones[i] = seededRandom(i + 60);
    }

    this.dotGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dotGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.dotGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.dotGeometry.setAttribute('aTone', new THREE.BufferAttribute(tones, 1));

    this.dotMaterial = new THREE.ShaderMaterial({
      vertexShader: DotVertexShader,
      fragmentShader: DotFragmentShader,
      uniforms: {
        uScrollOffset: { value: 0 },
        uProgress: { value: 0 },
        uInkColor: { value: new THREE.Color(0x20160f) },
      },
      transparent: true,
      depthWrite: false,
    });

    this.dots = new THREE.Points(this.dotGeometry, this.dotMaterial);
    this.scene.add(this.dots);

    const strokeCount = 1180;
    const strokePositions = new Float32Array(strokeCount * 2 * 3);
    for (let i = 0; i < strokeCount; i += 1) {
      const x = (seededRandom(i + 1000) - 0.5) * 160;
      const z = seededRandom(i + 1100) * 260 - 115;
      const len = 0.35 + seededRandom(i + 1200) * 1.25;
      const angle = -0.28 + seededRandom(i + 1300) * 0.56;
      const y = -1.0 + seededRandom(i + 1400) * 0.06;
      const i6 = i * 6;
      strokePositions[i6] = x;
      strokePositions[i6 + 1] = y;
      strokePositions[i6 + 2] = z;
      strokePositions[i6 + 3] = x + Math.cos(angle) * len;
      strokePositions[i6 + 4] = y;
      strokePositions[i6 + 5] = z + Math.sin(angle) * len;
    }

    this.strokeGeometry.setAttribute('position', new THREE.BufferAttribute(strokePositions, 3));
    this.strokeMaterial = new THREE.LineBasicMaterial({
      color: 0x20160f,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this.strokes = new THREE.LineSegments(this.strokeGeometry, this.strokeMaterial);
    this.scene.add(this.strokes);
  }

  update(scrollOffset: number, dt: number, progress: number) {
    this.smoothedOffset += (scrollOffset - this.smoothedOffset) * Math.min(dt * 6, 1);
    this.dotMaterial.uniforms.uScrollOffset.value = this.smoothedOffset;
    this.dotMaterial.uniforms.uProgress.value = progress;
    this.strokes.position.z = (this.smoothedOffset * 1.28) % 26;
    this.strokeMaterial.opacity = THREE.MathUtils.lerp(0.26, 0.16, progress);
  }

  setInkColor(color: THREE.Color) {
    this.dotMaterial.uniforms.uInkColor.value.copy(color);
    this.strokeMaterial.color.copy(color);
  }

  dispose() {
    this.scene.remove(this.dots);
    this.scene.remove(this.strokes);
    this.dotGeometry.dispose();
    this.strokeGeometry.dispose();
    this.dotMaterial.dispose();
    this.strokeMaterial.dispose();
  }
}
