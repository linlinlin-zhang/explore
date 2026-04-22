import { useEffect, useRef, useState } from 'react';
import { SableScene, type SceneSemanticItem } from '@/lib/three/SableScene';
import SceneSemanticOverlay from './SceneSemanticOverlay';

export default function SableWorldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SableScene | null>(null);
  const [semanticItems, setSemanticItems] = useState<SceneSemanticItem[]>([]);
  const [journeyProgress, setJourneyProgress] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new SableScene(canvas, setSemanticItems);
    sceneRef.current = scene;
    scene.resize();
    scene.start();

    let raf = 0;
    let lastProgress = -1;
    let lastSemanticBlock = -2;
    const getSectionBlock = () => {
      const centerY = window.innerHeight * 0.52;
      const sections = [
        { id: 'capabilities', start: 0, count: 3 },
        { id: 'framework', start: 3, count: 3 },
        { id: 'ecosystem', start: 6, count: 1 },
      ];

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.top <= centerY && rect.bottom >= centerY) {
          const sectionProgress = Math.min(
            0.999,
            Math.max(0, (centerY - rect.top) / Math.max(rect.height, 1))
          );
          return section.start + Math.floor(sectionProgress * section.count);
        }
      }

      return -1;
    };
    const syncScroll = () => {
      const scrollable = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const progress = Math.min(Math.max(window.scrollY / scrollable, 0), 1);
      const semanticBlock = getSectionBlock();

      if (Math.abs(progress - lastProgress) > 0.0005) {
        scene.setJourneyProgress(progress);
        setJourneyProgress(progress);
        lastProgress = progress;
      }
      if (semanticBlock !== lastSemanticBlock) {
        scene.setSemanticBlock(semanticBlock);
        lastSemanticBlock = semanticBlock;
      }

      raf = requestAnimationFrame(syncScroll);
    };

    const updatePointer = (event: PointerEvent) => {
      scene.setPointer(
        event.clientX / Math.max(window.innerWidth, 1),
        event.clientY / Math.max(window.innerHeight, 1)
      );
    };

    window.addEventListener('pointermove', updatePointer, { passive: true });

    syncScroll();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', updatePointer);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
        style={{
          width: '100vw',
          height: '100dvh',
          minWidth: '100vw',
          minHeight: '100dvh',
          background: '#d2a166',
        }}
      >
        <canvas
          ref={canvasRef}
          className="block"
          style={{
            width: '100vw',
            height: '100dvh',
            minWidth: '100vw',
            minHeight: '100dvh',
            display: 'block',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, transparent 0%, transparent 58%, rgba(31, 22, 16, 0.12) 100%)',
            mixBlendMode: 'multiply',
          }}
        />
      </div>
      <SceneSemanticOverlay
        items={journeyProgress > 0.1 && journeyProgress < 0.86 ? semanticItems : []}
      />
    </>
  );
}
