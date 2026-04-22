import * as THREE from 'three';

const VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uCursor;
  uniform float uCursorActive;
  
  attribute vec3 aOffset;
  attribute float aScale;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aHeight;
  
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vHeight;
  varying float vEdgeGlow;
  
  void main() {
    vec3 pos = position;
    
    // Scale the plant
    pos.y *= aHeight * aScale;
    pos.x *= aScale;
    pos.z *= aScale;
    
    // Stem curvature (parabolic bend)
    float bendFactor = pos.y / (aHeight * aScale);
    pos.x += sin(aPhase * 2.0) * bendFactor * bendFactor * 0.3;
    pos.z += cos(aPhase * 1.5) * bendFactor * bendFactor * 0.2;
    
    // Wind effect - layered sine waves
    float windX = sin(uTime * 0.5 + aOffset.x * 0.3 + aPhase) * 0.15;
    windX += sin(uTime * 2.0 + aOffset.z * 0.8 + aPhase * 1.3) * 0.05;
    
    float windZ = cos(uTime * 0.4 + aOffset.z * 0.25 + aPhase * 0.7) * 0.12;
    windZ += cos(uTime * 1.8 + aOffset.x * 0.6 + aPhase * 1.1) * 0.04;
    
    // Wind affects top more than base
    float windStrength = bendFactor * bendFactor;
    pos.x += windX * windStrength;
    pos.z += windZ * windStrength;
    
    // Cursor repulsion
    vec3 worldPos = aOffset + pos;
    vec2 cursorWorld = uCursor;
    float cursorDist = distance(worldPos.xz, cursorWorld);
    float cursorRadius = 2.0;
    
    if (cursorDist < cursorRadius && uCursorActive > 0.5) {
      float falloff = 1.0 - (cursorDist / cursorRadius);
      falloff = falloff * falloff;
      vec2 pushDir = normalize(worldPos.xz - cursorWorld);
      float pushStrength = falloff * 0.4 * windStrength;
      pos.x += pushDir.x * pushStrength;
      pos.z += pushDir.y * pushStrength;
    }
    
    vec4 mvPosition = modelViewMatrix * vec4(aOffset + pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    vColor = aColor;
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    vHeight = bendFactor;
    
    // Edge glow calculation
    float fresnel = 1.0 - abs(dot(vViewDir, vNormal));
    vEdgeGlow = smoothstep(0.5, 0.9, fresnel);
  }
`;

const FRAGMENT_SHADER = `
  uniform float uTime;
  
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vHeight;
  varying float vEdgeGlow;
  
  void main() {
    // Base flat color (Moebius style)
    vec3 baseColor = vColor;
    
    // Slight height-based gradient for depth
    baseColor = mix(baseColor * 0.7, baseColor, vHeight);
    
    // Bioluminescent edge glow toward Alien Amethyst (#7B68EE)
    vec3 glowColor = vec3(0.482, 0.408, 0.933);
    vec3 finalColor = mix(baseColor, glowColor, vEdgeGlow * 0.6);
    
    // Subtle pulse glow on edges
    float pulse = sin(uTime * 1.5) * 0.1 + 0.9;
    finalColor += glowColor * vEdgeGlow * 0.15 * pulse;
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const MONOLITH_VERTEX = `
  uniform float uTime;
  attribute float aRotSpeed;
  attribute float aBobPhase;
  attribute float aBobAmp;
  
  varying vec3 vPosition;
  
  void main() {
    vec3 pos = position;
    
    // Slow rotation around Y
    float angle = uTime * aRotSpeed;
    float cosA = cos(angle);
    float sinA = sin(angle);
    float x = pos.x * cosA - pos.z * sinA;
    float z = pos.x * sinA + pos.z * cosA;
    pos.x = x;
    pos.z = z;
    
    // Gentle vertical bobbing
    pos.y += sin(uTime * aBobPhase) * aBobAmp;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vPosition = pos;
  }
`;

const MONOLITH_FRAGMENT = `
  uniform vec3 uColor;
  
  varying vec3 vPosition;
  
  void main() {
    // Ghostly appearance with wireframe-like edge detection
    float edge = abs(normalize(cross(dFdx(vPosition), dFdy(vPosition))).z);
    edge = smoothstep(0.0, 0.3, edge);
    
    vec3 color = uColor * (0.6 + edge * 0.4);
    float alpha = 0.12 + edge * 0.08;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

export class AlienEcosystem {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private rafId: number = 0;
  private disposed = false;
  
  // Vegetation
  private vegetationMesh!: THREE.InstancedMesh;
  private vegetationMaterial!: THREE.ShaderMaterial;
  private vegetationGeometry!: THREE.BufferGeometry;
  
  // Monoliths
  private monolithGroup: THREE.Group;
  
  // Uniforms
  private uniforms: {
    uTime: { value: number };
    uCursor: { value: THREE.Vector2 };
    uCursorActive: { value: number };
  };
  
  private monolithUniforms: {
    uTime: { value: number };
    uColor: { value: THREE.Color };
  };
  
  // Cursor tracking
  private cursorNDC: THREE.Vector2 = new THREE.Vector2(999, 999);
  private cursorWorld: THREE.Vector2 = new THREE.Vector2(999, 999);
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  
  private canvas: HTMLCanvasElement;
  private container: HTMLElement;
  
  // Render culling
  public shouldRender: boolean = true;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas;
    this.container = container;
    this.clock = new THREE.Clock();
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setClearColor(0x0D0A09, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0D0A09, 0.08);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 3, 8);
    this.camera.lookAt(0, 0.5, 0);
    
    // Uniforms
    this.uniforms = {
      uTime: { value: 0 },
      uCursor: { value: new THREE.Vector2(999, 999) },
      uCursorActive: { value: 0 },
    };
    
    this.monolithUniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xD4A373) },
    };
    
    this.monolithGroup = new THREE.Group();
    this.scene.add(this.monolithGroup);
    
    // Build scene
    this.buildVegetation();
    this.buildGround();
    this.buildMonoliths();
    
    // Handle resize
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    
    // Handle mouse
    this.handleMouseMove = this.handleMouseMove.bind(this);
    container.addEventListener('mousemove', this.handleMouseMove);
    container.addEventListener('mouseleave', () => {
      this.uniforms.uCursorActive.value = 0;
    });
    container.addEventListener('mouseenter', () => {
      this.uniforms.uCursorActive.value = 1;
    });
    
    this.handleResize();
    this.clock.start();
  }
  
  private buildVegetation() {
    // Create a single plant geometry (stem + leaves)
    const plantGeo = new THREE.BufferGeometry();
    
    const stemSegments = 8;
    const leafPairs = 5;
    const vertices: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    
    // Build stem (triangle prism)
    for (let i = 0; i <= stemSegments; i++) {
      const t = i / stemSegments;
      const y = t;
      const radius = 0.03 * (1 - t * 0.5);
      
      for (let j = 0; j < 3; j++) {
        const angle = (j / 3) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        vertices.push(x, y, z);
        
        const nx = Math.cos(angle);
        const nz = Math.sin(angle);
        normals.push(nx, 0, nz);
      }
    }
    
    // Stem indices
    for (let i = 0; i < stemSegments; i++) {
      for (let j = 0; j < 3; j++) {
        const base = i * 3 + j;
        const next = i * 3 + ((j + 1) % 3);
        const above = (i + 1) * 3 + j;
        const aboveNext = (i + 1) * 3 + ((j + 1) % 3);
        
        indices.push(base, next, above);
        indices.push(next, aboveNext, above);
      }
    }
    
    // Build leaves (simple diamond shapes)
    for (let pair = 0; pair < leafPairs; pair++) {
      const leafY = 0.2 + (pair / leafPairs) * 0.7;
      const leafSize = 0.08 + (pair / leafPairs) * 0.12;
      const leafAngle = pair * 1.3;
      
      for (let side = 0; side < 2; side++) {
        const sideMult = side === 0 ? 1 : -1;
        const cosA = Math.cos(leafAngle) * sideMult;
        const sinA = Math.sin(leafAngle);
        
        // Leaf as 4 vertices (diamond)
        const baseIdx = vertices.length / 3;
        
        // Center attachment
        vertices.push(0, leafY, 0);
        normals.push(cosA, 0.3, sinA);
        
        // Tip
        vertices.push(cosA * leafSize * 2, leafY + leafSize * 0.5, sinA * leafSize * 2);
        normals.push(cosA, 0.3, sinA);
        
        // Left wing
        vertices.push(
          cosA * leafSize * 0.8 - sinA * leafSize * 0.5,
          leafY + leafSize * 0.2,
          sinA * leafSize * 0.8 + cosA * leafSize * 0.5
        );
        normals.push(cosA, 0.3, sinA);
        
        // Right wing
        vertices.push(
          cosA * leafSize * 0.8 + sinA * leafSize * 0.5,
          leafY + leafSize * 0.2,
          sinA * leafSize * 0.8 - cosA * leafSize * 0.5
        );
        normals.push(cosA, 0.3, sinA);
        
        // Two triangles for leaf
        indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        indices.push(baseIdx, baseIdx + 1, baseIdx + 3);
      }
    }
    
    plantGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    plantGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    plantGeo.setIndex(indices);
    plantGeo.computeVertexNormals();
    
    this.vegetationGeometry = plantGeo;
    
    // Create instanced mesh
    const instanceCount = 400;
    
    this.vegetationMaterial = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: this.uniforms,
      side: THREE.DoubleSide,
      transparent: false,
    });
    
    this.vegetationMesh = new THREE.InstancedMesh(
      plantGeo,
      this.vegetationMaterial,
      instanceCount
    );
    
    // Generate instance attributes
    const offsets: number[] = [];
    const scales: number[] = [];
    const colors: number[] = [];
    const phases: number[] = [];
    const heights: number[] = [];
    
    const colorPalette = [
      new THREE.Color(0x2A9D8F),
      new THREE.Color(0x4ECDC4),
      new THREE.Color(0xCCD5AE),
      new THREE.Color(0xE9EDC9),
    ];
    
    for (let i = 0; i < instanceCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1 + Math.random() * 12;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      offsets.push(x, 0, z);
      scales.push(0.6 + Math.random() * 0.8);
      
      const colorIdx = Math.floor(Math.random() * colorPalette.length);
      const baseColor = colorPalette[colorIdx];
      const variation = new THREE.Color().copy(baseColor);
      variation.offsetHSL(0, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1);
      colors.push(variation.r, variation.g, variation.b);
      
      phases.push(Math.random() * Math.PI * 2);
      heights.push(0.8 + Math.random() * 1.5);
    }
    
    this.vegetationGeometry.setAttribute(
      'aOffset',
      new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3)
    );
    this.vegetationGeometry.setAttribute(
      'aScale',
      new THREE.InstancedBufferAttribute(new Float32Array(scales), 1)
    );
    this.vegetationGeometry.setAttribute(
      'aColor',
      new THREE.InstancedBufferAttribute(new Float32Array(colors), 3)
    );
    this.vegetationGeometry.setAttribute(
      'aPhase',
      new THREE.InstancedBufferAttribute(new Float32Array(phases), 1)
    );
    this.vegetationGeometry.setAttribute(
      'aHeight',
      new THREE.InstancedBufferAttribute(new Float32Array(heights), 1)
    );
    
    this.scene.add(this.vegetationMesh);
  }
  
  private buildGround() {
    const groundGeo = new THREE.PlaneGeometry(40, 40, 1, 1);
    const groundMat = new THREE.MeshBasicMaterial({
      color: 0x0D0A09,
      transparent: true,
      opacity: 1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    this.scene.add(ground);
  }
  
  private buildMonoliths() {
    const monolithGeos = [
      new THREE.TetrahedronGeometry(0.8, 0),
      new THREE.OctahedronGeometry(0.7, 0),
      new THREE.BoxGeometry(0.6, 1.2, 0.6),
      new THREE.TetrahedronGeometry(1.0, 0),
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.BoxGeometry(0.8, 0.4, 0.8),
      new THREE.TetrahedronGeometry(0.6, 0),
    ];
    
    const positions = [
      { x: -5, z: -8, y: 4 },
      { x: 7, z: -6, y: 5 },
      { x: -3, z: -10, y: 3.5 },
      { x: 4, z: -12, y: 6 },
      { x: -8, z: -5, y: 4.5 },
      { x: 9, z: -9, y: 3 },
      { x: 0, z: -15, y: 5.5 },
    ];
    
    const monolithMaterial = new THREE.ShaderMaterial({
      vertexShader: MONOLITH_VERTEX,
      fragmentShader: MONOLITH_FRAGMENT,
      uniforms: this.monolithUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    
    for (let i = 0; i < Math.min(monolithGeos.length, positions.length); i++) {
      const mesh = new THREE.Mesh(monolithGeos[i], monolithMaterial.clone());
      mesh.position.set(positions[i].x, positions[i].y, positions[i].z);
      
      // Add custom attributes for rotation and bobbing
      const geo = monolithGeos[i].clone();
      const rotSpeeds = new Float32Array(geo.attributes.position.count);
      const bobPhases = new Float32Array(geo.attributes.position.count);
      const bobAmps = new Float32Array(geo.attributes.position.count);
      
      for (let j = 0; j < rotSpeeds.length; j++) {
        rotSpeeds[j] = (0.05 + Math.random() * 0.1) * (Math.random() > 0.5 ? 1 : -1);
        bobPhases[j] = 0.3 + Math.random() * 0.5;
        bobAmps[j] = 0.1 + Math.random() * 0.15;
      }
      
      geo.setAttribute('aRotSpeed', new THREE.BufferAttribute(rotSpeeds, 1));
      geo.setAttribute('aBobPhase', new THREE.BufferAttribute(bobPhases, 1));
      geo.setAttribute('aBobAmp', new THREE.BufferAttribute(bobAmps, 1));
      
      mesh.geometry = geo;
      (mesh.material as THREE.ShaderMaterial).uniforms.uTime = this.monolithUniforms.uTime;
      (mesh.material as THREE.ShaderMaterial).uniforms.uColor = { value: new THREE.Color(0xD4A373) };
      
      this.monolithGroup.add(mesh);
      
      // Wireframe overlay
      const wireGeo = new THREE.WireframeGeometry(monolithGeos[i]);
      const wireMat = new THREE.LineBasicMaterial({
        color: 0xFAEDCD,
        transparent: true,
        opacity: 0.06,
      });
      const wireframe = new THREE.LineSegments(wireGeo, wireMat);
      wireframe.position.copy(mesh.position);
      this.monolithGroup.add(wireframe);
    }
  }
  
  private handleMouseMove(event: MouseEvent) {
    const rect = this.container.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.cursorNDC.set(x, y);
    this.uniforms.uCursorActive.value = 1;
    
    // Project cursor to world space on ground plane
    this.raycaster.setFromCamera(this.cursorNDC, this.camera);
    const intersectPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.groundPlane, intersectPoint);
    
    if (intersectPoint) {
      this.cursorWorld.set(intersectPoint.x, intersectPoint.z);
      this.uniforms.uCursor.value.copy(this.cursorWorld);
    }
  }
  
  private handleResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  public start() {
    this.animate();
  }
  
  private animate = () => {
    if (this.disposed) return;
    
    this.rafId = requestAnimationFrame(this.animate);
    
    if (!this.shouldRender) return;
    
    const elapsed = this.clock.getElapsedTime();
    this.uniforms.uTime.value = elapsed;
    this.monolithUniforms.uTime.value = elapsed;
    
    this.renderer.render(this.scene, this.camera);
  };
  
  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
  
  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    
    window.removeEventListener('resize', this.handleResize);
    this.container.removeEventListener('mousemove', this.handleMouseMove);
    
    this.vegetationGeometry.dispose();
    this.vegetationMaterial.dispose();
    this.renderer.dispose();
  }
}
