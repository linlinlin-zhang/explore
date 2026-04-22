import { useEffect, useMemo, useState } from 'react';
import { FileText, ImageIcon, Link2, Music2 } from 'lucide-react';
import type { SceneSemanticItem } from '@/lib/three/SableScene';

type SemanticMode = 'link' | 'music' | 'image' | 'note';

interface SceneSemanticOverlayProps {
  items: SceneSemanticItem[];
}

const modes: SemanticMode[] = ['link', 'music', 'image', 'note'];

const linkByCategory: Record<string, string> = {
  architecture: 'wikipedia.org/wiki/Brutalist_architecture',
  creature: 'wikipedia.org/wiki/Paleontology',
  ecosystem: 'wikipedia.org/wiki/Desert_ecology',
  geology: 'wikipedia.org/wiki/Impact_crater',
  image: 'unsplash.com/s/photos/desert-architecture',
  infrastructure: 'wikipedia.org/wiki/Infrastructure',
  knowledge: 'wikipedia.org/wiki/Archive',
  link: 'wikipedia.org/wiki/Hyperlink',
  music: 'bandcamp.com/tag/ambient',
  mobility: 'wikipedia.org/wiki/Vehicle',
  note: 'wikipedia.org/wiki/Annotation',
  portal: 'wikipedia.org/wiki/Gateway_(architecture)',
  signal: 'wikipedia.org/wiki/Signal',
  terrain: 'wikipedia.org/wiki/Terrain',
  culture: 'wikipedia.org/wiki/Material_culture',
  vehicle: 'wikipedia.org/wiki/Spacecraft',
};

const musicByCategory: Record<string, string> = {
  architecture: 'Concrete Arches - Slow Relay',
  creature: 'Bone Dunes - Low Wind Choir',
  ecosystem: 'Oasis Nocturne - Glass Leaves',
  geology: 'Impact Basin - Mineral Pulse',
  image: 'Reference Image - Cyan Gate',
  infrastructure: 'Cable Route - Utility Drone',
  knowledge: 'Archive Room - Tape Dust',
  link: 'Bridge Link - Related Thread',
  music: 'Signal Wake - Red Cloth',
  mobility: 'Hangar Loop - Soft Engine',
  note: 'Caption Field - Quiet Voice',
  portal: 'Threshold Tone - Ring Gate',
  signal: 'Relay Beacon - Thin Carrier',
  terrain: 'Needle Field - Sand Harmonics',
  culture: 'Statue Court - Stone Echo',
  vehicle: 'Hover Wake - Engine Lullaby',
};

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function useViewport() {
  const [size, setSize] = useState(() => ({
    width: typeof window === 'undefined' ? 1600 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
  }));

  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return size;
}

function getMode(item: SceneSemanticItem) {
  return modes[hashString(item.id) % modes.length];
}

function getLabel(mode: SemanticMode) {
  switch (mode) {
    case 'link':
      return 'LINK';
    case 'music':
      return 'MUSIC';
    case 'image':
      return 'IMAGE';
    case 'note':
    default:
      return 'NOTE';
  }
}

function getIcon(mode: SemanticMode) {
  switch (mode) {
    case 'link':
      return Link2;
    case 'music':
      return Music2;
    case 'image':
      return ImageIcon;
    case 'note':
    default:
      return FileText;
  }
}

function getPanelText(item: SceneSemanticItem, mode: SemanticMode) {
  if (mode === 'link') {
    return `Link: ${linkByCategory[item.category] ?? 'wikipedia.org/wiki/Association'}`;
  }
  if (mode === 'music') {
    return musicByCategory[item.category] ?? 'Music: Field Recording - Context Drift';
  }
  if (mode === 'image') {
    return `${item.title} reference image`;
  }
  return item.description;
}

export default function SceneSemanticOverlay({ items }: SceneSemanticOverlayProps) {
  const viewport = useViewport();

  const positioned = useMemo(() => {
    const maxItems = viewport.width < 760 ? 4 : 5;
    const margin = viewport.width < 760 ? 10 : 16;
    const sideCounts: Record<'left' | 'right', number> = { left: 0, right: 0 };
    const placed: Array<{ x: number; y: number; width: number; height: number }> = [];

    const overlapPenalty = (x: number, y: number, width: number, height: number) => placed.reduce((sum, box) => {
      const gap = 14;
      const overlapX = Math.max(0, Math.min(x + width + gap, box.x + box.width + gap) - Math.max(x - gap, box.x - gap));
      const overlapY = Math.max(0, Math.min(y + height + gap, box.y + box.height + gap) - Math.max(y - gap, box.y - gap));
      if (overlapX === 0 || overlapY === 0) return sum;
      return sum + 16 + (overlapX * overlapY) / Math.max(1, width * height) * 42;
    }, 0);

    const clamped = [...items]
      .sort((a, b) => a.depth - b.depth)
      .filter((item) => item.y > 22 && item.y < viewport.height - 22)
      .slice(0, maxItems)
      .map((item, index) => {
        const mode = getMode(item);
        const panelWidth = viewport.width < 760
          ? Math.min(202, viewport.width - 24)
          : mode === 'image'
            ? 216
            : 236;
        const panelHeight = mode === 'note' ? 112 : mode === 'image' ? 98 : 86;
        const jitter = (hashString(item.id) % 54) - 27;
        const preferredDirection = item.x < viewport.width * 0.5 ? 1 : -1;
        const verticalDrift = Math.sin(item.x * 0.011 + item.y * 0.019 + index * 1.7) * 18 + jitter * 0.16;
        const near = viewport.width < 760 ? 54 : 92;
        const far = viewport.width < 760 ? 106 : 154;
        const lift = viewport.width < 760 ? 46 : 72;

        const makeFreeCandidate = (rawX: number, rawY: number, weight: number) => {
          const x = Math.min(viewport.width - panelWidth - margin, Math.max(margin, rawX));
          const y = Math.min(viewport.height - panelHeight - margin, Math.max(38, rawY));
          const side: 'left' | 'right' = x + panelWidth * 0.5 < item.x ? 'left' : 'right';
          const attachX = side === 'left' ? x + panelWidth : x;
          const attachY = y + Math.min(panelHeight - 22, Math.max(24, item.y - y));
          const lineLength = Math.hypot(attachX - item.x, attachY - item.y);
          const clipPenalty = (Math.abs(x - rawX) + Math.abs(y - rawY)) * 0.012;
          const linePenalty = Math.abs(lineLength - (viewport.width < 760 ? 94 : 126)) * 0.0032;
          const balancePenalty = sideCounts[side] * 1.18;
          const edgeDistance = Math.min(x - margin, viewport.width - panelWidth - margin - x);
          const edgePenalty = edgeDistance < 18 ? (18 - edgeDistance) * 0.018 : 0;
          const panelCenter = (x + panelWidth * 0.5) / viewport.width;
          const centerPilePenalty = Math.max(0, 0.18 - Math.abs(panelCenter - 0.5)) * 2.6;
          const anchorPenalty = Math.abs((x + panelWidth * 0.5) - item.x) / viewport.width * 0.34;

          return {
            side,
            panelX: x,
            panelY: y,
            attachX,
            attachY,
            lineLength,
            lineAngle: Math.atan2(attachY - item.y, attachX - item.x),
            score:
              weight +
              clipPenalty +
              linePenalty +
              balancePenalty +
              edgePenalty +
              centerPilePenalty +
              anchorPenalty +
              overlapPenalty(x, y, panelWidth, panelHeight),
          };
        };

        const makeCandidate = (direction: -1 | 1, distance: number, dy: number, weight: number) => makeFreeCandidate(
          direction < 0 ? item.x - panelWidth - distance : item.x + distance,
          item.y - panelHeight * 0.5 + dy + verticalDrift,
          weight
        );
        const makeLaneCandidate = (ratio: number, dy: number, weight: number) => makeFreeCandidate(
          viewport.width * ratio - panelWidth * 0.5 + jitter * 0.08,
          item.y - panelHeight * 0.5 + dy + verticalDrift * 0.65,
          weight
        );

        const forward = preferredDirection as -1 | 1;
        const backward = -preferredDirection as -1 | 1;
        const candidates = [
          makeCandidate(forward, near, 0, 0),
          makeCandidate(forward, far, -lift * 0.5, 0.08),
          makeCandidate(forward, far, lift * 0.55, 0.1),
          makeCandidate(backward, near, 0, 0.22),
          makeCandidate(backward, far, -lift * 0.55, 0.28),
          makeCandidate(backward, far, lift * 0.6, 0.3),
          makeLaneCandidate(0.2, -lift * 0.36, 0.24),
          makeLaneCandidate(0.34, lift * 0.22, 0.26),
          makeLaneCandidate(0.66, -lift * 0.22, 0.26),
          makeLaneCandidate(0.8, lift * 0.36, 0.24),
          makeCandidate(forward, near * 0.72, -lift * 1.12, 0.36),
          makeCandidate(forward, near * 0.72, lift * 1.12, 0.38),
          makeCandidate(backward, near * 0.72, -lift * 1.04, 0.44),
          makeCandidate(backward, near * 0.72, lift * 1.04, 0.46),
        ];
        const best = candidates.sort((a, b) => a.score - b.score)[0];
        placed.push({ x: best.panelX, y: best.panelY, width: panelWidth, height: panelHeight });
        sideCounts[best.side] += 1;

        return {
          ...item,
          mode,
          side: best.side,
          panelX: best.panelX,
          panelY: best.panelY,
          panelWidth,
          attachX: best.attachX,
          attachY: best.attachY,
          panelHeight,
          lineLength: best.lineLength,
          lineAngle: best.lineAngle,
        };
      });

    return clamped;
  }, [items, viewport.height, viewport.width]);

  if (positioned.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 18 }}>
      {positioned.map((item) => {
        const Icon = getIcon(item.mode);
        const panelText = getPanelText(item, item.mode);

        return (
          <div key={item.id}>
            <div
              className="absolute h-px"
              style={{
                left: item.x,
                top: item.y,
                width: item.lineLength,
                transform: `rotate(${item.lineAngle}rad)`,
                transformOrigin: '0 50%',
                background: 'rgba(32, 20, 15, 0.72)',
                boxShadow: '0 0 0 1px rgba(245, 235, 215, 0.18)',
                transition: 'left 90ms linear, top 90ms linear, width 90ms linear, transform 90ms linear',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                left: item.x - 4,
                top: item.y - 4,
                width: 8,
                height: 8,
                border: '1px solid rgba(32, 20, 15, 0.72)',
                background: 'rgba(245, 232, 205, 0.72)',
                transition: 'left 90ms linear, top 90ms linear',
              }}
            />
            <div
              data-semantic-label={item.id}
              className="absolute"
              style={{
                left: item.panelX,
                top: item.panelY,
                width: item.panelWidth,
                height: item.panelHeight,
                color: '#21140f',
                fontFamily: "'Quattrocento Sans', sans-serif",
                textAlign: item.side === 'left' ? 'right' : 'left',
                opacity: 0.92,
                transition: 'left 90ms linear, top 90ms linear, opacity 130ms ease',
              }}
            >
              <div
                className="flex items-center gap-2"
                style={{
                  width: item.panelWidth,
                  height: item.panelHeight,
                  boxSizing: 'border-box',
                  border: '1px solid rgba(32, 20, 15, 0.28)',
                  background: 'rgba(245, 232, 205, 0.52)',
                  backdropFilter: 'blur(7px)',
                  padding: item.mode === 'image' ? 8 : '7px 10px',
                  maxWidth: item.panelWidth,
                  overflow: 'hidden',
                }}
              >
                {item.mode === 'image' ? (
                  <div
                    style={{
                      width: 76,
                      height: 48,
                      border: '1px solid rgba(32, 20, 15, 0.35)',
                      background:
                        'linear-gradient(180deg, rgba(126, 232, 218, 0.72), rgba(241, 193, 126, 0.62) 54%, rgba(173, 108, 134, 0.62)), repeating-linear-gradient(0deg, transparent 0, transparent 7px, rgba(32,20,15,0.22) 8px)',
                    }}
                  />
                ) : (
                  <Icon size={15} strokeWidth={1.6} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(32, 20, 15, 0.62)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getLabel(item.mode)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: item.mode === 'note' ? 19 : 17,
                      lineHeight: 1.08,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      lineHeight: 1.35,
                      marginTop: 3,
                      color: 'rgba(32, 20, 15, 0.75)',
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: item.mode === 'note' ? 3 : 2,
                      overflow: 'hidden',
                    }}
                  >
                    {panelText}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
