import * as THREE from 'three';

const ParticleVertexShader = `
  uniform float uTime;
  uniform float uScrollSpeed;
  
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aLife;
  
  varying float vAlpha;
  varying float vLife;
  
  void main() {
    vec3 pos = position;
    
    // Drift with wind
    pos.x += sin(uTime * aSpeed * 0.5 + aPhase) * 2.0;
    pos.y += sin(uTime * aSpeed * 0.3 + aPhase * 2.0) * 0.5;
    pos.z += uTime * aSpeed * 4.4 + uScrollSpeed;
    
    // Wrap around Z
    pos.z = mod(pos.z + 130.0, 260.0) - 130.0;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    float dist = length(mvPosition.xyz);
    gl_PointSize = aSize * (260.0 / dist);
    gl_PointSize = clamp(gl_PointSize, 0.8, 8.0);
    
    vAlpha = 0.3 + 0.7 * sin(aPhase + uTime * aSpeed);
    vLife = aLife;
  }
`;

const ParticleFragmentShader = `
  uniform vec3 uColor;
  
  varying float vAlpha;
  varying float vLife;
  
  void main() {
    // Soft circular particle
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float alpha = smoothstep(0.5, 0.1, dist) * vAlpha * vLife * 0.72;
    gl_FragColor = vec4(uColor, alpha);
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
    this.particleCount = 1400;
    
    this.material = new THREE.ShaderMaterial({
      vertexShader: ParticleVertexShader,
      fragmentShader: ParticleFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xE8D0B0) },
        uScrollSpeed: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
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

    for (let i = 0; i < this.particleCount; i++) {
      // Spread across wide area
      positions.push(
        (Math.random() - 0.5) * 170,     // x
        Math.random() * 18 - 2,          // y
        (Math.random() - 0.5) * 260      // z
      );
      
      sizes.push(1.0 + Math.random() * 4.6);
      phases.push(Math.random() * Math.PI * 2);
      speeds.push(0.3 + Math.random() * 0.7);
      lifes.push(0.3 + Math.random() * 0.7);
    }

    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    this.geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    this.geometry.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speeds, 1));
    this.geometry.setAttribute('aLife', new THREE.Float32BufferAttribute(lifes, 1));

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  update(dt: number, scrollProgress: number) {
    this.material.uniforms.uTime.value += dt;
    this.material.uniforms.uScrollSpeed.value = scrollProgress * 120;
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
