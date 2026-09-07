export type Language = 'fr' | 'ar' | 'derja';

export type CountryCode = 'TN' | 'FR' | 'DZ' | 'SA' | 'AE' | 'US' | 'GLOBAL';
export type CurrencyCode = 'TND' | 'EUR' | 'DZD' | 'SAR' | 'AED' | 'USD';
export type UnitSystem = 'metric' | 'imperial';

export interface CountryConfig {
  code: CountryCode;
  nameFr: string;
  nameAr: string;
  flag: string;
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  defaultVatRate: number;
  vatRates: Array<{ rate: number; label: string }>;
  timbreFiscalDefault: number;
  timbreLabel: string;
  standardRetenueRate: number;
  buildingCodes: string;
  unitSystem: UnitSystem;
}

export type TradeCategory = 
  | 'placo' 
  | 'peinture' 
  | 'carrelage' 
  | 'maconnerie' 
  | 'plomberie' 
  | 'electricite' 
  | 'etancheite' 
  | 'isolation' 
  | 'menuiserie' 
  | 'sols' 
  | 'facade' 
  | 'demolition';

export interface MaterialRate {
  id: string;
  category: TradeCategory;
  nameFr: string;
  nameAr: string;
  nameDerja: string;
  unit: 'unit' | 'm²' | 'ml' | 'kg' | 'sac' | 'boite' | 'rouleau' | 'boite_1000' | 'tube' | 'm³' | 'point' | 'panneau' | 'mètre';
  unitPriceTnd: number; // Base reference price in TND
  defaultPriceTnd: number;
  note?: string;
}

export interface MaterialItemResult {
  id: string;
  nameFr: string;
  nameAr: string;
  qty: number;
  unit: string;
  unitPriceTnd: number;
  totalTnd: number;
  unitPriceConverted?: number;
  totalConverted?: number;
  category: string;
  packageInfo?: string; // e.g. "1 boite de 1000", "3 sacs de 25kg"
  formulaUsed?: string; // e.g. "(Surface × 1.05) / 3.0"
}

export interface CalculationResult {
  trade: TradeCategory;
  subType: string;
  subTypeTitle: string;
  areaM2: number;
  netAreaM2: number;
  perimeterM: number;
  materialItems: MaterialItemResult[];
  totalMaterialTnd: number;
  estimatedLaborTnd: number;
  grandTotalTnd: number; // Total HT
  wasteMarginPercent: number;
  fieldNotes: string[];
  // Fiscalité & Ingénierie
  tvaPercent: number;
  tvaAmountTnd: number;
  timbreFiscalTnd: number;
  retenueGarantiePercent: number;
  retenueGarantieTnd: number;
  totalTtcTnd: number; // Total TTC (HT + TVA + Timbre)
  netAPayerTnd: number; // Net après retenue
  executionSteps?: string[];
  // Generalized & Converted fields for Internationalization
  currency?: CurrencyCode;
  currencySymbol?: string;
  totalMaterialConverted?: number;
  estimatedLaborConverted?: number;
  grandTotalConverted?: number;
  tvaAmountConverted?: number;
  timbreFiscalConverted?: number;
  retenueGarantieConverted?: number;
  totalTtcConverted?: number;
  netAPayerConverted?: number;
  equipmentOverheadConverted?: number;
  estimatedLaborDays?: number;
}

export interface DevisItem {
  id: string;
  trade: TradeCategory;
  title: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  unitPriceTnd?: number;
  totalTnd?: number;
  unitPriceConverted?: number;
  totalConverted?: number;
  details?: string;
}

export interface DevisDocument {
  id: string;
  reference: string;
  date: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  projectTitle: string;
  country: CountryCode;
  currency: CurrencyCode;
  region: string;
  items: DevisItem[];
  subtotalMaterials: number;
  subtotalLabor: number;
  discount: number;
  subtotalMaterialsTnd?: number;
  subtotalLaborTnd?: number;
  discountTnd?: number;
  totalTnd?: number;
  // Optimistic concurrency version maintained by server (integer)
  version?: number;
  tvaPercent: number;
  timbreFiscal: number;
  timbreFiscalTnd?: number;
  retenueGarantiePercent: number;
  total: number;
  notes: string;
  status: 'brouillon' | 'envoye' | 'valide';
  // Company identity — client-side fields ONLY (edited in the Devis view,
  // resolved/fallback via utils/devisFields.ts; NOT persisted as DB columns).
  companyName?: string;
  companyPhone?: string;
  companyMatricule?: string;
  companyAddress?: string;
}

export interface KnowledgeArticle {
  id: string;
  partNumber: number;
  code: string;
  titleFr: string;
  titleAr: string;
  category: TradeCategory;
  introduction: string;
  subTypes?: Array<{
    name: string;
    description: string;
    specs: string;
  }>;
  executionSteps: string[];
  dimensionsTable: Array<{
    element: string;
    standard: string;
    notes?: string;
  }>;
  formulas: string[];
  variables: string[];
  tips: string[];
}

export type RegionTunisia = 
  | 'Tunis Grand' 
  | 'Ariana' 
  | 'Ben Arous' 
  | 'Manouba' 
  | 'Nabeul / Cap Bon' 
  | 'Bizerte' 
  | 'Sousse / Sahel' 
  | 'Monastir' 
  | 'Mahdia' 
  | 'Sfax' 
  | 'Kairouan' 
  | 'Gabès' 
  | 'Médenine / Djerba' 
  | 'Béja' 
  | 'Jendouba' 
  | 'Autre / Tout le pays';

// USER AUTH & ROLES
export type UserRole = 
  | 'particulier' 
  | 'artisan' 
  | 'fournisseur' 
  | 'ingenieur' 
  | 'admin'
  | 'client'
  | 'contractor'
  | 'vendor'
  | 'engineer';

export interface UserProfile {
  id: string;
  name?: string;
  fullName?: string;
  role: UserRole;
  email: string;
  phone: string;
  company?: string;
  companyName?: string;
  matriculeFiscale?: string;
  taxNumber?: string;
  licenseNumber?: string;
  avatarUrl?: string;
  avatar?: string;
  region: string;
  country?: CountryCode;
  rating?: number;
  completedChantiersCount?: number;
  isVerified?: boolean;
  createdAt?: string;
}

// PLACO & BOARD DEEP SPECIFICATIONS
export type PlacoBoardType = 
  | 'plaque_ba13_standard' 
  | 'plaque_ba13_hydrofuge' 
  | 'plaque_ba13_coupe_feu' 
  | 'plaque_ba13_phonique' 
  | 'plaque_habito_durete' 
  | 'plaque_aquapanel_exterieur' 
  | 'plaque_aquapanel_interieur' 
  | 'plaque_silicate_calcium' 
  | 'panneau_pvc_plafond';

export type PlacoThickness = '6mm' | '9.5mm' | '12.5mm' | '15mm' | '18mm' | '25mm';
export type PlacoDimension = '120x250' | '120x280' | '120x300' | '90x200';
export type PlacoStudProfile = '48mm' | '70mm' | '90mm';

// PROJECT & CHANTIER MANAGEMENT
export interface ChantierPhase {
  id: string;
  title: string;
  description: string;
  trade: TradeCategory;
  startDate: string;
  endDate: string;
  status: 'en_attente' | 'en_cours' | 'valide' | 'retard';
  progressPercent: number;
  estimatedCost: number;
  actualCost: number;
}

export interface SiteLogEntry {
  id: string;
  date: string;
  time: string;
  authorName: string;
  authorRole: string;
  category: 'avancement' | 'incident' | 'livraison' | 'controle_qualite' | 'meteo';
  content: string;
  photosCount?: number;
  validated: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  roleTitle: string;
  phone: string;
  trade: TradeCategory;
  status: 'actif' | 'chantier_voisin' | 'conge';
}

export interface ChantierProject {
  id: string;
  code: string;
  name: string;
  clientName: string;
  clientPhone: string;
  address: string;
  region: string;
  country: CountryCode;
  currency: CurrencyCode;
  type: 'residentiel' | 'commercial' | 'renovation' | 'villa_neuve' | 'bureau';
  status: 'planification' | 'en_cours' | 'reception_provisoire' | 'cloture';
  progressPercent: number;
  budgetTotalHt: number;
  depensesActuellesHt: number;
  startDate: string;
  targetEndDate: string;
  managerName: string;
  phases: ChantierPhase[];
  logs: SiteLogEntry[];
  team: TeamMember[];
  notes: string;
}

// PROFESSIONAL DIRECTORY & MARKETPLACE
export interface ArtisanDirectoryItem {
  id: string;
  name: string;
  company: string;
  trade: TradeCategory;
  secondaryTrades: TradeCategory[];
  region: string;
  rating: number;
  reviewsCount: number;
  isVerified: boolean;
  isPro2026: boolean;
  phone: string;
  whatsapp: string;
  avatar: string;
  bio: string;
  hourlyRateTnd: number;
  squareMeterRateTnd: number;
  services: string[];
  badges: string[];
}

export interface MarketProduct {
  id: string;
  name: string;
  category: TradeCategory;
  brand: string;
  priceTnd: number;
  priceConverted?: number;
  unit: string;
  stockQty: number;
  supplierName: string;
  supplierPhone: string;
  supplierLocation: string;
  isAvailable: boolean;
  specs: string;
  minOrderQty: number;
}

// ON-DEMAND MAINTENANCE & TECHNICAL SERVICES
export type UrgentServiceType = 
  | 'fuite_eau' 
  | 'court_circuit' 
  | 'fissure_placo' 
  | 'infiltration_toit' 
  | 'serrure_bloquee' 
  | 'climatisation_panne' 
  | 'peinture_retouche' 
  | 'carreau_casse';

export interface MaintenanceTicket {
  id: string;
  ticketCode: string;
  title: string;
  serviceType: UrgentServiceType;
  trade: TradeCategory;
  urgency: 'normal_48h' | 'urgent_24h' | 'urgence_extreme_2h';
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  region: string;
  status: 'signalé' | 'artisan_assigné' | 'en_route' | 'en_intervention' | 'clôturé';
  description: string;
  estimatedPrice: number;
  assignedTechnician?: string;
  createdAt: string;
  scheduledTime?: string;
}

export interface CatalogImportResult {
  fileName: string;
  itemsParsed: number;
  itemsUpdated: number;
  itemsAdded: number;
  timestamp: string;
  supplierName?: string;
  taxIncluded: boolean;
}

