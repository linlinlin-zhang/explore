import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    num: '01',
    title: 'Perceive',
    desc: 'You upload an image, paste a URL, or drop a video. VISIONE ingests the content — analyzing objects, scenery, text, style, mood, and geographic clues.',
    color: '#E07A5F',
  },
  {
    num: '02',
    title: 'Understand',
    desc: 'The AI framework builds a rich context model. It identifies locations, time periods, architectural styles, natural elements, and emotional atmosphere.',
    color: '#4ECDC4',
  },
  {
    num: '03',
    title: 'Orchestrate',
    desc: 'Based on context and your conversation history, VISIONE selects the optimal tools — image generators, video models, 3D engines, search APIs, music synthesizers.',
    color: '#7B68EE',
  },
  {
    num: '04',
    title: 'Create',
    desc: 'Results flow back as a cohesive narrative: a historical photo alongside research links, a 3D scene with ambient sound, a video transformation with weather data.',
    color: '#CCD5AE',
  },
];

export default function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const stepElements = stepRefs.current.filter(Boolean) as HTMLDivElement[];

    stepElements.forEach((stepEl, i) => {
      const items = stepEl.querySelectorAll('.step-reveal');
      const line = stepEl.querySelector('.step-line');

      gsap.fromTo(
        items,
        { x: i % 2 === 0 ? -40 : 40, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: stepEl,
            start: 'top 75%',
          },
        }
      );

      if (line) {
        gsap.fromTo(
          line,
          { scaleY: 0 },
          {
            scaleY: 1,
            duration: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: stepEl,
              start: 'top 70%',
            },
          }
        );
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return (
    <section
      id="framework"
      ref={sectionRef}
      className="relative z-[5] w-full"
      style={{
        background: 'linear-gradient(to bottom, rgba(230, 210, 180, 0.22), rgba(220, 195, 160, 0.14))',
      }}
    >
      <div className="max-w-[900px] mx-auto px-6 py-28">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div
            className="mb-4"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: '#8A6A5A',
            }}
          >
            FRAMEWORK
          </div>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(32px, 5vw, 48px)',
              fontWeight: 300,
              color: '#2C1810',
              lineHeight: 1.2,
              marginBottom: '16px',
            }}
          >
            The Engine Beneath
          </h2>
          <div
            className="mx-auto"
            style={{
              width: '60px',
              height: '2px',
              backgroundColor: '#2C1810',
              opacity: 0.15,
            }}
          />
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Central connecting line */}
          <div
            className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 hidden md:block"
            style={{ backgroundColor: 'rgba(44, 24, 16, 0.08)' }}
          />

          <div className="space-y-20">
            {steps.map((step, i) => (
              <div
                key={step.num}
                ref={(el) => { stepRefs.current[i] = el; }}
                className={`relative flex flex-col ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8 md:gap-16`}
              >
                {/* Content */}
                <div className={`flex-1 ${i % 2 === 0 ? 'md:text-right' : 'md:text-left'} text-center`}>
                  <div
                    className="step-reveal opacity-0 inline-block mb-3"
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: '64px',
                      fontWeight: 300,
                      color: step.color,
                      opacity: 0.25,
                      lineHeight: 1,
                    }}
                  >
                    {step.num}
                  </div>
                  <h3
                    className="step-reveal opacity-0 mb-3"
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: '28px',
                      fontWeight: 400,
                      color: '#2C1810',
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="step-reveal opacity-0"
                    style={{
                      fontFamily: "'Quattrocento Sans', sans-serif",
                      fontSize: '15px',
                      color: '#5A4035',
                      lineHeight: 1.7,
                    }}
                  >
                    {step.desc}
                  </p>
                </div>

                {/* Center Node */}
                <div className="relative flex-shrink-0 hidden md:flex items-center justify-center">
                  <div
                    className="step-line w-4 h-4 origin-top"
                    style={{
                      border: `2px solid ${step.color}`,
                      backgroundColor: 'rgba(245, 228, 198, 0.9)',
                      transform: 'rotate(45deg)',
                    }}
                  />
                </div>

                {/* Spacer for opposite side */}
                <div className="flex-1 hidden md:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
