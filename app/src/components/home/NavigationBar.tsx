import { useEffect, useState } from 'react';

type NavPhase = 'top' | 'journey' | 'bottom';

export default function NavigationBar() {
  const [phase, setPhase] = useState<NavPhase>('top');

  useEffect(() => {
    const updatePhase = () => {
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = window.scrollY / scrollable;

      if (progress < 0.08) {
        setPhase('top');
      } else if (progress > 0.86) {
        setPhase('bottom');
      } else {
        setPhase('journey');
      }
    };

    updatePhase();
    window.addEventListener('scroll', updatePhase, { passive: true });
    window.addEventListener('resize', updatePhase);

    return () => {
      window.removeEventListener('scroll', updatePhase);
      window.removeEventListener('resize', updatePhase);
    };
  }, []);

  const visible = phase !== 'journey';
  const isBottom = phase === 'bottom';

  return (
    <nav
      className="fixed top-0 left-0 w-full z-50"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-110%)',
        pointerEvents: visible ? 'auto' : 'none',
        background: isBottom ? 'rgba(245, 228, 198, 0.88)' : 'rgba(245, 228, 198, 0.18)',
        backdropFilter: isBottom ? 'blur(12px)' : 'blur(5px)',
        borderBottom: visible ? '1px solid rgba(44, 24, 16, 0.08)' : 'none',
        transition:
          'opacity 420ms ease, transform 420ms ease, background 320ms ease, backdrop-filter 320ms ease, border-color 320ms ease',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-[68px] flex items-center justify-between">
        <div className="flex flex-col items-start">
          <span
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '22px',
              fontWeight: 500,
              letterSpacing: '0.15em',
              color: '#2C1810',
            }}
          >
            VISIONE
          </span>
          <div
            className="h-[2px] w-10 mt-0.5"
            style={{ backgroundColor: 'rgba(44, 24, 16, 0.2)' }}
          />
        </div>

        <div className="hidden md:flex items-center gap-10">
          {['Capabilities', 'Framework', 'Ecosystem'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="relative group"
              style={{
                fontFamily: "'Quattrocento Sans', sans-serif",
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#5A4035',
                textDecoration: 'none',
                transition: 'color 200ms ease',
                paddingBottom: '2px',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.color = '#2C1810';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = '#5A4035';
              }}
            >
              {item}
              <span
                className="absolute bottom-0 left-0 w-0 group-hover:w-full h-[1px] transition-all duration-300"
                style={{ backgroundColor: '#2C1810' }}
              />
            </a>
          ))}
        </div>

        <a
          href="#start"
          className="hidden md:block"
          style={{
            fontFamily: "'Quattrocento Sans', sans-serif",
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#2C1810',
            border: '1px solid rgba(44, 24, 16, 0.25)',
            padding: '7px 20px',
            textDecoration: 'none',
            transition: 'all 250ms ease',
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
          START
        </a>
      </div>
    </nav>
  );
}
