export default function Footer() {
  const links = ['GitHub', 'Documentation', 'API Reference', 'Community'];

  return (
    <footer
      className="relative z-[5] w-full"
      style={{
        backgroundColor: 'rgba(30, 22, 32, 0.78)',
        backdropFilter: 'blur(3px)',
        borderTop: '1px solid rgba(212, 163, 115, 0.08)',
      }}
    >
      <div className="max-w-[1100px] mx-auto px-6 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Left */}
          <div>
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '22px',
                fontWeight: 500,
                letterSpacing: '0.15em',
                color: '#D4A373',
              }}
            >
              VISIONE
            </span>
            <div
              className="mt-2 mb-3"
              style={{
                width: '32px',
                height: '2px',
                backgroundColor: 'rgba(212, 163, 115, 0.3)',
              }}
            />
            <p
              style={{
                fontFamily: "'Quattrocento Sans', sans-serif",
                fontSize: '13px',
                color: 'rgba(212, 163, 115, 0.5)',
                lineHeight: 1.6,
              }}
            >
              Where perception becomes creation.
            </p>
          </div>

          {/* Center */}
          <div className="flex flex-col gap-3">
            {links.map((link) => (
              <a
                key={link}
                href="#"
                className="group inline-flex items-center gap-2"
                style={{
                  fontFamily: "'Quattrocento Sans', sans-serif",
                  fontSize: '13px',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: '#8A7A6A',
                  textDecoration: 'none',
                  transition: 'color 200ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#D4A373';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#8A7A6A';
                }}
              >
                <span
                  className="w-0 group-hover:w-3 h-[1px] transition-all duration-300"
                  style={{ backgroundColor: '#D4A373' }}
                />
                {link}
              </a>
            ))}
          </div>

          {/* Right - Status */}
          <div className="flex items-start gap-3">
            <div
              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
              style={{
                backgroundColor: '#4ECDC4',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }}
            />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                color: '#8A7A6A',
              }}
            >
              All Systems Operational
            </span>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="text-center pt-8"
          style={{ borderTop: '1px solid rgba(212, 163, 115, 0.06)' }}
        >
          <p
            style={{
              fontFamily: "'Quattrocento Sans', sans-serif",
              fontSize: '11px',
              color: 'rgba(212, 163, 115, 0.3)',
            }}
          >
            2026 VISIONE. Open Source Framework.
          </p>
        </div>
      </div>
    </footer>
  );
}
