import React, { useState } from 'react';
import { Escale } from '../../types';
import { Anchor, Navigation, ShieldAlert, CheckCircle2, Clock, Info, Layers, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

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
  angle: number; // in degrees for quay alignment
  escaleId?: number; // assigned ship if docked
}

const BASE_QUAYS: Omit<QuayBerth, 'escaleId'>[] = [
  { id: 'Q01', code: 'Poste 11', nom: 'Terminal Conteneurs Vridi TC1', longueur: '250m', tirantEau: '12.5m', type: 'CONTENEUR', x: 28, y: 38, angle: 0 },
  { id: 'Q02', code: 'Poste 12', nom: 'Terminal Conteneurs Vridi TC2', longueur: '300m', tirantEau: '13.5m', type: 'CONTENEUR', x: 52, y: 38, angle: 0 },
  { id: 'Q03', code: 'Poste 13', nom: 'Quai Polyvalent Vridi', longueur: '200m', tirantEau: '11.0m', type: 'VRAC', x: 75, y: 38, angle: 0 },
  { id: 'Q04', code: 'Poste 05', nom: 'Quai Ro-Ro Rive Ouest', longueur: '180m', tirantEau: '10.5m', type: 'RO-RO', x: 30, y: 68, angle: 90 },
  { id: 'Q05', code: 'Poste 06', nom: 'Quai Fruitière & Produits Frais', longueur: '190m', tirantEau: '10.0m', type: 'FRUITIER', x: 30, y: 84, angle: 90 },
  { id: 'Q06', code: 'Poste 08', nom: 'Quai Pétrolier & Chimique', longueur: '220m', tirantEau: '12.0m', type: 'PETROLIER', x: 72, y: 72, angle: 45 },
];

export const PortAccostageMap: React.FC<PortAccostageMapProps> = ({ escales, onSelectEscale }) => {
  const [selectedQuay, setSelectedQuay] = useState<Omit<QuayBerth, 'escaleId'> | null>(null);
  const [mapMode, setMapMode] = useState<'ACCORSTAGE' | 'SATELLITE' | 'SCHEMATIQUE'>('ACCORSTAGE');
  const [showRadeOnly, setShowRadeOnly] = useState(false);

  // Map ships docked vs anchored in bay (rade)
  const dockedEscales = escales.filter(e => e.statut === 'EN_COURS');
  const anchoredEscales = escales.filter(e => e.statut === 'CLOTUREE');

  return (
    <div className="bg-[#0f172a] text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
      
      {/* Map Control Toolbar */}
      <div className="bg-[#1e293b]/90 backdrop-blur-md px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <span>Carte des Quais d'Accostage & Bassins Portuaires</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-950 text-blue-300 border border-blue-800">
                Port Autonome d'Abidjan (PAA)
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Positionnement réels des postes à quai (TC1, TC2, Ro-Ro) & Rade Extérieure
            </p>
          </div>
        </div>

        {/* View Switchers */}
        <div className="flex items-center space-x-2">
          <div className="bg-slate-900/80 p-1 rounded-xl border border-slate-800 flex items-center space-x-1">
            <button
              onClick={() => setMapMode('ACCORSTAGE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mapMode === 'ACCORSTAGE' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Plan d'Accostage
            </button>
            <button
              onClick={() => setMapMode('SCHEMATIQUE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mapMode === 'SCHEMATIQUE' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Vue Quais & Tirants
            </button>
          </div>

          <button
            onClick={() => setShowRadeOnly(!showRadeOnly)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition ${showRadeOnly ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
          >
            <Anchor className="w-3.5 h-3.5 text-amber-400" />
            <span>Zone de Mouillage</span>
          </button>
        </div>
      </div>

      {/* Main Vector Map Display (MarineTraffic Style) */}
      <div className="relative w-full h-[420px] bg-[#cbd5e1] overflow-hidden select-none">
        
        {/* SVG Background - Ocean and Coastline */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          {/* Ocean */}
          <path d="M 0 240 Q 250 270 450 250 T 850 270 T 1200 240 L 1200 500 L 0 500 Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
          
          {/* Borders (approximate) */}
          <path d="M 300 0 L 280 120 L 320 180 L 300 245" stroke="#94a3b8" fill="none" strokeWidth="1" strokeDasharray="5 3" />
          <path d="M 750 0 L 730 150 L 760 210 L 720 260" stroke="#94a3b8" fill="none" strokeWidth="1" strokeDasharray="5 3" />
          
          {/* Labels */}
          <text x="500" y="140" fill="#64748b" fontSize="18" fontWeight="600" fontFamily="sans-serif" textAnchor="middle">Ivory Coast</text>
          <text x="500" y="170" fill="#94a3b8" fontSize="12" fontWeight="500" fontFamily="sans-serif" textAnchor="middle">Yamoussoukro</text>
          <text x="850" y="160" fill="#64748b" fontSize="16" fontWeight="600" fontFamily="sans-serif">Ghana</text>
          <text x="150" y="160" fill="#64748b" fontSize="16" fontWeight="600" fontFamily="sans-serif">Liberia</text>
          
          {/* Abidjan Marker */}
          <circle cx="580" cy="255" r="8" fill="none" stroke="#475569" strokeWidth="2" />
          <circle cx="580" cy="255" r="4" fill="white" stroke="#475569" strokeWidth="1" />
          <circle cx="580" cy="255" r="2" fill="#475569" />
          <text x="600" y="260" fill="#334155" fontSize="13" fontWeight="bold" fontFamily="sans-serif">Abidjan</text>
        </svg>

        {/* Ships (Escales) */}
        {escales.map((escale, idx) => {
          // Positions approximatives au large d'Abidjan (x: ~58%, y: ~70%)
          const isDocked = escale.statut === 'EN_COURS';
          const posX = 55 + (Math.sin(idx * 45) * 12) + (isDocked ? (Math.random() * 4) : (Math.random() * 20 - 10)); 
          const posY = 65 + (Math.cos(idx * 45) * 8) + (isDocked ? (Math.random() * 3) : (Math.random() * 15 + 5));
          const rotation = (idx * 73) % 360;
          
          // Green for active/docked, Red for others
          const colorClass = isDocked ? 'fill-emerald-400 stroke-emerald-700' : 'fill-red-500 stroke-red-800';

          return (
            <div
              key={escale.id}
              style={{ left: `${posX}%`, top: `${posY}%` }}
              className="absolute z-20 group cursor-pointer"
              onClick={() => onSelectEscale(escale)}
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-lg border border-slate-700 z-30">
                <p className="font-bold">{escale.nomNavire}</p>
                <p className="text-slate-400">{escale.statut}</p>
              </div>
              {/* Ship Arrow */}
              <div style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} className="hover:scale-125 transition-transform duration-200">
                <svg width="16" height="16" viewBox="0 0 24 24" className={colorClass} strokeWidth="1.5">
                  <path d="M12 2L22 20L12 17L2 20L12 2Z" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
