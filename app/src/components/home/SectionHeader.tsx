import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface SectionHeaderProps {
  label: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
}

export default function SectionHeader({ label, title, subtitle, align = 'left' }: SectionHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const words = el.querySelectorAll('.header-word');

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
          trigger: el,
          start: 'top 80%',
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === el) st.kill();
      });
    };
  }, []);

  const titleWords = title.split(' ');

  return (
    <div ref={containerRef} className={align === 'center' ? 'text-center' : 'text-left'}>
      <div
        className="mb-4"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#CCD5AE',
        }}
      >
        {label}
      </div>
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 'clamp(32px, 5vw, 48px)',
          fontWeight: 300,
          color: '#E9EDC9',
          lineHeight: 1.2,
          marginBottom: '16px',
        }}
      >
        {titleWords.map((word, i) => (
          <span key={i} className="header-word inline-block mr-[0.3em] opacity-0">
            {word}
          </span>
        ))}
      </h2>
      <div
        className="header-word opacity-0"
        style={{
          width: '80px',
          height: '1px',
          backgroundColor: 'rgba(250, 237, 205, 0.3)',
          margin: align === 'center' ? '0 auto 20px' : '0 0 20px',
        }}
      />
      {subtitle && (
        <p
          className="header-word opacity-0"
          style={{
            fontFamily: "'Quattrocento Sans', sans-serif",
            fontSize: '18px',
            color: 'rgba(212, 163, 115, 0.6)',
            lineHeight: 1.6,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
