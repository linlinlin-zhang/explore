import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Entrance animations
    const tl = gsap.timeline({ delay: 0.5 });

    if (labelRef.current) {
      tl.to(labelRef.current, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0);
    }
    if (titleRef.current) {
      tl.to(titleRef.current, { opacity: 1, scale: 1, duration: 1.2, ease: 'power3.out' }, 0.2);
    }
    if (subtitleRef.current) {
      tl.to(subtitleRef.current, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0.6);
    }
    if (ctaRef.current) {
      tl.to(ctaRef.current, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 1.0);
    }
    if (scrollIndicatorRef.current) {
      tl.to(scrollIndicatorRef.current, { opacity: 1, duration: 0.6 }, 1.4);
    }

    const handleScroll = () => {
      const scrollY = window.scrollY;

      // Hide scroll indicator
      if (scrollIndicatorRef.current && scrollY > 100) {
        gsap.to(scrollIndicatorRef.current, { opacity: 0, duration: 0.3 });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <section
      id="hero-section"
      ref={containerRef}
      className="relative w-full"
      style={{ minHeight: '180vh' }}
    >
      <div className="sticky top-0 w-full h-[100dvh] overflow-hidden">
        <div
          className="absolute bottom-0 left-0 w-full h-[30%] pointer-events-none z-10"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(210, 161, 102, 0.24))',
          }}
        />

        {/* Hero Content Overlay */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-center pointer-events-auto" style={{ marginTop: '-28vh' }}>
            {/* Top Label */}
            <div
              ref={labelRef}
              className="opacity-0 translate-y-5 mb-6"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'rgba(44, 24, 16, 0.6)',
              }}
            >
              AI-PERCEPTION FRAMEWORK
            </div>

            {/* Main Title */}
            <h1
              ref={titleRef}
              className="opacity-0 scale-95 mb-4"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(56px, 12vw, 120px)',
                fontWeight: 300,
                letterSpacing: '0.12em',
                color: '#2C1810',
                lineHeight: 1,
                textShadow: '0 2px 30px rgba(255,255,255,0.35), 0 0 80px rgba(255,255,255,0.15)',
              }}
            >
              VISIONE
            </h1>

            {/* Decorative line - Moebius style */}
            <div
              className="mx-auto mb-6"
              style={{
                width: '100px',
                height: '2px',
                background: 'linear-gradient(to right, transparent, rgba(44, 24, 16, 0.4), transparent)',
              }}
            />

            {/* Subtitle */}
            <p
              ref={subtitleRef}
              className="opacity-0 translate-y-4 mx-auto mb-10"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(18px, 3vw, 26px)',
                fontWeight: 400,
                fontStyle: 'italic',
                letterSpacing: '0.04em',
                color: '#3A2018',
                lineHeight: 1.4,
                maxWidth: '480px',
                textShadow: '0 1px 8px rgba(255,255,255,0.3)',
              }}
            >
              Send any image. Unlock infinite dimensions.
            </p>

            {/* CTA Button */}
            <a
              ref={ctaRef}
              href="#capabilities"
              className="opacity-0 translate-y-5 inline-flex items-center justify-center"
              style={{
                fontFamily: "'Quattrocento Sans', sans-serif",
                fontSize: '13px',
                fontWeight: 500,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#2C1810',
                border: '2px solid #2C1810',
                padding: '14px 40px',
                background: 'rgba(255, 255, 255, 0.15)',
                textDecoration: 'none',
                transition: 'all 300ms ease',
                backdropFilter: 'blur(4px)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2C1810';
                e.currentTarget.style.color = '#F5E6D0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = '#2C1810';
              }}
            >
              BEGIN THE JOURNEY
            </a>
          </div>

          {/* Scroll Indicator */}
          <div
            ref={scrollIndicatorRef}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-0 flex flex-col items-center gap-2"
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(44, 24, 16, 0.5)',
              }}
            >
              Scroll to Glide
            </span>
            <div
              className="w-[1px] h-8 animate-scroll-bounce"
              style={{ backgroundColor: 'rgba(44, 24, 16, 0.35)' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
