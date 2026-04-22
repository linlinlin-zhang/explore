import * as THREE from 'three';

const ParticleVertexShader = `
  uniform float uTime;
  uniform float uScrollSpeed;
  
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aLife;
  attribute float aBand;
  attribute float aDrift;
  
  varying float vAlpha;
  varying float vLife;
  varying float vBand;
  
  void main() {
    vec3 pos = position;
    float wind = mix(1.0, 3.4, aBand);
    float swirl = sin(uTime * (0.38 + aSpeed * 0.45) + aPhase) * wind;
    float lateral = sin(uTime * (0.72 + aBand * 0.5) + pos.z * 0.06 + aPhase * 1.7) * aDrift;
    pos.x += swirl + lateral;
    pos.y += sin(uTime * (0.24 + aSpeed * 0.3) + aPhase * 2.0) * mix(0.16, 1.08, aBand);
    pos.y += sin(uTime * 0.95 + pos.x * 0.04 + aPhase) * 0.18 * aBand;
    pos.z += uTime * mix(2.0, 6.2, aSpeed) + uScrollSpeed * mix(0.14, 0.3, aBand);
    
    pos.z = mod(pos.z + 170.0, 340.0) - 170.0;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    float dist = length(mvPosition.xyz);
    gl_PointSize = aSize * mix(0.9, 1.34, aBand) * (320.0 / dist);
    gl_PointSize = clamp(gl_PointSize, 0.9, 11.0);
    
    vAlpha = 0.38 + 0.62 * sin(aPhase + uTime * (0.66 + aSpeed));
    vLife = aLife;
    vBand = aBand;
  }
`;

const ParticleFragmentShader = `
  uniform vec3 uColor;
  
  varying float vAlpha;
  varying float vLife;
  varying float vBand;
  
  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float core = smoothstep(0.5, 0.06, dist);
    float feather = smoothstep(0.5, 0.24, dist);
    float alpha = mix(core * 0.6, feather, vBand) * vAlpha * vLife * mix(0.42, 0.78, vBand);
    vec3 color = mix(uColor * 0.82, uColor * 1.08, vBand * 0.85);
    gl_FragColor = vec4(color, alpha);
  }
`;

export class DesertParticles {
  private points!: THREE.Points;
  private material: THREE.ShaderMaterial;
  private geometry!: THREE.BufferGeometry;
  private particleCount: number;
  private scene: THREE.Scene;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleCount = 2600;
    
    this.material = new THREE.ShaderMaterial({
      vertexShader: ParticleVertexShader,
      fragmentShader: ParticleFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xe8d0b0) },
        uScrollSpeed: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.generateParticles();
  }

  private generateParticles() {
    this.geometry = new THREE.BufferGeometry();
    
    const positions: number[] = [];
    const sizes: number[] = [];
    const phases: number[] = [];
    const speeds: number[] = [];
    const lifes: number[] = [];
    const bands: number[] = [];
    const drifts: number[] = [];

    for (let i = 0; i < this.particleCount; i += 1) {
      const r = Math.random();
      let x = 0;
      let y = 0;
      let z = 0;
      let band = 0.2;
      let size = 1.0;

      if (r < 0.62) {
        band = 0.16 + Math.random() * 0.18;
        x = (Math.random() - 0.5) * 200;
        y = Math.random() * 2.8 - 1.1;
        z = (Math.random() - 0.5) * 320;
        size = 0.9 + Math.random() * 2.4;
      } else if (r < 0.9) {
        band = 0.46 + Math.random() * 0.24;
        x = (Math.random() - 0.5) * 180;
        y = Math.random() * 18 - 1.8;
        z = (Math.random() - 0.5) * 330;
        size = 1.4 + Math.random() * 3.8;
      } else {
        band = 0.82 + Math.random() * 0.18;
        x = (Math.random() - 0.5) * 240;
        y = Math.random() * 24 + 6;
        z = (Math.random() - 0.5) * 340;
        size = 1.8 + Math.random() * 4.8;
      }

      positions.push(x, y, z);
      sizes.push(size);
      phases.push(Math.random() * Math.PI * 2);
      speeds.push(0.2 + Math.random() * 0.95);
      lifes.push(0.32 + Math.random() * 0.68);
      bands.push(band);
      drifts.push(0.6 + Math.random() * 2.8);
    }

    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    this.geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    this.geometry.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speeds, 1));
    this.geometry.setAttribute('aLife', new THREE.Float32BufferAttribute(lifes, 1));
    this.geometry.setAttribute('aBand', new THREE.Float32BufferAttribute(bands, 1));
    this.geometry.setAttribute('aDrift', new THREE.Float32BufferAttribute(drifts, 1));

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.position.y = 0.3;
    this.scene.add(this.points);
  }

  update(dt: number, scrollProgress: number) {
    this.material.uniforms.uTime.value += dt;
    this.material.uniforms.uScrollSpeed.value = scrollProgress * 130;
  }

  setColor(color: THREE.Color) {
    this.material.uniforms.uColor.value.copy(color);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.points);
  }
}
