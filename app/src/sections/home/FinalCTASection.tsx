import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function FinalCTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const items = content.querySelectorAll('.cta-reveal');

    gsap.fromTo(
      items,
      { y: 35, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return (
    <section
      id="start"
      ref={sectionRef}
      className="relative z-[5] w-full"
      style={{
        background: 'linear-gradient(to bottom, rgba(200, 180, 155, 0.12), rgba(40, 29, 55, 0.52))',
      }}
    >
      <div
        ref={contentRef}
        className="max-w-[700px] mx-auto px-6 py-32 text-center"
      >
        {/* Decorative top element */}
        <div
          className="cta-reveal opacity-0 mx-auto mb-8"
          style={{
            width: '40px',
            height: '40px',
            border: '2px solid rgba(44, 24, 16, 0.25)',
            transform: 'rotate(45deg)',
          }}
        />

        <div
          className="cta-reveal opacity-0 mb-6"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: '#5A4035',
          }}
        >
          READY?
        </div>

        <h2
          className="cta-reveal opacity-0 mb-8"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 300,
            color: '#2C1810',
            lineHeight: 1.1,
          }}
        >
          Step Into the Unknown
        </h2>

        <p
          className="cta-reveal opacity-0 mx-auto mb-10"
          style={{
            fontFamily: "'Quattrocento Sans', sans-serif",
            fontSize: '17px',
            color: '#5A4035',
            lineHeight: 1.7,
            maxWidth: '460px',
          }}
        >
          Upload your first image and watch VISIONE transform it into something extraordinary.
        </p>

        <a
          href="#start"
          className="cta-reveal opacity-0 inline-flex items-center justify-center"
          style={{
            fontFamily: "'Quattrocento Sans', sans-serif",
            fontSize: '14px',
            fontWeight: 500,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#2C1810',
            border: '2px solid #2C1810',
            padding: '16px 48px',
            background: 'transparent',
            textDecoration: 'none',
            transition: 'all 300ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#2C1810';
            e.currentTarget.style.color = '#F5E6D0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#2C1810';
          }}
        >
          LAUNCH VISIONE
        </a>

        <div className="mt-6">
          <a
            href="#"
            className="cta-reveal opacity-0"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.1em',
              color: '#7A5A4A',
              textDecoration: 'none',
              transition: 'color 200ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#2C1810'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#7A5A4A'; }}
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
