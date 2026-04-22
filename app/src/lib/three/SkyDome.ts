import * as THREE from 'three';

const SkyVertexShader = `
  varying vec3 vWorldPos;
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SkyFragmentShader = `
  uniform vec3 uSkyTop;
  uniform vec3 uSkyHorizon;
  uniform float uTime;
  uniform float uStarVisibility;
  uniform float uSunGlow;
  uniform float uProgress;
  
  varying vec3 vWorldPos;
  varying vec2 vUv;
  
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  void main() {
    vec3 dir = normalize(vWorldPos);
    float y = dir.y;
    
    // Multi-band sky gradient (Sable style)
    float horizonBand = smoothstep(-0.1, 0.3, y);
    float midBand = smoothstep(0.2, 0.6, y);
    float topBand = smoothstep(0.5, 1.0, y);
    
    vec3 horizonColor = uSkyHorizon * 1.2;
    vec3 midColor = mix(uSkyHorizon, uSkyTop, 0.5);
    vec3 skyColor = mix(horizonColor, midColor, horizonBand);
    skyColor = mix(skyColor, uSkyTop, midBand);
    
    // Warm horizon glow
    float glow = smoothstep(-0.05, 0.2, y) * smoothstep(0.4, 0.05, y);
    skyColor += uSkyHorizon * 0.3 * glow * uSunGlow;
    
    // Subtle color banding (Sable's graphic sky)
    float banding = sin(y * 15.0) * 0.015;
    skyColor += banding;

    // Flat sun disk travelling across the journey.
    vec3 sunDir = normalize(vec3(
      mix(0.82, -0.65, uProgress),
      0.28 + sin(uProgress * 3.14159265) * 0.54,
      -0.36
    ));
    float sunDisc = 1.0 - smoothstep(0.025, 0.034, distance(dir, sunDir));
    float sunHalo = 1.0 - smoothstep(0.03, 0.22, distance(dir, sunDir));
    vec3 sunColor = mix(vec3(1.0, 0.86, 0.56), vec3(1.0, 0.34, 0.22), smoothstep(0.55, 0.78, uProgress));
    skyColor = mix(skyColor, sunColor, sunDisc * (1.0 - smoothstep(0.78, 0.92, uProgress)));
    skyColor += sunColor * sunHalo * 0.16 * uSunGlow;

    // Two distant moons/rings become clearer toward dusk.
    vec3 moonDir = normalize(vec3(-0.42, 0.58, -0.62));
    float moonDisc = 1.0 - smoothstep(0.028, 0.038, distance(dir, moonDir));
    float moonRing = 1.0 - smoothstep(0.006, 0.017, abs(distance(dir, moonDir) - 0.078));
    float moonVisibility = smoothstep(0.55, 0.88, uProgress);
    skyColor = mix(skyColor, vec3(0.76, 0.82, 0.92), moonDisc * moonVisibility * 0.82);
    skyColor = mix(skyColor, vec3(0.12, 0.09, 0.16), moonRing * moonVisibility * 0.42);

    // Long stylized cloud/sand bands near horizon.
    float cloudBand = smoothstep(0.02, 0.08, y) * smoothstep(0.32, 0.12, y);
    float cloudPattern = sin(dir.x * 34.0 + uTime * 0.08 + uProgress * 8.0);
    cloudPattern += sin((dir.x + dir.z) * 18.0 - uTime * 0.04) * 0.55;
    float cloud = smoothstep(0.78, 0.96, cloudPattern * 0.5 + 0.5) * cloudBand;
    skyColor = mix(skyColor, uSkyHorizon * 1.18, cloud * 0.28);
    
    // Stars
    if (uStarVisibility > 0.01) {
      float star1 = hash(floor(dir.xz * 180.0));
      float star2 = hash(floor(dir.xz * 350.0 + 50.0));
      float starBright = (step(0.998, star1) + step(0.9995, star2) * 0.5);
      starBright *= 0.5 + 0.5 * sin(uTime * 1.5 + star1 * 100.0);
      float starMask = smoothstep(-0.1, 0.3, y) * uStarVisibility;
      skyColor += vec3(1.0, 0.95, 0.88) * starBright * starMask;
    }
    
    gl_FragColor = vec4(skyColor, 1.0);
  }
`;

export class SkyDome {
  private mesh!: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.ShaderMaterial({
      vertexShader: SkyVertexShader,
      fragmentShader: SkyFragmentShader,
      uniforms: {
        uSkyTop: { value: new THREE.Color(0x7EC8C8) },
        uSkyHorizon: { value: new THREE.Color(0xF5D4A8) },
        uTime: { value: 0 },
        uStarVisibility: { value: 0 },
        uSunGlow: { value: 1.0 },
        uProgress: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    const geo = new THREE.SphereGeometry(250, 32, 20);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.scene.add(this.mesh);
  }

  setColors(top: THREE.Color, horizon: THREE.Color) {
    this.material.uniforms.uSkyTop.value.copy(top);
    this.material.uniforms.uSkyHorizon.value.copy(horizon);

    const brightness = (top.r + top.g + top.b) / 3;
    this.material.uniforms.uStarVisibility.value = Math.max(0, 1 - brightness * 2.5);
    this.material.uniforms.uSunGlow.value = Math.max(0.1, brightness * 2);
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
  }

  setJourneyProgress(progress: number) {
    this.material.uniforms.uProgress.value = progress;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.mesh);
  }
}
