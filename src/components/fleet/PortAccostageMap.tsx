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

      {/* Main Vector Map Display */}
      <div className="relative w-full h-[420px] bg-[#090d16] overflow-hidden select-none">
        
        {/* SVG Background Layer - Water Bassins, Coastal Land, Dock Lines */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Water Gradient */}
            <radialGradient id="waterGrad" cx="50%" cy="50%" r="75%">
              <stop offset="0%" stopColor="#0f2b48" />
              <stop offset="100%" stopColor="#081426" />
            </radialGradient>
            
            {/* Land Texture Pattern */}
            <pattern id="landGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
            </pattern>

            {/* Quay Hatching */}
            <pattern id="quayHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="10" stroke="#334155" strokeWidth="2" />
            </pattern>
          </defs>

          {/* Background Water Surface */}
          <rect width="100%" height="100%" fill="url(#waterGrad)" />

          {/* Channel Grid Lines */}
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#1e293b" strokeDasharray="4,4" strokeWidth="1" />
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#1e293b" strokeDasharray="4,4" strokeWidth="1" />

          {/* COASTLINE & LAND MASSES (PORT D'ABIDJAN - TERMINALS & VRIDI) */}
          
          {/* North Coast / Terre-Plein principal */}
          <path
            d="M 0 0 L 1000 0 L 1000 130 L 850 130 L 850 160 L 200 160 L 200 130 L 0 130 Z"
            fill="#172033"
            stroke="#334155"
            strokeWidth="2"
          />
          <path
            d="M 0 0 L 1000 0 L 1000 130 L 850 130 L 850 160 L 200 160 L 200 130 L 0 130 Z"
            fill="url(#landGrid)"
            opacity="0.4"
          />

          {/* West Coast / Quai Ro-Ro & Fruitier Peninsula */}
          <path
            d="M 0 130 L 180 130 L 180 400 L 0 400 Z"
            fill="#172033"
            stroke="#334155"
            strokeWidth="2"
          />
          <path
            d="M 0 130 L 180 130 L 180 400 L 0 400 Z"
            fill="url(#landGrid)"
            opacity="0.4"
          />

          {/* East Coast / Zone Industrielle & Terminal Pétrolier */}
          <path
            d="M 800 240 L 1000 240 L 1000 420 L 700 420 Z"
            fill="#172033"
            stroke="#334155"
            strokeWidth="2"
          />

          {/* QUAY ACCORSTAGE WALL LINES (Lignes Jaunes d'Accostage) */}
          {/* North Quay Line TC1 / TC2 */}
          <line x1="200" y1="160" x2="850" y2="160" stroke="#f59e0b" strokeWidth="4" strokeDasharray="12 4" />
          
          {/* West Quay Line Ro-Ro / Fruitier */}
          <line x1="180" y1="160" x2="180" y2="380" stroke="#38bdf8" strokeWidth="4" strokeDasharray="12 4" />

          {/* East Oil/Vrac Berth Line */}
          <line x1="700" y1="420" x2="800" y2="240" stroke="#ec4899" strokeWidth="4" strokeDasharray="12 4" />

          {/* Fairway Navigational Channel (Passage des Navires) */}
          <path
            d="M 190 280 Q 500 250 820 180"
            fill="none"
            stroke="#0284c7"
            strokeWidth="2"
            strokeDasharray="6 6"
            opacity="0.6"
          />
          <text x="500" y="270" fill="#38bdf8" fontSize="10" fontFamily="monospace" textAnchor="middle" opacity="0.8">
            ◀ CHANAL PRINCIPAL DE NAVIGATION (PROFONDEUR 15.0m) ▶
          </text>

          {/* Quay Labels on SVG */}
          <text x="320" y="145" fill="#f8fafc" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
            QUAI NORTH — TERMINAL CONTENEURS (TC1 / TC2)
          </text>
          <text x="30" y="270" fill="#f8fafc" fontSize="10" fontWeight="bold" fontFamily="sans-serif" transform="rotate(-90 30 270)">
            QUAI OUEST — RO-RO & FRUITIÈRE
          </text>
          <text x="830" y="340" fill="#f8fafc" fontSize="10" fontWeight="bold" fontFamily="sans-serif" transform="rotate(-60 830 340)">
            QUAI PETROLIER & VRAC
          </text>

          {/* Anchorage Zone / Rade Extérieure */}
          <circle cx="850" cy="90" r="45" fill="#f59e0b" fillOpacity="0.05" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="850" y="93" fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="middle">
            ZONE DE MOUILLAGE (RADE)
          </text>
        </svg>

        {/* INTERACTIVE QUAY BERTH POSITIONS & SHIPS DOCKED */}
        {BASE_QUAYS.map((quay, idx) => {
          // Dynamically assign docked escales to available quays
          const assignedEscale = dockedEscales[idx];
          const isOccupied = !!assignedEscale;

          return (
            <div
              key={quay.id}
              style={{ left: `${quay.x}%`, top: `${quay.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer"
              onClick={() => {
                setSelectedQuay(quay);
                if (assignedEscale) onSelectEscale(assignedEscale);
              }}
            >
              {/* Quay Docking Slot Indicator */}
              <div className={`p-2 rounded-xl border backdrop-blur-md transition-all duration-300 ${isOccupied ? 'bg-slate-900/90 border-emerald-500 shadow-lg shadow-emerald-950/40 ring-2 ring-emerald-500/30' : 'bg-slate-900/70 border-slate-700 hover:border-blue-400 hover:bg-slate-800/90'}`}>
                
                {/* Quay Header Info */}
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-1 mb-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800">
                    {quay.code}
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 truncate max-w-[120px]">
                    {quay.nom}
                  </span>
                </div>

                {/* Ship Docked State */}
                {isOccupied ? (
                  <div className="flex items-center space-x-2 bg-emerald-950/60 p-1.5 rounded-lg border border-emerald-800/60">
                    {/* Ship Vector Icon Hull */}
                    <div className="w-7 h-7 rounded bg-emerald-500 text-slate-950 font-bold flex items-center justify-center shadow">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 13.5L5 6h14l2 7.5v4.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18v-4.5zM7 9h10v2H7V9z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-xs font-black text-white font-mono">
                          {assignedEscale ? assignedEscale.nomNavire : 'NAVIRE À QUAI'}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-emerald-300 block">
                        Accosté • Tirant: {quay.tirantEau}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono py-0.5">
                    <span className="flex items-center text-slate-400">
                      <CheckCircle2 className="w-3 h-3 text-slate-500 mr-1" /> Libre
                    </span>
                    <span>L: {quay.longueur}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ANCHORED SHIPS IN RADE (Mouillage Extérieur) */}
        {anchoredEscales.map((escale, idx) => {
          const posX = 78 + (idx * 8);
          const posY = 18 + (idx * 12);
          return (
            <div
              key={escale.id}
              style={{ left: `${posX}%`, top: `${posY}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer"
              onClick={() => onSelectEscale(escale)}
            >
              <div className="bg-amber-950/80 border border-amber-500/60 p-1.5 rounded-lg backdrop-blur-sm flex items-center space-x-1.5 shadow-lg hover:scale-105 transition">
                <Anchor className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                <div className="text-left">
                  <span className="text-[10px] font-bold text-amber-200 block font-mono leading-none">
                    {escale.nomNavire}
                  </span>
                  <span className="text-[8px] text-amber-400/80 font-mono">En Rade (Attente Quai)</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Map Legend Overlay Card */}
        <div className="absolute bottom-3 left-3 bg-[#0f172a]/95 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-xs shadow-xl space-y-1.5 max-w-xs z-30">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 border-b border-slate-800 pb-1 mb-1">
            <span>LÉGENDE PORTUAIRE ACCORSTAGE</span>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 border border-emerald-300"></span>
              <span className="text-slate-300">Navire À Quai (Actif)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded bg-amber-500 border border-amber-300"></span>
              <span className="text-slate-300">Navire En Rade</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-700 border border-slate-500"></span>
              <span className="text-slate-300">Poste à Quai Libre</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-4 h-0.5 bg-amber-500 stroke-dasharray"></span>
              <span className="text-slate-300">Ligne d'Accostage</span>
            </div>
          </div>
        </div>

        {/* Selected Quay Drawer Details */}
        {selectedQuay && (
          <div className="absolute top-3 right-3 bg-[#0f172a]/95 backdrop-blur-md p-4 rounded-xl border border-blue-500/50 shadow-2xl max-w-xs w-full z-40 space-y-3 animate-fade-in text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <span className="text-[10px] font-mono font-bold text-blue-400 uppercase">Fiche Poste à Quai</span>
                <h4 className="font-bold text-white text-sm">{selectedQuay.nom}</h4>
              </div>
              <button
                onClick={() => setSelectedQuay(null)}
                className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px] uppercase font-bold">Longueur Quai</span>
                <span className="font-bold text-white font-mono">{selectedQuay.longueur}</span>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[9px] uppercase font-bold">Tirant d'Eau Max</span>
                <span className="font-bold text-emerald-400 font-mono">{selectedQuay.tirantEau}</span>
              </div>
            </div>

            <div className="bg-blue-950/40 p-2.5 rounded-lg border border-blue-800/50 space-y-1">
              <span className="text-[10px] font-bold text-blue-300 uppercase block">Type de Terminal</span>
              <p className="font-semibold text-slate-200">{selectedQuay.type} — Équipé d'outillage de manutention portuaire moderne.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
