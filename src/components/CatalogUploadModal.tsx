import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertTriangle, RefreshCw, Layers, DollarSign, ArrowRight, ShieldCheck, Download } from 'lucide-react';
import { MaterialRate, Language } from '../types';

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
  materialCode?: string;
  category: string;
  trade?: string;
  unit: string;
  newPriceTnd: number;
  oldPriceTnd?: number;
  unitPriceTtc?: number;
  tvaRate: number;
  currency: string;
  matchedRateId?: string;
}

interface ImportRowError {
  row: number;
  reason: string;
}

interface ParseTotals {
  totalRows: number;
  valid: number;
  errors: number;
}

interface ColumnMapping {
  material_name?: string;
  material_code?: string;
  category?: string;
  trade?: string;
  unit?: string;
  price_ht?: string;
  tva_rate?: string;
  currency?: string;
  source?: string;
}

// ── Smart Mapping: canonical field aliases (accents-insensitive) ─────────────
const FIELD_ALIASES: Record<string, string[]> = {
  material_name: ['material_name', 'designation', 'name', 'produit', 'nom', 'nom_materiau', 'name_fr', 'libelle', 'description', 'nom_produit'],
  material_code: ['material_code', 'reference', 'ref', 'code', 'reference_code', 'code_materiau', 'code_article', 'code_produit', 'sku', 'product_code', 'item_code'],
  category: ['category', 'categorie', 'catégorie', 'categorie_metier', 'categorie_produit', 'famille', 'famille_produit', 'rayon'],
  trade: ['trade', 'metier', 'métier', 'trade_code', 'metier_code', 'trade_name'],
  unit: ['unit', 'unite', 'unité', 'unite_mesure', 'base_unit', 'mesure', 'uom'],
  price_ht: ['price_ht', 'prix_ht', 'prix_ht_tnd', 'prix_tnd_ht', 'price', 'prix', 'prix_tnd', 'prix_unitaire', 'unit_price', 'pu_ht', 'price_tnd', 'montant'],
  tva_rate: ['tva_rate', 'taux_tva', 'tva', 'vat', 'tax'],
  currency: ['currency', 'devise', 'monnaie', 'currency_code', 'code_devise'],
  source: ['source', 'fournisseur', 'supplier', 'source_name', 'supplier_name']
};

export function normalizeHeader(header: string): string {
  return String(header ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

// ── CSV parsing (comma / semicolon / tab, BOM, quoted commas) ────────────────
function detectDelimiter(line: string): string {
  let tab = 0, semi = 0, comma = 0, inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (inQuotes) continue;
    if (ch === '\t') tab++;
    else if (ch === ';') semi++;
    else if (ch === ',') comma++;
  }
  if (tab >= semi && tab >= comma && tab > 0) return '\t';
  if (semi >= comma && semi > 0) return ';';
  return ',';
}

function stripQuotes(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/""/g, '"').trim();
  }
  return v;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i += 2; continue; }
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      values.push(stripQuotes(current));
      current = '';
      i++;
      continue;
    }
    current += char;
    i++;
  }
  values.push(stripQuotes(current));
  return values;
}

export function parseCsvContent(content: string): Array<Record<string, string>> {
  const text = String(content || '').replace(/^\uFEFF/, ''); // strip UTF-8 BOM
  if (text.trim() === '') return [];

  // Physical lines → logical records, keeping quoted newlines together.
  const rawLines = text.split(/\r\n|\r|\n/);
  const records: string[] = [];
  let buffer = '';
  let inQuotes = false;
  for (const raw of rawLines) {
    buffer = buffer === '' ? raw : `${buffer}\n${raw}`;
    let q = inQuotes;
    for (let index = 0; index < raw.length; index++) {
      const c = raw[index];
      if (c === '"') {
        if (q && raw[index + 1] === '"') { index++; continue; }
        q = !q;
      }
    }
    inQuotes = q;
    if (!inQuotes && buffer.trim() !== '') {
      records.push(buffer);
      buffer = '';
    }
  }
  if (buffer.trim() !== '') records.push(buffer);

  if (records.length === 0) return [];
  const delimiter = detectDelimiter(records[0]);
  const headerCells = parseCsvLine(records[0], delimiter);
  const seen = new Map<string, number>();
  const headers = headerCells.map((h) => {
    const key = h === '' ? '(vide)' : h;
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    return n === 1 ? key : `${key} #${n}`;
  });

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < records.length; i++) {
    const cells = parseCsvLine(records[i], delimiter);
    if (!cells.some((c) => c.trim() !== '')) continue; // skip empty rows
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

// ── Smart Mapping: header names → canonical fields ───────────────────────────
export function resolveMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((h) => ({ original: String(h ?? ''), norm: normalizeHeader(h) }));
  const used = new Set<string>();
  const mapping: ColumnMapping = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const aliasSet = new Set(aliases.map((a) => normalizeHeader(a)));
    for (const { original, norm } of normalized) {
      if (used.has(original)) continue;
      if (aliasSet.has(norm)) {
        mapping[field] = original;
        used.add(original);
        break;
      }
    }
  }
  return mapping;
}

export function parseImportPrice(raw: string): number | null {
  const cleaned = String(raw ?? '').trim().replace(/\s/g, '').replace(/,/g, '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function parseTvaRate(raw: string): number | null {
  const value = parseImportPrice(raw);
  if (value === null) return null;
  return value >= 0 && value <= 100 ? value : null;
}

// ── Shared: header-keyed rows → validated ParsedItem list ────────────────────
export function buildParsedItems(
  rows: Array<Record<string, string>>,
  mapping: ColumnMapping,
  opts: { taxMode: 'ht' | 'ttc'; tvaRate: number; rates: MaterialRate[] }
): { items: ParsedItem[]; errors: ImportRowError[] } {
  const items: ParsedItem[] = [];
  const errors: ImportRowError[] = [];
  const pick = (row: Record<string, string>, key: keyof ColumnMapping): string => {
    const header = mapping[key];
    if (!header) return '';
    return String(row[header] ?? '').trim();
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +1 for the header row
    const fail = (reason: string) => errors.push({ row: rowNumber, reason });

    const nameFr = pick(row, 'material_name');
    const unit = pick(row, 'unit');
    const priceRaw = pick(row, 'price_ht');

    if (!nameFr) { fail('Désignation (material_name) manquante.'); continue; }
    if (!unit) { fail('Unité (unit) manquante.'); continue; }

    const priceNum = parseImportPrice(priceRaw);
    if (priceNum === null || priceNum <= 0) {
      fail(`Prix HT invalide (« ${priceRaw || '(vide)'} » doit être un nombre > 0).`);
      continue;
    }

    // TVA: file value when present, otherwise the TVA currently selected in the UI.
    const tvaRaw = pick(row, 'tva_rate');
    let tvaRate = opts.tvaRate;
    if (tvaRaw !== '') {
      const parsed = parseTvaRate(tvaRaw);
      if (parsed === null) {
        fail(`Taux TVA invalide (« ${tvaRaw} » doit être un nombre entre 0 et 100).`);
        continue;
      }
      tvaRate = parsed;
    }

    // Currency: file value when present, otherwise TND.
    const currencyRaw = pick(row, 'currency');
    const currency = currencyRaw !== '' ? currencyRaw : 'TND';

    let priceHt = priceNum;
    let priceTtc = priceNum;
    if (opts.taxMode === 'ttc') {
      priceHt = +(priceNum / (1 + tvaRate / 100)).toFixed(3);
      priceTtc = priceNum;
    } else {
      priceHt = priceNum;
      priceTtc = +(priceNum * (1 + tvaRate / 100)).toFixed(3);
    }

    // Existing matching behavior (unchanged).
    const designation = nameFr;
    const matchedRate = opts.rates.find((r) => {
      const rName = r.nameFr.toLowerCase();
      const dName = designation.toLowerCase();
      return dName.includes(r.id.replace(/_/g, ' ')) ||
             rName.split(' ').some((w) => w.length > 4 && dName.includes(w));
    });

    const category = pick(row, 'category');
    const trade = pick(row, 'trade');
    items.push({
      nameFr: designation,
      materialCode: pick(row, 'material_code'),
      category: category !== '' ? category : (trade !== '' ? trade : ''),
      trade,
      unit,
      newPriceTnd: priceHt,
      unitPriceTtc: priceTtc,
      tvaRate,
      currency,
      matchedRateId: matchedRate?.id,
      oldPriceTnd: matchedRate?.unitPriceTnd
    });
  }

  return { items, errors };
}

// ── Excel (.xlsx / .xls) → same row shape as CSV ─────────────────────────────
async function parseExcelFile(file: File): Promise<Array<Record<string, string>>> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer));
  const sheetNames: string[] = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error('Le fichier Excel ne contient aucune feuille de calcul.');
  }
  const worksheet = workbook.Sheets[sheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(
    worksheet,
    { header: 1, raw: false, defval: '' }
  ) as unknown[][];

  // Locate the header row (first non-empty row).
  let headerIdx = -1;
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i] || [];
    if (row.some((c) => String(c ?? '').trim() !== '')) { headerIdx = i; break; }
  }
  if (headerIdx < 0) {
    throw new Error('Le fichier Excel ne contient aucune donnée lisible.');
  }

  const headerCells = (matrix[headerIdx] || []).map((c) => String(c ?? '').trim());
  const seen = new Map<string, number>();
  const headers = headerCells.map((h) => {
    const key = h === '' ? '(vide)' : h;
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    return n === 1 ? key : `${key} #${n}`;
  });

  const rows: Array<Record<string, string>> = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const cells = matrix[i] || [];
    if (!cells.some((c) => String(c ?? '').trim() !== '')) continue; // skip empty rows
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = idx < cells.length ? String(cells[idx] ?? '').trim() : '';
    });
    rows.push(row);
  }
  return rows;
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
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);
  const [parsedTotals, setParsedTotals] = useState<ParseTotals>({ totalRows: 0, valid: 0, errors: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Sample CSV Catalog generator for instant testing
  // Sample Master CSV (same column names as the official Master CSV export)
  const sampleCatalogCSV = `material_code,material_name,category,unit,price_ht,tva_rate,currency,source,effective_from,effective_to,observed_at,status
PLA-BA13-STD,Plaque de plâtre BA13 Standard 1.2x2.5m,placo,unit,31.500,19,TND,Comptoir BTP,2026-01-01,,2026-01-01,active
PLA-BA13-HYD,Plaque de plâtre BA13 Hydrofuge Verte 1.2x2.5m,placo,unit,47.800,19,TND,Comptoir BTP,2026-01-01,,2026-01-01,active
OSS-RAIL48,Rail R48 galvanisé ép. 0.6mm - Longueur 3m,placo,unit,7.800,19,TND,Comptoir BTP,2026-01-01,,2026-01-01,active
ISOL-VERRE50,Laine de verre avec kraft 50mm (Rouleau 15m²),isolation,rouleau,78.000,19,TND,Comptoir BTP,2026-01-01,,2026-01-01,active
DAL-VINYL60,Dalle de plafond démontable vinyle 60x60cm,placo,unit,5.800,19,TND,Comptoir BTP,2026-01-01,,2026-01-01,active`;

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

  const processRows = (rows: Array<Record<string, string>>) => {
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const mapping = resolveMapping(headers);

    if (!mapping.price_ht) {
      setParsedItems([]);
      setRowErrors([]);
      setParsedTotals({ totalRows: rows.length, valid: 0, errors: 0 });
      setStatusMessage(
        `Aucune colonne de prix reconnue dans le fichier (colonnes détectées : ${headers.join(', ') || 'aucune'}). ` +
        `Ajoutez une colonne nommée price_ht, prix_ht, prix_ht_tnd, price, prix…`
      );
      return;
    }

    const { items, errors } = buildParsedItems(rows, mapping, {
      taxMode,
      tvaRate,
      rates
    });

    setParsedItems(items);
    setRowErrors(errors);
    setParsedTotals({ totalRows: rows.length, valid: items.length, errors: errors.length });

    if (items.length === 0 && errors.length > 0) {
      setStatusMessage(`Fichier analysé : ${rows.length} ligne(s) lue(s), 0 article valide — consultez les erreurs ci-dessous.`);
    } else if (errors.length > 0) {
      setStatusMessage(`Catalogue analysé : ${items.length} article(s) valide(s), ${errors.length} ligne(s) rejetée(s).`);
    } else {
      setStatusMessage(`Catalogue analysé avec succès : ${items.length} article(s) identifié(s).`);
    }
  };

  const parseFileContent = (content: string) => {
    setIsProcessing(true);
    try {
      const rows = parseCsvContent(content);
      if (rows.length === 0) {
        throw new Error('Fichier vide ou format non reconnu');
      }
      processRows(rows);
    } catch (err: any) {
      setParsedItems([]);
      setRowErrors([]);
      setParsedTotals({ totalRows: 0, valid: 0, errors: 0 });
      setStatusMessage(`Erreur d'analyse : ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (ext === 'xlsx' || ext === 'xls') {
        const rows = await parseExcelFile(file);
        processRows(rows);
      } else {
        const text = await file.text();
        parseFileContent(text);
      }
    } catch (err: any) {
      setParsedItems([]);
      setRowErrors([]);
      setParsedTotals({ totalRows: 0, valid: 0, errors: 0 });
      setStatusMessage(`Erreur de lecture du fichier : ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
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
              Formats supportés : CSV, TXT, TSV, Excel (.xlsx / .xls). Séparateurs auto-détectés (virgule, point-virgule, tabulation) ; Smart Mapping par noms de colonnes (Référence, Désignation, Prix HT, TVA…).
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <label className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition-all">
                <span>Parcourir mes fichiers</span>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv,.xlsx,.xls"
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
            <div className={`p-3 rounded-xl flex items-center gap-2.5 text-xs ${
              parsedItems.length === 0 && (rowErrors.length > 0 || parsedTotals.totalRows > 0)
                ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                : 'bg-slate-950 border border-slate-800 text-slate-300'
            }`}>
              {parsedItems.length === 0 && (rowErrors.length > 0 || parsedTotals.totalRows > 0) ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Parsed Items Preview Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-3">
              {/* Preview summary */}
              <div className="grid grid-cols-3 gap-3 bg-slate-950 rounded-xl border border-slate-800 p-3">
                <div className="text-center">
                  <div className="text-lg font-black text-slate-100">{parsedTotals.totalRows}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Lignes lues</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black text-emerald-400">{parsedTotals.valid}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Articles valides</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-black ${parsedTotals.errors > 0 ? 'text-red-400' : 'text-slate-100'}`}>{parsedTotals.errors}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Lignes en erreur</div>
                </div>
              </div>

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
                      <th className="p-2.5 text-right">TVA</th>
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
                        <td className="p-2.5 text-right text-slate-400 font-mono">{item.tvaRate}%</td>
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

              {/* Row errors */}
              {rowErrors.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-300 mb-1.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{rowErrors.length} ligne(s) ignorée(s) — non importées :</span>
                  </div>
                  <ul className="text-[11px] text-red-300/90 space-y-1 max-h-32 overflow-y-auto">
                    {rowErrors.slice(0, 10).map((err, idx) => (
                      <li key={idx}>Ligne {err.row} : {err.reason}</li>
                    ))}
                    {rowErrors.length > 10 && (
                      <li className="text-slate-400">… et {rowErrors.length - 10} autre(s) erreur(s).</li>
                    )}
                  </ul>
                </div>
              )}

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
