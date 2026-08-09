import React, { useState } from 'react';
import { DraftExport, Escale, User, UserRole, ContainerType, BL } from '../types';
import { generateOriginalBlPdf } from '../utils/pdfGenerator';
import { SignatureModal } from '../components/common/SignatureModal';

interface ExportModuleProps {
  initialSubTab?: 'CONSOLIDATION' | 'SAISIE_DRAFT' | 'ESPACE_CLIENT';
  drafts: DraftExport[];
  escales: Escale[];
  currentUser: User;
  onAddDraft: (draft: DraftExport) => void;
  onUpdateDraftStatus: (draftId: number, status: any, motif?: string, blNumber?: string) => void;
  onGenerateInvoice: (invoice: any) => void;
  onLogAudit: (action: string, entite: string, details: string) => void;
  userRole: UserRole;
}

export const ExportModule: React.FC<ExportModuleProps> = ({
  initialSubTab = 'SAISIE_DRAFT',
  drafts,
  escales,
  currentUser,
  onAddDraft,
  onUpdateDraftStatus,
  onLogAudit,
  userRole
}) => {
  // Mode tabs: 'CONSOLIDATION' (Manifeste Export), 'SAISIE_DRAFT' (Formulaire Saisie Draft 4 Étapes), 'ESPACE_CLIENT' (Liste des Drafts)
  const [activeSubTab, setActiveSubTab] = useState<'CONSOLIDATION' | 'SAISIE_DRAFT' | 'ESPACE_CLIENT'>(initialSubTab);

  React.useEffect(() => {
    if (initialSubTab) setActiveSubTab(initialSubTab);
  }, [initialSubTab]);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedEscaleCode, setSelectedEscaleCode] = useState('BOCS_BREMEN_042V');

  // Signature Modal state
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [targetForSignature, setTargetForSignature] = useState<DraftExport | null>(null);

  // Form State Step 1 (Routing & General Info)
  const [shipperNom, setShipperNom] = useState(currentUser.nomSociete || 'Agro Export SA');
  const [shipperAdresse, setShipperAdresse] = useState('Zone Industrielle Vridi, BP 128 Abidjan');
  const [shipperPays, setShipperPays] = useState('Côte d\'Ivoire');
  const [consigneeNom, setConsigneeNom] = useState('Bremen Logistics Group');
  const [consigneeAdresse, setConsigneeAdresse] = useState('Hafenstrasse 12, Bremen');
  const [consigneePays, setConsigneePays] = useState('Allemagne');
  const [notifyNom, setNotifyNom] = useState('Nordic Wood Imports');
  const [notifyAdresse, setNotifyAdresse] = useState('Hafenstrasse 12, Bremen');
  const [notifyPays, setNotifyPays] = useState('Allemagne');

  // Form State Step 2 (Cargo)
  const [marchandiseDesc, setMarchandiseDesc] = useState('FEVES DE COCAO & BOIS DE CONSTRUCTION');
  const [hsCode, setHsCode] = useState('1801.00.00');
  const [poidsBrutKg, setPoidsBrutKg] = useState<number>(240500);
  const [volumeM3, setVolumeM3] = useState<number>(310);
  const [nombreColis, setNombreColis] = useState<number>(1200);
  const [typeEmballage, setTypeEmballage] = useState('SACS DE 65KG');

  // Form State Step 3 (Containers)
  const [containersList, setContainersList] = useState<Array<{
    numeroConteneur: string;
    typeConteneur: ContainerType;
    numeroScelle: string;
    poidsKg: number;
    tareKg: number;
    nombreColis: number;
  }>>([
    { numeroConteneur: 'BOCU-DKR-001', typeConteneur: '20_DRY', numeroScelle: 'SC-1001', poidsKg: 24000, tareKg: 2200, nombreColis: 200 },
    { numeroConteneur: 'BOCU-DKR-002', typeConteneur: '40_HC', numeroScelle: 'SC-1002', poidsKg: 45000, tareKg: 3800, nombreColis: 400 }
  ]);

  const [newCtnNum, setNewCtnNum] = useState('');
  const [newCtnType, setNewCtnType] = useState<ContainerType>('20_DRY');
  const [newCtnScelle, setNewCtnScelle] = useState('');
  const [newCtnPoids, setNewCtnPoids] = useState<number>(24000);

  // Sample BL list matching user's exact screenshot
  const sampleBlList = [
    { numBl: 'BOCS-DKR-001', shipper: 'Agro Export SA', consignee: 'Bremen Logistics Group', containers: 12, weightTons: 240.5, status: 'VALIDATED' },
    { numBl: 'BOCS-DKR-002', shipper: 'Senegal Timber Co', consignee: 'Nordic Wood Imports', containers: 5, weightTons: 95.0, status: 'VALIDATED' },
    { numBl: 'BOCS-DKR-003', shipper: 'Global Minerals', consignee: 'Ruhr Industrie', containers: 24, weightTons: 620.8, status: 'VALIDATED' },
    { numBl: 'BOCS-DKR-004', shipper: 'West Africa Cotton', consignee: 'EuroTex Mills', containers: 8, weightTons: 112.4, status: 'PENDING' }
  ];

  const handleAddContainer = () => {
    if (!newCtnNum) return;
    setContainersList(prev => [
      ...prev,
      {
        numeroConteneur: newCtnNum.toUpperCase(),
        typeConteneur: newCtnType,
        numeroScelle: newCtnScelle || `SC-${Math.floor(1000 + Math.random() * 9000)}`,
        poidsKg: newCtnPoids,
        tareKg: 2200,
        nombreColis: 200
      }
    ]);
    setNewCtnNum('');
    setNewCtnScelle('');
  };

  const handleRemoveContainer = (index: number) => {
    setContainersList(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveDraftBrouillon = () => {
    const newDraft: DraftExport = {
      id: Date.now(),
      clientId: currentUser.id,
      clientNom: currentUser.nomComplet,
      clientSociete: currentUser.nomSociete || 'Agro Export SA',
      numeroDraft: `BOCS-DKR-${Math.floor(100 + Math.random() * 900)}`,
      shipperInfo: { nom: shipperNom, adresse: shipperAdresse, pays: shipperPays },
      consigneeInfo: { nom: consigneeNom, adresse: consigneeAdresse, pays: consigneePays },
      notifyInfo: { nom: notifyNom, adresse: notifyAdresse, pays: notifyPays },
      marchandisesInfo: {
        description: marchandiseDesc,
        poidsBrutKg,
        volumeM3,
        nombreColis,
        typeEmballage,
        hsCode
      },
      conteneursInfo: containersList,
      statut: 'BROUILLON',
      dateCreation: new Date().toISOString().split('T')[0]
    };

    onAddDraft(newDraft);
    onLogAudit('SAUVEGARDE_BROUILLON_DRAFT', 'DraftBL', `Brouillon sauvegardé: ${newDraft.numeroDraft}`);
    alert(`Le Brouillon ${newDraft.numeroDraft} a été enregistré dans votre Espace Client.`);
    setActiveSubTab('ESPACE_CLIENT');
  };

  const handleFinalSubmitDraft = () => {
    const newDraft: DraftExport = {
      id: Date.now(),
      clientId: currentUser.id,
      clientNom: currentUser.nomComplet,
      clientSociete: currentUser.nomSociete || 'Agro Export SA',
      numeroDraft: `BOCS-DKR-${Math.floor(100 + Math.random() * 900)}`,
      shipperInfo: { nom: shipperNom, adresse: shipperAdresse, pays: shipperPays },
      consigneeInfo: { nom: consigneeNom, adresse: consigneeAdresse, pays: consigneePays },
      notifyInfo: { nom: notifyNom, adresse: notifyAdresse, pays: notifyPays },
      marchandisesInfo: {
        description: marchandiseDesc,
        poidsBrutKg,
        volumeM3,
        nombreColis,
        typeEmballage,
        hsCode
      },
      conteneursInfo: containersList,
      statut: 'SOUMIS',
      dateCreation: new Date().toISOString().split('T')[0]
    };

    onAddDraft(newDraft);
    onLogAudit('SOUMISSION_DRAFT_EXPORT', 'DraftBL', `Soumission du Draft BL ${newDraft.numeroDraft}`);
    alert(`Votre Connaissement ${newDraft.numeroDraft} a été soumis avec succès à l'agent maritime !`);
    setActiveSubTab('CONSOLIDATION');
    setStep(1);
  };

  const handleOpenSignatureModal = (draft: DraftExport) => {
    setTargetForSignature(draft);
    setSignModalOpen(true);
  };

  const handleSignComplete = (draftId: number, signatureDataUrl: string) => {
    const blNum = `BOCS-EXP-ORIGINAL-${Math.floor(1000 + Math.random() * 9000)}`;
    onUpdateDraftStatus(draftId, 'BL_GENERE', undefined, blNum);
    onLogAudit('SIGNATURE_BL_ORIGINAL', 'BLOriginal', `Signature numérique et édition du BL Original ${blNum}`);
    
    const targetDraft = drafts.find(d => d.id === draftId);
    if (targetDraft) {
      const mockBl: BL = {
        id: targetDraft.id,
        escaleId: targetDraft.escaleId || 1,
        numeroBL: blNum,
        typeOperation: 'EXPORT',
        shipperNom: targetDraft.shipperInfo.nom,
        shipperAdresse: targetDraft.shipperInfo.adresse,
        consigneeNom: targetDraft.consigneeInfo.nom,
        consigneeAdresse: targetDraft.consigneeInfo.adresse,
        notifyNom: targetDraft.notifyInfo.nom,
        notifyAdresse: targetDraft.notifyInfo.adresse,
        portChargementCode: 'DKR',
        portDechargementCode: 'BRE',
        destinationFinale: targetDraft.consigneeInfo.pays,
        descriptionGoods: targetDraft.marchandisesInfo.description,
        nombreColis: targetDraft.marchandisesInfo.nombreColis,
        typeEmballage: targetDraft.marchandisesInfo.typeEmballage,
        poidsBrutKg: targetDraft.marchandisesInfo.poidsBrutKg,
        volumeM3: targetDraft.marchandisesInfo.volumeM3,
        conteneurs: targetDraft.conteneursInfo.map((c, i) => ({
          id: i,
          blId: targetDraft.id,
          numeroConteneur: c.numeroConteneur,
          typeConteneur: c.typeConteneur,
          numeroScelle: c.numeroScelle,
          poidsKg: c.poidsKg,
          tareKg: c.tareKg,
          nombreColis: c.nombreColis,
          montantCautionFcfa: 150000
        }))
      };
      generateOriginalBlPdf(mockBl, signatureDataUrl);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Module Sub-Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('SAISIE_DRAFT')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'SAISIE_DRAFT' 
                ? 'bg-[#005daa] text-white shadow' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-base">edit_note</span>
            <span>Saisie du Draft de BL</span>
          </button>

          <button
            onClick={() => setActiveSubTab('CONSOLIDATION')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'CONSOLIDATION' 
                ? 'bg-[#005daa] text-white shadow' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-base">grid_view</span>
            <span>Manifeste Export (Consolidation)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('ESPACE_CLIENT')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'ESPACE_CLIENT' 
                ? 'bg-[#005daa] text-white shadow' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-base">folder_shared</span>
            <span>Espace Client & Historique</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-mono font-semibold px-3">
          Saisie en cours: BOCS BREMEN (Voy 042V)
        </div>
      </div>

      {/* SECTION 1: SAISIE DU DRAFT DE BL (4-STEP GUIDED WORKFLOW FORM) */}
      {activeSubTab === 'SAISIE_DRAFT' && (
        <div className="space-y-6">
          
          {/* Header Banner Saisie Draft */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-1">
                Saisie du Draft de BL
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Veuillez remplir les informations nécessaires pour générer le Bill of Lading.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDraftBrouillon}
                className="px-4 py-2.5 border border-[#00182f] text-[#00182f] font-bold text-xs rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={handleFinalSubmitDraft}
                className="px-5 py-2.5 bg-[#00182f] text-white font-bold text-xs rounded-lg hover:bg-[#075fac] transition-colors shadow-sm flex items-center gap-2"
              >
                <span>Submit Draft</span>
                <span className="material-symbols-outlined text-base">send</span>
              </button>
            </div>
          </div>

          {/* Stepper Progress Bar (Matching saisie_du_draft_de_bl) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            
            <div className="relative flex justify-between w-full max-w-3xl mx-auto py-2">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full -z-0"></div>
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#005daa] rounded-full transition-all duration-300 -z-0"
                style={{ width: `${((step - 1) / 3) * 100}%` }}
              ></div>

              {/* Step 1 */}
              <button 
                onClick={() => setStep(1)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow border-2 transition-all ${
                  step >= 1 ? 'bg-[#005daa] text-white border-white ring-4 ring-blue-100' : 'bg-slate-100 text-slate-500 border-slate-300'
                }`}>
                  1
                </div>
                <span className={`text-xs font-bold ${step === 1 ? 'text-[#005daa]' : 'text-slate-500'}`}>
                  Infos Générales
                </span>
              </button>

              {/* Step 2 */}
              <button 
                onClick={() => setStep(2)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow border-2 transition-all ${
                  step >= 2 ? 'bg-[#005daa] text-white border-white ring-4 ring-blue-100' : 'bg-slate-100 text-slate-500 border-slate-300'
                }`}>
                  2
                </div>
                <span className={`text-xs font-bold ${step === 2 ? 'text-[#005daa]' : 'text-slate-500'}`}>
                  Détails Cargaison
                </span>
              </button>

              {/* Step 3 */}
              <button 
                onClick={() => setStep(3)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow border-2 transition-all ${
                  step >= 3 ? 'bg-[#005daa] text-white border-white ring-4 ring-blue-100' : 'bg-slate-100 text-slate-500 border-slate-300'
                }`}>
                  3
                </div>
                <span className={`text-xs font-bold ${step === 3 ? 'text-[#005daa]' : 'text-slate-500'}`}>
                  Conteneurs & Plombs
                </span>
              </button>

              {/* Step 4 */}
              <button 
                onClick={() => setStep(4)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow border-2 transition-all ${
                  step >= 4 ? 'bg-[#005daa] text-white border-white ring-4 ring-blue-100' : 'bg-slate-100 text-slate-500 border-slate-300'
                }`}>
                  4
                </div>
                <span className={`text-xs font-bold ${step === 4 ? 'text-[#005daa]' : 'text-slate-500'}`}>
                  Résumé & Soumission
                </span>
              </button>
            </div>

            {/* FORM CANVAS CONTENT */}
            <div className="pt-4 border-t border-slate-200">
              
              {/* STEP 1: INFOS GENERALES / ROUTING */}
              {step === 1 && (
                <div className="space-y-6 text-xs animate-fade-in">
                  <h3 className="font-bold text-sm text-[#00182f] border-b border-slate-200 pb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#005daa]">info</span>
                    <span>Informations Générales & Routing Maritime</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Shipper */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <span className="font-bold text-slate-900 uppercase text-[11px] tracking-wider block flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-secondary text-base">person</span>
                        <span>Chargeur (Shipper)</span>
                      </span>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Nom / Raison Sociale</label>
                        <input
                          type="text"
                          value={shipperNom}
                          onChange={e => setShipperNom(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:border-[#005daa]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Adresse Complète</label>
                        <input
                          type="text"
                          value={shipperAdresse}
                          onChange={e => setShipperAdresse(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:border-[#005daa]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Pays Expéditeur</label>
                        <input
                          type="text"
                          value={shipperPays}
                          onChange={e => setShipperPays(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:border-[#005daa]"
                        />
                      </div>
                    </div>

                    {/* Consignee */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <span className="font-bold text-slate-900 uppercase text-[11px] tracking-wider block flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-secondary text-base">domain</span>
                        <span>Consignataire (Consignee)</span>
                      </span>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Nom / Raison Sociale</label>
                        <input
                          type="text"
                          value={consigneeNom}
                          onChange={e => setConsigneeNom(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:border-[#005daa]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Adresse Complète</label>
                        <input
                          type="text"
                          value={consigneeAdresse}
                          onChange={e => setConsigneeAdresse(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:border-[#005daa]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Pays Destination</label>
                        <input
                          type="text"
                          value={consigneePays}
                          onChange={e => setConsigneePays(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:border-[#005daa]"
                        />
                      </div>
                    </div>

                    {/* Notify */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <span className="font-bold text-slate-900 uppercase text-[11px] tracking-wider block flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-secondary text-base">notifications</span>
                        <span>Partie à Notifier (Notify)</span>
                      </span>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Nom / Raison Sociale</label>
                        <input
                          type="text"
                          value={notifyNom}
                          onChange={e => setNotifyNom(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:border-[#005daa]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Adresse Complète</label>
                        <input
                          type="text"
                          value={notifyAdresse}
                          onChange={e => setNotifyAdresse(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:border-[#005daa]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Pays Notify</label>
                        <input
                          type="text"
                          value={notifyPays}
                          onChange={e => setNotifyPays(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:border-[#005daa]"
                        />
                      </div>
                    </div>

                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-6 py-2.5 bg-[#005daa] text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition-all shadow flex items-center gap-2 active:scale-95"
                    >
                      <span>Suivant : Détails Cargaison</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: DETAILS CARGAISON */}
              {step === 2 && (
                <div className="space-y-6 text-xs animate-fade-in">
                  <h3 className="font-bold text-sm text-[#00182f] border-b border-slate-200 pb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#005daa]">inventory_2</span>
                    <span>Détails de la Cargaison & Description des Marchandises</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 uppercase mb-1">Description Complète des Marchandises</label>
                      <textarea
                        rows={3}
                        value={marchandiseDesc}
                        onChange={e => setMarchandiseDesc(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:border-[#005daa]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Code SH (Harmonized System Code)</label>
                      <input
                        type="text"
                        value={hsCode}
                        onChange={e => setHsCode(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-300 rounded-md text-xs font-mono font-bold text-slate-800 focus:border-[#005daa]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Type d'Emballage / Conditionnement</label>
                      <input
                        type="text"
                        value={typeEmballage}
                        onChange={e => setTypeEmballage(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:border-[#005daa]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Poids Brut Total (KG)</label>
                      <input
                        type="number"
                        value={poidsBrutKg}
                        onChange={e => setPoidsBrutKg(parseFloat(e.target.value) || 0)}
                        className="w-full h-10 px-3 bg-white border border-slate-300 rounded-md text-xs font-mono font-extrabold text-[#00182f] focus:border-[#005daa]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Volume Total (M³)</label>
                      <input
                        type="number"
                        value={volumeM3}
                        onChange={e => setVolumeM3(parseFloat(e.target.value) || 0)}
                        className="w-full h-10 px-3 bg-white border border-slate-300 rounded-md text-xs font-mono font-extrabold text-[#00182f] focus:border-[#005daa]"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-6 py-2.5 bg-[#005daa] text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition-all shadow flex items-center gap-2 active:scale-95"
                    >
                      <span>Suivant : Saisie des Conteneurs</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: CONTENEURS */}
              {step === 3 && (
                <div className="space-y-6 text-xs animate-fade-in">
                  <h3 className="font-bold text-sm text-[#00182f] border-b border-slate-200 pb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#005daa]">view_in_ar</span>
                    <span>Saisie des Conteneurs & Numéros de Scellés</span>
                  </h3>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">N° Conteneur</label>
                      <input
                        type="text"
                        value={newCtnNum}
                        onChange={e => setNewCtnNum(e.target.value)}
                        placeholder="BOCU-123456-7"
                        className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Type</label>
                      <select
                        value={newCtnType}
                        onChange={e => setNewCtnType(e.target.value as ContainerType)}
                        className="w-full h-9 px-2.5 bg-[#ffe135] hover:bg-[#ffe855] text-[#0f172a] border border-[#e5c122] rounded-xl text-xs font-black cursor-pointer outline-none transition-all"
                      >
                        <option value="20_DRY">20' Dry</option>
                        <option value="40_DRY">40' Dry</option>
                        <option value="40_HC">40' High Cube</option>
                        <option value="20_REEFER">20' Reefer</option>
                        <option value="40_REEFER">40' Reefer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Plomb / Scellé</label>
                      <input
                        type="text"
                        value={newCtnScelle}
                        onChange={e => setNewCtnScelle(e.target.value)}
                        placeholder="SC-1001"
                        className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Poids Brut (kg)</label>
                      <input
                        type="number"
                        value={newCtnPoids}
                        onChange={e => setNewCtnPoids(parseFloat(e.target.value) || 0)}
                        className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded font-mono text-xs"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={handleAddContainer}
                        className="w-full h-9 bg-[#005daa] text-white font-bold text-xs rounded hover:bg-blue-700 transition-all flex items-center justify-center gap-1 shadow"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span>Ajouter</span>
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="p-3">N° Conteneur</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Scellé</th>
                          <th className="p-3">Poids Brut</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {containersList.map((ctn, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold text-[#005daa]">{ctn.numeroConteneur}</td>
                            <td className="p-3 font-semibold">{ctn.typeConteneur}</td>
                            <td className="p-3 font-mono text-slate-600">{ctn.numeroScelle}</td>
                            <td className="p-3 font-mono font-bold text-slate-900">{ctn.poidsKg.toLocaleString()} kg</td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveContainer(i)}
                                className="text-red-600 hover:underline text-xs font-bold"
                              >
                                Supprimer
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-4 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="px-6 py-2.5 bg-[#005daa] text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition-all shadow flex items-center gap-2 active:scale-95"
                    >
                      <span>Suivant : Résumé & Soumission</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: RESUME & SOUMISSION */}
              {step === 4 && (
                <div className="space-y-6 text-xs animate-fade-in">
                  <h3 className="font-bold text-sm text-[#00182f] border-b border-slate-200 pb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#005daa]">verified</span>
                    <span>Résumé Final & Soumission du Draft BL</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <span className="font-bold text-slate-900 uppercase text-[10px] block border-b border-slate-200 pb-1">Routing & Parties</span>
                      <p><strong>Chargeur (Shipper):</strong> {shipperNom} ({shipperAdresse})</p>
                      <p><strong>Consignataire:</strong> {consigneeNom} ({consigneeAdresse})</p>
                      <p><strong>Notify Party:</strong> {notifyNom} ({notifyAdresse})</p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <span className="font-bold text-slate-900 uppercase text-[10px] block border-b border-slate-200 pb-1">Résumé Cargaison</span>
                      <p><strong>Marchandises:</strong> {marchandiseDesc}</p>
                      <p><strong>Code SH:</strong> {hsCode} | <strong>Colis:</strong> {nombreColis} {typeEmballage}</p>
                      <p><strong>Poids Total:</strong> {(poidsBrutKg / 1000).toFixed(1)} Tonnes | <strong>Volume:</strong> {volumeM3} M³</p>
                      <p><strong>Conteneurs rattachés:</strong> {containersList.length} unités</p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[#00182f]">Prêt pour la soumission au Manifeste Export</h4>
                      <p className="text-slate-600">Le draft sera directement transmis à l'agent maritime BOCS pour validation.</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleFinalSubmitDraft}
                      className="px-6 py-3 bg-[#00182f] text-white font-bold text-sm rounded-lg hover:bg-[#075fac] transition-all shadow-md flex items-center gap-2 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-lg">send</span>
                      <span>Soumettre au Manifeste</span>
                    </button>
                  </div>

                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      Retour aux conteneurs
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* SECTION 2: MANIFESTE EXPORT (CONSOLIDATION TABLEAU EXACT DE LA CAPTURE) */}
      {activeSubTab === 'CONSOLIDATION' && (
        <div className="space-y-6">
          
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-2">
            <div>
              <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight mb-1">
                Manifeste Export
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                Consolidation des connaissements originaux pour l'escale sélectionnée.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              
              {/* Select Escale */}
              <div className="relative flex-1 lg:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                <select
                  value={selectedEscaleCode}
                  onChange={e => setSelectedEscaleCode(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-[#ffe135] hover:bg-[#ffe855] border border-[#e5c122] rounded-xl text-xs font-black text-[#0f172a] focus:outline-none shadow-sm cursor-pointer appearance-none"
                >
                  <option value="BOCS_BREMEN_042V">BOCS BREMEN - Voy 042V (0)</option>
                  <option value="BOCS_AFRICA_018V">BOCS AFRICA - Voy 018V (Abidjan)</option>
                  <option value="GLEN_CANYON_D5ZW">GLEN CANYON - D5ZW3 (Dakar)</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">arrow_drop_down</span>
              </div>

              {/* Generate Manifest Button */}
              <button
                onClick={() => alert('Génération du Manifeste Export au format PDF...')}
                className="bg-[#00182f] text-white px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-[#075fac] transition-colors shadow-sm whitespace-nowrap active:scale-95"
              >
                <span className="material-symbols-outlined text-base">description</span>
                <span>Générer Manifeste</span>
              </button>

            </div>
          </div>

          {/* Stats Bento Grid (3 Cards) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total BL Validés</h3>
                <div className="w-10 h-10 rounded-full bg-blue-50 text-[#005daa] flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">description</span>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-extrabold text-slate-900 font-sans tracking-tight">42</span>
                <span className="text-xs text-slate-400 font-semibold mb-1">/ 45 BL Prévus</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conteneurs (TEU)</h3>
                <div className="w-10 h-10 rounded-full bg-blue-50 text-[#005daa] flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">view_in_ar</span>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-extrabold text-slate-900 font-sans tracking-tight">128</span>
                <span className="text-xs text-slate-400 font-semibold mb-1">Unités</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Poids Brut Total</h3>
                <div className="w-10 h-10 rounded-full bg-orange-50 text-[#D79375] flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">scale</span>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-extrabold text-slate-900 font-sans tracking-tight">2,450</span>
                <span className="text-xs text-slate-400 font-semibold mb-1">Tonnes</span>
              </div>
            </div>

          </div>

          {/* Data Table Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col min-h-[440px]">
            
            {/* Table Header */}
            <div className="px-6 py-4 border-b border-slate-200/80 bg-white flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 tracking-wide">Liste des Connaissements (BL)</h3>
              
              <div className="flex items-center gap-2">
                <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors" title="Filtrer">
                  <span className="material-symbols-outlined text-xl">filter_list</span>
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors" title="Exporter Excel">
                  <span className="material-symbols-outlined text-xl">download</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-6">N° BL</th>
                    <th className="py-3 px-6">Chargeur</th>
                    <th className="py-3 px-6">Consignataire</th>
                    <th className="py-3 px-6 text-center">Conteneurs</th>
                    <th className="py-3 px-6 text-right">Poids (T)</th>
                    <th className="py-3 px-6 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {sampleBlList.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-mono font-semibold text-slate-900">{row.numBl}</td>
                      <td className="py-4 px-6 font-medium text-slate-700">{row.shipper}</td>
                      <td className="py-4 px-6 text-slate-600">{row.consignee}</td>
                      <td className="py-4 px-6 text-center font-mono text-slate-700">{row.containers}</td>
                      <td className="py-4 px-6 text-right font-mono text-slate-900 font-semibold">{row.weightTons.toFixed(1)}</td>
                      <td className="py-4 px-6 text-center">
                        {row.status === 'VALIDATED' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-[#005daa] border border-blue-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#005daa]"></span>
                            Validé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                            En attente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* SECTION 3: ESPACE CLIENT & HISTORIQUE DES DRAFTS */}
      {activeSubTab === 'ESPACE_CLIENT' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Espace Client - Historique de vos Drafts BL</h2>
              <p className="text-xs text-slate-500">Suivez l'état de validation et faites signer vos connaissements originaux.</p>
            </div>
            <button
              onClick={() => {
                setActiveSubTab('SAISIE_DRAFT');
                setStep(1);
              }}
              className="bg-[#005daa] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 transition-colors shadow"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>Nouveau Draft BL</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <th className="p-3">Numéro Draft</th>
                  <th className="p-3">Expéditeur</th>
                  <th className="p-3">Destinataire</th>
                  <th className="p-3">Poids Brut</th>
                  <th className="p-3">Statut Workflow</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {drafts.map(draft => (
                  <tr key={draft.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-[#005daa]">{draft.numeroDraft}</td>
                    <td className="p-3">{draft.shipperInfo.nom}</td>
                    <td className="p-3">{draft.consigneeInfo.nom}</td>
                    <td className="p-3 font-mono">{draft.marchandisesInfo.poidsBrutKg.toLocaleString()} kg</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        draft.statut === 'BL_GENERE' ? 'bg-blue-50 text-[#005daa] border border-blue-200' :
                        draft.statut === 'VALIDE' ? 'bg-emerald-100 text-emerald-800' :
                        draft.statut === 'SOUMIS' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {draft.statut}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleOpenSignatureModal(draft)}
                        className="px-3 py-1 bg-[#00182f] text-white font-bold text-xs rounded hover:bg-[#075fac] inline-flex items-center gap-1 shadow"
                      >
                        <span className="material-symbols-outlined text-sm">draw</span>
                        <span>Signer BL Original</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Signature Modal Component */}
      {targetForSignature && (
        <SignatureModal
          isOpen={signModalOpen}
          onClose={() => setSignModalOpen(false)}
          targetBlOrDraft={targetForSignature}
          onSignComplete={handleSignComplete}
        />
      )}

    </div>
  );
};
