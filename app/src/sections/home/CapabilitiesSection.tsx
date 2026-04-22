import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const capabilities = [
  {
    num: '01',
    title: 'Visual Generation',
    desc: 'Transform any scene into historical photographs, futuristic renderings, or alternate-reality versions powered by state-of-the-art diffusion models.',
    tag: 'Image',
    color: '#E07A5F',
  },
  {
    num: '02',
    title: 'Temporal Reconstruction',
    desc: 'Watch your scene evolve through time — from centuries past to speculative futures with animated video sequences.',
    tag: 'Video',
    color: '#7B68EE',
  },
  {
    num: '03',
    title: 'Spatial Mapping',
    desc: 'Convert flat images into explorable 3D environments with accurate depth, structure, and navigable viewpoints.',
    tag: '3D',
    color: '#4ECDC4',
  },
  {
    num: '04',
    title: 'Deep Research',
    desc: 'Automatically gather historical archives, contemporary references, and contextual data from across the web.',
    tag: 'Research',
    color: '#CCD5AE',
  },
  {
    num: '05',
    title: 'Sonic Landscapes',
    desc: 'Generate ambient soundscapes and musical compositions inspired by the mood, era, and geography of your scene.',
    tag: 'Audio',
    color: '#D4A373',
  },
  {
    num: '06',
    title: 'Intelligence Orchestration',
    desc: 'Our core AI analyzes inputs, maintains conversation context, and intelligently routes tasks to the optimal model or tool.',
    tag: 'AI Core',
    color: '#E9EDC9',
  },
];

function CapabilityCard({ cap, index }: { cap: typeof capabilities[0]; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const elements = card.querySelectorAll('.reveal-item');

    gsap.fromTo(
      elements,
      { y: 50, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.9,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 75%',
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === card) st.kill();
      });
    };
  }, []);

  const isLeft = index % 2 === 0;

  return (
    <div
      ref={cardRef}
      className="py-24 md:py-32"
      style={{
        borderBottom: '1px solid rgba(44, 24, 16, 0.08)',
      }}
    >
      <div className={`max-w-[1000px] mx-auto px-6 flex flex-col ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-12 md:gap-20`}>
        {/* Visual Side - Geometric Moebius Icon */}
        <div className="reveal-item opacity-0 flex-shrink-0 w-full md:w-[280px] flex justify-center">
          <div
            className="relative w-[200px] h-[200px] flex items-center justify-center"
            style={{
              border: `2px solid ${cap.color}`,
              opacity: 0.8,
            }}
          >
            {/* Moebius-style geometric decoration */}
            <div
              className="absolute inset-4"
              style={{
                border: `1px solid ${cap.color}`,
                opacity: 0.4,
              }}
            />
            {/* Corner marks */}
            {[[0, 0], [100, 0], [0, 100], [100, 100]].map(([x, y], i) => (
              <div
                key={i}
                className="absolute w-3 h-3"
                style={{
                  [x === 0 ? 'left' : 'right']: '-1px',
                  [y === 0 ? 'top' : 'bottom']: '-1px',
                  borderTop: y === 0 ? `2px solid ${cap.color}` : 'none',
                  borderBottom: y === 100 ? `2px solid ${cap.color}` : 'none',
                  borderLeft: x === 0 ? `2px solid ${cap.color}` : 'none',
                  borderRight: x === 100 ? `2px solid ${cap.color}` : 'none',
                }}
              />
            ))}
            {/* Center number */}
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '72px',
                fontWeight: 300,
                color: cap.color,
                opacity: 0.7,
                lineHeight: 1,
              }}
            >
              {cap.num}
            </span>
          </div>
        </div>

        {/* Content Side */}
        <div className={`flex-1 ${isLeft ? 'md:text-left' : 'md:text-right'} text-center`}>
          {/* Tag */}
          <div
            className="reveal-item opacity-0 inline-block mb-4"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: cap.color,
              border: `1px solid ${cap.color}4D`,
              padding: '4px 12px',
            }}
          >
            {cap.tag}
          </div>

          {/* Title */}
          <h3
            className="reveal-item opacity-0 mb-5"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 400,
              color: '#2C1810',
              lineHeight: 1.2,
            }}
          >
            {cap.title}
          </h3>

          {/* Description */}
          <p
            className="reveal-item opacity-0"
            style={{
              fontFamily: "'Quattrocento Sans', sans-serif",
              fontSize: '16px',
              color: '#5A4035',
              lineHeight: 1.7,
              maxWidth: '440px',
              marginLeft: isLeft ? '0' : 'auto',
              marginRight: isLeft ? 'auto' : '0',
            }}
          >
            {cap.desc}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CapabilitiesSection() {
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const words = header.querySelectorAll('.header-word');
    gsap.fromTo(
      words,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: header,
          start: 'top 80%',
        },
      }
    );
  }, []);

  return (
    <section
      id="capabilities"
      className="relative z-[5] w-full"
      style={{
        background: 'linear-gradient(to bottom, rgba(245, 228, 198, 0.30), rgba(245, 228, 198, 0.18))',
      }}
    >
      {/* Section Header */}
      <div ref={headerRef} className="pt-28 pb-8 text-center px-6">
        <div
          className="header-word opacity-0 mb-4"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: '#9A7A6A',
          }}
        >
          CAPABILITIES
        </div>
        <h2
          className="header-word opacity-0"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 300,
            color: '#2C1810',
            lineHeight: 1.2,
            marginBottom: '16px',
          }}
        >
          One Input. Infinite Possibilities.
        </h2>
        <div
          className="header-word opacity-0 mx-auto"
          style={{
            width: '60px',
            height: '2px',
            backgroundColor: '#2C1810',
            opacity: 0.2,
          }}
        />
      </div>

      {/* Capability Cards */}
      <div className="max-w-[1200px] mx-auto">
        {capabilities.map((cap, i) => (
          <CapabilityCard key={cap.num} cap={cap} index={i} />
        ))}
      </div>
    </section>
  );
}
