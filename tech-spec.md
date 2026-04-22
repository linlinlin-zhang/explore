# VISIONE — Technical Specification

## Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.1.0 | UI framework |
| react-dom | ^19.1.0 | DOM renderer |
| react-router-dom | ^7.6.0 | SPA routing (homepage → workspace transition) |
| three | ^0.175.0 | WebGL procedural hero vegetation + dissolve transition |
| gsap | ^3.13.0 | Core animation engine (ScrollTrigger, timelines) |
| lenis | ^1.3.0 | Smooth scroll |
| imagesloaded | ^5.0.0 | Image preload utility |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| vite | ^6.3.0 | Build tool |
| @vitejs/plugin-react | ^4.5.0 | React Fast Refresh for Vite |
| typescript | ^5.8.0 | Type safety |
| @types/react | ^19.1.0 | React type definitions |
| @types/react-dom | ^19.1.0 | ReactDOM type definitions |
| @types/three | ^0.175.0 | Three.js type definitions |
| tailwindcss | ^4.1.0 | Utility-first CSS |
| @tailwindcss/vite | ^4.1.0 | Tailwind Vite integration |

### External Resources (CDN / HTML)

- Google Fonts: Cormorant Garamond, Quattrocento Sans, JetBrains Mono (loaded via `<link>` in `index.html`)

---

## Component Inventory

### Layout (shared across routes)

| Component | Source | Reuse |
|-----------|--------|-------|
| NavigationBar | Custom | Homepage only (workspace will have its own nav) |
| Footer | Custom | Homepage only |

### Sections (page-specific, Homepage)

| Component | Source | Notes |
|-----------|--------|-------|
| HeroSection | Custom | Owns AlienEcosystem canvas, overlaid with HeroContent |
| CapabilitiesSection | Custom | Owns horizontal scroll gallery |
| HowItWorksSection | Custom | Vertical timeline with 4 steps |
| EcosystemSection | Custom | Tool grid + gradient background |
| FinalCTASection | Custom | Transparent background, hero canvas visible behind |

### Reusable Components

| Component | Source | Used by |
|-----------|--------|---------|
| AlienEcosystem | Custom (Three.js) | HeroSection (primary), FinalCTASection (peeks through) |
| DissolveTransition | Custom (WebGL) | Global, triggered on CTA click |
| CustomCursor | Custom | Global (disabled on touch) |
| SectionHeader | Custom | Capabilities, HowItWorks, Ecosystem sections |
| CapabilityCard | Custom | CapabilitiesSection × 6 |
| ToolBadge | Custom | EcosystemSection × 12 |
| SmoothScrollProvider | Custom (wraps Lenis) | App-level, coordinates with GSAP ScrollTrigger |

### Hooks

| Hook | Purpose |
|------|---------|
| useLenis | Access Lenis instance for scroll control / GSAP sync |

---

## Animation Implementation

| Animation | Library | Implementation Approach | Complexity |
|-----------|---------|------------------------|------------|
| Alien vegetation (hero background) | Three.js raw | InstancedMesh + custom GLSL vertex/fragment shaders. Wind + cursor repulsion in vertex shader. Moebius flat color + bioluminescent rim in fragment shader. | 🔒 High |
| Floating monoliths | Three.js raw | Simple geometry (tetrahedron/octahedron/box) with slow rotation + bobbing via sin(time) in render loop. Wireframe overlay. | Low |
| Cursor repels vegetation | Three.js raw | Cursor world-space position passed as uniform to vegetation shader each frame. Radial falloff displacement in vertex shader. | Medium |
| Hero content entrance | GSAP | Timeline: label → title → subtitle → description → CTA staggered with translateY + opacity. Fires once on mount. | Low |
| Scroll indicator pulse | CSS @keyframes | translateY + opacity oscillation, 2s infinite. Fade-out on scroll via class toggle. | Low |
| Section header word stagger | GSAP + ScrollTrigger | Split title into words, stagger translateY + opacity. ScrollTrigger start "top 80%". | Low |
| **Horizontal scroll gallery** | GSAP ScrollTrigger | Pin section, scrub inner container translateX from 0 to -(totalWidth - viewportWidth). | 🔒 High |
| Card hover effects | CSS transitions | Border, background, box-shadow transitions 400ms. Pure CSS, no JS animation needed. | Low |
| Timeline step entrance | GSAP + ScrollTrigger | Per-step timeline: node pulse → number fade → content fade → visual fade. ScrollTrigger per step. | Medium |
| Step visual elements | CSS / Canvas 2D | Wireframe eye (CSS borders), connecting nodes (CSS), gear-flower (CSS rotate), particles (Canvas 2D). Each self-contained. | Medium |
| Tool badge grid stagger | GSAP + ScrollTrigger | Stagger translateY + opacity, 0.06s per item. ScrollTrigger start "top 75%". | Low |
| **Page dissolve transition** | Three.js raw | Fullscreen quad with fragment shader. Perlin-noise driven dissolve threshold animates 0→1 over 1800ms. Millions of square particles via noise. | 🔒 High |
| Custom cursor | GSAP | Mouse position → GSAP quickTo for dot following. Scale + ring toggle on interactive hover. | Low |
| Nav show/hide on scroll | GSAP | translateY(-100% / 0%) toggled via Lenis scroll direction detection. 300ms. | Low |
| Nav background blur | CSS transition | Background + backdrop-filter transition 400ms on scroll-past-hero. ScrollTrigger class toggle. | Low |

---

## State & Logic Plan

### 1. Two-Canvas WebGL Architecture

The homepage maintains **two independent WebGL contexts**: one for the persistent procedural hero (AlienEcosystem) and one for the full-screen dissolve transition overlay (DissolveTransition). This separation is architecturally required because:

- **AlienEcosystem** is `position: fixed`, lives for the entire homepage session, and must continue rendering while the user scrolls through content sections. It is disposed only when navigation to workspace begins.
- **DissolveTransition** is a transient overlay that renders on top of everything at z-index 100, captures the visual state of the hero at transition start, and independently runs its dissolve shader. It self-disposes after reveal completes.

Both canvases use `alpha: false` and manage their own renderer lifecycles. No shared WebGL context.

### 2. Page Transition Sequence State Machine

The CTA → workspace navigation follows a strict 4-phase sequence that bridges imperative WebGL with React Router:

| Phase | Action | Duration |
|-------|--------|----------|
| 1. Overlay fade-in | Transition canvas opacity 0→1 | 400ms |
| 2. Dissolve shader | Noise threshold 0→1, hero canvas still rendering behind | 1800ms |
| 3. React navigation | `router.navigate('/workspace')` called — workspace mounts behind overlay | Immediate |
| 4. Overlay fade-out | Transition canvas opacity 1→0, then dispose | 600ms |

A `transitionPhase` ref (not state — must not trigger React re-renders during 60fps WebGL) tracks the current phase. The sequence is driven by GSAP timeline callbacks, not React state. React Router navigation occurs at phase 3, during the dissolve, so the workspace begins mounting behind the visual effect.

### 3. Hero Canvas Visibility Management

The AlienEcosystem canvas is `position: fixed` and remains visible behind scrolling content. However, when content sections with opaque backgrounds (Capabilities, HowItWorks, Ecosystem) scroll over it, the canvas still renders unnecessarily. Implement render-loop culling:

- Track which content sections currently overlap the viewport using IntersectionObserver (or ScrollTrigger onEnter/onLeave).
- If **no** opaque section overlaps the viewport (i.e., only Hero or FinalCTA are visible), render the hero canvas at full fidelity.
- If an opaque section fully covers the viewport, skip the Three.js render call for that frame (keep the RAF loop running but skip `renderer.render()`).
- This prevents wasted GPU cycles on invisible pixels without destroying/recreating the WebGL context.

### 4. Horizontal Scroll ScrollTrigger Coordination

The CapabilitiesSection horizontal scroll uses GSAP ScrollTrigger with `pin: true` and `scrub: 1`. This creates a virtual scroll-hijacking zone that intercepts native (Lenis-smoothed) scroll events. Critical integration points:

- Lenis must remain active during the pin — ScrollTrigger's pin container scrolls naturally within Lenis's smooth scroll stream.
- The pinned section's inner container translates via GSAP scrub. No manual wheel event listeners.
- After the horizontal scroll completes (last card visible), ScrollTrigger unpins and Lenis resumes vertical scrolling seamlessly.
- Calculate `totalWidth` from actual DOM measurements after mount (use `useLayoutEffect` or ResizeObserver) — card widths + gaps may change on responsive breakpoints.

### 5. Lenis ↔ ScrollTrigger Global Sync

A single SmoothScrollProvider component at the App level:

- Instantiates Lenis with `{ lerp: 0.08, smoothWheel: true }`
- Registers `lenis.on('scroll', ScrollTrigger.update)` on mount
- Provides Lenis instance via React context for scroll-direction detection (nav show/hide) and scroll-to actions
- Calls `lenis.destroy()` on unmount

All ScrollTrigger instances across all sections are created within this synced environment.

---

## Other Key Decisions

### Raw Three.js over React Three Fiber

The hero vegetation and transition shader use **raw Three.js** (direct `new THREE.WebGLRenderer`, custom `ShaderMaterial` with handwritten GLSL) rather than React Three Fiber. Rationale:

- Both scenes are single fullscreen quads/meshes with custom GLSL — no scene graph, no reusable components, no benefit from R3F's declarative model.
- Direct uniform manipulation from refs (cursor position, dissolve threshold) is cleaner without R3F's abstraction layer.
- The transition shader is a transient imperative effect that does not map well to React's render cycle.

### CSS-Generated Icons Over Image Assets

The design specifies zero image assets for the homepage. All icons and visual elements (capability card icons, how-it-works step visuals, tool category dots) are generated via CSS shapes, CSS animations, or small Canvas 2D drawings. This eliminates image loading latency and keeps the homepage bundle self-contained.
