import React, { useState } from 'react';
import { 
  FileText, Share2, Printer, Plus, Trash2, Edit2, Save, Download, 
  Check, Phone, User, MapPin, Building, ShieldCheck, Sparkles, FolderOpen,
  Receipt, Landmark, Globe, Smartphone, ChevronRight, ChevronLeft,
  Hammer, Layers, Sun, Home, Wrench, Shield, CheckCircle2, ArrowRight
} from 'lucide-react';
import { CountryCode, CurrencyCode, DevisDocument, DevisItem, Language, RegionTunisia, UnitSystem } from '../types';
import { formatDevisForWhatsApp, openWhatsApp } from '../utils/whatsapp';
import { COUNTRIES_CONFIG, CURRENCY_SYMBOLS, convertFromTnd, formatPrice } from '../data/countryConfig';

interface DevisTabProps {
  devis: DevisDocument;
  setDevis: React.Dispatch<React.SetStateAction<DevisDocument>>;
  devisHistory: DevisDocument[];
  onSaveDevisHistory: (devis: DevisDocument) => void;
  onLoadFromHistory: (devis: DevisDocument) => void;
  onDeleteFromHistory: (id: string) => void;
  lang: Language;
  region: RegionTunisia;
  country: CountryCode;
  currency: CurrencyCode;
  unitSystem: UnitSystem;
}

export const DevisTab: React.FC<DevisTabProps> = ({
  devis,
  setDevis,
  devisHistory,
  onSaveDevisHistory,
  onLoadFromHistory,
  onDeleteFromHistory,
  lang,
  region,
  country,
  currency,
  unitSystem
}) => {
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('u');
  const [newItemPrice, setNewItemPrice] = useState(0);
  const [includeTimbre, setIncludeTimbre] = useState(country === 'TN' || country === 'DZ');
  const [retenueGarantiePercent, setRetenueGarantiePercent] = useState(0);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Multi-Step Request Wizard State
  const [showWizard, setShowWizard] = useState(true);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardProjectType, setWizardProjectType] = useState<'placo' | 'renovation' | 'construction' | 'isolation'>('placo');
  const [wizardSurface, setWizardSurface] = useState<number>(45);
  const [wizardLocation, setWizardLocation] = useState<string>('Tunis / Grand Tunis');
  const [wizardQuality, setWizardQuality] = useState<'standard' | 'premium' | 'luxe'>('premium');

  const countryInfo = COUNTRIES_CONFIG[country] || COUNTRIES_CONFIG.TN;
  const currMeta = CURRENCY_SYMBOLS[currency] || { symbol: currency, decimals: 2 };

  // Recalculate totals
  const subtotalMaterials = devis.items
    .filter(i => !i.title.toLowerCase().includes("main d'œuvre") && !i.title.toLowerCase().includes("khidma") && !i.title.toLowerCase().includes("labor"))
    .reduce((acc, item) => acc + (item.totalConverted || item.totalTnd || 0), 0);

  const subtotalLabor = devis.items
    .filter(i => i.title.toLowerCase().includes("main d'œuvre") || i.title.toLowerCase().includes("khidma") || i.title.toLowerCase().includes("labor"))
    .reduce((acc, item) => acc + (item.totalConverted || item.totalTnd || 0), 0);

  const rawSubtotal = devis.items.reduce((acc, item) => acc + (item.totalConverted ?? item.totalTnd ?? item.total ?? 0), 0);
  const discountAmount = devis.discount || devis.discountTnd || 0;
  const netHtSubtotal = Math.max(0, rawSubtotal - discountAmount);
  
  const activeTvaPercent = devis.tvaPercent ?? countryInfo.defaultVatRate;
  const tvaAmount = activeTvaPercent > 0 ? (netHtSubtotal * activeTvaPercent) / 100 : 0;
  
  const timbreAmount = includeTimbre ? countryInfo.timbreFiscalDefault : 0;
  const totalTtc = netHtSubtotal + tvaAmount + timbreAmount;
  const retenueAmount = (netHtSubtotal * retenueGarantiePercent) / 100;
  const netAPayer = totalTtc - retenueAmount;

  // Wizard quick generation helper
  const handleApplyWizard = () => {
    let presetItems: DevisItem[] = [];
    const area = wizardSurface || 40;
    const mult = wizardQuality === 'luxe' ? 1.35 : wizardQuality === 'premium' ? 1.15 : 1.0;

    if (wizardProjectType === 'placo') {
      presetItems = [
        {
          id: `wiz-${Date.now()}-1`,
          trade: 'placo',
          title: 'Plaques Placo BA13 Hydrofuge/Standard (1.2x2.5m)',
          quantity: Math.ceil((area * 1.05) / 3),
          unit: 'plaque',
          unitPrice: Math.round(36 * mult),
          total: Math.ceil((area * 1.05) / 3) * Math.round(36 * mult),
          unitPriceTnd: Math.round(36 * mult),
          totalTnd: Math.ceil((area * 1.05) / 3) * Math.round(36 * mult),
          unitPriceConverted: Math.round(36 * mult),
          totalConverted: Math.ceil((area * 1.05) / 3) * Math.round(36 * mult),
          details: 'Norme DTU 25.41 avec marge de chute 5%'
        },
        {
          id: `wiz-${Date.now()}-2`,
          trade: 'placo',
          title: 'Ossature Métallique Fourrures F47 / Rails 48',
          quantity: Math.ceil((area * 2) / 3),
          unit: 'barre 3m',
          unitPrice: 8.5,
          total: Math.ceil((area * 2) / 3) * 8.5,
          unitPriceTnd: 8.5,
          totalTnd: Math.ceil((area * 2) / 3) * 8.5,
          unitPriceConverted: 8.5,
          totalConverted: Math.ceil((area * 2) / 3) * 8.5,
          details: 'Entraxe 50cm & suspentes pivot'
        },
        {
          id: `wiz-${Date.now()}-3`,
          trade: 'placo',
          title: 'Enduit à joint 25kg & Bande armée 90m',
          quantity: Math.max(1, Math.ceil(area * 0.35 / 25)),
          unit: 'sac 25kg',
          unitPrice: 42.0,
          total: Math.max(1, Math.ceil(area * 0.35 / 25)) * 42.0,
          unitPriceTnd: 42.0,
          totalTnd: Math.max(1, Math.ceil(area * 0.35 / 25)) * 42.0,
          unitPriceConverted: 42.0,
          totalConverted: Math.max(1, Math.ceil(area * 0.35 / 25)) * 42.0,
          details: 'Finition 2 passes ponçage prêt à peindre'
        },
        {
          id: `wiz-${Date.now()}-4`,
          trade: 'placo',
          title: 'Main d’œuvre Fourniture & Pose Plaquiste Certifié',
          quantity: area,
          unit: 'm²',
          unitPrice: Math.round(18 * mult),
          total: area * Math.round(18 * mult),
          unitPriceTnd: Math.round(18 * mult),
          totalTnd: area * Math.round(18 * mult),
          unitPriceConverted: Math.round(18 * mult),
          totalConverted: area * Math.round(18 * mult),
          details: 'Pose complète, calicot et joints finition Q3'
        }
      ];
    } else if (wizardProjectType === 'renovation') {
      presetItems = [
        {
          id: `wiz-${Date.now()}-1`,
          trade: 'maconnerie',
          title: 'Démolition cloisons, dépose revêtements & évacuation gravats',
          quantity: area,
          unit: 'm²',
          unitPrice: 15,
          total: area * 15,
          unitPriceTnd: 15,
          totalTnd: area * 15,
          unitPriceConverted: 15,
          totalConverted: area * 15,
          details: 'Évacuation décharge contrôlée'
        },
        {
          id: `wiz-${Date.now()}-2`,
          trade: 'carrelage',
          title: 'Fourniture & Pose Grès Cérame Grand Format 60x120',
          quantity: area,
          unit: 'm²',
          unitPrice: Math.round(75 * mult),
          total: area * Math.round(75 * mult),
          unitPriceTnd: Math.round(75 * mult),
          totalTnd: area * Math.round(75 * mult),
          unitPriceConverted: Math.round(75 * mult),
          totalConverted: area * Math.round(75 * mult),
          details: 'Colle C2TE haute performance et joints hydrofuges'
        },
        {
          id: `wiz-${Date.now()}-3`,
          trade: 'peinture',
          title: 'Mise en peinture acrylique satinée 3 couches + enduit ratissage',
          quantity: area * 2.5,
          unit: 'm²',
          unitPrice: 14,
          total: area * 2.5 * 14,
          unitPriceTnd: 14,
          totalTnd: area * 2.5 * 14,
          unitPriceConverted: 14,
          totalConverted: area * 2.5 * 14,
          details: 'Finition soignée sans aspérités'
        }
      ];
    } else if (wizardProjectType === 'isolation') {
      presetItems = [
        {
          id: `wiz-${Date.now()}-1`,
          trade: 'isolation',
          title: 'Fourniture Laine de Roche 50mm Haute Densité',
          quantity: Math.ceil((area * 1.05) / 7.2),
          unit: 'paquet 7.2m²',
          unitPrice: 90,
          total: Math.ceil((area * 1.05) / 7.2) * 90,
          unitPriceTnd: 90,
          totalTnd: Math.ceil((area * 1.05) / 7.2) * 90,
          unitPriceConverted: 90,
          totalConverted: Math.ceil((area * 1.05) / 7.2) * 90,
          details: 'Résistance thermique R = 1.45 m²K/W'
        },
        {
          id: `wiz-${Date.now()}-2`,
          trade: 'isolation',
          title: 'Pose de bande résiliente acoustique & étanchéité à l’air',
          quantity: Math.ceil(area * 0.8),
          unit: 'ml',
          unitPrice: 3.5,
          total: Math.ceil(area * 0.8) * 3.5,
          unitPriceTnd: 3.5,
          totalTnd: Math.ceil(area * 0.8) * 3.5,
          unitPriceConverted: 3.5,
          totalConverted: Math.ceil(area * 0.8) * 3.5,
          details: 'Désolidarisation périphérique phonique'
        },
        {
          id: `wiz-${Date.now()}-3`,
          trade: 'isolation',
          title: 'Main d’œuvre Pose Isolant Thermique & Phonique',
          quantity: area,
          unit: 'm²',
          unitPrice: 8,
          total: area * 8,
          unitPriceTnd: 8,
          totalTnd: area * 8,
          unitPriceConverted: 8,
          totalConverted: area * 8,
          details: 'Pose conforme règles de l’art'
        }
      ];
    } else {
      // Construction neuve
      presetItems = [
        {
          id: `wiz-${Date.now()}-1`,
          trade: 'maconnerie',
          title: 'Maçonnerie brique 12 trous & mortier ciment dosé à 350kg',
          quantity: area,
          unit: 'm²',
          unitPrice: 32,
          total: area * 32,
          unitPriceTnd: 32,
          totalTnd: area * 32,
          unitPriceConverted: 32,
          totalConverted: area * 32,
          details: 'Élévation des murs et linteaux béton armé'
        },
        {
          id: `wiz-${Date.now()}-2`,
          trade: 'placo',
          title: 'Doublage thermique intérieur & faux plafonds BA13',
          quantity: area,
          unit: 'm²',
          unitPrice: 38,
          total: area * 38,
          unitPriceTnd: 38,
          totalTnd: area * 38,
          unitPriceConverted: 38,
          totalConverted: area * 38,
          details: 'Système complet avec isolant thermo-acoustique'
        }
      ];
    }

    setDevis(prev => ({
      ...prev,
      projectTitle: `${wizardProjectType.toUpperCase()} - ${wizardLocation} (${area}m²)`,
      items: [...prev.items, ...presetItems]
    }));
    setWizardStep(4);
  };


  // Update Devis Object
  const handleUpdateField = (field: keyof DevisDocument, value: any) => {
    setDevis(prev => ({
      ...prev,
      [field]: value,
      total: field === 'discount' || field === 'tvaPercent' ? totalTtc : prev.total,
      currency: currency
    }));
  };

  const handleAddItem = () => {
    if (!newItemTitle) return;
    const newItem: DevisItem = {
      id: `custom-${Date.now()}`,
      trade: 'placo',
      title: newItemTitle,
      quantity: newItemQty,
      unit: newItemUnit,
      unitPrice: newItemPrice,
      total: newItemQty * newItemPrice,
      unitPriceTnd: newItemPrice,
      totalTnd: newItemQty * newItemPrice,
      unitPriceConverted: newItemPrice,
      totalConverted: newItemQty * newItemPrice,
      details: 'Fourniture & pose selon cahier des charges'
    };
    setDevis(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setNewItemTitle('');
    setNewItemQty(1);
    setNewItemPrice(0);
  };

  const handleRemoveItem = (id: string) => {
    setDevis(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id)
    }));
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const text = formatDevisForWhatsApp({ ...devis, totalTnd: totalTtc }, lang === 'fr' ? 'fr' : 'derja');
    openWhatsApp(text, devis.clientPhone);
  };

  const handleSaveToHistory = () => {
    onSaveDevisHistory({
      ...devis,
      totalTnd: totalTtc,
      tvaPercent: activeTvaPercent,
      currency: currency
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Ribbon - Hidden on print */}
      <div className="bg-[#131b2e] rounded-2xl p-4 sm:p-5 border border-[#1e293b] shadow-xl flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>{lang === 'derja' ? 'إدارة التقارير والـ Devis الرسمي' : 'Générateur de Devis & Factures Pro'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-950 text-amber-400 border border-slate-800 font-mono font-bold">
                {countryInfo.flag} {currency}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {lang === 'derja' ? 'طباعة Devis مهني على ورق A4 أو إرساله مباشرة للزبون عبر الواتساب' : 'Formatage A4 aux normes BTP avec TVA, Timbre Fiscal et Retenue de Garantie'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowWizard(!showWizard)}
            className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-bold rounded-xl border border-amber-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{showWizard ? 'Masquer l’Assistant' : 'Assistant Devis Guidé'}</span>
          </button>

          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span>Historique ({devisHistory.length})</span>
          </button>

          <button
            onClick={handleSaveToHistory}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {savedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4 text-amber-400" />}
            <span>{savedSuccess ? 'Enregistré !' : 'Sauvegarder'}</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>WhatsApp Client</span>
          </button>

          <button
            onClick={handlePrintPdf}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 stroke-[2.5]" />
            <span>Imprimer / PDF A4</span>
          </button>
        </div>
      </div>

      {/* MULTI-STEP REQUEST WIZARD (ASSISTANT DEVIS ÉTAPE PAR ÉTAPE) - Print: Hidden */}
      {showWizard && (
        <div className="bg-[#131b2e] rounded-3xl p-6 border border-[#1e293b] shadow-2xl space-y-6 print:hidden relative overflow-hidden bg-blueprint">
          
          {/* Top Wizard Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                  Assistant Intelligent
                </span>
                <h3 className="text-base font-black text-white">
                  Création Rapide de Devis par Étape
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Sélectionnez le type d'intervention et configurez vos spécifications en 4 étapes fluides.
              </p>
            </div>

            <div className="text-xs font-mono font-bold text-amber-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              Étape {wizardStep} sur 4
            </div>
          </div>

          {/* AMBER / GOLD PROGRESS INDICATOR BAR */}
          <div className="space-y-2">
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 rounded-full transition-all duration-500 shadow-md shadow-amber-500/50"
                style={{ width: `${(wizardStep / 4) * 100}%` }}
              />
            </div>

            <div className="grid grid-cols-4 text-center text-[11px] font-bold">
              <span className={wizardStep >= 1 ? 'text-amber-400' : 'text-slate-500'}>
                1. Type de Projet
              </span>
              <span className={wizardStep >= 2 ? 'text-amber-400' : 'text-slate-500'}>
                2. Dimensions
              </span>
              <span className={wizardStep >= 3 ? 'text-amber-400' : 'text-slate-500'}>
                3. Matériaux & Pose
              </span>
              <span className={wizardStep >= 4 ? 'text-amber-400' : 'text-slate-500'}>
                4. Finalisation
              </span>
            </div>
          </div>

          {/* STEP 1: PROJECT TYPE SELECTION (VISUAL CARDS) */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-200">
                1. Quel type d'ouvrage souhaitez-vous chiffrer ?
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    id: 'placo',
                    title: 'Placo & Faux Plafonds',
                    sub: 'Plafonds suspendus BA13, cloisons M48, caissons LED & gorges',
                    icon: Layers,
                    badge: 'Recommandé Plaquiste'
                  },
                  {
                    id: 'renovation',
                    title: 'Rénovation Complète',
                    sub: 'Revêtement carrelage, peinture intégrale & reprise maçonnerie',
                    icon: Home,
                    badge: 'Clé en main'
                  },
                  {
                    id: 'isolation',
                    title: 'Isolation & Acoustique',
                    sub: 'Laine de roche, laine de verre, bande résiliente & pare-vapeur',
                    icon: Sun,
                    badge: 'Confort thermique'
                  },
                  {
                    id: 'construction',
                    title: 'Gros Œuvre & Maçonnerie',
                    sub: 'Élévation briques 12 trous, doublage & cloisons de distribution',
                    icon: Hammer,
                    badge: 'BTP Structure'
                  }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setWizardProjectType(item.id as any)}
                    className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative flex flex-col justify-between h-44 ${
                      wizardProjectType === item.id
                        ? 'bg-amber-500/10 border-amber-500 shadow-xl shadow-amber-500/15'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-2.5 rounded-xl ${wizardProjectType === item.id ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-amber-400 border border-slate-800'}`}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        {wizardProjectType === item.id && (
                          <CheckCircle2 className="w-5 h-5 text-amber-400" />
                        )}
                      </div>
                      <h5 className="text-sm font-bold text-white mb-1">{item.title}</h5>
                      <p className="text-xs text-slate-400 line-clamp-2">{item.sub}</p>
                    </div>

                    <span className="text-[10px] font-mono text-amber-400/90 font-bold">
                      {item.badge}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Continuer : Dimensions & Spécifications</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: DIMENSIONS & SITE CONFIG */}
          {wizardStep === 2 && (
            <div className="space-y-5">
              <h4 className="text-sm font-bold text-slate-200">
                2. Surface estimée et localisation du chantier
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Surface du Projet (m²)</label>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={wizardSurface}
                    onChange={(e) => setWizardSurface(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Equivalent env. {Math.round(wizardSurface * 1.05 / 3)} plaques standard</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Région / Gouvernorat</label>
                  <input
                    type="text"
                    value={wizardLocation}
                    onChange={(e) => setWizardLocation(e.target.value)}
                    placeholder="Ex: Tunis, Sousse, Sfax, Nabeul..."
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Pour adaptation des frais logistiques</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Gamme de Finition</label>
                  <select
                    value={wizardQuality}
                    onChange={(e) => setWizardQuality(e.target.value as any)}
                    className="w-full bg-[#131b2e] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold"
                  >
                    <option value="standard">Standard (Locatif / Économique)</option>
                    <option value="premium">Premium (Résidentiel / Villa Q3)</option>
                    <option value="luxe">Luxe & Tertiaire (Haut standing)</option>
                  </select>
                  <span className="text-[10px] text-slate-400">Coefficient qualité appliqué</span>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Précédent</span>
                </button>

                <button
                  onClick={() => setWizardStep(3)}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Continuer : Prévisualiser le Bordereau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PRE-POPULATION SUMMARY */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-200">
                3. Validation des postes de fournitures et main d'œuvre
              </h4>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="font-bold text-white">Poste sélectionné :</span>
                  <span className="text-amber-400 font-bold uppercase font-mono">{wizardProjectType} ({wizardSurface} m²)</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Gamme sélectionnée :</span>
                  <span className="font-bold text-emerald-400">{wizardQuality.toUpperCase()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Chantier :</span>
                  <span className="text-slate-200">{wizardLocation}</span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  En cliquant sur "Générer et Insérer dans le Devis", les lignes de calcul conformes au barème 2026 seront automatiquement injectées dans votre document officiel ci-dessous.
                </p>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Précédent</span>
                </button>

                <button
                  onClick={handleApplyWizard}
                  className="px-7 py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-xl shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Générer et Insérer dans le Devis</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: COMPLETED BANNER */}
          {wizardStep === 4 && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                  ✓
                </div>
                <div>
                  <h5 className="text-xs font-black text-white">Lignes de devis générées avec succès !</h5>
                  <p className="text-[11px] text-slate-300">
                    Vous pouvez maintenant ajuster les quantités, personnaliser les prix unitaires ou imprimer en PDF ci-dessous.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setWizardStep(1)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer flex-shrink-0"
              >
                Nouveau Chiffrage
              </button>
            </div>
          )}

        </div>
      )}

      {/* Main Printable Document Canvas */}
      <div className="bg-[#131b2e] print:bg-white rounded-3xl p-6 sm:p-10 border border-[#1e293b] print:border-none shadow-2xl space-y-8 text-white print:text-black transition-all">
        
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-800 print:border-slate-300 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black text-sm print:border print:border-black">
                K
              </div>
              <span className="text-xl sm:text-2xl font-black tracking-tight font-mono text-white print:text-black">
                {devis.companyName || 'KONSTRIVO BTP PRO'}
              </span>
            </div>
            <div className="text-xs text-slate-400 print:text-slate-600 space-y-0.5">
              <p className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400 print:text-slate-600" />
                <span>{devis.companyAddress || `Tunis - Région ${region}`} • {countryInfo.nameFr}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400 print:text-slate-600" />
                <span>Tél : {devis.companyPhone || '+216 71 000 000'}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-amber-400 print:text-slate-600" />
                <span>R.C / Matricule Fiscal : {devis.companyMatricule || '1849204/A/M/000'}</span>
              </p>
              <p className="text-[10px] text-amber-400/80 print:text-slate-500 font-mono">
                Normes d'Exécution : {countryInfo.buildingCodes}
              </p>
            </div>
          </div>

          {/* Right Reference Box */}
          <div className="bg-slate-950 print:bg-slate-100 p-4 rounded-2xl border border-slate-800 print:border-slate-300 min-w-[240px] space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-400 print:text-slate-600">DOCUMENT :</span>
              <span className="font-mono font-black text-amber-400 print:text-amber-800 uppercase">
                {devis.type === 'facture' ? 'FACTURE OFFICIELLE' : 'DEVIS ESTIMATIF'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 print:text-slate-600">RÉFÉRENCE :</span>
              <input
                type="text"
                value={devis.reference}
                onChange={(e) => handleUpdateField('reference', e.target.value)}
                className="bg-transparent text-right font-mono font-bold text-white print:text-black focus:outline-none w-28"
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 print:text-slate-600">DATE ÉMISSION :</span>
              <input
                type="date"
                value={devis.date}
                onChange={(e) => handleUpdateField('date', e.target.value)}
                className="bg-transparent text-right font-mono text-white print:text-black focus:outline-none"
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 print:text-slate-600">VALIDITÉ :</span>
              <span className="font-mono text-slate-300 print:text-slate-700">{devis.validityDays || 30} Jours</span>
            </div>
          </div>
        </div>

        {/* Client & Project Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-950 print:bg-slate-50 p-4 rounded-2xl border border-slate-800 print:border-slate-300 space-y-2">
            <h4 className="text-xs font-black text-amber-400 print:text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Informations Client (الزبون)</span>
            </h4>
            <div className="space-y-1.5 text-xs">
              <input
                type="text"
                placeholder="Nom du Client / Raison Sociale"
                value={devis.clientName}
                onChange={(e) => handleUpdateField('clientName', e.target.value)}
                className="w-full bg-slate-900 print:bg-white border border-slate-800 print:border-slate-300 rounded-lg px-2.5 py-1.5 text-white print:text-black font-bold focus:outline-none"
              />
              <input
                type="text"
                placeholder="Téléphone / WhatsApp"
                value={devis.clientPhone}
                onChange={(e) => handleUpdateField('clientPhone', e.target.value)}
                className="w-full bg-slate-900 print:bg-white border border-slate-800 print:border-slate-300 rounded-lg px-2.5 py-1.5 text-white print:text-black font-mono focus:outline-none"
              />
              <input
                type="text"
                placeholder="Adresse du Chantier / Ville"
                value={devis.clientAddress}
                onChange={(e) => handleUpdateField('clientAddress', e.target.value)}
                className="w-full bg-slate-900 print:bg-white border border-slate-800 print:border-slate-300 rounded-lg px-2.5 py-1.5 text-white print:text-black focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-slate-950 print:bg-slate-50 p-4 rounded-2xl border border-slate-800 print:border-slate-300 space-y-2">
            <h4 className="text-xs font-black text-amber-400 print:text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" />
              <span>Projet & Localisation Chantier</span>
            </h4>
            <div className="space-y-1.5 text-xs">
              <input
                type="text"
                placeholder="Intitulé du Projet (ex: Rénovation Faux Plafond Villa)"
                value={devis.projectTitle}
                onChange={(e) => handleUpdateField('projectTitle', e.target.value)}
                className="w-full bg-slate-900 print:bg-white border border-slate-800 print:border-slate-300 rounded-lg px-2.5 py-1.5 text-white print:text-black font-bold focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-slate-900 print:bg-white rounded-lg border border-slate-800 print:border-slate-300">
                  <span className="text-[10px] text-slate-400 print:text-slate-500 block">Pays & Devise :</span>
                  <span className="font-bold text-slate-200 print:text-black font-mono">
                    {countryInfo.flag} {countryInfo.nameFr} ({currency})
                  </span>
                </div>
                <div className="p-2 bg-slate-900 print:bg-white rounded-lg border border-slate-800 print:border-slate-300">
                  <span className="text-[10px] text-slate-400 print:text-slate-500 block">Système de Mesure :</span>
                  <span className="font-bold text-slate-200 print:text-black uppercase">
                    {unitSystem === 'metric' ? 'Métrique (m²)' : 'Imperial (sq ft)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-white print:text-black uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400 print:text-slate-700" />
              <span>Détail des Prestations & Fournitures BTP</span>
            </h3>
            <span className="text-xs text-slate-400 print:text-slate-600 font-mono">
              {devis.items.length} lignes enregistrées
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 print:border-slate-300">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 print:bg-slate-100 text-slate-300 print:text-slate-700 font-bold border-b border-slate-800 print:border-slate-300">
                <tr>
                  <th className="p-3">Désignation des Travaux & Matériaux</th>
                  <th className="p-3 text-center w-20">Qté</th>
                  <th className="p-3 text-center w-20">Unité</th>
                  <th className="p-3 text-right w-28">P.U ({currMeta.symbol})</th>
                  <th className="p-3 text-right w-32">Total H.T ({currMeta.symbol})</th>
                  <th className="p-3 text-center w-12 print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                {devis.items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 print:hover:bg-transparent">
                    <td className="p-3">
                      <div className="font-bold text-slate-100 print:text-black">{item.title}</div>
                      {item.details && (
                        <div className="text-[10px] text-slate-400 print:text-slate-600 mt-0.5">{item.details}</div>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-200 print:text-black">
                      {item.quantity}
                    </td>
                    <td className="p-3 text-center text-slate-400 print:text-slate-600 font-medium">
                      {item.unit}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-300 print:text-black">
                      {((item.unitPriceConverted ?? item.unitPriceTnd) || 0).toFixed(currMeta.decimals)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-amber-400 print:text-black">
                      {((item.totalConverted ?? item.totalTnd) || 0).toFixed(currMeta.decimals)}
                    </td>
                    <td className="p-3 text-center print:hidden">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                        title="Supprimer la ligne"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {devis.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 print:text-slate-400">
                      Aucune ligne dans le devis. Utilisez la <strong>Calculatrice</strong> pour insérer les résultats ou ajoutez une ligne ci-dessous.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Add Custom Item Form - Hidden on print */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 flex flex-wrap items-center gap-2 print:hidden">
            <input
              type="text"
              placeholder="Ajouter une prestation manuelle (ex: Pose échafaudage, Nettoyage fin de chantier)..."
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              className="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <input
              type="number"
              min={1}
              value={newItemQty}
              onChange={(e) => setNewItemQty(parseFloat(e.target.value) || 1)}
              className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white text-center font-mono focus:outline-none"
              placeholder="Qté"
            />
            <select
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white font-bold focus:outline-none"
            >
              <option value="m²">m²</option>
              <option value="ml">ml</option>
              <option value="u">u</option>
              <option value="forfait">Forfait</option>
              <option value="jour">Jour</option>
            </select>
            <input
              type="number"
              min={0}
              step={0.5}
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
              className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-amber-400 font-mono text-right focus:outline-none"
              placeholder={`Prix (${currMeta.symbol})`}
            />
            <button
              type="button"
              onClick={handleAddItem}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>

        {/* Financial Recapitulation & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-slate-800 print:border-slate-300">
          
          {/* Left: Notes & Conditions */}
          <div className="md:col-span-7 space-y-3 text-xs">
            <label className="font-bold text-slate-300 print:text-slate-800 block">
              Conditions Générales d'Exécution & Modalités de Règlement :
            </label>
            <textarea
              rows={4}
              value={devis.notes || "Conditions: Acompte de 40% au démarrage du chantier, 40% à l'avancement des ossatures/plaques, solde de 20% à la réception définitive. Travaux réalisés selon DTU en vigueur."}
              onChange={(e) => handleUpdateField('notes', e.target.value)}
              className="w-full bg-slate-950 print:bg-white border border-slate-800 print:border-slate-300 rounded-2xl p-3.5 text-xs text-white print:text-black font-medium focus:outline-none"
            />

            {/* Signature stamps area on print */}
            <div className="hidden print:grid grid-cols-2 gap-8 pt-8 text-center text-xs">
              <div className="border border-slate-300 p-6 rounded-xl min-h-[100px]">
                <span className="font-bold block mb-1">Cachet & Signature de l'Entreprise</span>
                <span className="text-[10px] text-slate-500">Bon pour accord et exécution</span>
              </div>
              <div className="border border-slate-300 p-6 rounded-xl min-h-[100px]">
                <span className="font-bold block mb-1">Signature du Client / Maître d'Ouvrage</span>
                <span className="text-[10px] text-slate-500">Lu et approuvé - Date et Mention manuscrite</span>
              </div>
            </div>
          </div>

          {/* Right: Calculations with Fiscal Details */}
          <div className="md:col-span-5 bg-slate-950 print:bg-slate-50 p-5 rounded-2xl border border-slate-800 print:border-slate-300 space-y-2.5 text-xs">
            
            <div className="flex justify-between text-slate-300 print:text-slate-700">
              <span>Sous-total Fournitures (Matériaux) :</span>
              <span className="font-mono font-bold">{subtotalMaterials.toFixed(currMeta.decimals)} {currMeta.symbol}</span>
            </div>

            <div className="flex justify-between text-slate-300 print:text-slate-700">
              <span>Sous-total Main d'œuvre (Chantier) :</span>
              <span className="font-mono font-bold">{subtotalLabor.toFixed(currMeta.decimals)} {currMeta.symbol}</span>
            </div>

            {/* Discount Input */}
            <div className="flex justify-between items-center text-slate-300 print:text-slate-700 py-1">
              <span>Remise Commerciale ({currMeta.symbol}) :</span>
              <input
                type="number"
                value={devis.discount || 0}
                onChange={(e) => handleUpdateField('discount', parseFloat(e.target.value) || 0)}
                className="w-24 bg-slate-900 print:bg-white border border-slate-800 print:border-slate-300 rounded-lg px-2 py-0.5 text-right font-mono font-bold text-amber-400 print:text-amber-700 text-xs"
              />
            </div>

            <div className="flex justify-between text-slate-100 print:text-slate-900 font-black border-t border-slate-900 print:border-slate-200 pt-1.5">
              <span>TOTAL NET H.T :</span>
              <span className="font-mono">{netHtSubtotal.toFixed(currMeta.decimals)} {currMeta.symbol}</span>
            </div>

            {/* Dynamic Country TVA Option */}
            <div className="flex justify-between items-center text-slate-300 print:text-slate-700 py-1">
              <span>Taux TVA ({countryInfo.nameFr}) :</span>
              <select
                value={activeTvaPercent}
                onChange={(e) => handleUpdateField('tvaPercent', parseFloat(e.target.value) || 0)}
                className="bg-slate-900 print:bg-white border border-slate-800 print:border-slate-300 rounded-lg px-2 py-0.5 font-mono text-xs font-bold text-white print:text-black"
              >
                {countryInfo.vatRates.map((vr) => (
                  <option key={vr.rate} value={vr.rate}>
                    {vr.label}
                  </option>
                ))}
              </select>
            </div>

            {activeTvaPercent > 0 && (
              <div className="flex justify-between text-slate-300 print:text-slate-700">
                <span>Montant TVA ({activeTvaPercent}%) :</span>
                <span className="font-mono font-bold text-slate-200 print:text-slate-800">
                  +{tvaAmount.toFixed(currMeta.decimals)} {currMeta.symbol}
                </span>
              </div>
            )}

            {/* Timbre Fiscal Option */}
            <div className="flex justify-between items-center text-slate-300 print:text-slate-700 py-1">
              <span>Timbre Fiscal ({countryInfo.timbreLabel}) :</span>
              <button
                type="button"
                onClick={() => setIncludeTimbre(!includeTimbre)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                  includeTimbre ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {includeTimbre ? `+${countryInfo.timbreFiscalDefault.toFixed(currMeta.decimals)} Inclus` : 'Exonéré'}
              </button>
            </div>

            {/* Retenue de Garantie Option */}
            <div className="flex justify-between items-center text-slate-300 print:text-slate-700 py-1">
              <span>Retenue de Garantie :</span>
              <select
                value={retenueGarantiePercent}
                onChange={(e) => setRetenueGarantiePercent(parseFloat(e.target.value) || 0)}
                className="bg-slate-900 print:bg-white border border-slate-800 print:border-slate-300 rounded-lg px-2 py-0.5 font-mono text-xs font-bold text-white print:text-black"
              >
                <option value={0}>0% (Sans Retenue)</option>
                <option value={5}>5% (Chantiers Standard BTP)</option>
                <option value={10}>10% (Marchés Publics & Tertiaires)</option>
              </select>
            </div>

            {/* Grand Total TTC */}
            <div className="border-t border-slate-800 print:border-slate-300 pt-2 flex justify-between items-center">
              <span className="text-sm font-black text-amber-400 print:text-amber-800 uppercase">TOTAL GÉNÉRAL TTC :</span>
              <span className="text-lg font-black text-amber-400 print:text-amber-800 font-mono">
                {totalTtc.toFixed(currMeta.decimals)} <span className="text-xs text-slate-400">{currMeta.symbol}</span>
              </span>
            </div>

            {/* Net à Payer after Retenue */}
            {retenueGarantiePercent > 0 && (
              <div className="border-t border-slate-800 print:border-slate-300 pt-1.5 flex justify-between items-center text-emerald-400 print:text-emerald-700">
                <span className="text-xs font-black uppercase">NET À PAYER (APRÈS RETENUE) :</span>
                <span className="text-base font-black font-mono">
                  {netAPayer.toFixed(currMeta.decimals)} <span className="text-xs text-slate-400">{currMeta.symbol}</span>
                </span>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-amber-400" />
                <span>Historique des Devis Enregistrés</span>
              </h3>
              <button 
                onClick={() => setShowHistoryModal(false)} 
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {devisHistory.map(dh => (
                <div key={dh.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-xs">{dh.clientName || 'Client sans nom'} - {dh.projectTitle || 'Projet'}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{dh.reference} • {dh.date} • {dh.items.length} articles</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {dh.totalTnd.toFixed(2)} {currMeta.symbol}
                    </span>
                    <button
                      onClick={() => { onLoadFromHistory(dh); setShowHistoryModal(false); }}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Ouvrir
                    </button>
                    <button
                      onClick={() => onDeleteFromHistory(dh.id)}
                      className="p-1 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {devisHistory.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">Aucun devis enregistré dans l'historique.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
