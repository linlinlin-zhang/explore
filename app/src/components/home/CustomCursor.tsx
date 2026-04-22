import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const isTouch = useRef(false);

  useEffect(() => {
    isTouch.current = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch.current) return;

    const dot = dotRef.current;
    if (!dot) return;

    // Only hide cursor on interactive elements, not body
    const moveCursor = (e: MouseEvent) => {
      gsap.to(dot, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.12,
        ease: 'power2.out',
      });
    };

    const handleEnter = () => {
      gsap.to(dot, { scale: 2.5, duration: 0.25, ease: 'power2.out' });
    };
    const handleLeave = () => {
      gsap.to(dot, { scale: 1, duration: 0.25, ease: 'power2.out' });
    };

    window.addEventListener('mousemove', moveCursor);

    const attachListeners = () => {
      const els = document.querySelectorAll('a, button, [data-cursor-hover]');
      els.forEach((el) => {
        el.addEventListener('mouseenter', handleEnter);
        el.addEventListener('mouseleave', handleLeave);
      });
      return els;
    };

    let interactiveEls = attachListeners();

    // Re-attach periodically for dynamic content
    const interval = setInterval(() => {
      interactiveEls = attachListeners();
    }, 3000);

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      clearInterval(interval);
      interactiveEls.forEach((el) => {
        el.removeEventListener('mouseenter', handleEnter);
        el.removeEventListener('mouseleave', handleLeave);
      });
    };
  }, []);

  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
    return null;
  }

  return (
    <div
      ref={dotRef}
      className="fixed top-0 left-0 pointer-events-none z-[9999] hidden md:block"
      style={{
        width: '10px',
        height: '10px',
        marginLeft: '-5px',
        marginTop: '-5px',
        borderRadius: '50%',
        backgroundColor: '#2C1810',
        mixBlendMode: 'multiply',
        willChange: 'transform',
      }}
    />
  );
}
