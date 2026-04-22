import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { TerrainGenerator } from './TerrainGenerator';
import { ProceduralRocks } from './ProceduralRocks';
import { DesertParticles } from './DesertParticles';
import { SkyDome } from './SkyDome';
import { HoverBike } from './HoverBike';
import { WorldLandmarks, type LandmarkSemanticPoint } from './WorldLandmarks';
import { InkDetailField } from './InkDetailField';
import { GraphicNovelLayers } from './GraphicNovelLayers';

export interface SceneSemanticItem extends LandmarkSemanticPoint {
  source: 'landmark' | 'bike';
}

// Sable-style outline post-processing
const OutlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    resolution: { value: new THREE.Vector2() },
    outlineColor: { value: new THREE.Color(0.14, 0.09, 0.05) },
    outlineThickness: { value: 1.85 },
    outlineIntensity: { value: 0.82 },
    paperStrength: { value: 0.34 },
    hatchStrength: { value: 0.18 },
    progress: { value: 0 },
    time: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform vec3 outlineColor;
    uniform float outlineThickness;
    uniform float outlineIntensity;
    uniform float paperStrength;
    uniform float hatchStrength;
    uniform float progress;
    uniform float time;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    
    float sampleDepth(vec2 uv) {
      return texture2D(tDepth, uv).r;
    }
    
    vec3 sampleColor(vec2 uv) {
      return texture2D(tDiffuse, uv).rgb;
    }
    
    void main() {
      vec2 texel = outlineThickness / resolution;
      
      // Sobel on depth
      float dL = sampleDepth(vUv - vec2(texel.x, 0.0));
      float dR = sampleDepth(vUv + vec2(texel.x, 0.0));
      float dU = sampleDepth(vUv + vec2(0.0, texel.y));
      float dD = sampleDepth(vUv - vec2(0.0, texel.y));
      float depthEdge = abs(dL - dR) + abs(dU - dD);
      
      // Color edge detection for internal details
      vec3 c = sampleColor(vUv);
      vec3 cL = sampleColor(vUv - vec2(texel.x, 0.0));
      vec3 cR = sampleColor(vUv + vec2(texel.x, 0.0));
      vec3 cU = sampleColor(vUv + vec2(0.0, texel.y));
      vec3 cD = sampleColor(vUv - vec2(0.0, texel.y));
      float colorEdge = length(cL - cR) + length(cU - cD);
      
      // Combine edges
      float edge = clamp(depthEdge * 50.0 + colorEdge * 0.8, 0.0, 1.0);
      
      // Hard threshold for Sable's bold line look
      edge = smoothstep(0.05, 0.2, edge);
      
      vec3 poster = floor(c * 7.0 + 0.5) / 7.0;
      c = mix(c, poster, 0.18);

      float grain = hash(vUv * resolution * 0.54 + floor(time * 7.0)) - 0.5;
      float paperFibers =
        sin((vUv.y + progress * 0.13) * resolution.y * 0.38) * 0.5 + 0.5;
      float hatchA = 1.0 - smoothstep(0.035, 0.11, abs(fract((vUv.x + vUv.y * 0.32) * 58.0 + progress * 8.0) - 0.5));
      float hatchB = 1.0 - smoothstep(0.02, 0.08, abs(fract((vUv.x * 0.42 - vUv.y) * 42.0 - progress * 5.0) - 0.5));
      float shade = smoothstep(0.0, 0.72, 1.0 - dot(c, vec3(0.299, 0.587, 0.114)));
      vec3 inked = mix(c, outlineColor, (hatchA * 0.06 + hatchB * 0.045) * hatchStrength * shade);
      inked += grain * paperStrength * 0.075;
      inked = mix(inked, inked * (0.96 + paperFibers * 0.045), paperStrength);

      float vignette = smoothstep(0.9, 0.18, distance(vUv, vec2(0.5)));
      inked = mix(inked * 0.86, inked, vignette);

      vec3 finalColor = mix(inked, outlineColor, edge * outlineIntensity);
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

// Sable time-of-day palettes
const Palettes = {
  dawn: {
    skyTop: new THREE.Color(0xb7e8e0),
    skyHorizon: new THREE.Color(0xffdfbe),
    fog: new THREE.Color(0xf4d8c1),
    sun: new THREE.Color(0xffd4a0),
    ambient: 0.55,
    terrain: new THREE.Color(0xe4b77b),
    rock: new THREE.Color(0xc88e87),
    accent: new THREE.Color(0xea704a),
    outlineIntensity: 0.74,
  },
  day: {
    skyTop: new THREE.Color(0xb4f0e8),
    skyHorizon: new THREE.Color(0xffe8c7),
    fog: new THREE.Color(0xf7e5cf),
    sun: new THREE.Color(0xfff2d0),
    ambient: 0.86,
    terrain: new THREE.Color(0xf2c47d),
    rock: new THREE.Color(0xd7929a),
    accent: new THREE.Color(0x45cfc7),
    outlineIntensity: 0.88,
  },
  golden: {
    skyTop: new THREE.Color(0xaed8de),
    skyHorizon: new THREE.Color(0xffc486),
    fog: new THREE.Color(0xf0c5a2),
    sun: new THREE.Color(0xffb860),
    ambient: 0.66,
    terrain: new THREE.Color(0xea9f58),
    rock: new THREE.Color(0xbc788a),
    accent: new THREE.Color(0xe45736),
    outlineIntensity: 0.82,
  },
  sunset: {
    skyTop: new THREE.Color(0xc293be),
    skyHorizon: new THREE.Color(0xff9a70),
    fog: new THREE.Color(0xe2a7a9),
    sun: new THREE.Color(0xff7840),
    ambient: 0.42,
    terrain: new THREE.Color(0xd67857),
    rock: new THREE.Color(0x9d607a),
    accent: new THREE.Color(0xf5bc5f),
    outlineIntensity: 0.76,
  },
  dusk: {
    skyTop: new THREE.Color(0x4c5688),
    skyHorizon: new THREE.Color(0xb56a89),
    fog: new THREE.Color(0x8e7690),
    sun: new THREE.Color(0xc05040),
    ambient: 0.26,
    terrain: new THREE.Color(0x9b6684),
    rock: new THREE.Color(0x73536f),
    accent: new THREE.Color(0x5ee4d5),
    outlineIntensity: 0.64,
  },
  night: {
    skyTop: new THREE.Color(0x213e72),
    skyHorizon: new THREE.Color(0x4f497a),
    fog: new THREE.Color(0x2c3b66),
    sun: new THREE.Color(0x8aa0d8),
    ambient: 0.12,
    terrain: new THREE.Color(0x544067),
    rock: new THREE.Color(0x40556c),
    accent: new THREE.Color(0x5df1dd),
    outlineIntensity: 0.62,
  },
};

const SemanticSceneOrder = [
  'archive-wall',
  'bone-dunes',
  'cliff-city',
  'wreck-site',
  'launch-yard',
  'oasis-habitat',
  'impact-basin',
  'open-archive',
  'signal-corridor',
  'hangar-camp',
  'needle-field',
  'statue-garden',
  'relay-beacon',
  'return-gate',
];

const ContentSemanticSceneOrder = [
  'archive-wall',
  'bone-dunes',
  'launch-yard',
  'oasis-habitat',
  'impact-basin',
  'open-archive',
  'signal-corridor',
];

export class SableScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private rafId: number = 0;
  private disposed = false;
  private lastFrameTime = 0;
  private elapsedTime = 0;

  private terrain!: TerrainGenerator;
  private rocks!: ProceduralRocks;
  private landmarks!: WorldLandmarks;
  private graphicLayers!: GraphicNovelLayers;
  private inkDetails!: InkDetailField;
  private particles!: DesertParticles;
  private sky!: SkyDome;
  private bike!: HoverBike;

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  private timeOfDay = 0.25;
  private targetTimeOfDay = 0.25;
  private journeyProgress = 0;
  private pointer = new THREE.Vector2(0.5, 0.5);
  private smoothedPointer = new THREE.Vector2(0.5, 0.5);
  private onSemanticUpdate?: (items: SceneSemanticItem[]) => void;
  private semanticTimer = 0;
  private lastSemanticSignature = '';
  private activeSemanticSceneId = '';
  private semanticContentBlock = -1;

  private canvas: HTMLCanvasElement;
  private depthRenderTarget!: THREE.WebGLRenderTarget;
  private depthMaterial!: THREE.MeshDepthMaterial;
  private outlinePass!: ShaderPass;

  constructor(canvas: HTMLCanvasElement, onSemanticUpdate?: (items: SceneSemanticItem[]) => void) {
    this.canvas = canvas;
    this.onSemanticUpdate = onSemanticUpdate;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x7EC8C8, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xE0C8A0, 0.006);

    this.camera = new THREE.PerspectiveCamera(
      58,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      900
    );
    this.camera.position.set(0, 3.8, 16);
    this.camera.lookAt(0, 1.8, 0);

    // Depth render target for outline effect
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    this.depthRenderTarget = new THREE.WebGLRenderTarget(
      size.x, size.y,
      { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat }
    );
    this.depthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
    });

    this.initLighting();
    this.initSky();
    this.initTerrain();
    this.initRocks();
    this.initGraphicLayers();
    this.initLandmarks();
    this.initInkDetails();
    this.initParticles();
    this.initBike();
    this.initPostProcessing();

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  private initLighting() {
    const palette = Palettes.day;

    this.hemiLight = new THREE.HemisphereLight(
      palette.skyTop,
      palette.terrain,
      palette.ambient
    );
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(palette.sun, 1.8);
    this.sunLight.position.set(20, 25, 15);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 120;
    this.sunLight.shadow.camera.left = -50;
    this.sunLight.shadow.camera.right = 50;
    this.sunLight.shadow.camera.top = 50;
    this.sunLight.shadow.camera.bottom = -50;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Cool fill from opposite
    const fillLight = new THREE.DirectionalLight(
      new THREE.Color(0x88A8C8),
      0.25
    );
    fillLight.position.set(-15, 10, -10);
    this.scene.add(fillLight);
  }

  private initSky() {
    this.sky = new SkyDome(this.scene);
  }

  private initTerrain() {
    this.terrain = new TerrainGenerator(this.scene);
  }

  private initRocks() {
    this.rocks = new ProceduralRocks(this.scene);
  }

  private initGraphicLayers() {
    this.graphicLayers = new GraphicNovelLayers(this.scene);
  }

  private initLandmarks() {
    this.landmarks = new WorldLandmarks(this.scene);
  }

  private initInkDetails() {
    this.inkDetails = new InkDetailField(this.scene);
  }

  private initParticles() {
    this.particles = new DesertParticles(this.scene);
  }

  private initBike() {
    this.bike = new HoverBike(this.scene);
    this.bike.setPosition(0.08, 2.28, 2.78);
  }

  private initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.25));

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.outlinePass = new ShaderPass(OutlineShader);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.outlinePass.uniforms.resolution.value.set(size.x, size.y);
    this.composer.addPass(this.outlinePass);

    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
    this.composer.addPass(fxaaPass);

    this.composer.addPass(new OutputPass());
  }

  setJourneyProgress(progress: number) {
    this.journeyProgress = progress;
    this.targetTimeOfDay = 0.12 + progress * 0.82;
  }

  setSemanticBlock(block: number) {
    this.semanticContentBlock = block;
  }

  setPointer(x: number, y: number) {
    this.pointer.set(
      THREE.MathUtils.clamp(x, 0, 1),
      THREE.MathUtils.clamp(y, 0, 1)
    );
  }

  private syncJourneyFromScroll() {
    if (typeof window === 'undefined') return;
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = THREE.MathUtils.clamp(window.scrollY / scrollable, 0, 1);
    this.journeyProgress = progress;
    this.targetTimeOfDay = 0.12 + progress * 0.82;
  }

  private collectSemanticItems() {
    const viewport = new THREE.Vector2(
      Math.max(this.canvas.clientWidth, 1),
      Math.max(this.canvas.clientHeight, 1)
    );
    const landmarkItems: SceneSemanticItem[] = this.landmarks
      .getSemanticPoints(this.camera, viewport)
      .map((item) => ({ ...item, source: 'landmark' as const }));
    const bikeItems: SceneSemanticItem[] = [];

    this.bike.getSemanticPoints().forEach((point) => {
      const projected = point.world.clone().project(this.camera);
      if (projected.z < -1 || projected.z > 1) return;
      if (Math.abs(projected.x) > 1.12 || Math.abs(projected.y) > 1.08) return;

      bikeItems.push({
        id: point.id,
        sceneId: 'hoverbike',
        title: point.title,
        category: point.category,
        description: point.description,
        tags: point.tags,
        x: (projected.x * 0.5 + 0.5) * viewport.x,
        y: (-projected.y * 0.5 + 0.5) * viewport.y,
        depth: projected.z,
        side: projected.x < 0.08 ? 'left' : 'right',
        source: 'bike',
      });
    });

    const visibleLandmarks = landmarkItems.filter((item) => item.depth < 0.999);
    const groups = new Map<string, SceneSemanticItem[]>();
    visibleLandmarks.forEach((item) => {
      const existing = groups.get(item.sceneId) ?? [];
      existing.push(item);
      groups.set(item.sceneId, existing);
    });

    const scoreGroup = (groupItems: SceneSemanticItem[]) => {
      const densityBonus = Math.min(groupItems.length, 6) * 0.055;
      const average = groupItems.reduce((sum, item) => {
        const cx = item.x / viewport.x;
        const cy = item.y / viewport.y;
        const center = 1 - Math.min(1, Math.abs(cx - 0.5) * 1.55);
        const vertical = 1 - Math.min(1, Math.abs(cy - 0.48) * 1.35);
        const forwardDepth = 1 - THREE.MathUtils.clamp((item.depth + 1) * 0.5, 0, 1);
        return sum + center * 0.58 + vertical * 0.24 + forwardDepth * 0.18;
      }, 0) / Math.max(1, groupItems.length);

      return average + densityBonus;
    };

    let candidateSceneId = '';
    let candidateScore = -Infinity;

    groups.forEach((groupItems, sceneId) => {
      const score = scoreGroup(groupItems);
      if (score > candidateScore) {
        candidateScore = score;
        candidateSceneId = sceneId;
      }
    });

    const order = this.semanticContentBlock >= 0 ? ContentSemanticSceneOrder : SemanticSceneOrder;
    const semanticT = THREE.MathUtils.clamp((this.journeyProgress - 0.1) / 0.76, 0, 0.999);
    const targetIndex = this.semanticContentBlock >= 0
      ? THREE.MathUtils.clamp(this.semanticContentBlock, 0, order.length - 1)
      : Math.floor(semanticT * order.length);
    const targetSceneId = order[targetIndex];
    const visibleTargetIndex = order.findIndex((sceneId) => sceneId === targetSceneId);
    let sceneForBlock = groups.has(targetSceneId) ? targetSceneId : '';

    if (!sceneForBlock && visibleTargetIndex >= 0) {
      for (let offset = 1; offset < order.length; offset += 1) {
        const before = order[visibleTargetIndex - offset];
        const after = order[visibleTargetIndex + offset];
        if (after && groups.has(after)) {
          sceneForBlock = after;
          break;
        }
        if (before && groups.has(before)) {
          sceneForBlock = before;
          break;
        }
      }
    }

    this.activeSemanticSceneId = sceneForBlock || candidateSceneId;

    if (!this.activeSemanticSceneId) {
      return bikeItems.slice(0, viewport.x < 760 ? 4 : 6);
    }

    const maxTotal = viewport.x < 760 ? 4 : 5;
    const maxLandmarks = viewport.x < 760 ? 3 : 5;
    const rankedFocus = (groups.get(this.activeSemanticSceneId) ?? [])
      .sort((a, b) => {
        const ax = Math.abs(a.x / viewport.x - 0.5);
        const ay = Math.abs(a.y / viewport.y - 0.5);
        const bx = Math.abs(b.x / viewport.x - 0.5);
        const by = Math.abs(b.y / viewport.y - 0.5);
        return (ax + ay * 0.65 + a.depth * 0.08) - (bx + by * 0.65 + b.depth * 0.08);
      });
    const focusItems: SceneSemanticItem[] = [];
    rankedFocus.forEach((item) => {
      if (focusItems.length >= maxLandmarks) return;
      const farEnough = focusItems.every((placed) => {
        const dx = placed.x - item.x;
        const dy = placed.y - item.y;
        return Math.hypot(dx, dy) > (viewport.x < 760 ? 68 : 96);
      });
      if (farEnough || focusItems.length < 2) focusItems.push(item);
    });
    if (focusItems.length < Math.min(maxLandmarks, rankedFocus.length)) {
      rankedFocus.forEach((item) => {
        if (focusItems.length >= maxLandmarks) return;
        if (!focusItems.some((existing) => existing.id === item.id)) focusItems.push(item);
      });
    }
    const vehicleFocus = bikeItems
      .sort((a, b) => Math.abs(a.x / viewport.x - 0.5) - Math.abs(b.x / viewport.x - 0.5))
      .slice(0, focusItems.length < 2 ? Math.max(0, maxTotal - focusItems.length) : 0);

    return [...focusItems, ...vehicleFocus].slice(0, maxTotal);
  }

  private updateSemanticOverlay(dt: number) {
    if (!this.onSemanticUpdate) return;

    this.semanticTimer += dt;
    if (this.semanticTimer < 0.033) return;
    this.semanticTimer = 0;

    if (this.journeyProgress < 0.1 || this.journeyProgress > 0.86) {
      if (this.lastSemanticSignature !== 'hidden') {
        this.onSemanticUpdate([]);
        this.lastSemanticSignature = 'hidden';
      }
      return;
    }

    const items = this.collectSemanticItems();
    const signature = items
      .map((item) => `${item.sceneId}:${item.id}:${Math.round(item.x * 2)}:${Math.round(item.y * 2)}:${item.source}`)
      .join('|');
    if (signature === this.lastSemanticSignature) return;
    this.lastSemanticSignature = signature;
    this.onSemanticUpdate(items);
  }

  private lerpPalette(a: typeof Palettes.day, b: typeof Palettes.day, t: number) {
    return {
      skyTop: a.skyTop.clone().lerp(b.skyTop, t),
      skyHorizon: a.skyHorizon.clone().lerp(b.skyHorizon, t),
      fog: a.fog.clone().lerp(b.fog, t),
      sun: a.sun.clone().lerp(b.sun, t),
      ambient: a.ambient + (b.ambient - a.ambient) * t,
      terrain: a.terrain.clone().lerp(b.terrain, t),
      rock: a.rock.clone().lerp(b.rock, t),
      accent: a.accent.clone().lerp(b.accent, t),
      outlineIntensity: a.outlineIntensity + (b.outlineIntensity - a.outlineIntensity) * t,
    };
  }

  private getPalette(t: number) {
    if (t < 0.15) {
      return this.lerpPalette(Palettes.dawn, Palettes.day, t / 0.15);
    } else if (t < 0.4) {
      return Palettes.day;
    } else if (t < 0.55) {
      return this.lerpPalette(Palettes.day, Palettes.golden, (t - 0.4) / 0.15);
    } else if (t < 0.65) {
      return this.lerpPalette(Palettes.golden, Palettes.sunset, (t - 0.55) / 0.1);
    } else if (t < 0.75) {
      return this.lerpPalette(Palettes.sunset, Palettes.dusk, (t - 0.65) / 0.1);
    } else if (t < 0.85) {
      return this.lerpPalette(Palettes.dusk, Palettes.night, (t - 0.75) / 0.1);
    } else {
      return Palettes.night;
    }
  }

  private updateTimeOfDay(dt: number) {
    this.timeOfDay += (this.targetTimeOfDay - this.timeOfDay) * Math.min(dt * 1.5, 1);
    const palette = this.getPalette(this.timeOfDay);

    // Apply to scene
    this.renderer.setClearColor(palette.skyTop, 1);
    (this.scene.fog as THREE.FogExp2).color.copy(palette.fog);
    const fogDensity = 0.00315 + Math.sin(this.journeyProgress * Math.PI) * 0.0021 + this.timeOfDay * 0.00155;
    (this.scene.fog as THREE.FogExp2).density = fogDensity;

    this.hemiLight.color.copy(palette.skyTop);
    this.hemiLight.groundColor.copy(palette.terrain);
    this.hemiLight.intensity = palette.ambient;

    this.sunLight.color.copy(palette.sun);
    this.sunLight.intensity = 1.2 + (1 - this.timeOfDay) * 1.0;

    // Sun arc
    const sunAngle = (this.timeOfDay - 0.15) * Math.PI;
    this.sunLight.position.set(
      Math.cos(sunAngle) * 35,
      Math.max(Math.sin(sunAngle) * 30 + 5, 2),
      15
    );

    // Outline intensity
    this.outlinePass.uniforms.outlineIntensity.value = palette.outlineIntensity;

    // Update subsystems
    this.sky.setColors(palette.skyTop, palette.skyHorizon);
    this.sky.setJourneyProgress(this.journeyProgress);
    this.terrain.setColor(palette.terrain);
    this.terrain.setSkyColor(palette.skyTop);
    this.terrain.setAccentColor(palette.accent);
    this.rocks.setColor(palette.rock);
    this.rocks.setSkyColor(palette.skyTop);
    this.landmarks.setPalette(palette.rock, palette.skyTop, palette.accent);
    this.graphicLayers.setPalette({
      terrain: palette.terrain,
      rock: palette.rock,
      sky: palette.skyTop,
      accent: palette.accent,
    });
    this.inkDetails.setInkColor(new THREE.Color(0x24170f).lerp(palette.rock, this.timeOfDay * 0.18));
    this.particles.setColor(palette.fog);
  }

  start() {
    this.lastFrameTime = performance.now();
    this.elapsedTime = 0;
    this.animate();
  }

  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;
    this.elapsedTime += dt;
    const elapsed = this.elapsedTime;

    this.syncJourneyFromScroll();
    this.updateTimeOfDay(dt);

    const worldOffset = this.journeyProgress * 640;

    // Move and resample the world, not just the camera. This keeps the page feeling
    // like one continuous traversal through changing biomes.
    this.terrain.update(worldOffset, dt, this.journeyProgress);
    this.rocks.update(worldOffset, dt, this.journeyProgress);
    this.graphicLayers.update(worldOffset, dt, this.journeyProgress);
    this.landmarks.update(worldOffset, dt, this.journeyProgress);
    this.inkDetails.update(worldOffset, dt, this.journeyProgress);

    // Animate bike
    this.bike.update(elapsed, dt, this.journeyProgress);

    // Animate particles
    this.particles.update(dt, this.journeyProgress);

    // Sky
    this.sky.update(elapsed);

    // Camera: broad Sable-like travel arc with a little pointer parallax.
    this.smoothedPointer.lerp(this.pointer, Math.min(dt * 3.5, 1));
    const px = (this.smoothedPointer.x - 0.5) * 2;
    const py = (this.smoothedPointer.y - 0.5) * 2;
    const camTime = elapsed * 0.4;
    const progressWave = Math.sin(this.journeyProgress * Math.PI);
    this.camera.position.y =
      3.95 +
      progressWave * 1.55 +
      Math.sin(camTime) * 0.1 +
      Math.sin(camTime * 1.7) * 0.04 -
      py * 0.28;
    this.camera.position.x =
      Math.sin(this.journeyProgress * Math.PI * 3.4) * 1.82 +
      Math.sin(camTime * 0.6) * 0.22 +
      px * 0.45;
    this.camera.position.z = 17.4 - progressWave * 3.1;
    this.camera.fov = 52.5 + progressWave * 3.4;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(
      Math.sin(this.journeyProgress * Math.PI * 2.2) * 0.96 + px * 0.28,
      1.95 + progressWave * 0.7 - py * 0.18,
      -9.2 - progressWave * 4.2
    );
    this.updateSemanticOverlay(dt);

    // Render depth for outline
    this.graphicLayers.setDepthPassVisible(false);
    this.scene.overrideMaterial = this.depthMaterial;
    this.renderer.setRenderTarget(this.depthRenderTarget);
    this.renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    this.renderer.setRenderTarget(null);
    this.graphicLayers.setDepthPassVisible(true);

    // Pass depth to outline shader
    this.outlinePass.uniforms.tDepth.value = this.depthRenderTarget.texture;
    this.outlinePass.uniforms.time.value = elapsed;
    this.outlinePass.uniforms.progress.value = this.journeyProgress;
    this.outlinePass.uniforms.paperStrength.value = 0.22 + Math.sin(this.journeyProgress * Math.PI) * 0.18;
    this.outlinePass.uniforms.hatchStrength.value = 0.16 + Math.sin(this.journeyProgress * Math.PI * 1.25) * 0.08;

    // Main render
    this.composer.render();
  };

  private handleResize = () => {
    const bounds = this.canvas.parentElement?.getBoundingClientRect();
    const w = Math.round(bounds?.width || window.innerWidth || this.canvas.clientWidth);
    const h = Math.round(bounds?.height || window.innerHeight || this.canvas.clientHeight);
    if (w === 0 || h === 0) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.25);
    this.renderer.setPixelRatio(pixelRatio);
    this.composer.setPixelRatio(pixelRatio);

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);

    const bufferSize = this.renderer.getDrawingBufferSize(new THREE.Vector2());

    // Resize depth target
    this.depthRenderTarget.setSize(bufferSize.x, bufferSize.y);

    this.outlinePass.uniforms.resolution.value.set(bufferSize.x, bufferSize.y);
    const fxaaPass = this.composer.passes[2] as ShaderPass;
    if (fxaaPass) {
      fxaaPass.uniforms.resolution.value.set(1 / bufferSize.x, 1 / bufferSize.y);
    }
  };

  resize() {
    this.handleResize();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);

    this.terrain.dispose();
    this.rocks.dispose();
    this.graphicLayers.dispose();
    this.landmarks.dispose();
    this.inkDetails.dispose();
    this.particles.dispose();
    this.sky.dispose();
    this.bike.dispose();

    this.depthRenderTarget.dispose();
    this.depthMaterial.dispose();
    this.renderer.dispose();
    this.composer.dispose();
  }
}
