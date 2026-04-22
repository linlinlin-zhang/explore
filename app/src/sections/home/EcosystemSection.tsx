import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const tools = [
  { name: 'DALL-E 3', category: 'Image', color: '#4ECDC4' },
  { name: 'Midjourney', category: 'Image', color: '#4ECDC4' },
  { name: 'Stable Diffusion XL', category: 'Image', color: '#4ECDC4' },
  { name: 'Runway Gen-3', category: 'Video', color: '#7B68EE' },
  { name: 'Pika Labs', category: 'Video', color: '#7B68EE' },
  { name: 'Sora', category: 'Video', color: '#7B68EE' },
  { name: 'Tripo3D', category: '3D', color: '#E07A5F' },
  { name: 'Meshy AI', category: '3D', color: '#E07A5F' },
  { name: 'Google Maps MCP', category: 'Location', color: '#CCD5AE' },
  { name: 'Weather API MCP', category: 'Weather', color: '#CCD5AE' },
  { name: 'Perplexity', category: 'Research', color: '#2A9D8F' },
  { name: 'ElevenLabs', category: 'Audio', color: '#D4A373' },
];

export default function EcosystemSection() {
  const gridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (header) {
      const items = header.querySelectorAll('.eco-header-reveal');
      gsap.fromTo(
        items,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: { trigger: header, start: 'top 80%' },
        }
      );
    }

    const grid = gridRef.current;
    if (!grid) return;

    const badges = grid.querySelectorAll('.tool-badge');
    gsap.fromTo(
      badges,
      { y: 25, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.5,
        stagger: 0.04,
        ease: 'power3.out',
        scrollTrigger: { trigger: grid, start: 'top 75%' },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return (
    <section
      id="ecosystem"
      className="relative z-[5] w-full"
      style={{
        background: 'linear-gradient(to bottom, rgba(235, 215, 185, 0.18), rgba(225, 200, 170, 0.10))',
      }}
    >
      <div className="max-w-[1100px] mx-auto px-6 py-28">
        {/* Header */}
        <div ref={headerRef} className="text-center mb-16">
          <div
            className="eco-header-reveal opacity-0 mb-4"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: '#8A6A5A',
            }}
          >
            ECOSYSTEM
          </div>
          <h2
            className="eco-header-reveal opacity-0 mb-3"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(32px, 5vw, 48px)',
              fontWeight: 300,
              color: '#2C1810',
              lineHeight: 1.2,
            }}
          >
            Models. Tools. Skills.
          </h2>
          <p
            className="eco-header-reveal opacity-0"
            style={{
              fontFamily: "'Quattrocento Sans', sans-serif",
              fontSize: '16px',
              color: '#7A5A4A',
              fontStyle: 'italic',
            }}
          >
            Connected to the world's most capable AI systems
          </p>
        </div>

        {/* Tool Grid - Moebius styled */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
        >
          {tools.map((tool) => (
            <div
              key={tool.name}
              className="tool-badge opacity-0 flex items-center gap-4 px-5 py-4"
              style={{
                border: '1px solid rgba(44, 24, 16, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                transition: 'all 250ms ease',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = tool.color;
                el.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = 'rgba(44, 24, 16, 0.1)';
                el.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              {/* Color indicator - Moebius flat dot */}
              <div
                className="flex-shrink-0 w-3 h-3"
                style={{ backgroundColor: tool.color }}
              />

              <span
                className="flex-1"
                style={{
                  fontFamily: "'Quattrocento Sans', sans-serif",
                  fontSize: '14px',
                  color: '#3A2018',
                }}
              >
                {tool.name}
              </span>

              <span
                className="flex-shrink-0"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '9px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#9A7A6A',
                }}
              >
                {tool.category}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom text */}
        <div className="text-center mt-14">
          <p
            style={{
              fontFamily: "'Quattrocento Sans', sans-serif",
              fontSize: '15px',
              fontStyle: 'italic',
              color: '#8A6A5A',
              marginBottom: '12px',
            }}
          >
            And hundreds more via custom MCP integrations.
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-2 group"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#5A4035',
              textDecoration: 'none',
              transition: 'color 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#2C1810';
              const arrow = e.currentTarget.querySelector('.arrow') as HTMLElement;
              if (arrow) arrow.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#5A4035';
              const arrow = e.currentTarget.querySelector('.arrow') as HTMLElement;
              if (arrow) arrow.style.transform = 'translateX(0)';
            }}
          >
            EXPLORE FULL ECOSYSTEM
            <span className="arrow transition-transform duration-200">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
