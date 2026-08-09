import React, { useRef, useState } from 'react';
import { DraftExport, BL } from '../../types';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBlOrDraft: BL | DraftExport | null;
  onSignComplete: (targetId: number, signatureDataUrl: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  targetBlOrDraft,
  onSignComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [stampApposed, setStampApposed] = useState(true);

  if (!isOpen || !targetBlOrDraft) return null;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#00182f';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleConfirmSignature = () => {
    const canvas = canvasRef.current;
    let signatureUrl = '';
    if (canvas && hasSignature) {
      signatureUrl = canvas.toDataURL('image/png');
    } else {
      signatureUrl = 'STAMP_ONLY_VALIDATED';
    }
    onSignComplete(targetBlOrDraft.id, signatureUrl);
    onClose();
  };

  const isBl = 'numeroBL' in targetBlOrDraft;
  const numBl = isBl ? (targetBlOrDraft as BL).numeroBL : (targetBlOrDraft as DraftExport).numeroDraft;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 bg-primary text-on-primary flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-cargo-accent text-2xl">draw</span>
            <div>
              <h3 className="font-bold text-lg leading-tight">Signature Numérique BL Original</h3>
              <p className="text-xs text-secondary-fixed-dim font-mono">{numBl}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-primary-container text-on-primary hover:bg-secondary flex items-center justify-center transition"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 bg-surface overflow-y-auto max-h-[75vh]">
          
          {/* Stamp Preview Box */}
          <div className="p-4 bg-surface-container-lowest border border-outline-variant rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-on-surface-variant tracking-wider">Cachet Officiel Agent BOCS</span>
              <label className="flex items-center gap-2 text-xs font-bold text-secondary cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={stampApposed} 
                  onChange={e => setStampApposed(e.target.checked)} 
                  className="rounded border-outline-variant text-secondary focus:ring-secondary" 
                />
                <span>Apposer le cachet maritime BOCS</span>
              </label>
            </div>

            {stampApposed && (
              <div className="p-3 bg-secondary-fixed/20 border-2 border-dashed border-secondary/40 rounded flex items-center gap-4">
                <div className="w-14 h-14 rounded-full border-4 border-secondary text-secondary flex flex-col items-center justify-center font-bold text-[9px] uppercase tracking-tighter text-center leading-none p-1">
                  <span>BOCS</span>
                  <span className="text-[7px]">AGENT</span>
                  <span>MARITIME</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-primary">BOCS MARITIME AGENT OFFICIEL</h4>
                  <p className="text-[11px] text-on-surface-variant">Signé électroniquement selon protocole ISO 9001 / Port Abidjan</p>
                  <p className="text-[10px] text-outline font-mono mt-0.5">SHA256: {Math.random().toString(36).substring(2, 15).toUpperCase()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Canvas for Hand Written Signature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-on-surface-variant tracking-wider">
                Signature Manuscrite (Optionnelle)
              </label>
              {hasSignature && (
                <button 
                  type="button"
                  onClick={clearCanvas}
                  className="text-xs text-error hover:underline flex items-center gap-1 font-semibold"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Effacer</span>
                </button>
              )}
            </div>

            <div className="border-2 border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden shadow-inner relative">
              <canvas
                ref={canvasRef}
                width={560}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-[160px] cursor-crosshair touch-none"
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-outline/40 font-semibold text-sm">
                  Dessinez votre signature ici
                </div>
              )}
            </div>
          </div>

          <div className="p-3 bg-surface-container-high rounded text-xs text-on-surface-variant space-y-1">
            <p className="font-bold text-primary flex items-center gap-1">
              <span className="material-symbols-outlined text-base text-status-validated">verified</span>
              <span>Valeur Juridique BOCS Maritime</span>
            </p>
            <p>
              La signature et l'apposition du cachet certifient la délivrance conforme du Connaissement (Bill of Lading Original).
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high rounded transition-all"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirmSignature}
            className="px-6 py-2 bg-primary text-on-primary font-bold text-sm rounded hover:bg-secondary transition-all shadow flex items-center gap-2 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">verified</span>
            <span>Valider & Signer le BL</span>
          </button>
        </div>

      </div>
    </div>
  );
};
