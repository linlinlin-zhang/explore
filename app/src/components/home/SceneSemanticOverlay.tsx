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

function getPanelHref(item: SceneSemanticItem, mode: SemanticMode) {
  const rawCategoryLink = linkByCategory[item.category] ?? 'wikipedia.org/wiki/Association';
  const normalizedCategoryLink = rawCategoryLink.startsWith('http') ? rawCategoryLink : `https://${rawCategoryLink}`;

  if (mode === 'link') return normalizedCategoryLink;
  if (mode === 'music') {
    const term = encodeURIComponent((musicByCategory[item.category] ?? item.title).replace(/\s+-\s+/g, ' '));
    return `https://bandcamp.com/search?q=${term}`;
  }
  if (mode === 'image') {
    const term = encodeURIComponent(item.tags.slice(0, 3).join(' ') || item.title);
    return `https://unsplash.com/s/photos/${term}`;
  }
  const term = encodeURIComponent(item.title);
  return `https://www.google.com/search?q=${term}`;
}

function getPanelHrefLabel(item: SceneSemanticItem, mode: SemanticMode) {
  if (mode === 'link') {
    return linkByCategory[item.category] ?? 'wikipedia.org/wiki/Association';
  }
  if (mode === 'music') {
    return 'bandcamp.com/search';
  }
  if (mode === 'image') {
    return 'unsplash.com/search';
  }
  return 'google.com/search';
}

export default function SceneSemanticOverlay({ items }: SceneSemanticOverlayProps) {
  const viewport = useViewport();

  const positioned = useMemo(() => {
    const maxItems = viewport.width < 760 ? 4 : 5;
    const margin = viewport.width < 760 ? 10 : 18;
    const placed: Array<{ x: number; y: number; width: number; height: number }> = [];

    const overlapPenalty = (x: number, y: number, width: number, height: number) => placed.reduce((sum, box) => {
      const gap = viewport.width < 760 ? 14 : 20;
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
        const centerX = viewport.width * 0.5;
        const centerY = viewport.height * 0.5;
        const centerBias = 1 - Math.min(1, Math.abs(item.x - centerX) / (viewport.width * 0.5));
        const directionBias = item.x < centerX
          ? 1
          : item.x > centerX
            ? -1
            : (hashString(item.id) % 2 === 0 ? 1 : -1);
        const verticalBias = item.y < centerY ? 1 : -1;
        const horizontalNear = viewport.width < 760 ? 34 : 56;
        const horizontalFar = viewport.width < 760 ? 58 : 92;
        const horizontalEdge = viewport.width < 760 ? 92 : 156;
        const verticalNear = viewport.width < 760 ? 24 : 34;
        const verticalFar = viewport.width < 760 ? 44 : 58;
        const lateralDrift = Math.sin(item.x * 0.012 + item.y * 0.018 + index * 1.4) * 12 + jitter * 0.18;
        const verticalDrift = Math.cos(item.y * 0.014 + index * 1.3) * 10;
        const leftEdgeInset = viewport.width < 760 ? 12 : 18;
        const rightEdgeInset = viewport.width < 760 ? 12 : 18;
        const edgeLaneOffset = viewport.width < 760 ? 0 : 22 + (hashString(item.id) % 2) * 28;

        const makeFreeCandidate = (rawX: number, rawY: number, weight: number) => {
          const x = Math.min(viewport.width - panelWidth - margin, Math.max(margin, rawX));
          const y = Math.min(viewport.height - panelHeight - margin, Math.max(28, rawY));
          const side: 'left' | 'right' = x + panelWidth * 0.5 < item.x ? 'left' : 'right';
          const attachX = side === 'left'
            ? x + panelWidth
            : x;
          const attachY = Math.min(y + panelHeight - 18, Math.max(y + 18, item.y));
          const lineLength = Math.hypot(attachX - item.x, attachY - item.y);
          const clipPenalty = (Math.abs(x - rawX) + Math.abs(y - rawY)) * 0.012;
          const linePenalty = Math.abs(lineLength - (viewport.width < 760 ? 74 : 96)) * 0.0032;
          const edgeDistance = Math.min(x - margin, viewport.width - panelWidth - margin - x);
          const edgePenalty = edgeDistance < 8 ? (8 - edgeDistance) * 0.06 : 0;
          const panelCenter = (x + panelWidth * 0.5) / viewport.width;
          const centerPilePenalty = Math.max(0, 0.16 - Math.abs(panelCenter - 0.5)) * 2.4;
          const anchorPenalty = Math.abs((x + panelWidth * 0.5) - item.x) / viewport.width * 0.26;
          const verticalAnchorPenalty = Math.abs((y + panelHeight * 0.5) - item.y) / viewport.height * 0.22;
          const directCenterPenalty = Math.abs(item.x - centerX) < panelWidth * 0.52 && Math.abs(item.y - centerY) < panelHeight * 0.78 ? 0.32 : 0;
          const farFromAnchorBonus = lineLength > horizontalEdge ? -0.06 : 0;

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
              edgePenalty +
              centerPilePenalty +
              anchorPenalty +
              verticalAnchorPenalty +
              directCenterPenalty +
              farFromAnchorBonus +
              overlapPenalty(x, y, panelWidth, panelHeight),
          };
        };

        const makeCandidate = (direction: -1 | 1, dx: number, dy: number, weight: number) => makeFreeCandidate(
          direction < 0 ? item.x - panelWidth - dx : item.x + dx,
          item.y - panelHeight * 0.5 + dy,
          weight
        );

        const makeEdgeCandidate = (side: -1 | 1, dy: number, weight: number) => makeFreeCandidate(
          side < 0
            ? leftEdgeInset + edgeLaneOffset
            : viewport.width - panelWidth - rightEdgeInset - edgeLaneOffset,
          item.y - panelHeight * 0.5 + dy,
          weight
        );

        const forward = directionBias as -1 | 1;
        const backward = -directionBias as -1 | 1;
        const edgeForwardWeight = 0.08 - centerBias * 0.16;
        const edgeBackwardWeight = 0.18 - centerBias * 0.08;
        const candidates = [
          makeCandidate(forward, horizontalNear, verticalDrift * 0.4 + lateralDrift * 0.1, 0),
          makeCandidate(forward, horizontalFar, -verticalNear + verticalDrift, 0.05),
          makeCandidate(forward, horizontalFar, verticalNear + verticalDrift, 0.06),
          makeCandidate(forward, horizontalEdge, verticalDrift * 0.55, 0.08),
          makeCandidate(backward, horizontalNear, verticalDrift * 0.4 - lateralDrift * 0.1, 0.14),
          makeCandidate(backward, horizontalFar, -verticalNear + verticalDrift, 0.18),
          makeCandidate(backward, horizontalFar, verticalNear + verticalDrift, 0.19),
          makeCandidate(backward, horizontalEdge, verticalDrift * 0.55, 0.2),
          makeFreeCandidate(
            item.x - panelWidth * 0.5 + lateralDrift * 0.4,
            item.y - panelHeight - verticalFar * verticalBias + verticalDrift,
            0.22
          ),
          makeFreeCandidate(
            item.x - panelWidth * 0.5 + lateralDrift * 0.4,
            item.y + verticalFar * verticalBias + verticalDrift,
            0.24
          ),
          makeCandidate(forward, horizontalNear * 0.72, -verticalFar, 0.28),
          makeCandidate(forward, horizontalNear * 0.72, verticalFar, 0.3),
          makeCandidate(backward, horizontalNear * 0.72, -verticalFar, 0.34),
          makeCandidate(backward, horizontalNear * 0.72, verticalFar, 0.36),
          makeEdgeCandidate(forward, verticalDrift * 0.9, edgeForwardWeight),
          makeEdgeCandidate(forward, -verticalFar * 0.9 + verticalDrift, edgeForwardWeight + 0.03),
          makeEdgeCandidate(forward, verticalFar * 0.9 + verticalDrift, edgeForwardWeight + 0.04),
          makeEdgeCandidate(backward, verticalDrift * 0.8, edgeBackwardWeight),
          makeEdgeCandidate(backward, -verticalFar + verticalDrift, edgeBackwardWeight + 0.04),
          makeEdgeCandidate(backward, verticalFar + verticalDrift, edgeBackwardWeight + 0.05),
        ];
        const best = candidates.sort((a, b) => a.score - b.score)[0];
        placed.push({ x: best.panelX, y: best.panelY, width: panelWidth, height: panelHeight });

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
        const panelHref = getPanelHref(item, item.mode);
        const panelHrefLabel = getPanelHrefLabel(item, item.mode);

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
                transition: 'left 18ms linear, top 18ms linear, width 18ms linear, transform 18ms linear',
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
                transition: 'left 18ms linear, top 18ms linear',
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
                transition: 'left 18ms linear, top 18ms linear, opacity 90ms ease',
                willChange: 'left, top',
              }}
            >
              <a
                href={panelHref}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 pointer-events-auto"
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
                  textDecoration: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
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
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      lineHeight: 1.25,
                      marginTop: 4,
                      color: 'rgba(32, 20, 15, 0.56)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {panelHrefLabel}
                  </div>
                </div>
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
