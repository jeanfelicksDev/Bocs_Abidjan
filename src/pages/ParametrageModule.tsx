import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { NavTab } from '../components/layout/Sidebar';
import { ThemeSwitcher } from '../components/common/ThemeSwitcher';
import { canEditExchangeRate, isTabAllowed, usePermissionsSync } from '../utils/permissions';

export type ProfileTab = 'profile' | 'password' | 'security';
export type InvoiceConfigTab = 'TYPES' | 'TAXE' | 'TIMBRE';

interface ParametrageModuleProps {
  currentUser: User;
  exchangeRateUsd: number;
  onUpdateExchangeRate: (rate: number) => void;
  /** Ouvre l'écran de réglage ; `configTab` cible un onglet du paramétrage des factures. */
  onNavigate: (tab: NavTab, configTab?: InvoiceConfigTab) => void;
  onOpenProfile: (tab: ProfileTab) => void;
}

interface Reglage {
  icon: string;
  titre: string;
  description: string;
  /** Écran cible : la carte n'apparaît que si l'utilisateur y a accès. */
  tab?: NavTab;
  configTab?: InvoiceConfigTab;
  profileTab?: ProfileTab;
}

interface Rubrique {
  titre: string;
  description: string;
  reglages: Reglage[];
}

const RUBRIQUES: Rubrique[] = [
  {
    titre: 'Mon compte',
    description: 'Vos informations personnelles et la sécurité de votre accès.',
    reglages: [
      { icon: 'person', titre: 'Profil', description: 'Nom, téléphone, entreprise et pays de résidence.', profileTab: 'profile' },
      { icon: 'key', titre: 'Mot de passe', description: 'Changer le mot de passe de votre compte.', profileTab: 'password' },
      { icon: 'shield_person', titre: 'Sécurité & rôle', description: 'Votre rôle et vos habilitations dans BOCS.', profileTab: 'security' }
    ]
  },
  {
    titre: 'Facturation',
    description: 'Ce qui compose, calcule et numérote les factures.',
    reglages: [
      { icon: 'receipt_long', titre: 'Types de facture & rubriques', description: 'Caution, Échange, Telex… et leurs lignes tarifées.', tab: 'facturation_config', configTab: 'TYPES' },
      { icon: 'percent', titre: 'Taxe additionnelle', description: 'Activation, mode de calcul et libellé sur le TTC.', tab: 'facturation_config', configTab: 'TAXE' },
      { icon: 'approval', titre: 'Timbre fiscal', description: "Tranches du timbre d'État appliqué au net à payer.", tab: 'facturation_config', configTab: 'TIMBRE' },
      { icon: 'calculate', titre: 'Grille tarifaire DMDT', description: 'Tranches de surestaries et de détention par type de conteneur.', tab: 'facturation_tarifs' },
      { icon: 'account_balance', titre: 'FNE DGI & devise', description: 'Certification fiscale, paramètres de facture et devise.', tab: 'admin_fne' }
    ]
  },
  {
    titre: 'Référentiels',
    description: 'Les données de base réutilisées dans toute l’application.',
    reglages: [
      { icon: 'sailing', titre: 'Navires & codes facture', description: 'Registre de la flotte et code navire des numéros de facture.', tab: 'navires' }
    ]
  },
  {
    titre: 'Administration & sécurité',
    description: 'Les comptes, les droits et la traçabilité.',
    reglages: [
      { icon: 'manage_accounts', titre: 'Comptes utilisateurs', description: 'Créer, modifier, désactiver les comptes.', tab: 'admin_users' },
      { icon: 'admin_panel_settings', titre: 'Habilitations', description: 'Droits par rôle et par utilisateur.', tab: 'admin_rights' },
      { icon: 'history', titre: "Journal d'audit", description: 'Historique des actions sensibles.', tab: 'admin_audit' }
    ]
  }
];

/**
 * Point d'entrée unique de tout ce qui se règle dans BOCS. Chaque carte ouvre
 * l'écran de réglage existant ; elle n'apparaît que si l'utilisateur y a accès.
 */
export const ParametrageModule: React.FC<ParametrageModuleProps> = ({
  currentUser,
  exchangeRateUsd,
  onUpdateExchangeRate,
  onNavigate,
  onOpenProfile
}) => {
  usePermissionsSync();
  const [rate, setRate] = useState(String(exchangeRateUsd));
  const [rateSaved, setRateSaved] = useState(false);
  // Le taux a pu changer ailleurs (en-tête, écran FNE) : la saisie suit.
  useEffect(() => setRate(String(exchangeRateUsd)), [exchangeRateUsd]);

  const rateEditable = canEditExchangeRate(currentUser);
  const visible = (r: Reglage) => !r.tab || isTabAllowed(currentUser, r.tab);
  const open = (r: Reglage) => {
    if (r.profileTab) onOpenProfile(r.profileTab);
    else if (r.tab) onNavigate(r.tab, r.configTab);
  };

  const parsedRate = parseFloat(rate.replace(',', '.'));
  const rateValid = !isNaN(parsedRate) && parsedRate > 0;
  const saveRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateEditable || !rateValid) return;
    onUpdateExchangeRate(parsedRate);
    setRateSaved(true);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[#002B49] dark:text-night-ink font-display">Paramétrage</h1>
        <p className="text-sm text-text-muted dark:text-night-ink-2 font-medium mt-1">
          Tous les réglages de BOCS au même endroit. Seuls ceux auxquels vous avez accès sont affichés.
        </p>
      </div>

      {RUBRIQUES.map(rubrique => {
        const reglages = rubrique.reglages.filter(visible);
        if (reglages.length === 0) return null;
        return (
          <section key={rubrique.titre} aria-labelledby={`param-${rubrique.titre}`} className="space-y-3">
            <div>
              <h2 id={`param-${rubrique.titre}`} className="text-base font-black text-[#002B49] dark:text-night-ink">{rubrique.titre}</h2>
              <p className="text-xs text-text-muted dark:text-night-ink-3">{rubrique.description}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {reglages.map(r => (
                <button
                  key={r.titre}
                  type="button"
                  onClick={() => open(r)}
                  className="group text-left flex items-start gap-3 p-4 bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md shadow-1 hover:border-[#005DAA] dark:hover:border-night-link hover:shadow-2 transition-all cursor-pointer"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-xl text-[#005DAA] dark:text-night-link bg-[#F0F7FF] dark:bg-night-accent-soft rounded-md p-2 shrink-0">
                    {r.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-text-primary dark:text-night-ink">{r.titre}</span>
                    <span className="block text-xs text-text-muted dark:text-night-ink-2 mt-0.5">{r.description}</span>
                  </span>
                  <span aria-hidden="true" className="material-symbols-outlined text-lg text-text-muted dark:text-night-ink-3 group-hover:text-[#005DAA] dark:group-hover:text-night-link transition-colors self-center">
                    chevron_right
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <section aria-labelledby="param-affichage" className="space-y-3">
        <div>
          <h2 id="param-affichage" className="text-base font-black text-[#002B49] dark:text-night-ink">Affichage & devise</h2>
          <p className="text-xs text-text-muted dark:text-night-ink-3">Réglés ici directement.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <div className="p-4 bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md shadow-1 space-y-3">
            <div>
              <span className="block text-sm font-black text-text-primary dark:text-night-ink">Thème</span>
              <span className="block text-xs text-text-muted dark:text-night-ink-2 mt-0.5">Clair, sombre, ou selon le réglage de Windows.</span>
            </div>
            <ThemeSwitcher />
          </div>

          <form onSubmit={saveRate} className="p-4 bg-surface-canvas dark:bg-night-surface border border-border-default dark:border-night-line rounded-md shadow-1 space-y-3">
            <div>
              <label htmlFor="param-taux" className="block text-sm font-black text-text-primary dark:text-night-ink">Taux de change USD</label>
              <span className="block text-xs text-text-muted dark:text-night-ink-2 mt-0.5">
                Contre-valeur en FCFA d'un dollar sur les factures.
                {!rateEditable && ' Modifiable par la comptabilité et l’administrateur.'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold font-mono text-text-secondary dark:text-night-ink-2">1 USD =</span>
              <input
                id="param-taux"
                type="text"
                inputMode="decimal"
                value={rate}
                onChange={e => { setRate(e.target.value); setRateSaved(false); }}
                aria-invalid={!rateValid}
                readOnly={!rateEditable}
                aria-readonly={!rateEditable}
                className="w-24 h-9 px-2 text-sm font-mono font-bold rounded-md border border-border-default dark:border-night-line bg-surface-canvas dark:bg-night-sunken focus:outline-hidden focus:border-[#005DAA] read-only:bg-surface-sunken read-only:border-transparent read-only:cursor-default"
              />
              <span className="text-sm font-bold font-mono text-text-secondary dark:text-night-ink-2">FCFA</span>
              {rateEditable && <button
                type="submit"
                disabled={!rateValid || parsedRate === exchangeRateUsd}
                className="ml-auto px-3 h-9 premium-btn-primary text-white text-xs font-bold rounded-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Enregistrer
              </button>}
            </div>
            <p role="status" className="text-xs font-bold text-positive-text min-h-4">
              {rateSaved && parsedRate === exchangeRateUsd ? 'Taux enregistré.' : ''}
            </p>
          </form>
        </div>
      </section>
    </div>
  );
};
