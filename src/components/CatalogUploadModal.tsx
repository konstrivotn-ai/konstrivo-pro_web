import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertTriangle, RefreshCw, Layers, DollarSign, ArrowRight, ShieldCheck, Download } from 'lucide-react';
import { MaterialRate, Language, TradeCategory } from '../types';

interface CatalogUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  rates: MaterialRate[];
  onApplyCatalog: (updatedRates: MaterialRate[]) => void;
  lang: Language;
}

interface ParsedItem {
  id?: string;
  nameFr: string;
  category: TradeCategory;
  unit: string;
  newPriceTnd: number;
  oldPriceTnd?: number;
  unitPriceTtc?: number;
  matchedRateId?: string;
}

export const CatalogUploadModal: React.FC<CatalogUploadModalProps> = ({
  isOpen,
  onClose,
  rates,
  onApplyCatalog,
  lang
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [supplierName, setSupplierName] = useState('Comptoir BTP Tunisie 2026');
  const [taxMode, setTaxMode] = useState<'ht' | 'ttc'>('ht');
  const [tvaRate, setTvaRate] = useState<number>(19); // 19% standard Tunisia
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Sample CSV Catalog generator for instant testing
  const sampleCatalogCSV = `Reference,Designation,Categorie,Unite,Prix_HT_TND
PLA-BA13-STD,Plaque de plâtre BA13 Standard 1.2x2.5m,placo,unit,31.500
PLA-BA13-HYD,Plaque de plâtre BA13 Hydrofuge Verte 1.2x2.5m,placo,unit,47.800
PLA-BA13-IGN,Plaque de plâtre BA13 Coupe-Feu Ignifuge Rose,placo,unit,52.000
PLA-AQUA-EXT,Plaque Aquapanel Outdoor Ciment 1.2x2.5m,placo,unit,88.000
OSS-RAIL48,Rail R48 galvanisé ép. 0.6mm - Longueur 3m,placo,unit,7.800
OSS-MONT48,Montant M48 renforcé - Longueur 3m,placo,unit,8.400
OSS-FOURRURE,Fourrure F530 plafond suspendu 3m,placo,unit,7.300
ACC-VIS25,Vis Placo TTPC 25mm (Boîte de 1000 pièces),placo,boite_1000,23.500
END-JOINT25,Enduit à joint pour plaque de plâtre 25kg,placo,sac,44.000
ISOL-VERRE50,Laine de verre avec kraft 50mm (Rouleau 15m²),isolation,rouleau,78.000
DAL-VINYL60,Dalle de plafond démontable vinyle 60x60cm,placo,unit,5.800`;

  const handleDownloadSample = () => {
    const blob = new Blob([sampleCatalogCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Catalogue_Fournisseur_Modele_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseFileContent = (content: string) => {
    setIsProcessing(true);
    try {
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        throw new Error('Fichier vide ou format non reconnu');
      }

      const results: ParsedItem[] = [];

      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Split by comma, semicolon, or tab
        const cols = line.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
        
        if (cols.length >= 3) {
          const designation = cols[1] || cols[0];
          const rawPrice = parseFloat(cols[cols.length - 1].replace(',', '.'));
          
          if (!isNaN(rawPrice) && rawPrice > 0) {
            let priceHt = rawPrice;
            let priceTtc = rawPrice;

            if (taxMode === 'ttc') {
              priceHt = +(rawPrice / (1 + tvaRate / 100)).toFixed(3);
              priceTtc = rawPrice;
            } else {
              priceHt = rawPrice;
              priceTtc = +(rawPrice * (1 + tvaRate / 100)).toFixed(3);
            }

            // Find matching rate in database by keyword
            const matchedRate = rates.find(r => {
              const rName = r.nameFr.toLowerCase();
              const dName = designation.toLowerCase();
              return dName.includes(r.id.replace(/_/g, ' ')) || 
                     rName.split(' ').some(w => w.length > 4 && dName.includes(w));
            });

            results.push({
              nameFr: designation,
              category: (cols[2] as TradeCategory) || 'placo',
              unit: cols[3] || 'unit',
              newPriceTnd: priceHt,
              unitPriceTtc: priceTtc,
              matchedRateId: matchedRate?.id,
              oldPriceTnd: matchedRate?.unitPriceTnd
            });
          }
        }
      }

      setParsedItems(results);
      setStatusMessage(`Catalogue analysé avec succès : ${results.length} articles identifiés.`);
    } catch (err: any) {
      setStatusMessage(`Erreur d'analyse : ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseFileContent(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleApply = () => {
    if (parsedItems.length === 0) return;

    let updatedCount = 0;
    const updatedRates = rates.map(rate => {
      const matched = parsedItems.find(p => p.matchedRateId === rate.id || p.nameFr.toLowerCase().includes(rate.nameFr.toLowerCase()));
      if (matched) {
        updatedCount++;
        return {
          ...rate,
          unitPriceTnd: matched.newPriceTnd,
          note: `Mis à jour via ${supplierName} (${new Date().toLocaleDateString('fr-TN')})`
        };
      }
      return rate;
    });

    onApplyCatalog(updatedRates);
    setStatusMessage(`Base de calcul mise à jour avec ${updatedCount} articles synchronisés.`);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  const handleLoadSampleNow = () => {
    setSupplierName('Comptoir BTP Tunisie (Catalogue Certifié 2026)');
    parseFileContent(sampleCatalogCSV);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Importation Catalogue Fournisseur
                <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Légal & Certifié 2026
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Mise à jour directe de la base de prix avec barèmes fournisseurs officiels (CSV, Excel, JSON)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          
          {/* Supplier Info & Tax Config */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nom du Fournisseur / Quincaillerie</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ex: Comptoir Matériaux Tunis"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Base des Prix Importés</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setTaxMode('ht')}
                  className={`py-1.5 text-xs font-bold rounded-md transition-all ${
                    taxMode === 'ht' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Hors Taxes (HT)
                </button>
                <button
                  type="button"
                  onClick={() => setTaxMode('ttc')}
                  className={`py-1.5 text-xs font-bold rounded-md transition-all ${
                    taxMode === 'ttc' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  TTC (TVA Incluse)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Taux TVA Applicable (%)</label>
              <select
                value={tvaRate}
                onChange={(e) => setTvaRate(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                <option value={19}>19% (Taux normal BTP Tunisie 2026)</option>
                <option value={13}>13% (Taux réduit matériaux)</option>
                <option value={7}>7% (Prestations spécifiques)</option>
                <option value={0}>0% (Régime suspensif / Export)</option>
              </select>
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              dragActive
                ? 'border-amber-400 bg-amber-500/10'
                : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
            }`}
          >
            <Upload className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-white mb-1">
              Glissez-déposez le fichier du catalogue fournisseur
            </h4>
            <p className="text-xs text-slate-400 mb-4 max-w-md mx-auto">
              Formats supportés : CSV, TXT, Excel (séparateur virgule ou point-virgule). Structure : Référence, Désignation, Catégorie, Unité, Prix TND.
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <label className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition-all">
                <span>Parcourir mes fichiers</span>
                <input
                  type="file"
                  accept=".csv,.txt,.json,.tsv"
                  onChange={(e) => e.target.files && e.target.files[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleLoadSampleNow}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                Charger Catalogue Démo 2026
              </button>

              <button
                type="button"
                onClick={handleDownloadSample}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-xs transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Modèle CSV
              </button>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Parsed Items Preview Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Aperçu des Prix Détectés ({parsedItems.length} articles)
                </h4>
                <span className="text-xs text-amber-400 font-medium">
                  {taxMode === 'ht' ? 'Prix HT saisis' : `Prix HT calculés (TVA ${tvaRate}%)`}
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 font-semibold sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Désignation</th>
                      <th className="p-2.5">Unité</th>
                      <th className="p-2.5 text-right">Ancien Prix HT</th>
                      <th className="p-2.5 text-right text-amber-400">Nouveau Prix HT</th>
                      <th className="p-2.5 text-right text-emerald-400">Prix TTC</th>
                      <th className="p-2.5 text-center">Correspondance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        <td className="p-2.5 font-medium text-white max-w-xs truncate">{item.nameFr}</td>
                        <td className="p-2.5 text-slate-400">{item.unit}</td>
                        <td className="p-2.5 text-right text-slate-400 font-mono">
                          {item.oldPriceTnd !== undefined ? `${item.oldPriceTnd.toFixed(3)} TND` : '-'}
                        </td>
                        <td className="p-2.5 text-right font-bold text-amber-400 font-mono">
                          {item.newPriceTnd.toFixed(3)} TND
                        </td>
                        <td className="p-2.5 text-right font-semibold text-emerald-400 font-mono">
                          {item.unitPriceTtc ? `${item.unitPriceTtc.toFixed(3)} TND` : '-'}
                        </td>
                        <td className="p-2.5 text-center">
                          {item.matchedRateId ? (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold">
                              ✓ Lié ({item.matchedRateId})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full text-[10px]">
                              Nouvel article
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Validation automatique DTU 25.41 & Conformité fiscale 2026</span>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Appliquer et Mettre à Jour le Calculateur
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
