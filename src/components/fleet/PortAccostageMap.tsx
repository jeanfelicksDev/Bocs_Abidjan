import React, { useState } from 'react';
import { Escale } from '../../types';
import {
  Anchor,
  Navigation,
  ZoomIn,
  ZoomOut,
  Ship,
  Compass,
  ChevronRight,
  X,
  Search,
  Layers,
  MapPin,
  Clock,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

interface PortAccostageMapProps {
  escales: Escale[];
  onSelectEscale: (escale: Escale) => void;
}

export const PortAccostageMap: React.FC<PortAccostageMapProps> = ({ escales, onSelectEscale }) => {
  const [selectedEscale, setSelectedEscale] = useState<Escale | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'A_QUAI' | 'EN_RADE'>('ALL');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hoveredEscale, setHoveredEscale] = useState<Escale | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const dockedEscales = escales.filter(e => e.statut === 'EN_COURS');
  const anchoredEscales = escales.filter(e => e.statut === 'CLOTUREE');

  const displayedEscales = escales.filter(e => {
    const matchesFilter =
      filterMode === 'A_QUAI' ? e.statut === 'EN_COURS' :
      filterMode === 'EN_RADE' ? e.statut === 'CLOTUREE' :
      true;
    const matchesSearch = searchQuery
      ? e.nomNavire.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.numeroVoyage || '').toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesFilter && matchesSearch;
  });

  const handleSelectEscale = (escale: Escale) => {
    setSelectedEscale(escale);
  };

  const handleOpenDetails = () => {
    if (selectedEscale) onSelectEscale(selectedEscale);
  };

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-border-default dark:border-night-line shadow-2xl dark:shadow-black/70 bg-[#ddeef8]" style={{ height: '600px' }}>

      {/* ══════════════════════════════════════
          CARTE SVG — FOND FIXE
      ══════════════════════════════════════ */}
      <div
        className="absolute inset-0 w-full h-full transition-transform duration-300 origin-center"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        <svg
          className="w-full h-full"
          viewBox="0 0 1200 650"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="oceanWater" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#aad4f0" />
              <stop offset="60%" stopColor="#89c4e8" />
              <stop offset="100%" stopColor="#6ab4e0" />
            </linearGradient>
            <linearGradient id="lagoonWater" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7ab8e0" />
              <stop offset="100%" stopColor="#5aaad8" />
            </linearGradient>
            <linearGradient id="landMass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c8d8a8" />
              <stop offset="100%" stopColor="#b0c890" />
            </linearGradient>
            <linearGradient id="quaiGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#b0b8c8" />
              <stop offset="100%" stopColor="#c8d0dc" />
            </linearGradient>
            <linearGradient id="hullBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a3a5c" />
              <stop offset="100%" stopColor="#0f2440" />
            </linearGradient>
            <linearGradient id="hullRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7f1f1f" />
              <stop offset="100%" stopColor="#3f0e0e" />
            </linearGradient>
            <linearGradient id="hullGray" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3a4a5a" />
              <stop offset="100%" stopColor="#222e3a" />
            </linearGradient>
            <radialGradient id="waterShine" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#aad4f0" stopOpacity="0" />
            </radialGradient>
            <pattern id="radarGrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#6090c0" strokeWidth="0.4" strokeOpacity="0.3" />
            </pattern>
            <pattern id="wavePattern" width="120" height="12" patternUnits="userSpaceOnUse">
              <path d="M0 6 Q15 2 30 6 Q45 10 60 6 Q75 2 90 6 Q105 10 120 6" fill="none" stroke="#4a90c0" strokeWidth="1" opacity="0.25"/>
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glowGreen">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="shipShadow">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.5"/>
            </filter>
          </defs>

          {/* Fond marin */}
          <rect width="1200" height="650" fill="url(#oceanWater)" />
          <rect width="1200" height="650" fill="url(#radarGrid)" />
          <ellipse cx="580" cy="390" rx="480" ry="180" fill="url(#waterShine)" />
          <rect x="0" y="430" width="1200" height="220" fill="url(#wavePattern)" opacity="0.6" />

          {/* Grille AIS */}
          <g opacity="0.5">
            <circle cx="580" cy="350" r="130" fill="none" stroke="#2060a0" strokeWidth="0.8" strokeDasharray="5 5" />
            <circle cx="580" cy="350" r="250" fill="none" stroke="#2060a0" strokeWidth="0.8" strokeDasharray="5 5" />
            <circle cx="580" cy="350" r="390" fill="none" stroke="#2060a0" strokeWidth="0.8" strokeDasharray="5 5" />
            <line x1="580" y1="0" x2="580" y2="650" stroke="#2060a0" strokeWidth="0.5" strokeDasharray="8 8" />
            <line x1="0" y1="350" x2="1200" y2="350" stroke="#2060a0" strokeWidth="0.5" strokeDasharray="8 8" />
            <text x="590" y="218" fill="#2060a0" fontSize="9" fontFamily="monospace" opacity="0.9">1 NM</text>
            <text x="590" y="96" fill="#2060a0" fontSize="9" fontFamily="monospace" opacity="0.9">2 NM</text>
          </g>

          {/* Terres émergées */}
          <path d="M 0 0 L 1200 0 L 1200 355 C 1090 365 960 348 855 308 C 758 268 728 196 658 188 C 596 180 568 228 518 228 C 468 228 428 177 338 177 C 258 177 198 238 118 240 C 58 242 0 278 0 278 Z" fill="url(#landMass)" stroke="#8aaa70" strokeWidth="1.5" />
          <path d="M 150 240 Q 200 220 260 235 Q 320 248 370 225 Q 430 200 480 220 Q 530 238 570 220 Q 610 200 650 210 Q 710 225 760 195 Q 820 165 880 200" fill="none" stroke="#90b070" strokeWidth="1" opacity="0.5"/>
          <path d="M 0 348 C 118 348 198 328 298 328 C 398 328 458 348 508 348 L 508 432 C 418 432 298 422 0 422 Z" fill="url(#landMass)" stroke="#8aaa70" strokeWidth="1.5" />
          <path d="M 642 348 L 1200 348 L 1200 432 L 642 432 Z" fill="url(#landMass)" stroke="#8aaa70" strokeWidth="1.5" />

          {/* Bassin portuaire */}
          <rect x="330" y="228" width="470" height="122" fill="url(#lagoonWater)" rx="4" opacity="0.9"/>

          {/* Quai TC1 */}
          <rect x="420" y="238" width="162" height="24" fill="url(#quaiGrad)" stroke="#00875A" strokeWidth="2" rx="2"/>
          {[430, 450, 470, 490, 510, 530, 550, 565].map(x => (
            <rect key={x} x={x} y="235" width="4" height="6" fill="#8090a0" rx="1" />
          ))}
          {[445, 490, 535].map((gx, gi) => (
            <g key={gi} transform={`translate(${gx}, 238)`}>
              <line x1="6" y1="0" x2="6" y2="-38" stroke="#4a7090" strokeWidth="3"/>
              <line x1="6" y1="-38" x2="26" y2="-38" stroke="#4a7090" strokeWidth="2.5"/>
              <line x1="26" y1="-38" x2="26" y2="-10" stroke="#4a7090" strokeWidth="2"/>
              <rect x="2" y="-50" width="8" height="10" fill="#3a5570" rx="1"/>
            </g>
          ))}

          {/* Quai TC2 */}
          <rect x="592" y="238" width="180" height="24" fill="url(#quaiGrad)" stroke="#005DAA" strokeWidth="2" rx="2"/>
          {[602, 622, 642, 662, 682, 702, 722, 742, 762].map(x => (
            <rect key={x} x={x} y="235" width="4" height="6" fill="#8090a0" rx="1" />
          ))}
          {[615, 660, 705, 750].map((gx, gi) => (
            <g key={gi} transform={`translate(${gx}, 238)`}>
              <line x1="6" y1="0" x2="6" y2="-42" stroke="#3d6090" strokeWidth="3"/>
              <line x1="6" y1="-42" x2="30" y2="-42" stroke="#3d6090" strokeWidth="2.5"/>
              <line x1="30" y1="-42" x2="30" y2="-10" stroke="#3d6090" strokeWidth="2"/>
              <rect x="2" y="-56" width="8" height="12" fill="#2a4560" rx="1"/>
            </g>
          ))}

          {/* Quai Ro-Ro */}
          <rect x="330" y="256" width="24" height="76" fill="url(#quaiGrad)" stroke="#10B981" strokeWidth="2" rx="2"/>
          <path d="M 330 290 L 358 310 L 330 310 Z" fill="#2a3f55" stroke="#10B981" strokeWidth="1" opacity="0.8"/>

          {/* Appontement Pétrolier */}
          <rect x="745" y="270" width="82" height="16" fill="url(#quaiGrad)" stroke="#0284C7" strokeWidth="1.5" rx="2" transform="rotate(-15 745 270)"/>

          {/* Chenal de Vridi */}
          <g>
            <rect x="508" y="340" width="132" height="100" fill="url(#lagoonWater)" opacity="0.8"/>
            <line x1="508" y1="340" x2="508" y2="445" stroke="#059669" strokeWidth="3.5" strokeDasharray="9 5"/>
            <line x1="640" y1="340" x2="640" y2="445" stroke="#DC2626" strokeWidth="3.5" strokeDasharray="9 5"/>
            <path d="M 498 408 L 508 448 L 482 460" fill="none" stroke="#5a7080" strokeWidth="5" strokeLinecap="round"/>
            <path d="M 652 408 L 640 448 L 666 460" fill="none" stroke="#5a7080" strokeWidth="5" strokeLinecap="round"/>
            <circle cx="482" cy="460" r="9" fill="#10B981" opacity="0.2" className="animate-ping"/>
            <circle cx="482" cy="460" r="4.5" fill="#10B981" filter="url(#glow)"/>
            <circle cx="666" cy="460" r="7" fill="#EF4444" opacity="0.15" className="animate-ping"/>
            <circle cx="666" cy="460" r="4.5" fill="#EF4444" filter="url(#glow)"/>
          </g>

          {/* Navires statiques */}
          <g transform="translate(430, 252)" filter="url(#shipShadow)">
            <path d="M 0 8 L 8 2 L 125 2 L 132 8 L 132 22 L 0 22 Z" fill="url(#hullBlue)" stroke="#1a4a7a" strokeWidth="1"/>
            <path d="M 2 18 L 130 18" stroke="#c0a020" strokeWidth="1.5" opacity="0.7"/>
            <rect x="10" y="-2" width="100" height="6" fill="#2a4060" stroke="#1a3050" strokeWidth="0.5" rx="1"/>
            {[10, 24, 38, 52, 66, 80, 94].map((cx, ci) => (
              <g key={ci}>
                <rect x={cx} y="-10" width="12" height="8" fill={['#b22222','#1a5fa0','#2a8040','#c07a10','#1a5fa0','#b22222','#2a8040'][ci]} stroke="#0a0a0a" strokeWidth="0.5" rx="0.5"/>
                <rect x={cx} y="-19" width="12" height="8" fill={['#2a8040','#c07a10','#b22222','#1a5fa0','#2a8040','#c07a10','#b22222'][ci]} stroke="#0a0a0a" strokeWidth="0.5" rx="0.5"/>
              </g>
            ))}
            <rect x="88" y="-24" width="32" height="22" fill="#283848" stroke="#3a5070" strokeWidth="1" rx="1"/>
          </g>

          <g transform="translate(745, 262) rotate(-15)" filter="url(#shipShadow)">
            <path d="M 0 7 L 7 2 L 110 2 L 118 7 L 118 20 L 0 20 Z" fill="url(#hullRed)" stroke="#6f1a1a" strokeWidth="1"/>
            <path d="M 2 16 L 116 16" stroke="#c0a020" strokeWidth="1.5" opacity="0.6"/>
            <rect x="8" y="-1" width="90" height="4" fill="#4a2020" stroke="#3a1515" strokeWidth="0.5" rx="1"/>
            <rect x="80" y="-18" width="28" height="20" fill="#3a1010" stroke="#5a2020" strokeWidth="1" rx="1"/>
          </g>

          <g transform="translate(338, 265) rotate(90)" filter="url(#shipShadow)">
            <path d="M 0 6 L 5 1 L 75 1 L 80 6 L 80 17 L 0 17 Z" fill="url(#hullGray)" stroke="#3a4a5a" strokeWidth="1"/>
            <path d="M 2 14 L 78 14" stroke="#8a8040" strokeWidth="1.2" opacity="0.6"/>
            <rect x="6" y="-2" width="62" height="4" fill="#2a3a4a" rx="1"/>
          </g>

          <g transform="translate(180, 510)" filter="url(#shipShadow)">
            <path d="M 0 6 L 9 1 L 90 1 L 96 6 L 96 18 L 0 18 Z" fill="url(#hullBlue)" stroke="#1a3a6a" strokeWidth="1"/>
            <rect x="60" y="-18" width="24" height="20" fill="#1a2535" stroke="#2a3545" strokeWidth="1" rx="1"/>
            <line x1="48" y1="18" x2="48" y2="35" stroke="#3a4a5a" strokeWidth="1.5" strokeDasharray="3 2"/>
            <circle cx="48" cy="35" r="3" fill="none" stroke="#3a4a5a" strokeWidth="1"/>
            <text x="0" y="52" fill="#38BDF8" fontSize="8" fontFamily="monospace" fontWeight="bold">EN RADE</text>
          </g>

          <g transform="translate(980, 540)" filter="url(#shipShadow)">
            <path d="M 0 5 L 7 1 L 75 1 L 80 5 L 80 15 L 0 15 Z" fill="url(#hullGray)" stroke="#3a4a5a" strokeWidth="1"/>
            <line x1="40" y1="15" x2="40" y2="28" stroke="#3a4a5a" strokeWidth="1.5" strokeDasharray="3 2"/>
            <text x="0" y="44" fill="#38BDF8" fontSize="8" fontFamily="monospace" fontWeight="bold">MOUILLAGE</text>
          </g>

          {/* Labels géographiques */}
          <g fontFamily="'Arial', sans-serif" fontWeight="bold">
            <text x="440" y="186" fill="#3a5a30" fontSize="12" letterSpacing="2">TREICHVILLE</text>
            <text x="758" y="190" fill="#3a5a30" fontSize="12" letterSpacing="1">PORT-BOUËT</text>
            <text x="175" y="290" fill="#3a5a30" fontSize="12" letterSpacing="1">ÎLE BOULAY</text>
            <text x="256" y="388" fill="#005a20" fontSize="12" letterSpacing="2" fontWeight="900">VRIDI TERMINAL</text>
            <text x="605" y="205" fill="#1a5090" fontSize="14" opacity="0.9" fontStyle="italic" fontFamily="Georgia, serif">Lagune Ébrié</text>
            <text x="575" y="395" fill="#1a5090" fontSize="10" opacity="0.9" fontStyle="italic" textAnchor="middle">Chenal de Vridi (-16m)</text>
            <text x="580" y="590" fill="#1a5090" fontSize="15" opacity="0.55" letterSpacing="2" textAnchor="middle">GOLFE DE GUINÉE  •  RADE EXTÉRIEURE</text>
            <text x="440" y="229" fill="#006040" fontSize="9" fontFamily="monospace" fontWeight="900">POSTE 11 (TC1)</text>
            <text x="612" y="229" fill="#004090" fontSize="9" fontFamily="monospace" fontWeight="900">POSTE 12 (TC2)</text>
            <text x="300" y="248" fill="#006040" fontSize="9" fontFamily="monospace">RO-RO / FRUITIER</text>

            <g transform="translate(580, 502)">
              <circle cx="0" cy="0" r="9" fill="#00875A" opacity="0.2" className="animate-ping"/>
              <circle cx="0" cy="0" r="4.5" fill="#00875A" filter="url(#glowGreen)"/>
              <text x="14" y="4" fill="#1a5090" fontSize="9" fontFamily="monospace" fontWeight="bold">BOUÉE D'ATTERRAGE (PAA)</text>
            </g>
          </g>

          <path d="M 580 502 L 575 342 L 570 238" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="7 5" opacity="0.4"/>
        </svg>

        {/* Overlays navires dynamiques */}
        {displayedEscales.map((escale, idx) => {
          const isDocked = escale.statut === 'EN_COURS';
          let posX = 0, posY = 0;
          if (isDocked) {
            posX = 42 + (idx * 3); posY = 35;
          } else {
            const angle = (idx * 45) + 15;
            const radius = 10 + (idx * 5);
            posX = 48 + Math.cos(angle * (Math.PI / 180)) * radius;
            posY = 76 + Math.sin(angle * (Math.PI / 180)) * (radius * 0.45);
          }
          const isSelected = selectedEscale?.id === escale.id;

          return (
            <div
              key={escale.id}
              style={{ left: `${posX}%`, top: `${posY}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-30 group cursor-pointer"
              onClick={() => handleSelectEscale(escale)}
              onMouseEnter={() => setHoveredEscale(escale)}
              onMouseLeave={() => setHoveredEscale(null)}
            >
              {/* Halo */}
              <div className={`absolute -inset-2 rounded-full opacity-50 animate-ping pointer-events-none ${isDocked ? 'bg-emerald-500' : 'bg-sky-500'}`} />

              {/* Icone navire — style Google Maps pin */}
              <div className={`relative flex flex-col items-center transition-transform duration-200 ${isSelected ? 'scale-130' : 'group-hover:scale-110'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg dark:shadow-black/50 border-2 ${
                  isSelected
                    ? 'bg-surface-canvas dark:bg-night-surface border-[#1a73e8] text-[#1a73e8] shadow-[0_4px_16px_rgba(26,115,232,0.5)]'
                    : isDocked
                    ? 'bg-[#002B49] text-emerald-400 border-[#00875A]'
                    : 'bg-[#002B49] text-sky-400 border-[#005DAA] dark:border-night-line'
                }`}>
                  <Ship className="w-4 h-4" />
                </div>
                {/* Pin tail */}
                <div className={`w-0.5 h-3 ${isSelected ? 'bg-[#1a73e8]' : isDocked ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                <div className={`w-2 h-1 rounded-full opacity-30 ${isSelected ? 'bg-[#1a73e8]' : isDocked ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                {/* Label */}
                <div className="absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-surface-canvas dark:bg-night-surface/95 border border-border-default dark:border-night-line px-2 py-0.5 rounded-full shadow-md text-2xs font-bold text-text-primary dark:text-night-ink pointer-events-none">
                  {escale.nomNavire}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════
          OVERLAY UI — STYLE GOOGLE MAPS
      ══════════════════════════════════════ */}

      {/* ── Barre de recherche + chips (haut gauche) ── */}
      <div className="absolute top-4 left-4 z-40 flex flex-col gap-2 w-80">
        {/* Searchbar */}
        <div className="flex items-center gap-2 bg-surface-canvas dark:bg-night-surface rounded-full shadow-lg dark:shadow-black/50 px-4 py-2.5 border border-white/60">
          <Search className="w-4 h-4 text-text-muted dark:text-night-ink-3 shrink-0" />
          <input
            type="text"
            placeholder="Rechercher un navire ou voyage…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 text-xs text-text-primary dark:text-night-ink bg-transparent outline-none placeholder:text-text-muted font-medium"
          />
          {searchQuery && (
            <button aria-label="Effacer la recherche" type="button" onClick={() => setSearchQuery('')} className="text-text-muted dark:text-night-ink-3 hover:text-text-secondary transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Chips de filtre */}
        <div className="flex items-center gap-1.5">
          {[
            { key: 'ALL', label: `Tous (${escales.length})`, dot: null },
            { key: 'A_QUAI', label: `À Quai (${dockedEscales.length})`, dot: 'bg-emerald-500' },
            { key: 'EN_RADE', label: `En Rade (${anchoredEscales.length})`, dot: 'bg-sky-500' },
          ].map(({ key, label, dot }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterMode(key as typeof filterMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-2xs font-bold shadow-md  transition-all cursor-pointer border ${
                filterMode === key
                  ? 'bg-[#1a73e8] text-white dark:text-night-ink border-[#1a73e8] shadow-blue-200'
                  : 'bg-surface-canvas dark:bg-night-surface text-text-secondary dark:text-night-ink border-white/60 hover:bg-surface-base '
              }`}
            >
              {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Panneau latéral escale sélectionnée (droite) ── */}
      <div className={`absolute top-0 right-0 h-full w-80 z-50 transition-transform duration-300 ease-out ${selectedEscale ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedEscale && (
          <div className="h-full bg-surface-canvas dark:bg-night-surface shadow-2xl dark:shadow-black/70 flex flex-col">
            {/* Header panneau */}
            <div className="bg-[#1a73e8] px-5 py-5 text-white dark:text-night-ink">
              <div className="flex items-center justify-between mb-3">
                <button aria-label="Fermer"
                  type="button"
                  onClick={() => setSelectedEscale(null)}
                  className="w-8 h-8 rounded-full bg-surface-canvas dark:bg-night-surface/20 flex items-center justify-center hover:bg-surface-canvas transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-black ${
                  selectedEscale.statut === 'EN_COURS'
                    ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-300/40'
                    : 'bg-sky-400/20 text-sky-100 border border-sky-300/40'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedEscale.statut === 'EN_COURS' ? 'bg-emerald-300' : 'bg-sky-300'}`} />
                  {selectedEscale.statut === 'EN_COURS' ? 'À QUAI' : 'EN RADE'}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-surface-canvas dark:bg-night-surface/20 flex items-center justify-center shrink-0">
                  <Ship className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base leading-tight">{selectedEscale.nomNavire}</h3>
                  <p className="text-2xs text-white dark:text-night-ink/70 font-mono mt-0.5">V.{selectedEscale.numeroVoyage}</p>
                </div>
              </div>
            </div>

            {/* Corps du panneau */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Carte mini-info */}
              <div className="rounded-md border border-border-default bg-surface-base dark:bg-night-sunken p-4 space-y-3">
                {[
                  { label: 'Poste attribué', value: selectedEscale.quai || 'Rade Extérieure', icon: <MapPin className="w-3.5 h-3.5" /> },
                  { label: 'Callsign / IMO', value: selectedEscale.callsign || 'N/A', icon: <Navigation className="w-3.5 h-3.5" /> },
                  { label: 'Date d\'arrivée', value: selectedEscale.dateArrivee, icon: <Clock className="w-3.5 h-3.5" /> },
                  { label: 'Date départ', value: selectedEscale.dateDepart || '—', icon: <Clock className="w-3.5 h-3.5" /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[#e8f0fe] flex items-center justify-center text-[#1a73e8] shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-2xs text-text-muted dark:text-night-ink-3 font-medium">{label}</div>
                      <div className="text-xs font-bold text-text-primary dark:text-night-ink truncate">{value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Route maritime */}
              <div className="rounded-md border border-border-default bg-surface-base dark:bg-night-sunken p-4">
                <div className="text-2xs font-bold text-text-muted dark:text-night-ink-3 uppercase tracking-wider mb-3">Route maritime</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-center">
                    <div className="w-8 h-8 rounded-full bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center mx-auto mb-1">
                      <Anchor className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-2xs font-bold text-text-secondary dark:text-night-ink truncate">{selectedEscale.portChargement?.split(' ')[0] || '—'}</div>
                    <div className="text-2xs text-text-muted dark:text-night-ink-3">Départ</div>
                  </div>
                  <div className="flex-1 flex items-center gap-1">
                    <div className="h-px flex-1 bg-zinc-200" />
                    <ChevronRight className="w-3.5 h-3.5 text-text-muted dark:text-night-ink-3 shrink-0" />
                    <div className="h-px flex-1 bg-zinc-200" />
                  </div>
                  <div className="flex-1 text-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-night-positive-soft text-emerald-600 dark:text-night-positive flex items-center justify-center mx-auto mb-1">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-2xs font-bold text-text-secondary dark:text-night-ink truncate">{selectedEscale.portDechargement?.split(' ')[0] || 'Abidjan'}</div>
                    <div className="text-2xs text-text-muted dark:text-night-ink-3">Arrivée</div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA footer */}
            <div className="p-4 border-t border-border-default">
              <button
                type="button"
                onClick={handleOpenDetails}
                className="w-full flex items-center justify-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white dark:text-night-ink font-black text-sm py-3 rounded-md transition-colors cursor-pointer shadow-lg dark:shadow-black/50 shadow-blue-200"
              >
                Ouvrir le dossier escale
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Contrôles de zoom (bas droite style Google Maps) ── */}
      <div className={`absolute bottom-14 z-40 flex flex-col rounded-md overflow-hidden shadow-lg dark:shadow-black/50 border border-border-default dark:border-night-line bg-surface-canvas dark:bg-night-surface transition-all ${selectedEscale ? 'right-84' : 'right-4'}`}>
        <button
          type="button"
          onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 1.6))}
          className="w-10 h-10 flex items-center justify-center text-text-secondary dark:text-night-ink hover:bg-surface-sunken dark:bg-night-sunken transition-colors border-b border-border-default dark:border-night-line cursor-pointer"
          title="Zoom avant"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.7))}
          className="w-10 h-10 flex items-center justify-center text-text-secondary dark:text-night-ink hover:bg-surface-sunken dark:bg-night-sunken transition-colors cursor-pointer"
          title="Zoom arrière"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* ── Compas (haut droite style Google Maps) ── */}
      <div className={`absolute top-4 z-40 flex flex-col items-center bg-surface-canvas dark:bg-night-surface/95 p-2.5 rounded-md border border-border-default dark:border-night-line text-slate-600 dark:text-night-ink font-mono text-2xs shadow-lg dark:shadow-black/50 transition-all ${selectedEscale ? 'right-84' : 'right-4'}`}>
        <div className="w-8 h-8 rounded-full border border-border-default dark:border-night-line flex items-center justify-center text-[#1a73e8] relative">
          <Compass className="w-4 h-4" />
          <span className="absolute -top-1 font-black text-2xs text-[#1a73e8]">N</span>
        </div>
        <span className="mt-1 font-bold text-text-secondary dark:text-night-ink text-2xs">05°15'N</span>
        <span className="text-text-muted dark:text-night-ink-3 text-2xs">04°00'W</span>
      </div>

      {/* ── Légende bottom-bar (bas gauche style Google Maps) ── */}
      <div className="absolute bottom-4 left-4 z-40 flex items-center gap-3 bg-surface-canvas dark:bg-night-surface/95 px-4 py-2 rounded-full border border-border-default dark:border-night-line shadow-md text-2xs font-mono">
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-night-positive font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Navire à Quai ({dockedEscales.length})
        </div>
        <div className="w-px h-3.5 bg-zinc-300" />
        <div className="flex items-center gap-1.5 text-sky-600 font-bold">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          En Rade / Mouillage ({anchoredEscales.length})
        </div>
        <div className="w-px h-3.5 bg-zinc-300" />
        <div className="flex items-center gap-1.5 text-[#1a5090] font-bold">
          <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
          Chenal Vridi (-16n)
        </div>
      </div>

      {/* ── Titre flottant (style Google Maps en haut) — masqué si panneau ouvert ── */}
      {!selectedEscale && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-surface-canvas dark:bg-night-surface/90 px-4 py-1.5 rounded-full border border-border-default dark:border-night-line shadow-md ">
            <span className="text-2xs font-bold text-text-secondary dark:text-night-ink tracking-wide">
              Port Autonome d'Abidjan · PAA · <span className="text-[#1a73e8]">CIABJ</span>
            </span>
          </div>
        </div>
      )}

    </div>
  );
};
