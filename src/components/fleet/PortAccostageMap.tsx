import React, { useState } from 'react';
import { Escale } from '../../types';
import { 
  Anchor, 
  Navigation, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Info, 
  Layers, 
  RefreshCw, 
  ZoomIn, 
  ZoomOut,
  Ship,
  Compass,
  MapPin,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface PortAccostageMapProps {
  escales: Escale[];
  onSelectEscale: (escale: Escale) => void;
}

interface QuayBerth {
  id: string;
  code: string;
  nom: string;
  longueur: string;
  tirantEau: string;
  type: 'CONTENEUR' | 'RO-RO' | 'FRUITIER' | 'VRAC' | 'PETROLIER';
  x: number;
  y: number;
  angle: number;
}

const QUAYS: QuayBerth[] = [
  { id: 'Q11', code: 'P.11', nom: 'TC1 - Terminal Conteneurs Vridi 1', longueur: '250m', tirantEau: '12.5m', type: 'CONTENEUR', x: 38, y: 36, angle: 0 },
  { id: 'Q12', code: 'P.12', nom: 'TC2 - Terminal Conteneurs Côte d’Ivoire', longueur: '350m', tirantEau: '16.0m', type: 'CONTENEUR', x: 49, y: 36, angle: 0 },
  { id: 'Q13', code: 'P.13', nom: 'Quai Nord Polyvalent & Vrac', longueur: '220m', tirantEau: '11.5m', type: 'VRAC', x: 60, y: 36, angle: 0 },
  { id: 'Q05', code: 'P.05', nom: 'Quai Ro-Ro Rive Ouest', longueur: '180m', tirantEau: '10.5m', type: 'RO-RO', x: 30, y: 46, angle: 90 },
  { id: 'Q06', code: 'P.06', nom: 'Quai Fruitier & Bananier', longueur: '190m', tirantEau: '10.0m', type: 'FRUITIER', x: 30, y: 55, angle: 90 },
  { id: 'Q08', code: 'P.08', nom: 'Appontement Pétrolier Vridi', longueur: '240m', tirantEau: '13.0m', type: 'PETROLIER', x: 70, y: 44, angle: -30 },
];

export const PortAccostageMap: React.FC<PortAccostageMapProps> = ({ escales, onSelectEscale }) => {
  const [selectedQuay, setSelectedQuay] = useState<QuayBerth | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'A_QUAI' | 'EN_RADE'>('ALL');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hoveredEscale, setHoveredEscale] = useState<Escale | null>(null);

  const dockedEscales = escales.filter(e => e.statut === 'EN_COURS');
  const anchoredEscales = escales.filter(e => e.statut === 'CLOTUREE');

  const displayedEscales = escales.filter(e => {
    if (filterMode === 'A_QUAI') return e.statut === 'EN_COURS';
    if (filterMode === 'EN_RADE') return e.statut === 'CLOTUREE';
    return true;
  });

  return (
    <div className="bg-white text-slate-800 rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden flex flex-col relative animate-fade-in font-sans">
      
      {/* ─── 1. BARRE DE CONTRÔLE AIS & INFOS PORTUAIRES ─── */}
      <div className="bg-white/98 backdrop-blur-md px-6 sm:px-8 py-4 border-b border-zinc-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 z-20">
        
        {/* Titre & Identification */}
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#005DAA]/10 border border-[#005DAA]/30 flex items-center justify-center shrink-0 shadow-xs">
            <Navigation className="w-5 h-5 text-[#005DAA]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-base sm:text-lg text-zinc-900 font-display tracking-tight flex items-center gap-2">
                <span className="text-zinc-900">Carte des Quais d'Accostage &amp; Bassins Portuaires</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-[#F0F7FF] text-[#005DAA] border border-[#005DAA]/30 tracking-wider">
                Port Autonome d'Abidjan (PAA)
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Positionnement réel des postes à quai (TC1, TC2, Ro-Ro) &amp; Rade Extérieure
            </p>
          </div>
        </div>

        {/* Filtres d'affichage & Outils radar */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterMode === 'ALL' ? 'bg-[#005DAA] text-white font-black shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tous ({escales.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('A_QUAI')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'A_QUAI' ? 'bg-[#00875A] text-white font-black shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>À Quai ({dockedEscales.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('EN_RADE')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'EN_RADE' ? 'bg-sky-600 text-white font-black shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>En Rade ({anchoredEscales.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 1.45))}
              className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
              title="Zoom avant"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="px-2 h-7 rounded-lg text-[10px] font-mono text-slate-500 hover:text-slate-900 hover:bg-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
              title="Réinitialiser le zoom"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.85))}
              className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
              title="Zoom arrière"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

      {/* ─── 2. CARTE MARITIME VECTORIELLE HAUTE PRÉCISION ─── */}
      <div className="relative w-full h-[520px] bg-[#ddeef8] overflow-hidden select-none">
        
        <div 
          className="absolute inset-0 w-full h-full transition-transform duration-300 origin-center"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {/* SVG Cartographie Lagune Ébrié / Canal de Vridi / Port d'Abidjan — Ultra Réaliste */}
          <svg
            className="w-full h-full"
            viewBox="0 0 1200 650"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Eau — bleu azur clair */}
              <linearGradient id="oceanWater" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#aad4f0" />
                <stop offset="60%" stopColor="#89c4e8" />
                <stop offset="100%" stopColor="#6ab4e0" />
              </linearGradient>
              {/* Lagune — bleu légèrement plus foncé */}
              <linearGradient id="lagoonWater" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7ab8e0" />
                <stop offset="100%" stopColor="#5aaad8" />
              </linearGradient>
              {/* Terres — vert olive clair style carte */}
              <linearGradient id="landMass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c8d8a8" />
                <stop offset="100%" stopColor="#b0c890" />
              </linearGradient>
              {/* Quai béton clair */}
              <linearGradient id="quaiGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#b0b8c8" />
                <stop offset="100%" stopColor="#c8d0dc" />
              </linearGradient>
              {/* Coque navire porte-conteneurs */}
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
              <linearGradient id="deckGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a6080" />
                <stop offset="100%" stopColor="#2c3f55" />
              </linearGradient>
              {/* Reflet eau clair */}
              <radialGradient id="waterShine" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#aad4f0" stopOpacity="0" />
              </radialGradient>
              {/* Grille AIS claire */}
              <pattern id="radarGrid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#6090c0" strokeWidth="0.4" strokeOpacity="0.3" />
              </pattern>
              {/* Vague pattern clair */}
              <pattern id="wavePattern" width="120" height="12" patternUnits="userSpaceOnUse">
                <path d="M0 6 Q15 2 30 6 Q45 10 60 6 Q75 2 90 6 Q105 10 120 6" fill="none" stroke="#4a90c0" strokeWidth="1" opacity="0.25"/>
              </pattern>
              {/* Filtre lumineux */}
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

            {/* ═══ FOND MARIN ═══ */}
            <rect width="1200" height="650" fill="url(#oceanWater)" />
            <rect width="1200" height="650" fill="url(#radarGrid)" />

            {/* Reflet lumineux sur l'eau */}
            <ellipse cx="580" cy="390" rx="480" ry="180" fill="url(#waterShine)" />

            {/* Vagues stylisées sur l'eau */}
            <rect x="0" y="430" width="1200" height="220" fill="url(#wavePattern)" opacity="0.6" />
            <rect x="0" y="470" width="1200" height="120" fill="url(#wavePattern)" opacity="0.3" />

            {/* ═══ GRILLE AIS claire ═══ */}
            <g opacity="0.5">
              <circle cx="580" cy="350" r="130" fill="none" stroke="#2060a0" strokeWidth="0.8" strokeDasharray="5 5" />
              <circle cx="580" cy="350" r="250" fill="none" stroke="#2060a0" strokeWidth="0.8" strokeDasharray="5 5" />
              <circle cx="580" cy="350" r="390" fill="none" stroke="#2060a0" strokeWidth="0.8" strokeDasharray="5 5" />
              <line x1="580" y1="0" x2="580" y2="650" stroke="#2060a0" strokeWidth="0.5" strokeDasharray="8 8" />
              <line x1="0" y1="350" x2="1200" y2="350" stroke="#2060a0" strokeWidth="0.5" strokeDasharray="8 8" />
              <text x="590" y="218" fill="#2060a0" fontSize="9" fontFamily="monospace" opacity="0.9">1 NM</text>
              <text x="590" y="96" fill="#2060a0" fontSize="9" fontFamily="monospace" opacity="0.9">2 NM</text>
            </g>

            {/* ═══ TERRES ÉMERGÉES ═══ */}
            {/* Côte Nord — Abidjan, Treichville, Marcory */}
            <path
              d="M 0 0 L 1200 0 L 1200 355 C 1090 365 960 348 855 308 C 758 268 728 196 658 188 C 596 180 568 228 518 228 C 468 228 428 177 338 177 C 258 177 198 238 118 240 C 58 242 0 278 0 278 Z"
              fill="url(#landMass)" stroke="#8aaa70" strokeWidth="1.5"
            />
            {/* Relief léger sur la côte Nord */}
            <path d="M 150 240 Q 200 220 260 235 Q 320 248 370 225 Q 430 200 480 220 Q 530 238 570 220 Q 610 200 650 210 Q 710 225 760 195 Q 820 165 880 200" fill="none" stroke="#90b070" strokeWidth="1" opacity="0.5"/>

            {/* Presqu'île de Vridi & cordon littoral Sud */}
            <path
              d="M 0 348 C 118 348 198 328 298 328 C 398 328 458 348 508 348 L 508 432 C 418 432 298 422 0 422 Z"
              fill="url(#landMass)" stroke="#8aaa70" strokeWidth="1.5"
            />
            {/* Cordon Littoral Est — Port-Bouët */}
            <path
              d="M 642 348 L 1200 348 L 1200 432 L 642 432 Z"
              fill="url(#landMass)" stroke="#8aaa70" strokeWidth="1.5"
            />

            {/* ═══ BASSIN PORTUAIRE & LAGUNE ═══ */}
            {/* Plan d'eau bassin intérieur */}
            <rect x="330" y="228" width="470" height="122" fill="url(#lagoonWater)" rx="4" opacity="0.9"/>

            {/* ─── QUAIS & INFRASTRUCTURE ─── */}
            {/* Quai TC1 - Poste 11 */}
            <rect x="420" y="238" width="162" height="24" fill="url(#quaiGrad)" stroke="#00875A" strokeWidth="2" rx="2"/>
            {/* Lignes de bollards TC1 */}
            {[430, 450, 470, 490, 510, 530, 550, 565].map(x => (
              <rect key={x} x={x} y="235" width="4" height="6" fill="#8090a0" rx="1" />
            ))}
            {/* Grues TC1 */}
            {[445, 490, 535].map((gx, gi) => (
              <g key={gi} transform={`translate(${gx}, 238)`}>
                <line x1="6" y1="0" x2="6" y2="-38" stroke="#4a7090" strokeWidth="3"/>
                <line x1="6" y1="-38" x2="26" y2="-38" stroke="#4a7090" strokeWidth="2.5"/>
                <line x1="26" y1="-38" x2="26" y2="-10" stroke="#4a7090" strokeWidth="2"/>
                <line x1="26" y1="-22" x2="26" y2="-18" stroke="#e0a020" strokeWidth="1.5" strokeDasharray="2 2"/>
                <rect x="2" y="-50" width="8" height="10" fill="#3a5570" rx="1"/>
              </g>
            ))}

            {/* Quai TC2 - Poste 12 */}
            <rect x="592" y="238" width="180" height="24" fill="url(#quaiGrad)" stroke="#005DAA" strokeWidth="2" rx="2"/>
            {[602, 622, 642, 662, 682, 702, 722, 742, 762].map(x => (
              <rect key={x} x={x} y="235" width="4" height="6" fill="#8090a0" rx="1" />
            ))}
            {/* Grues TC2 */}
            {[615, 660, 705, 750].map((gx, gi) => (
              <g key={gi} transform={`translate(${gx}, 238)`}>
                <line x1="6" y1="0" x2="6" y2="-42" stroke="#3d6090" strokeWidth="3"/>
                <line x1="6" y1="-42" x2="30" y2="-42" stroke="#3d6090" strokeWidth="2.5"/>
                <line x1="30" y1="-42" x2="30" y2="-10" stroke="#3d6090" strokeWidth="2"/>
                <line x1="30" y1="-24" x2="30" y2="-19" stroke="#e0a020" strokeWidth="1.5" strokeDasharray="2 2"/>
                <rect x="2" y="-56" width="8" height="12" fill="#2a4560" rx="1"/>
              </g>
            ))}

            {/* Quai Ro-Ro / Fruitier (rive Ouest) */}
            <rect x="330" y="256" width="24" height="76" fill="url(#quaiGrad)" stroke="#10B981" strokeWidth="2" rx="2"/>
            {[266, 282, 298, 314, 320].map(y => (
              <rect key={y} x="327" y={y} width="6" height="3" fill="#4a6580" rx="1" />
            ))}
            {/* Rampe Ro-Ro */}
            <path d="M 330 290 L 358 310 L 330 310 Z" fill="#2a3f55" stroke="#10B981" strokeWidth="1" opacity="0.8"/>

            {/* Appontement Pétrolier P.08 */}
            <rect x="745" y="270" width="82" height="16" fill="url(#quaiGrad)" stroke="#0284C7" strokeWidth="1.5" rx="2" transform="rotate(-15 745 270)"/>

            {/* ═══ CHENAL DE VRIDI ═══ */}
            <g>
              <rect x="508" y="340" width="132" height="100" fill="url(#lagoonWater)" opacity="0.8"/>
              {/* Balisage chenal */}
              <line x1="508" y1="340" x2="508" y2="445" stroke="#059669" strokeWidth="3.5" strokeDasharray="9 5"/>
              <line x1="640" y1="340" x2="640" y2="445" stroke="#DC2626" strokeWidth="3.5" strokeDasharray="9 5"/>
              {/* Reflets sur le chenal */}
              <path d="M 520 360 Q 535 355 550 360 Q 565 365 580 360" fill="none" stroke="#1a4a8a" strokeWidth="1" opacity="0.5"/>
              <path d="M 520 380 Q 540 375 560 380 Q 580 385 600 380" fill="none" stroke="#1a4a8a" strokeWidth="1" opacity="0.4"/>
              {/* Digues */}
              <path d="M 498 408 L 508 448 L 482 460" fill="none" stroke="#5a7080" strokeWidth="5" strokeLinecap="round"/>
              <path d="M 652 408 L 640 448 L 666 460" fill="none" stroke="#5a7080" strokeWidth="5" strokeLinecap="round"/>
              {/* Feux lumineux animés */}
              <circle cx="482" cy="460" r="7" fill="#10B981" opacity="0.15" filter="url(#glowGreen)" className="animate-ping"/>
              <circle cx="482" cy="460" r="4.5" fill="#10B981" filter="url(#glow)"/>
              <circle cx="666" cy="460" r="7" fill="#EF4444" opacity="0.15" className="animate-ping"/>
              <circle cx="666" cy="460" r="4.5" fill="#EF4444" filter="url(#glow)"/>
            </g>

            {/* ═══ PORTE-CONTENEURS À QUAI TC1 (navire 1) ═══ */}
            {/* Coque — amarré au quai TC1, horizontal */}
            <g transform="translate(430, 252)" filter="url(#shipShadow)">
              {/* Coque principale */}
              <path d="M 0 8 L 8 2 L 125 2 L 132 8 L 132 22 L 0 22 Z" fill="url(#hullBlue)" stroke="#1a4a7a" strokeWidth="1"/>
              {/* Liseré de flottaison */}
              <path d="M 2 18 L 130 18" stroke="#c0a020" strokeWidth="1.5" opacity="0.7"/>
              {/* Pont avec conteneurs empilés */}
              <rect x="10" y="-2" width="100" height="6" fill="#2a4060" stroke="#1a3050" strokeWidth="0.5" rx="1"/>
              {/* Rangée de conteneurs */}
              {[10, 24, 38, 52, 66, 80, 94].map((cx, ci) => (
                <g key={ci}>
                  <rect x={cx} y="-10" width="12" height="8" fill={['#b22222','#1a5fa0','#2a8040','#c07a10','#1a5fa0','#b22222','#2a8040'][ci]} stroke="#0a0a0a" strokeWidth="0.5" rx="0.5"/>
                  <rect x={cx} y="-19" width="12" height="8" fill={['#2a8040','#c07a10','#b22222','#1a5fa0','#2a8040','#c07a10','#b22222'][ci]} stroke="#0a0a0a" strokeWidth="0.5" rx="0.5"/>
                </g>
              ))}
              {/* Superstructure / passerelle */}
              <rect x="88" y="-24" width="32" height="22" fill="#283848" stroke="#3a5070" strokeWidth="1" rx="1"/>
              <rect x="90" y="-20" width="6" height="4" fill="#1a6080" opacity="0.8"/>
              <rect x="98" y="-20" width="6" height="4" fill="#1a6080" opacity="0.8"/>
              {/* Mât avant */}
              <line x1="20" y1="2" x2="20" y2="-32" stroke="#3a5070" strokeWidth="1.5"/>
              <line x1="12" y1="-28" x2="28" y2="-28" stroke="#3a5070" strokeWidth="1"/>
              {/* Cheminée */}
              <rect x="106" y="-36" width="8" height="16" fill="#1e2a38" stroke="#2a3a4a" strokeWidth="0.8" rx="1"/>
              <ellipse cx="110" cy="-36" rx="4" ry="2" fill="#2a3a4a"/>
              {/* Fumée légère */}
              <ellipse cx="110" cy="-44" rx="3" ry="2" fill="#3a4a5a" opacity="0.4"/>
              {/* Câbles d'amarrage */}
              <line x1="8" y1="8" x2="-8" y2="22" stroke="#8a9aaa" strokeWidth="0.8" opacity="0.7" strokeDasharray="3 2"/>
              <line x1="124" y1="8" x2="140" y2="22" stroke="#8a9aaa" strokeWidth="0.8" opacity="0.7" strokeDasharray="3 2"/>
              {/* Reflet sur l'eau */}
              <path d="M 5 22 Q 66 30 128 22" fill="none" stroke="#1a4a8a" strokeWidth="1" opacity="0.4"/>
            </g>

            {/* ═══ NAVIRE PÉTROLIER À QUAI P.08 ═══ */}
            <g transform="translate(745, 262) rotate(-15)" filter="url(#shipShadow)">
              {/* Coque tanker — plus longue et plus large */}
              <path d="M 0 7 L 7 2 L 110 2 L 118 7 L 118 20 L 0 20 Z" fill="url(#hullRed)" stroke="#6f1a1a" strokeWidth="1"/>
              <path d="M 2 16 L 116 16" stroke="#c0a020" strokeWidth="1.5" opacity="0.6"/>
              {/* Pont tanker (lisse, peu de structures) */}
              <rect x="8" y="-1" width="90" height="4" fill="#4a2020" stroke="#3a1515" strokeWidth="0.5" rx="1"/>
              {/* Tuyauteries sur pont */}
              <line x1="15" y1="0" x2="90" y2="0" stroke="#8a5030" strokeWidth="1.5" opacity="0.8"/>
              <line x1="15" y1="-2" x2="90" y2="-2" stroke="#8a5030" strokeWidth="1" opacity="0.5"/>
              {[20,35,50,65,80].map(tx => (
                <rect key={tx} x={tx} y="-4" width="4" height="4" fill="#6a3020" rx="0.5" />
              ))}
              {/* Superstructure arrière */}
              <rect x="80" y="-18" width="28" height="20" fill="#3a1010" stroke="#5a2020" strokeWidth="1" rx="1"/>
              <rect x="82" y="-14" width="5" height="3" fill="#2a4060" opacity="0.9"/>
              <rect x="90" y="-14" width="5" height="3" fill="#2a4060" opacity="0.9"/>
              {/* Cheminée rouge */}
              <rect x="94" y="-28" width="7" height="12" fill="#8a1010" stroke="#6a0a0a" strokeWidth="0.8" rx="1"/>
              <ellipse cx="97" cy="-28" rx="3.5" ry="1.5" fill="#6a0a0a"/>
              {/* Mât */}
              <line x1="16" y1="2" x2="16" y2="-28" stroke="#6a3a3a" strokeWidth="1.5"/>
            </g>

            {/* ═══ PETIT NAVIRE RO-RO RIVE OUEST ═══ */}
            <g transform="translate(338, 265) rotate(90)" filter="url(#shipShadow)">
              {/* Coque Ro-Ro verticale */}
              <path d="M 0 6 L 5 1 L 75 1 L 80 6 L 80 17 L 0 17 Z" fill="url(#hullGray)" stroke="#3a4a5a" strokeWidth="1"/>
              <path d="M 2 14 L 78 14" stroke="#8a8040" strokeWidth="1.2" opacity="0.6"/>
              {/* Tablier (rampe Ro-Ro) */}
              <path d="M 0 8 L -10 14 L 0 14 Z" fill="#3a4a5a" stroke="#4a5a6a" strokeWidth="0.8"/>
              {/* Pont — niveau chargement */}
              <rect x="6" y="-2" width="62" height="4" fill="#2a3a4a" rx="1"/>
              {/* Véhicules chargés (symboliques) */}
              {[10, 24, 38, 52].map((vx, vi) => (
                <rect key={vi} x={vx} y="-6" width="10" height="5" fill={['#a03020','#206030','#203060','#8a7020'][vi]} rx="1" stroke="#1a2030" strokeWidth="0.5"/>
              ))}
              {/* Superstructure */}
              <rect x="54" y="-16" width="20" height="16" fill="#2a3040" stroke="#3a4050" strokeWidth="1" rx="1"/>
              <rect x="56" y="-12" width="4" height="3" fill="#1a4060" opacity="0.9"/>
              <line x1="64" y1="1" x2="64" y2="-24" stroke="#3a4a5a" strokeWidth="1.5"/>
              <rect x="60" y="-26" width="8" height="6" fill="#1e2a36" rx="1"/>
            </g>

            {/* ═══ NAVIRE EN RADE (ancré au large) ═══ */}
            {/* Cargo polyvalent au mouillage dans la rade */}
            <g transform="translate(180, 510)" filter="url(#shipShadow)">
              <path d="M 0 6 L 9 1 L 90 1 L 96 6 L 96 18 L 0 18 Z" fill="url(#hullBlue)" stroke="#1a3a6a" strokeWidth="1"/>
              <path d="M 3 15 L 93 15" stroke="#c0a020" strokeWidth="1.2" opacity="0.6"/>
              {/* Superstructures */}
              <rect x="8" y="-1" width="70" height="5" fill="#1a2a3a" rx="1"/>
              <rect x="60" y="-18" width="24" height="20" fill="#1a2535" stroke="#2a3545" strokeWidth="1" rx="1"/>
              <rect x="62" y="-14" width="5" height="3" fill="#1a5070" opacity="0.9"/>
              <rect x="70" y="-14" width="5" height="3" fill="#1a5070" opacity="0.9"/>
              <line x1="14" y1="1" x2="14" y2="-30" stroke="#2a3545" strokeWidth="1.5"/>
              <line x1="8" y1="-26" x2="20" y2="-26" stroke="#2a3545" strokeWidth="1"/>
              <rect x="72" y="-30" width="6" height="14" fill="#151f2a" rx="1"/>
              {/* Ancre (symbolique) */}
              <line x1="48" y1="18" x2="48" y2="35" stroke="#3a4a5a" strokeWidth="1.5" strokeDasharray="3 2"/>
              <circle cx="48" cy="35" r="3" fill="none" stroke="#3a4a5a" strokeWidth="1"/>
              <text x="0" y="52" fill="#38BDF8" fontSize="8" fontFamily="monospace" fontWeight="bold">EN RADE</text>
              {/* Sillage */}
              <path d="M -15 12 Q 0 8 0 12" fill="none" stroke="#0f3060" strokeWidth="2" opacity="0.6"/>
              <path d="M -22 15 Q 0 10 0 15" fill="none" stroke="#0f3060" strokeWidth="1.5" opacity="0.35"/>
            </g>

            {/* Second navire en rade (plus petit) */}
            <g transform="translate(980, 540)" filter="url(#shipShadow)">
              <path d="M 0 5 L 7 1 L 75 1 L 80 5 L 80 15 L 0 15 Z" fill="url(#hullGray)" stroke="#3a4a5a" strokeWidth="1"/>
              <path d="M 2 12 L 78 12" stroke="#8a8040" strokeWidth="1.1" opacity="0.6"/>
              <rect x="8" y="-1" width="56" height="4" fill="#1e2a36" rx="1"/>
              {[12, 25, 38, 50].map((cx, ci) => (
                <rect key={ci} x={cx} y="-7" width="10" height="7" fill={['#8a2020','#204080','#206040','#906010'][ci]} stroke="#0a0a0a" strokeWidth="0.5" rx="0.5"/>
              ))}
              <rect x="52" y="-15" width="20" height="16" fill="#1a2030" stroke="#2a3040" strokeWidth="1" rx="1"/>
              <rect x="54" y="-11" width="4" height="3" fill="#1a4060" opacity="0.8"/>
              <line x1="12" y1="1" x2="12" y2="-26" stroke="#2a3a4a" strokeWidth="1.5"/>
              <line x1="6" y1="-22" x2="18" y2="-22" stroke="#2a3a4a" strokeWidth="1"/>
              {/* Ancre */}
              <line x1="40" y1="15" x2="40" y2="28" stroke="#3a4a5a" strokeWidth="1.5" strokeDasharray="3 2"/>
              <circle cx="40" cy="28" r="2.5" fill="none" stroke="#3a4a5a" strokeWidth="1"/>
              <text x="0" y="44" fill="#38BDF8" fontSize="8" fontFamily="monospace" fontWeight="bold">MOUILLAGE</text>
            </g>

            {/* ═══ REMORQUEUR PORTUAIRE ═══ */}
            <g transform="translate(560, 355)">
              <path d="M 0 4 L 4 0 L 32 0 L 36 4 L 36 12 L 0 12 Z" fill="#1a3a6a" stroke="#2a5a9a" strokeWidth="0.8"/>
              <path d="M 2 10 L 34 10" stroke="#c07010" strokeWidth="1" opacity="0.7"/>
              <rect x="18" y="-8" width="12" height="10" fill="#0f1e2a" stroke="#1a3040" strokeWidth="0.7" rx="1"/>
              <rect x="19" y="-6" width="3" height="2" fill="#1a6080" opacity="0.9"/>
              <line x1="6" y1="0" x2="6" y2="-12" stroke="#1a3a5a" strokeWidth="1.2"/>
              <rect x="2" y="-14" width="5" height="4" fill="#0f1a26" rx="0.5"/>
            </g>

            {/* ═══ TEXTES & LABELS GÉOGRAPHIQUES ═══ */}
            <g fontFamily="'Arial', sans-serif" fontWeight="bold">
              {/* Régions */}
              <text x="440" y="186" fill="#3a5a30" fontSize="12" letterSpacing="2">TREICHVILLE</text>
              <text x="758" y="190" fill="#3a5a30" fontSize="12" letterSpacing="1">PORT-BOUËT</text>
              <text x="175" y="290" fill="#3a5a30" fontSize="12" letterSpacing="1">ÎLE BOULAY</text>
              <text x="256" y="388" fill="#005a20" fontSize="12" letterSpacing="2" fontWeight="900">VRIDI TERMINAL</text>

              {/* Plans d'eau */}
              <text x="605" y="205" fill="#1a5090" fontSize="14" opacity="0.9" fontStyle="italic" fontFamily="Georgia, serif">Lagune Ébrié</text>
              <text x="575" y="395" fill="#1a5090" fontSize="10" opacity="0.9" fontStyle="italic" textAnchor="middle">Chenal de Vridi (-16m)</text>
              <text x="580" y="590" fill="#1a5090" fontSize="15" opacity="0.55" letterSpacing="2" textAnchor="middle">GOLFE DE GUINÉE  •  RADE EXTÉRIEURE</text>

              {/* Labels de quais */}
              <text x="440" y="229" fill="#006040" fontSize="9" fontFamily="monospace" fontWeight="900">POSTE 11 (TC1)</text>
              <text x="612" y="229" fill="#004090" fontSize="9" fontFamily="monospace" fontWeight="900">POSTE 12 (TC2)</text>
              <text x="300" y="248" fill="#006040" fontSize="9" fontFamily="monospace">RO-RO / FRUITIER</text>
              <text x="762" y="258" fill="#004090" fontSize="9" fontFamily="monospace">PÉTROLIER P.08</text>

              {/* Bouée d'atterrage */}
              <g transform="translate(580, 502)">
                <circle cx="0" cy="0" r="9" fill="#00875A" opacity="0.2" className="animate-ping"/>
                <circle cx="0" cy="0" r="5" fill="#00875A" filter="url(#glowGreen)"/>
                <text x="14" y="4" fill="#1a5090" fontSize="9" fontFamily="monospace" fontWeight="bold">BOUÉE D'ATTERRAGE (PAA)</text>
              </g>
            </g>

            {/* ═══ LIGNE D'ALIGNEMENT MARITIME ═══ */}
            <path d="M 580 502 L 575 342 L 570 238" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="7 5" opacity="0.4"/>

            {/* ═══ SILLAGES SUR L'EAU (effet réaliste) ═══ */}
            <g opacity="0.3">
              <path d="M 490 310 Q 510 305 530 310" fill="none" stroke="#38BDF8" strokeWidth="1.5"/>
              <path d="M 480 318 Q 510 312 540 318" fill="none" stroke="#38BDF8" strokeWidth="1"/>
              <path d="M 200 520 Q 230 514 260 520" fill="none" stroke="#38BDF8" strokeWidth="1.2"/>
              <path d="M 190 527 Q 225 520 260 527" fill="none" stroke="#38BDF8" strokeWidth="0.8"/>
              <path d="M 985 550 Q 1010 544 1040 550" fill="none" stroke="#38BDF8" strokeWidth="1.2"/>
              <path d="M 978 557 Q 1010 550 1042 557" fill="none" stroke="#38BDF8" strokeWidth="0.8"/>
            </g>
          </svg>

          {/* ─── 3. OVERLAYS INTERACTIFS : NAVIRES (ESCALES) ─── */}
          {displayedEscales.map((escale, idx) => {
            const isDocked = escale.statut === 'EN_COURS';
            
            // Calcul des coordonnées d'amarrage ou de mouillage
            let posX = 0;
            let posY = 0;
            let heading = 0;

            if (isDocked) {
              // Navire à quai à Vridi (Poste 11 ou 12 ou Ro-Ro)
              if (idx % 3 === 0) {
                posX = 42 + (idx * 3);
                posY = 35;
                heading = 90;
              } else if (idx % 3 === 1) {
                posX = 54 + (idx * 2.5);
                posY = 35;
                heading = 90;
              } else {
                posX = 29;
                posY = 43 + (idx * 4);
                heading = 0;
              }
            } else {
              // Navire en rade extérieure (au mouillage)
              const angle = (idx * 45) + 15;
              const radius = 10 + (idx * 5);
              posX = 48 + Math.cos(angle * (Math.PI / 180)) * radius;
              posY = 76 + Math.sin(angle * (Math.PI / 180)) * (radius * 0.45);
              heading = (idx * 60) % 360;
            }

            return (
              <div
                key={escale.id}
                style={{ left: `${posX}%`, top: `${posY}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-30 group cursor-pointer"
                onClick={() => onSelectEscale(escale)}
                onMouseEnter={() => setHoveredEscale(escale)}
                onMouseLeave={() => setHoveredEscale(null)}
              >
                {/* Halo pulsant */}
                <div 
                  className={`absolute -inset-2 rounded-full opacity-60 animate-ping pointer-events-none ${
                    isDocked ? 'bg-emerald-500' : 'bg-sky-500'
                  }`} 
                />

                {/* Vaisseau Icone & Flèche de cap */}
                <div className="relative flex items-center justify-center">
                  <div 
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg border transition-all duration-200 group-hover:scale-125 ${
                      isDocked 
                        ? 'bg-[#002B49] text-emerald-400 border-[#00875A] shadow-emerald-950/50' 
                        : 'bg-[#002B49] text-sky-400 border-[#005DAA] shadow-blue-950/50'
                    }`}
                  >
                    <Ship className="w-5 h-5" />
                  </div>

                  {/* Badge Navire Nom */}
                  <div className="absolute top-full mt-1.5 whitespace-nowrap bg-slate-950/90 border border-slate-700 px-2 py-0.5 rounded-md shadow-md text-[10px] font-black font-mono text-white pointer-events-none">
                    {escale.nomNavire}
                  </div>
                </div>

                {/* Tooltip Haute Définition au Survol */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block w-72 bg-[#0B132B] border border-slate-700 text-white p-4 rounded-2xl shadow-2xl z-50 pointer-events-none animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${isDocked ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400'}`} />
                      <span className="font-black text-sm text-white font-display">{escale.nomNavire}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#00875A]">V.{escale.numeroVoyage}</span>
                  </div>

                  <div className="mt-2.5 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Callsign / IMO:</span>
                      <strong className="text-slate-200 font-mono">{escale.callsign || 'N/A'}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Statut AIS:</span>
                      <strong className={isDocked ? 'text-emerald-400 font-black' : 'text-sky-400 font-black'}>
                        {isDocked ? 'À QUAI (EN OPÉRATION)' : 'AU MOUILLAGE (RADE)'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Poste Attribué:</span>
                      <strong className="text-cyan-300 font-mono">{escale.quai || (isDocked ? 'Poste 12 - TC2' : 'Rade Extérieure')}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Route Maritime:</span>
                      <strong className="text-slate-200">{escale.portChargement?.split(' ')[0]} → {escale.portDechargement?.split(' ')[0]}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>ETA / Arrivée:</span>
                      <strong className="text-slate-200 font-mono">{escale.dateArrivee}</strong>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-[#38BDF8] font-bold">
                    <span>Cliquer pour ouvrir l'escale</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>

              </div>
            );
          })}

        </div>

        {/* ─── 4. LÉGENDE NAUTIQUE & COMPAS FLOTTANT ─── */}
        <div className="absolute bottom-4 left-6 z-20 hidden sm:flex items-center gap-4 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-zinc-300 shadow-sm text-xs font-mono">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>Navire à Quai ({dockedEscales.length})</span>
          </div>
          <div className="w-px h-4 bg-zinc-300" />
          <div className="flex items-center gap-2 text-sky-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span>En Rade / Mouillage ({anchoredEscales.length})</span>
          </div>
          <div className="w-px h-4 bg-zinc-300" />
          <div className="flex items-center gap-2 text-[#1a5090] font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
            <span>Chenal Vridi (-16m)</span>
          </div>
        </div>

        {/* Compas Nautique */}
        <div className="absolute top-4 right-6 z-20 flex flex-col items-center bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-zinc-300 text-slate-600 font-mono text-[10px] shadow-md">
          <div className="w-9 h-9 rounded-full border border-zinc-300 flex items-center justify-center text-[#00875A] relative">
            <Compass className="w-5 h-5 animate-spin-slow" />
            <span className="absolute -top-1 font-black text-[9px] text-[#00875A]">N</span>
          </div>
          <span className="mt-1 font-bold text-slate-700">05°15'N</span>
          <span className="text-slate-600">04°00'W</span>
        </div>

      </div>

    </div>
  );
};
