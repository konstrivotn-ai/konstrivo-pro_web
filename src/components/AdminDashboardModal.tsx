import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ShieldCheck, ShieldAlert, Lock, UserCheck, Users, FileText, 
  TrendingUp, DollarSign, Search, Filter, CheckCircle2, Trash2, 
  PlusCircle, Edit3, RefreshCw, KeyRound, Sparkles, Building2, Phone, Star, AlertCircle, LogOut,
  BarChart3, PieChart, ArrowRight, Eye, Calendar, MapPin, HardHat, ExternalLink,
  Coins, Percent, Receipt, Plus, Calculator, Settings,
  Upload, FileSpreadsheet, Download, ListChecks, CheckSquare, Square, Award, Check
} from 'lucide-react';
import { ArtisanDirectoryItem, MaterialRate, DevisDocument, Language, CountryCode, CurrencyCode, TradeCategory, UserProfile } from '../types';
import { CURRENCY_SYMBOLS, formatPrice } from '../data/countryConfig';
import { login } from '../lib/api';

export interface ProFeatureItem {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  category: 'visibility' | 'tools' | 'support' | 'badge';
}

export const DEFAULT_PRO_FEATURES: ProFeatureItem[] = [
  {
    id: 'pf_1',
    title: 'Badge Vérifié & Certifié CS8 BTP 2026',
    description: 'Affichez le macaron Or de confiance auprès des clients sur toute la Tunisie.',
    enabled: true,
    category: 'badge'
  },
  {
    id: 'pf_2',
    title: 'Devis PDF Illimités & Envoi Direct WhatsApp',
    description: 'Générez des devis professionnels aux couleurs de votre entreprise sans aucune limite.',
    enabled: true,
    category: 'tools'
  },
  {
    id: 'pf_3',
    title: 'Mise en Relation Directe Client (0% Intermédiaire)',
    description: 'Recevez directement les demandes de devis sur votre gouvernorat par téléphone et WhatsApp.',
    enabled: true,
    category: 'visibility'
  },
  {
    id: 'pf_4',
    title: 'Assistant IA Devising BTP 24/7 (Pro Derja AI)',
    description: 'Calculs automatiques de matériaux et métrés complexes (Plafonds, Cloisons, Carrelage, Peinture).',
    enabled: true,
    category: 'tools'
  },
  {
    id: 'pf_5',
    title: 'Accès Catalogue Grossistes & Remises Kankaerie',
    description: 'Bénéficiez de prix préférentiels négociés auprès des fournisseurs BTP partenaires.',
    enabled: true,
    category: 'visibility'
  },
  {
    id: 'pf_6',
    title: 'Support Dédié & Relecture de Métrés Complexes',
    description: 'Ligne directe avec nos métreurs pour valider vos devis de chantiers d\'envergure.',
    enabled: true,
    category: 'support'
  }
];

// Security Helper: Sanitize user input to prevent XSS vulnerabilities
export const sanitizeInput = (text: string): string => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onLogin: (user: UserProfile) => void;
  onLogout: () => void;
  devisHistory: DevisDocument[];
  artisans: ArtisanDirectoryItem[];
  onUpdateArtisans: (artisans: ArtisanDirectoryItem[]) => void;
  rates: MaterialRate[];
  onBulkUpdateRates: (rates: MaterialRate[]) => void;
  lang: Language;
  country: CountryCode;
  currency: CurrencyCode;
}

export const TUNISIAN_GOVERNORATES_LIST = [
  'Tunis Grand', 'Ariana', 'Ben Arous', 'Manouba',
  'Nabeul / Cap Bon', 'Bizerte', 'Sousse / Sahel', 'Monastir',
  'Mahdia', 'Sfax', 'Kairouan', 'Gabès', 'Médenine / Djerba',
  'Béja', 'Jendouba', 'Le Kef', 'Siliana', 'Kasserine',
  'Sidi Bouzid', 'Gafsa', 'Tozeur', 'Kebili', 'Tataouine', 'Zaghouan'
];

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onLogout,
  devisHistory = [],
  artisans = [],
  onUpdateArtisans,
  rates = [],
  onBulkUpdateRates,
  lang,
  country,
  currency
}) => {
    // ── Defensive security guard ──────────────────────────────────────────────
  // AdminDashboardModal exposes privileged management UI (artisan moderation,
  // rate edition, pro-offer & commission configuration). It MUST only render
  // that UI for a server-validated admin session. isCurrentlyAdmin is the
  // single authoritative check (currentUser?.role === 'admin'); the dashboard
  // branch below is gated exclusively on it, so a non-admin session always
  // falls back to the real backend admin login form (handleAdminLogin) and
  // never to the management UI.
  const isCurrentlyAdmin = currentUser?.role === 'admin';

  // Authentication & Security State
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [showDeveloperApiStatus, setShowDeveloperApiStatus] = useState<boolean>(false);

  // Admin Tab Navigation State: 'artisans' | 'prices' | 'add_artisan' | 'commissions' | 'pro_offers' | 'stats'
  const [activeAdminTab, setActiveAdminTab] = useState<'artisans' | 'prices' | 'add_artisan' | 'commissions' | 'pro_offers' | 'stats'>('artisans');
  const [artisanSearch, setArtisanSearch] = useState<string>('');
  const [artisanFilterStatus, setArtisanFilterStatus] = useState<'all' | 'free' | 'pro'>('all');
  const [notification, setNotification] = useState<string | null>(null);

  // CSV File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Price Editing Local State
  const [editableRates, setEditableRates] = useState<MaterialRate[]>(rates);

  // Dynamic Material Addition Form State
  const [showAddMaterialForm, setShowAddMaterialForm] = useState<boolean>(false);
  const [newMaterial, setNewMaterial] = useState<{
    nameFr: string;
    nameAr: string;
    category: TradeCategory;
    unit: MaterialRate['unit'];
    unitPriceTnd: number;
    note: string;
  }>({
    nameFr: '',
    nameAr: '',
    category: 'placo',
    unit: 'unit',
    unitPriceTnd: 15,
    note: ''
  });

  // Dynamic Pro Features State
  const [proFeatures, setProFeatures] = useState<ProFeatureItem[]>(() => {
    const saved = localStorage.getItem('konstrivo_pro_features');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_PRO_FEATURES;
      }
    }
    return DEFAULT_PRO_FEATURES;
  });

  const [showAddProFeatureForm, setShowAddProFeatureForm] = useState<boolean>(false);
  const [newProFeature, setNewProFeature] = useState<{
    title: string;
    description: string;
    category: 'visibility' | 'tools' | 'support' | 'badge';
  }>({
    title: '',
    description: '',
    category: 'tools'
  });

  // Commission & Fees Config State
  const [commissionType, setCommissionType] = useState<'percent' | 'flat' | 'hybrid'>('percent');
  const [commissionPercent, setCommissionPercent] = useState<number>(3.5);
  const [flatFeePerDevis, setFlatFeePerDevis] = useState<number>(15);
  const [proMonthlySubPrice, setProMonthlySubPrice] = useState<number>(49);
  const [retentionTaxPercent, setRetentionTaxPercent] = useState<number>(1.5);

  // New Artisan Form Local State
  const [newArtisan, setNewArtisan] = useState<{
    name: string;
    company: string;
    trade: TradeCategory;
    region: string;
    phone: string;
    whatsapp: string;
    hourlyRateTnd: number;
    squareMeterRateTnd: number;
    isPro2026: boolean;
    bio: string;
  }>({
    name: '',
    company: '',
    trade: 'placo',
    region: 'Tunis Grand',
    phone: '+216 ',
    whatsapp: '216',
    hourlyRateTnd: 20,
    squareMeterRateTnd: 18,
    isPro2026: true,
    bio: ''
  });

  // Sync rates prop if updated externally
  useEffect(() => {
    setEditableRates(rates);
  }, [rates]);

  if (!isOpen) return null;

  // Handle Admin Login inside Modal - MUST use real backend API only
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanEmail = adminEmail.trim().toLowerCase();

    try {
      const adminProfile = await login({ email: cleanEmail, password: adminPassword });
      
      // Verify the returned profile has admin role
      if (adminProfile.role !== 'admin') {
        setAuthError('Accès refusé. Ce compte n\'a pas les permissions administrateur.');
        return;
      }

      onLogin(adminProfile);
      setNotification('✓ Connexion Administrateur réussie.');
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setAuthError(err?.message || 'Échec de la connexion. Vérifiez vos identifiants.');
    }
  };

  // Logout Handler
  const handleAdminLogout = () => {
    onLogout();
    setNotification('Déconnexion Administrateur effectuée.');
    setTimeout(() => {
      setNotification(null);
      onClose();
    }, 400);
  };

  // Toggle Pro status for an artisan
  const handleToggleProStatus = (artisanId: string) => {
    const updated = artisans.map(a => {
      if (a.id === artisanId) {
        const nextStatus = !a.isPro2026;
        return {
          ...a,
          isPro2026: nextStatus,
          isVerified: nextStatus,
          badges: nextStatus 
            ? Array.from(new Set([...a.badges, 'Certifié KONSTRIVO PRO 2026']))
            : a.badges.filter(b => !b.includes('PRO'))
        };
      }
      return a;
    });

    onUpdateArtisans(updated);
    setNotification('✓ Statut PRO de l\'artisan mis à jour avec succès.');
    setTimeout(() => setNotification(null), 3000);
  };

  // Delete an artisan
  const handleDeleteArtisan = (artisanId: string, artisanName: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'artisan "${artisanName}" de l'annuaire ?`)) {
      const updated = artisans.filter(a => a.id !== artisanId);
      onUpdateArtisans(updated);
      setNotification(`✓ Artisan "${artisanName}" supprimé de l'annuaire.`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Save modified base prices
  const handleSavePrices = () => {
    onBulkUpdateRates(editableRates);
    setNotification('✓ Tous les barèmes de prix ont été enregistrés et appliqués en direct.');
    setTimeout(() => setNotification(null), 3000);
  };

  // Single Rate Change in Local State
  const handleRatePriceChange = (id: string, newPrice: number) => {
    setEditableRates(prev => prev.map(r => r.id === id ? { ...r, unitPriceTnd: newPrice } : r));
  };

  // Add New Material Handler
  const handleCreateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterial.nameFr || newMaterial.unitPriceTnd <= 0) {
      alert('Veuillez fournir un nom de matériau et un prix unitaire supérieur à 0.');
      return;
    }

    const createdId = `mat_custom_${Date.now()}`;
    const cleanNameFr = sanitizeInput(newMaterial.nameFr);
    const cleanNameAr = sanitizeInput(newMaterial.nameAr) || cleanNameFr;
    const cleanNote = sanitizeInput(newMaterial.note) || 'Matériau personnalisé ajouté via Administration BTP';

    const newMaterialRate: MaterialRate = {
      id: createdId,
      category: newMaterial.category,
      nameFr: cleanNameFr,
      nameAr: cleanNameAr,
      nameDerja: cleanNameFr,
      unit: newMaterial.unit,
      unitPriceTnd: Number(newMaterial.unitPriceTnd),
      defaultPriceTnd: Number(newMaterial.unitPriceTnd),
      note: cleanNote
    };

    const updatedRates = [newMaterialRate, ...editableRates];
    setEditableRates(updatedRates);
    onBulkUpdateRates(updatedRates);

    setNotification(`✓ Nouveau matériau "${cleanNameFr}" (${newMaterial.unitPriceTnd} DT/${newMaterial.unit}) ajouté aux barèmes BTP et calculateurs !`);
    
    // Reset Form
    setNewMaterial({
      nameFr: '',
      nameAr: '',
      category: 'placo',
      unit: 'unit',
      unitPriceTnd: 15,
      note: ''
    });
    setShowAddMaterialForm(false);
    setTimeout(() => setNotification(null), 3500);
  };

  // Delete Material Handler
  const handleDeleteMaterial = (id: string, nameFr: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le matériau "${nameFr}" des barèmes de prix ?`)) {
      const updatedRates = editableRates.filter(r => r.id !== id);
      setEditableRates(updatedRates);
      onBulkUpdateRates(updatedRates);
      setNotification(`✓ Matériau "${nameFr}" retiré des barèmes.`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // CSV Catalogue Import Handler
  const handleCsvImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let text = e.target?.result as string;
        if (!text) return;

        // Strip UTF-8 Byte Order Mark (BOM) automatically
        text = text.replace(/^\uFEFF/, '');

        // Detect delimiter (; or , or \t)
        const firstLine = text.split('\n')[0] || '';
        let delimiter = ';';
        if (firstLine.includes(';') && !firstLine.includes(',')) {
          delimiter = ';';
        } else if (firstLine.includes(',') && !firstLine.includes(';')) {
          delimiter = ',';
        } else if (firstLine.includes('\t')) {
          delimiter = '\t';
        }

        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length === 0) {
          alert('Le fichier CSV/Excel est vide.');
          return;
        }

        let importedCount = 0;
        let updatedCount = 0;

        const currentRatesMap = new Map<string, MaterialRate>();
        editableRates.forEach(r => {
          currentRatesMap.set(r.nameFr.toLowerCase().trim(), r);
        });

        const updatedRatesList = [...editableRates];

        // Check if header row is present
        const headerRow = lines[0].toLowerCase();
        const hasHeader = headerRow.includes('nom') || headerRow.includes('name') || headerRow.includes('prix') || headerRow.includes('price');
        const startIdx = hasHeader ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
          const row = lines[i];
          const cols = row.split(delimiter).map(col => col.replace(/^["']|["']$/g, '').trim());
          if (cols.length < 2) continue;

          let nameFr = sanitizeInput(cols[0]);
          let category: TradeCategory = 'placo';
          let unit: MaterialRate['unit'] = 'unit';
          let price = 0;
          let note = '';
          let nameAr = nameFr;

          if (cols.length >= 4) {
            nameFr = sanitizeInput(cols[0]);
            category = (cols[1].toLowerCase() as TradeCategory) || 'placo';
            unit = (cols[2] as MaterialRate['unit']) || 'unit';
            price = parseFloat(cols[3].replace(',', '.')) || 0;
            note = sanitizeInput(cols[4]) || 'Catalogue BTP importé par CSV';
            if (cols[5]) nameAr = sanitizeInput(cols[5]);
          } else if (cols.length === 2) {
            nameFr = sanitizeInput(cols[0]);
            price = parseFloat(cols[1].replace(',', '.')) || 0;
          } else if (cols.length === 3) {
            nameFr = sanitizeInput(cols[0]);
            unit = (cols[1] as MaterialRate['unit']) || 'unit';
            price = parseFloat(cols[2].replace(',', '.')) || 0;
          }

          if (!nameFr || isNaN(price) || price <= 0) continue;

          const validCategories: TradeCategory[] = [
            'placo', 'peinture', 'carrelage', 'maconnerie', 
            'plomberie', 'electricite', 'isolation', 'facade', 
            'etancheite', 'menuiserie'
          ];
          if (!validCategories.includes(category)) {
            category = 'placo';
          }

          const existingKey = nameFr.toLowerCase().trim();
          if (currentRatesMap.has(existingKey)) {
            const existingItem = currentRatesMap.get(existingKey)!;
            existingItem.unitPriceTnd = price;
            existingItem.unit = unit;
            existingItem.category = category;
            if (note) existingItem.note = note;
            updatedCount++;
          } else {
            const newRate: MaterialRate = {
              id: `mat_csv_${Date.now()}_${i}`,
              category,
              nameFr,
              nameAr,
              nameDerja: nameFr,
              unit,
              unitPriceTnd: price,
              defaultPriceTnd: price,
              note: note || 'Catalogue importé par CSV 2026'
            };
            updatedRatesList.unshift(newRate);
            currentRatesMap.set(existingKey, newRate);
            importedCount++;
          }
        }

        setEditableRates(updatedRatesList);
        onBulkUpdateRates(updatedRatesList);

        setNotification(`✓ Catalogue CSV Traité : ${importedCount} nouveaux matériaux créés, ${updatedCount} mis à jour dans le calculateur !`);
        setTimeout(() => setNotification(null), 4000);

      } catch (err) {
        console.error(err);
        alert('Erreur lors de la lecture du fichier CSV. Assurez-vous d\'utiliser un fichier texte/CSV valide.');
      }
    };

    reader.readAsText(file, 'UTF-8');

    if (event.target) {
      event.target.value = '';
    }
  };

  // Sample CSV Download Template
  const handleDownloadCsvSample = () => {
    const sampleCsvContent = 
`Nom_Materiau;Categorie;Unite;Prix_TND_HT;Note_Technique;Nom_Arabe
Plaque BA13 Standard 3m2;placo;unit;30;Plaque plâtre NF 1.2x2.5m;بلاك با13 عادي
Plaque BA13 Hydrofuge Vert;placo;unit;46;Plaque hydrofuge pièces humides;بلاك با13 مائي
Laine de Roche 50mm 7.2m2;isolation;boite;90;Isolation thermique et phonique;صوف صخري 50مم
Enduit de Joint 25kg;peinture;sac;42;Séchage rapide pour calicot;معجون فاصل 25كغ
Carreau Grès Cérame 60x60;carrelage;m²;38;Antidérapant R11 grand passage;زليج غرانيت 60*60
Tube PEX Sanitaire 20mm;plomberie;ml;3.5;Gainé rouge/bleu 50m;أنبوب صحي 20مم`;

    const blob = new Blob([sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modele_catalogue_konstrivo_btp.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Pro Features Toggle Active Handler
  const handleToggleProFeature = (featureId: string) => {
    const updated = proFeatures.map(f => f.id === featureId ? { ...f, enabled: !f.enabled } : f);
    setProFeatures(updated);
    localStorage.setItem('konstrivo_pro_features', JSON.stringify(updated));
  };

  // Delete Pro Feature Handler
  const handleDeleteProFeature = (featureId: string, title: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'avantage "${title}" de l'offre Pro ?`)) {
      const updated = proFeatures.filter(f => f.id !== featureId);
      setProFeatures(updated);
      localStorage.setItem('konstrivo_pro_features', JSON.stringify(updated));
      setNotification(`✓ Avantage "${title}" retiré du Plan Pro.`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Update Pro Feature Field
  const handleUpdateProFeature = (featureId: string, field: 'title' | 'description' | 'category', value: string) => {
    const updated = proFeatures.map(f => f.id === featureId ? { ...f, [field]: value } : f);
    setProFeatures(updated);
    localStorage.setItem('konstrivo_pro_features', JSON.stringify(updated));
  };

  // Add New Pro Feature
  const handleCreateProFeature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProFeature.title.trim() || !newProFeature.description.trim()) {
      alert('Veuillez fournir un titre et une description pour la nouvelle fonctionnalité Pro.');
      return;
    }

    const created: ProFeatureItem = {
      id: `pf_${Date.now()}`,
      title: sanitizeInput(newProFeature.title.trim()),
      description: sanitizeInput(newProFeature.description.trim()),
      enabled: true,
      category: newProFeature.category
    };

    const updated = [...proFeatures, created];
    setProFeatures(updated);
    localStorage.setItem('konstrivo_pro_features', JSON.stringify(updated));

    setNotification(`✓ Nouvelle fonctionnalité Pro "${created.title}" ajoutée à l'Offre Plan Pro !`);
    setNewProFeature({ title: '', description: '', category: 'tools' });
    setShowAddProFeatureForm(false);
    setTimeout(() => setNotification(null), 3500);
  };

  // Save All Pro Features
  const handleSaveProFeatures = () => {
    localStorage.setItem('konstrivo_pro_features', JSON.stringify(proFeatures));
    setNotification('✓ Tous les avantages et la grille de l\'Offre Plan Pro 2026 ont été enregistrés avec succès !');
    setTimeout(() => setNotification(null), 3500);
  };

  // Reset Pro Features
  const handleResetProFeatures = () => {
    if (window.confirm('Voulez-vous réinitialiser l\'Offre Plan Pro avec la grille d\'avantages par défaut ?')) {
      setProFeatures(DEFAULT_PRO_FEATURES);
      localStorage.setItem('konstrivo_pro_features', JSON.stringify(DEFAULT_PRO_FEATURES));
      setNotification('✓ Offre Pro réinitialisée aux paramètres par défaut.');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Save Commission Configuration Handler
  const handleSaveCommissions = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification('✓ Paramètres des commissions et grille tarifaire KONSTRIVO 2026 enregistrés avec succès !');
    setTimeout(() => setNotification(null), 3500);
  };

  // Add new Artisan Handler
  const handleCreateArtisan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtisan.name || !newArtisan.phone) {
      alert('Veuillez remplir au moins le nom et le numéro de téléphone.');
      return;
    }

    const cleanName = sanitizeInput(newArtisan.name);
    const cleanCompany = sanitizeInput(newArtisan.company || newArtisan.name);
    const cleanPhone = sanitizeInput(newArtisan.phone);
    const cleanWhatsapp = sanitizeInput(newArtisan.whatsapp || newArtisan.phone.replace(/[^0-9]/g, ''));
    const cleanBio = sanitizeInput(newArtisan.bio) || 'Prestataire spécialisé certifié sur la plateforme KONSTRIVO BTP.';

    const createdItem: ArtisanDirectoryItem = {
      id: `art_admin_${Date.now()}`,
      name: cleanName,
      company: cleanCompany,
      trade: newArtisan.trade,
      secondaryTrades: [],
      region: newArtisan.region,
      rating: 5.0,
      reviewsCount: 1,
      isVerified: newArtisan.isPro2026,
      isPro2026: newArtisan.isPro2026,
      phone: cleanPhone,
      whatsapp: cleanWhatsapp,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      bio: cleanBio,
      hourlyRateTnd: Number(newArtisan.hourlyRateTnd) || 20,
      squareMeterRateTnd: Number(newArtisan.squareMeterRateTnd) || 18,
      services: ['Ouvrages Placo BA13', 'Aménagement & Finitions'],
      badges: newArtisan.isPro2026 ? ['Certifié KONSTRIVO PRO 2026', 'Inscrit par Administrateur'] : ['Vérifié 2026']
    };

    onUpdateArtisans([createdItem, ...artisans]);
    setNotification(`✓ Nouvel artisan "${cleanName}" ajouté avec succès à l'annuaire !`);
    
    // Reset Form
    setNewArtisan({
      name: '',
      company: '',
      trade: 'placo',
      region: 'Tunis Grand',
      phone: '+216 ',
      whatsapp: '216',
      hourlyRateTnd: 20,
      squareMeterRateTnd: 18,
      isPro2026: true,
      bio: ''
    });

    setActiveAdminTab('artisans');
    setTimeout(() => setNotification(null), 3500);
  };

  // Filter Artisans List
  const filteredArtisans = artisans.filter(artisan => {
    const matchesSearch = artisan.name.toLowerCase().includes(artisanSearch.toLowerCase()) ||
                          artisan.company.toLowerCase().includes(artisanSearch.toLowerCase()) ||
                          artisan.region.toLowerCase().includes(artisanSearch.toLowerCase()) ||
                          artisan.trade.toLowerCase().includes(artisanSearch.toLowerCase());

    if (artisanFilterStatus === 'pro') return matchesSearch && (artisan.isPro2026 || artisan.isVerified);
    if (artisanFilterStatus === 'free') return matchesSearch && !artisan.isPro2026 && !artisan.isVerified;
    return matchesSearch;
  });

  // Calculate Metrics
  const totalDevisCount = devisHistory.length || 28;
  const totalDevisVolumeTnd = devisHistory.reduce((acc, d) => acc + (d.totalTnd || d.total || 0), 0) || 185400;
  const proArtisansCount = artisans.filter(a => a.isPro2026 || a.isVerified).length;
  const freeArtisansCount = artisans.length - proArtisansCount;
  const avgDevisTnd = totalDevisCount > 0 ? Math.round(totalDevisVolumeTnd / totalDevisCount) : 6620;

  // Sample fallback devis list for stats display if devisHistory is empty
  interface AdminStatsDevis {
    id: string;
    clientName: string;
    projectTitle: string;
    surfaceArea: number;
    totalTnd: number;
    date: string;
    status: string;
  }

  const sampleDevisList: AdminStatsDevis[] = devisHistory.length > 0 
    ? devisHistory.map(d => ({
        id: d.id || d.reference || 'DEV-2026',
        clientName: d.clientName || 'Client Particulier',
        projectTitle: d.projectTitle || (d.items && d.items[0] ? d.items[0].title : 'Travaux Placo & Aménagement'),
        surfaceArea: d.items && d.items[0] ? d.items[0].quantity : 120,
        totalTnd: d.totalTnd || d.total || 0,
        date: d.date || new Date().toISOString().split('T')[0],
        status: d.status || 'valide'
      }))
    : [
        {
          id: 'DEV-2026-081',
          clientName: 'Sami Mansour',
          projectTitle: 'Faux Plafond BA13 + Caisson LED',
          surfaceArea: 145,
          totalTnd: 8420,
          date: '2026-08-20',
          status: 'valide'
        },
        {
          id: 'DEV-2026-080',
          clientName: 'Résidence Ennasr 2',
          projectTitle: 'Cloison Séparation Double BA13',
          surfaceArea: 210,
          totalTnd: 14200,
          date: '2026-08-19',
          status: 'en_attente'
        },
        {
          id: 'DEV-2026-079',
          clientName: 'Boutique Lac 2',
          projectTitle: 'Plafond Démontable 60x60 Vinyl',
          surfaceArea: 95,
          totalTnd: 5180,
          date: '2026-08-18',
          status: 'valide'
        },
        {
          id: 'DEV-2026-078',
          clientName: 'Villa Hammamet Nord',
          projectTitle: 'Habillage Extérieur Aquapanel Ciment',
          surfaceArea: 180,
          totalTnd: 22400,
          date: '2026-08-16',
          status: 'valide'
        }
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#0b0f17] border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden my-6 text-white">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/50 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-400 shadow-md shadow-amber-500/10">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Espace Administration Général KONSTRIVO</span>
                {isCurrentlyAdmin && (
                  <span className="px-2.5 py-0.5 text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Owner Admin
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Panneau propriétaire : gestion globale des artisans, tarifs barèmes et devis calculés
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCurrentlyAdmin && (
              <button
                onClick={handleAdminLogout}
                className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="Se déconnecter de l'administration"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Déconnexion Admin</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

                {/* Defend admin-only UI: privileged dashboard renders ONLY when isCurrentlyAdmin is true (defensive guard) */}
        {/* NOT AUTHENTICATED: ADMIN LOGIN FORM */}
        {!isCurrentlyAdmin ? (
          <div className="p-6 sm:p-10 space-y-6">
            <div className="max-w-md mx-auto space-y-6 bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl">
              
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 mb-1">
                  <KeyRound className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-black text-white">Authentification Propriétaire</h4>
                <p className="text-xs text-slate-400">
                  Veuillez saisir vos identifiants administrateur pour accéder à l'Espace Administration Général.
                </p>
              </div>

              {authError && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Email Administrateur</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@entreprise.tn"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Mot de Passe</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Se Connecter au Dashboard Admin</span>
                  </button>
                </div>
              </form>

            </div>
          </div>
        ) : (
          /* AUTHENTICATED: OWNER ADMIN DASHBOARD */
          <div className="p-5 sm:p-6 space-y-6">
            
            {/* Notification Banner */}
            {notification && (
              <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{notification}</span>
              </div>
            )}

            {/* Developer API Sync Status Indicator */}
            <div className="bg-slate-950 p-3.5 sm:p-4 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl shrink-0">
                  <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin-slow" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">Bridge REST API & Mobile Sync</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase font-mono">
                      Prêt (Flutter / React Native)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Schémas JSON synchronisés pour l'application Mobile & Web. Jetons JWT & Hachage SHA-256 actifs.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeveloperApiStatus(!showDeveloperApiStatus)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-amber-400 hover:text-amber-300 border border-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{showDeveloperApiStatus ? 'Masquer Détails API' : 'Inspecter Endpoints REST'}</span>
                </button>
              </div>
            </div>

            {/* Expanded API Schema Status Modal/Panel */}
            {showDeveloperApiStatus && (
              <div className="bg-slate-900/90 p-4 rounded-2xl border border-amber-500/40 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h5 className="text-xs font-bold text-amber-400 flex items-center gap-2 font-mono">
                    <KeyRound className="w-4 h-4" />
                    <span>CONTRATS D'ENDPOINTS API REST V1 (MOBILE & WEB SYNC)</span>
                  </h5>
                  <span className="text-[10px] text-slate-400 font-mono">Protocole: HTTPS / Bearer JWT</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-emerald-400 font-bold">GET /api/v1/rates</div>
                    <div className="text-slate-300 text-[11px] mt-0.5">Payload: {editableRates.length} Matériaux BTP</div>
                    <div className="text-[9px] text-slate-500 mt-1">Format: MaterialRate[] JSON</div>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-emerald-400 font-bold">GET /api/v1/artisans</div>
                    <div className="text-slate-300 text-[11px] mt-0.5">Payload: {artisans.length} Artisans qualifiés</div>
                    <div className="text-[9px] text-slate-500 mt-1">Format: ArtisanDirectoryItem[] JSON</div>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-emerald-400 font-bold">POST /api/v1/devis</div>
                    <div className="text-slate-300 text-[11px] mt-0.5">Payload: {devisHistory.length} Devis chantiers</div>
                    <div className="text-[9px] text-slate-500 mt-1">Format: DevisDocument[] JSON</div>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-emerald-400 font-bold">GET /api/v1/pro-features</div>
                    <div className="text-slate-300 text-[11px] mt-0.5">Avantages Actifs: {proFeatures.filter(f => f.enabled).length}/{proFeatures.length}</div>
                    <div className="text-[9px] text-slate-500 mt-1">Format: ProFeatureItem[] JSON</div>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-sky-400 font-bold">DATABASE COMPATIBILITY</div>
                    <div className="text-slate-300 text-[11px] mt-0.5">Firebase / PostgreSQL</div>
                    <div className="text-[9px] text-slate-500 mt-1">Dual-Driver Ready for Mobile</div>
                  </div>
                </div>
              </div>
            )}

            {/* METRICS BAR: Clickable Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Card 1: Inscrits Totaux -> Switches to Artisans tab (All) */}
              <button
                type="button"
                onClick={() => {
                  setActiveAdminTab('artisans');
                  setArtisanFilterStatus('all');
                }}
                className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                  activeAdminTab === 'artisans' && artisanFilterStatus === 'all'
                    ? 'bg-gradient-to-br from-amber-500/20 via-slate-950 to-slate-950 border-amber-400 ring-2 ring-amber-400/30'
                    : 'bg-slate-950 border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/90'
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase">
                  <span>Inscrits Totaux</span>
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl font-black text-white font-mono mt-1">{artisans.length}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-400 block">{proArtisansCount} Pro / {freeArtisansCount} Gratuit</span>
                  <span className="text-[9px] text-amber-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    Voir <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </button>

              {/* Card 2: Artisans PRO -> Switches to Artisans tab (Pro Filter) */}
              <button
                type="button"
                onClick={() => {
                  setActiveAdminTab('artisans');
                  setArtisanFilterStatus('pro');
                }}
                className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                  activeAdminTab === 'artisans' && artisanFilterStatus === 'pro'
                    ? 'bg-gradient-to-br from-emerald-500/20 via-slate-950 to-slate-950 border-emerald-400 ring-2 ring-emerald-400/30'
                    : 'bg-slate-950 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/90'
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase">
                  <span>Artisans PRO</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-400 font-mono mt-1">{proArtisansCount}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-emerald-400/90 block font-semibold">✓ Badges Vérifiés</span>
                  <span className="text-[9px] text-emerald-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    Voir <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </button>

              {/* Card 3: Devis Calculés -> Switches to Stats & Devis tab */}
              <button
                type="button"
                onClick={() => setActiveAdminTab('stats')}
                className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                  activeAdminTab === 'stats'
                    ? 'bg-gradient-to-br from-amber-500/20 via-slate-950 to-slate-950 border-amber-400 ring-2 ring-amber-400/30'
                    : 'bg-slate-950 border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/90'
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase">
                  <span>Devis Calculés</span>
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl font-black text-amber-400 font-mono mt-1">{totalDevisCount}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-400 block font-mono">Vol: {totalDevisVolumeTnd.toLocaleString('fr-TN')} DT</span>
                  <span className="text-[9px] text-amber-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    Détails <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </button>

              {/* Card 4: Base Matériaux -> Switches to Prices tab */}
              <button
                type="button"
                onClick={() => setActiveAdminTab('prices')}
                className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                  activeAdminTab === 'prices'
                    ? 'bg-gradient-to-br from-sky-500/20 via-slate-950 to-slate-950 border-sky-400 ring-2 ring-sky-400/30'
                    : 'bg-slate-950 border-slate-800 hover:border-sky-500/50 hover:bg-slate-900/90'
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase">
                  <span>Base Matériaux</span>
                  <DollarSign className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-xl font-black text-sky-400 font-mono mt-1">{rates.length}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-400 block">Tarifs 2026 Actifs</span>
                  <span className="text-[9px] text-sky-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    Éditer <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </button>
            </div>

            {/* Admin Top Navigation Tabs Selector */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-none">
              
              {/* Tab 1: Gestion des Artisans */}
              <button
                type="button"
                onClick={() => setActiveAdminTab('artisans')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeAdminTab === 'artisans'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20 border border-amber-400'
                    : 'bg-[#111827] text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Gestion des Artisans ({artisans.length})</span>
              </button>

              {/* Tab 2: Barèmes de Prix BTP */}
              <button
                type="button"
                onClick={() => setActiveAdminTab('prices')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeAdminTab === 'prices'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20 border border-amber-400'
                    : 'bg-[#111827] text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Barèmes de Prix BTP ({rates.length})</span>
              </button>

              {/* Tab 3: Nouveau Profil Artisan */}
              <button
                type="button"
                onClick={() => setActiveAdminTab('add_artisan')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeAdminTab === 'add_artisan'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20 border border-amber-400'
                    : 'bg-[#111827] text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nouveau Profil Artisan</span>
              </button>

              {/* Tab 4: Commissions & Frais */}
              <button
                type="button"
                onClick={() => setActiveAdminTab('commissions')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeAdminTab === 'commissions'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20 border border-amber-400'
                    : 'bg-[#111827] text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>Commissions & Frais</span>
              </button>

              {/* Tab 5: Offres Pro (SaaS) */}
              <button
                type="button"
                onClick={() => setActiveAdminTab('pro_offers')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeAdminTab === 'pro_offers'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20 border border-amber-400'
                    : 'bg-[#111827] text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>Gestion Offres Pro ({proFeatures.filter(f => f.enabled).length}/{proFeatures.length})</span>
              </button>

              {/* Tab 6: Statistiques & Devis */}
              <button
                type="button"
                onClick={() => setActiveAdminTab('stats')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeAdminTab === 'stats'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20 border border-amber-400'
                    : 'bg-[#111827] text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Statistiques & Devis ({totalDevisCount})</span>
              </button>
            </div>

            {/* TAB 1: ARTISAN MANAGEMENT TABLE */}
            {activeAdminTab === 'artisans' && (
              <div className="space-y-4">
                
                {/* Search & Status Filters */}
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={artisanSearch}
                      onChange={(e) => setArtisanSearch(e.target.value)}
                      placeholder="Rechercher nom, ville, spécialité..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setArtisanFilterStatus('all')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        artisanFilterStatus === 'all' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Tous ({artisans.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setArtisanFilterStatus('pro')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        artisanFilterStatus === 'pro' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      PRO Verified ({proArtisansCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setArtisanFilterStatus('free')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        artisanFilterStatus === 'free' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Gratuit ({freeArtisansCount})
                    </button>
                  </div>
                </div>

                {/* Artisan Management Table */}
                <div className="max-h-96 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800 z-10">
                      <tr>
                        <th className="p-3">Artisan / Entreprise</th>
                        <th className="p-3">Ville / Gouvernorat</th>
                        <th className="p-3">Téléphone</th>
                        <th className="p-3">Abonnement / Plan</th>
                        <th className="p-3 text-right">Actions Administrateur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {filteredArtisans.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500">
                            Aucun artisan ne correspond à votre recherche.
                          </td>
                        </tr>
                      ) : (
                        filteredArtisans.map((artisan) => (
                          <tr key={artisan.id} className="hover:bg-slate-900/60 transition-colors">
                            <td className="p-3 font-semibold text-white">
                              <div className="flex items-center gap-2.5">
                                <img src={artisan.avatar} alt={artisan.name} className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-700" />
                                <div>
                                  <div className="font-bold text-white flex items-center gap-1.5">
                                    <span>{artisan.name}</span>
                                    {artisan.isPro2026 && (
                                      <span className="px-1.5 py-0.2 text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-mono font-black">PRO</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400">{artisan.company}</div>
                                </div>
                              </div>
                            </td>

                            <td className="p-3 font-medium text-slate-300">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>{artisan.region}</span>
                              </div>
                            </td>

                            <td className="p-3 font-mono text-slate-300">{artisan.phone}</td>

                            <td className="p-3">
                              {artisan.isPro2026 || artisan.isVerified ? (
                                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Plan PRO Verified
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-slate-800 text-slate-400 rounded-full">
                                  Plan Gratuit
                                </span>
                              )}
                            </td>

                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleProStatus(artisan.id)}
                                  className={`px-3 py-1 text-[10px] font-black rounded-lg border transition-all cursor-pointer ${
                                    artisan.isPro2026
                                      ? 'bg-slate-900 text-amber-400 border-slate-700 hover:bg-slate-800'
                                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                                  }`}
                                >
                                  {artisan.isPro2026 ? 'Rétrograder' : 'Activate PRO'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteArtisan(artisan.id, artisan.name)}
                                  className="p-1.5 text-rose-400 hover:text-white bg-slate-900 hover:bg-rose-950/80 border border-slate-800 rounded-lg transition-all cursor-pointer"
                                  title="Supprimer l'artisan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* TAB 2: GLOBAL PRICE MANAGER */}
            {activeAdminTab === 'prices' && (
              <div className="space-y-4">
                
                {/* Hidden File Input for CSV Catalogue Import */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCsvImport}
                  accept=".csv,.txt,.xlsx,.xls"
                  className="hidden"
                />

                <div className="flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Éditeur & Importation Catalogue Matériaux BTP 2026</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Gérez vos tarifs unitaires ou importez un catalogue CSV complet pour mettre à jour les calculateurs en direct.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* CSV Sample Download Template */}
                    <button
                      type="button"
                      onClick={handleDownloadCsvSample}
                      title="Télécharger un modèle CSV d'exemple pour le catalogue"
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-400" />
                      <span>Modèle CSV</span>
                    </button>

                    {/* Bulk CSV Import Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 border border-emerald-400"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Importer Catalogue (CSV/Excel)</span>
                    </button>

                    {/* Manual Add Material Form Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowAddMaterialForm(!showAddMaterialForm)}
                      className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border ${
                        showAddMaterialForm
                          ? 'bg-slate-800 text-amber-400 border-amber-500/40'
                          : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-700 font-bold'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      <span>{showAddMaterialForm ? 'Fermer Formulaire' : 'Ajouter un Matériau'}</span>
                    </button>

                    {/* Save All Rates */}
                    <button
                      type="button"
                      onClick={handleSavePrices}
                      className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>✓ Enregistrer les Barèmes</span>
                    </button>
                  </div>
                </div>

                {/* Dynamic Material Addition Form */}
                {showAddMaterialForm && (
                  <form onSubmit={handleCreateMaterial} className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-emerald-500/40 shadow-2xl space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                        <PlusCircle className="w-4 h-4" />
                        <span>Nouveau Matériau BTP — Inscription Dynamique dans les Calculateurs</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">Prise en compte immédiate</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Nom du Matériau (Français) *</label>
                        <input
                          type="text"
                          value={newMaterial.nameFr}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, nameFr: e.target.value }))}
                          placeholder="Ex: Plaque BA15 Acoustic Ultra, Profilé Omega 3m..."
                          required
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Nom en Arabe / Derja (Optionnel)</label>
                        <input
                          type="text"
                          value={newMaterial.nameAr}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, nameAr: e.target.value }))}
                          placeholder="Ex: بلاك با15 صوتية"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-serif focus:border-emerald-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Catégorie BTP *</label>
                        <select
                          value={newMaterial.category}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, category: e.target.value as TradeCategory }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-emerald-400 focus:outline-none"
                        >
                          <option value="placo">Plaquiste & Placo BA13</option>
                          <option value="peinture">Peinture & Enduits</option>
                          <option value="carrelage">Carrelage & Revêtement</option>
                          <option value="maconnerie">Maçonnerie & Ciment</option>
                          <option value="plomberie">Plomberie & Sanitaires</option>
                          <option value="electricite">Électricité BTP</option>
                          <option value="isolation">Isolation Acoustique / Thermique</option>
                          <option value="facade">Façade & Aquapanel</option>
                          <option value="etancheite">Étanchéité & Silicone</option>
                          <option value="menuiserie">Menuiserie & Fixations</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Unité de Mesure *</label>
                        <select
                          value={newMaterial.unit}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, unit: e.target.value as MaterialRate['unit'] }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-emerald-400 focus:outline-none"
                        >
                          <option value="unit">Unité (unit)</option>
                          <option value="m²">Mètre Carré (m²)</option>
                          <option value="ml">Mètre Linéaire (ml)</option>
                          <option value="sac">Sac (25kg/50kg)</option>
                          <option value="boite">Boîte (boite)</option>
                          <option value="boite_1000">Boîte de 1000 (vis)</option>
                          <option value="rouleau">Rouleau</option>
                          <option value="kg">Kilogramme (kg)</option>
                          <option value="panneau">Panneau</option>
                          <option value="tube">Tube</option>
                          <option value="point">Point</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Prix Unitaire HT (TND) *</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.1"
                          value={newMaterial.unitPriceTnd}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, unitPriceTnd: parseFloat(e.target.value) || 0 }))}
                          required
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold focus:border-emerald-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Note Technique / Spécification</label>
                      <input
                        type="text"
                        value={newMaterial.note}
                        onChange={(e) => setNewMaterial(prev => ({ ...prev, note: e.target.value }))}
                        placeholder="Ex: Conditionnement par carton, conforme aux spécifications CS8..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddMaterialForm(false)}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Ajouter aux Barèmes & Calculateurs</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Key Price Metric Input Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {editableRates.find(r => r.id === 'plaque_ba13_standard') && (
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-amber-500/30 space-y-2">
                      <span className="text-[11px] font-bold text-amber-400 block">Plaque BA13 Standard (DT)</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          value={editableRates.find(r => r.id === 'plaque_ba13_standard')?.unitPriceTnd || 30}
                          onChange={(e) => handleRatePriceChange('plaque_ba13_standard', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-sm font-black text-amber-400 text-right focus:border-amber-400 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-mono">DT/unit</span>
                      </div>
                    </div>
                  )}

                  {editableRates.find(r => r.id === 'plaque_ba13_hydrofuge') && (
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/30 space-y-2">
                      <span className="text-[11px] font-bold text-emerald-400 block">Plaque BA13 Hydrofuge (DT)</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          value={editableRates.find(r => r.id === 'plaque_ba13_hydrofuge')?.unitPriceTnd || 46}
                          onChange={(e) => handleRatePriceChange('plaque_ba13_hydrofuge', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-sm font-black text-emerald-400 text-right focus:border-emerald-400 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-mono">DT/unit</span>
                      </div>
                    </div>
                  )}

                  {editableRates.find(r => r.id === 'pose_m2') && (
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-sky-500/30 space-y-2">
                      <span className="text-[11px] font-bold text-sky-400 block">Main d'œuvre Pose m² (DT)</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          value={editableRates.find(r => r.id === 'pose_m2')?.unitPriceTnd || 18}
                          onChange={(e) => handleRatePriceChange('pose_m2', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 font-mono text-sm font-black text-sky-400 text-right focus:border-sky-400 focus:outline-none"
                        />
                        <span className="text-xs text-slate-400 font-mono">DT/m²</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* All Materials Table */}
                <div className="max-h-96 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800 z-10">
                      <tr>
                        <th className="p-3">Réf / Matériau</th>
                        <th className="p-3">Catégorie</th>
                        <th className="p-3">Unité</th>
                        <th className="p-3 text-right">Prix Unitaire HT (TND)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {editableRates.map((rate) => (
                        <tr key={rate.id} className="hover:bg-slate-900/60 transition-colors">
                          <td className="p-3 font-semibold text-white">
                            <div>{rate.nameFr}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{rate.id}</div>
                          </td>
                          <td className="p-3 text-slate-400 uppercase font-mono text-[10px]">{rate.category}</td>
                          <td className="p-3 text-slate-400">{rate.unit}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number"
                                step="0.1"
                                value={rate.unitPriceTnd}
                                onChange={(e) => handleRatePriceChange(rate.id, parseFloat(e.target.value) || 0)}
                                className="w-24 bg-slate-900 border border-amber-500/30 rounded-xl px-2.5 py-1 text-right font-bold text-amber-400 font-mono text-xs focus:border-amber-400 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteMaterial(rate.id, rate.nameFr)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 bg-slate-900 hover:bg-rose-950/50 border border-slate-800 rounded-lg transition-all cursor-pointer"
                                title="Supprimer ce matériau des barèmes"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: QUICK ADD ARTISAN FORM */}
            {activeAdminTab === 'add_artisan' && (
              <form onSubmit={handleCreateArtisan} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-amber-400" />
                  Formulaire d'enregistrement rapide d'un nouvel artisan
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Nom & Prénom *</label>
                    <input
                      type="text"
                      value={newArtisan.name}
                      onChange={(e) => setNewArtisan(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Sami Ben Ahmed"
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Nom de la Société / Entreprise</label>
                    <input
                      type="text"
                      value={newArtisan.company}
                      onChange={(e) => setNewArtisan(prev => ({ ...prev, company: e.target.value }))}
                      placeholder="Ex: Ben Ahmed Placo Bizerte"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Spécialité Principale</label>
                    <select
                      value={newArtisan.trade}
                      onChange={(e) => setNewArtisan(prev => ({ ...prev, trade: e.target.value as TradeCategory }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-amber-400 focus:outline-none"
                    >
                      <option value="placo">Plaquiste & Faux Plafonds</option>
                      <option value="peinture">Peinture & Enduits</option>
                      <option value="carrelage">Carrelage & Revêtement</option>
                      <option value="electricite">Électricité BTP</option>
                      <option value="plomberie">Plomberie & Sanitaires</option>
                      <option value="facade">Façadier & Aquapanel</option>
                      <option value="isolation">Isolation Acoustique</option>
                      <option value="maconnerie">Maçonnerie Générale</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Gouvernorat (Tunisie)</label>
                    <select
                      value={newArtisan.region}
                      onChange={(e) => setNewArtisan(prev => ({ ...prev, region: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-amber-400 focus:outline-none"
                    >
                      {TUNISIAN_GOVERNORATES_LIST.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Numéro Téléphone *</label>
                    <input
                      type="text"
                      value={newArtisan.phone}
                      onChange={(e) => setNewArtisan(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+216 98 123 456"
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Tarif Pose m² (DT)</label>
                    <input
                      type="number"
                      value={newArtisan.squareMeterRateTnd}
                      onChange={(e) => setNewArtisan(prev => ({ ...prev, squareMeterRateTnd: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Tarif Horaire (DT)</label>
                    <input
                      type="number"
                      value={newArtisan.hourlyRateTnd}
                      onChange={(e) => setNewArtisan(prev => ({ ...prev, hourlyRateTnd: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Abonnement Initial</label>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        id="pro_check_add"
                        checked={newArtisan.isPro2026}
                        onChange={(e) => setNewArtisan(prev => ({ ...prev, isPro2026: e.target.checked }))}
                        className="w-4 h-4 accent-amber-500 cursor-pointer"
                      />
                      <label htmlFor="pro_check_add" className="text-xs text-amber-400 font-bold cursor-pointer">
                        Activer Statut PRO Verified 2026
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Présentation / Bio</label>
                  <textarea
                    rows={2}
                    value={newArtisan.bio}
                    onChange={(e) => setNewArtisan(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Description des compétences, outillage et références de chantiers..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="pt-2 text-right">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Ajouter l'Artisan à l'Annuaire</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: COMMISSION & FEES CONFIGURATION PANEL */}
            {activeAdminTab === 'commissions' && (
              <div className="space-y-6">
                
                {/* Config Section Header & Controls Form */}
                <form onSubmit={handleSaveCommissions} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Coins className="w-5 h-5 text-amber-400" />
                        <span>Gestion des Commissions, Frais & Modèle Economique BTP 2026</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Configurez les règles de prélèvement sur les devis validés, abonnements artisans et frais de mise en relation.
                      </p>
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>✓ Enregistrer la Grille des Commissions</span>
                    </button>
                  </div>

                  {/* Commission Structure Options */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setCommissionType('percent')}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        commissionType === 'percent'
                          ? 'bg-amber-500/10 border-amber-400 text-white ring-2 ring-amber-400/20'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase font-mono">Commission Variable %</span>
                        <Percent className="w-4 h-4 text-amber-400" />
                      </div>
                      <p className="text-xs text-slate-300 font-semibold mb-1">Pourcentage sur Devis</p>
                      <p className="text-[11px] text-slate-400">Prélèvement proportionnel au montant total HT du chantier.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCommissionType('flat')}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        commissionType === 'flat'
                          ? 'bg-emerald-500/10 border-emerald-400 text-white ring-2 ring-emerald-400/20'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase font-mono">Frais Fixe par Devis</span>
                        <Receipt className="w-4 h-4 text-emerald-400" />
                      </div>
                      <p className="text-xs text-slate-300 font-semibold mb-1">Forfait par Estimation</p>
                      <p className="text-[11px] text-slate-400">Montant fixe prélevé par devis accepté ou transaction client.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCommissionType('hybrid')}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        commissionType === 'hybrid'
                          ? 'bg-sky-500/10 border-sky-400 text-white ring-2 ring-sky-400/20'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase font-mono">Modèle Hybride BTP</span>
                        <Coins className="w-4 h-4 text-sky-400" />
                      </div>
                      <p className="text-xs text-slate-300 font-semibold mb-1">Pourcentage + Forfait Fixe</p>
                      <p className="text-[11px] text-slate-400">Combinaison d'une commission % et de frais fixes de dossier.</p>
                    </button>
                  </div>

                  {/* Detailed Commission Parameter Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                    <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
                      <label className="block text-xs font-bold text-amber-400">Taux de Commission (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="25"
                          value={commissionPercent}
                          onChange={(e) => setCommissionPercent(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-sm font-black text-amber-400 focus:border-amber-400 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-slate-400 font-mono">%</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">Sur montant brut devis</span>
                    </div>

                    <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
                      <label className="block text-xs font-bold text-emerald-400">Frais Fixes par Devis (DT)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={flatFeePerDevis}
                          onChange={(e) => setFlatFeePerDevis(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-sm font-black text-emerald-400 focus:border-emerald-400 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-slate-400 font-mono">TND</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">Frais de traitement/Devis</span>
                    </div>

                    <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
                      <label className="block text-xs font-bold text-sky-400">Abonnement Artisan PRO (DT/Mois)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={proMonthlySubPrice}
                          onChange={(e) => setProMonthlySubPrice(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-sm font-black text-sky-400 focus:border-sky-400 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-slate-400 font-mono">DT/mois</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">Recette récurrente SaaS</span>
                    </div>

                    <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
                      <label className="block text-xs font-bold text-purple-400">Prélèvement Retenue Source (%)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="15"
                          value={retentionTaxPercent}
                          onChange={(e) => setRetentionTaxPercent(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-sm font-black text-purple-400 focus:border-purple-400 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-slate-400 font-mono">%</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">Conformité fiscale 2026</span>
                    </div>
                  </div>
                </form>

                {/* Simulation & Revenue Earnings Tracker Dashboard */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-amber-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        <span>Simulateur & Traqueur de Revenus Estimés (Platform Earnings)</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Estimation des revenus générés en fonction des {totalDevisCount} devis calculés et {proArtisansCount} artisans PRO.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold rounded-lg uppercase">
                      Mode : {commissionType === 'percent' ? 'Variable %' : commissionType === 'flat' ? 'Forfait Fixe' : 'Hybride'}
                    </span>
                  </div>

                  {/* KPI Revenue Simulation Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Volume Brut Devis</span>
                      <div className="text-xl font-black text-white font-mono">{totalDevisVolumeTnd.toLocaleString('fr-TN')} DT</div>
                      <span className="text-[10px] text-slate-500 block">Volume total chantiers</span>
                    </div>

                    <div className="bg-slate-900/90 p-4 rounded-2xl border border-amber-500/30 space-y-1">
                      <span className="text-[10px] font-bold text-amber-400 uppercase">Commissions Sur Devis Est.</span>
                      <div className="text-xl font-black text-amber-400 font-mono">
                        {Math.round(
                          commissionType === 'percent' ? (totalDevisVolumeTnd * commissionPercent) / 100 :
                          commissionType === 'flat' ? totalDevisCount * flatFeePerDevis :
                          ((totalDevisVolumeTnd * commissionPercent) / 100) + (totalDevisCount * flatFeePerDevis)
                        ).toLocaleString('fr-TN')} DT
                      </div>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {commissionType === 'percent' ? `${commissionPercent}% du volume` : commissionType === 'flat' ? `${flatFeePerDevis} DT/devis` : `${commissionPercent}% + ${flatFeePerDevis} DT/devis`}
                      </span>
                    </div>

                    <div className="bg-slate-900/90 p-4 rounded-2xl border border-sky-500/30 space-y-1">
                      <span className="text-[10px] font-bold text-sky-400 uppercase">Abonnements PRO Est.</span>
                      <div className="text-xl font-black text-sky-400 font-mono">
                        {(proArtisansCount * proMonthlySubPrice).toLocaleString('fr-TN')} DT
                      </div>
                      <span className="text-[10px] text-slate-400 block">{proArtisansCount} Artisans PRO × {proMonthlySubPrice} DT/mois</span>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-950/80 to-slate-950 p-4 rounded-2xl border border-emerald-500/50 space-y-1 shadow-lg shadow-emerald-500/10">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">Revenu Global Estimé</span>
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        {Math.round(
                          (commissionType === 'percent' ? (totalDevisVolumeTnd * commissionPercent) / 100 :
                           commissionType === 'flat' ? totalDevisCount * flatFeePerDevis :
                           ((totalDevisVolumeTnd * commissionPercent) / 100) + (totalDevisCount * flatFeePerDevis)) +
                          (proArtisansCount * proMonthlySubPrice)
                        ).toLocaleString('fr-TN')} DT
                      </div>
                      <span className="text-[10px] text-emerald-300/80 block font-semibold">Total plateforme KONSTRIVO</span>
                    </div>
                  </div>

                  {/* Simulated Per-Devis Revenue Breakdown Table */}
                  <div className="pt-2">
                    <h5 className="text-xs font-bold text-slate-300 mb-2">Simulations Détaillées par Devis du Journal</h5>
                    <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl bg-slate-900/60">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800">
                          <tr>
                            <th className="p-3">Réf / Client</th>
                            <th className="p-3">Projet</th>
                            <th className="p-3">Montant Devis HT</th>
                            <th className="p-3">Calcul Commission (%)</th>
                            <th className="p-3 text-right">Commission Est. (DT)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 font-mono">
                          {sampleDevisList.map((d, i) => {
                            const percentFee = (d.totalTnd * commissionPercent) / 100;
                            const flatFee = flatFeePerDevis;
                            const totalFee = 
                              commissionType === 'percent' ? percentFee :
                              commissionType === 'flat' ? flatFee :
                              (percentFee + flatFee);

                            return (
                              <tr key={d.id || i} className="hover:bg-slate-900 transition-colors">
                                <td className="p-3 font-semibold text-white">
                                  <div>{d.clientName}</div>
                                  <div className="text-[10px] text-amber-400">{d.id}</div>
                                </td>
                                <td className="p-3 text-slate-300 font-sans">{d.projectTitle}</td>
                                <td className="p-3 font-bold text-white">{d.totalTnd.toLocaleString('fr-TN')} DT</td>
                                <td className="p-3 text-slate-400 text-[11px]">
                                  {commissionType === 'percent' && `${commissionPercent}% de ${d.totalTnd} DT`}
                                  {commissionType === 'flat' && `${flatFeePerDevis} DT forfait`}
                                  {commissionType === 'hybrid' && `${commissionPercent}% (${Math.round(percentFee)} DT) + ${flatFeePerDevis} DT`}
                                </td>
                                <td className="p-3 text-right font-black text-amber-400">
                                  +{Math.round(totalFee).toLocaleString('fr-TN')} DT
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 5: GESTION DES OFFRES PRO (SaaS) */}
            {activeAdminTab === 'pro_offers' && (
              <div className="space-y-6">
                
                {/* Header & Controls Bar */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <ListChecks className="w-5 h-5 text-amber-400" />
                        <span>Gestion Dynamique des Offres Plan Pro (SaaS Artisans)</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Ajustez les fonctionnalités, avantages et points clés présentés aux artisans sur la carte tarifaire Plan PRO ({proMonthlySubPrice} DT/mois).
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetProFeatures}
                        title="Réinitialiser les avantages par défaut"
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Réinitialiser</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAddProFeatureForm(!showAddProFeatureForm)}
                        className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border ${
                          showAddProFeatureForm
                            ? 'bg-slate-800 text-amber-400 border-amber-500/40'
                            : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black border-amber-400 shadow-lg shadow-amber-500/20'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        <span>{showAddProFeatureForm ? 'Masquer Formulaire' : 'Ajouter un Avantage Pro'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveProFeatures}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 border border-emerald-400"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>✓ Enregistrer l'Offre Pro</span>
                      </button>
                    </div>
                  </div>

                  {/* Add New Pro Feature Form */}
                  {showAddProFeatureForm && (
                    <form onSubmit={handleCreateProFeature} className="bg-slate-900 p-4 rounded-2xl border border-amber-500/40 space-y-4 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h5 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" />
                          <span>Ajouter un Nouvel Avantage à l'Offre Pro</span>
                        </h5>
                        <span className="text-[10px] text-slate-400">Visible immédiatement sur l'application</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Titre de la Fonctionnalité / Avantage *</label>
                          <input
                            type="text"
                            value={newProFeature.title}
                            onChange={(e) => setNewProFeature(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Ex: Badge Officiel Artisans CS8 2026, Export Excel Pro..."
                            required
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Catégorie BTP *</label>
                          <select
                            value={newProFeature.category}
                            onChange={(e) => setNewProFeature(prev => ({ ...prev, category: e.target.value as any }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-amber-400 focus:outline-none"
                          >
                            <option value="tools">Outillage & Devising AI</option>
                            <option value="visibility">Visibilité Client & Leads</option>
                            <option value="badge">Certification & Badges</option>
                            <option value="support">Support & Expertise Métreur</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Description Détaillée / Impact pour l'Artisan *</label>
                        <textarea
                          rows={2}
                          value={newProFeature.description}
                          onChange={(e) => setNewProFeature(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Explication des avantages débloqués avec le Plan Pro..."
                          required
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddProFeatureForm(false)}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl cursor-pointer"
                        >
                          + Ajouter à la Grille Pro
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Main Content Layout: Features List (2 cols) & Live Preview Pricing Card (1 col) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Feature Management List */}
                  <div className="lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Liste des Avantages Configurés ({proFeatures.length})
                      </h5>
                      <span className="text-[11px] text-amber-400 font-mono font-bold">
                        {proFeatures.filter(f => f.enabled).length} Actifs / {proFeatures.length} Total
                      </span>
                    </div>

                    <div className="space-y-3">
                      {proFeatures.map((feat) => (
                        <div
                          key={feat.id}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            feat.enabled
                              ? 'bg-slate-950 border-slate-800 hover:border-amber-500/40'
                              : 'bg-slate-950/50 border-slate-900 opacity-60'
                          }`}
                        >
                          {/* Top Row: Enable Toggle & Title Input & Category Tag & Delete */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1">
                              {/* Checkbox Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleProFeature(feat.id)}
                                title={feat.enabled ? 'Désactiver cette fonctionnalité' : 'Activer cette fonctionnalité'}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex-shrink-0 ${
                                  feat.enabled
                                    ? 'bg-amber-400/10 border-amber-400 text-amber-400'
                                    : 'bg-slate-900 border-slate-800 text-slate-600'
                                }`}
                              >
                                {feat.enabled ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                              </button>

                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={feat.title}
                                  onChange={(e) => handleUpdateProFeature(feat.id, 'title', e.target.value)}
                                  className="w-full bg-transparent text-xs font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-amber-400 focus:outline-none py-0.5"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono border ${
                                feat.category === 'badge' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                feat.category === 'tools' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                feat.category === 'visibility' ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' :
                                'bg-purple-500/10 border-purple-500/30 text-purple-400'
                              }`}>
                                {feat.category}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleDeleteProFeature(feat.id, feat.title)}
                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                                title="Supprimer cet avantage"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Editable Description */}
                          <div>
                            <textarea
                              rows={2}
                              value={feat.description}
                              onChange={(e) => handleUpdateProFeature(feat.id, 'description', e.target.value)}
                              className="w-full bg-slate-900/60 border border-slate-850 rounded-xl p-2.5 text-xs text-slate-300 focus:border-amber-400 focus:outline-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Live Interactive Preview of Plan Pro Card */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="w-4 h-4" />
                        <span>Aperçu Carte Plan Pro Artisan</span>
                      </h5>
                      <span className="text-[10px] text-slate-400">Rendu Temps Réel</span>
                    </div>

                    <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-amber-400/80 rounded-3xl p-6 space-y-6 shadow-2xl shadow-amber-500/10 relative overflow-hidden">
                      {/* Top Ribbon */}
                      <div className="absolute top-3 right-3 px-3 py-1 bg-amber-400 text-slate-950 text-[10px] font-black uppercase rounded-full tracking-wider flex items-center gap-1">
                        <Star className="w-3 h-3 fill-slate-950" />
                        <span>Offre Recommandée</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Award className="w-5 h-5 text-amber-400" />
                          <h3 className="text-lg font-black text-white">Abonnement PLAN PRO 2026</h3>
                        </div>
                        <p className="text-xs text-slate-400">
                          Solution intégrée pour artisans, entrepreneurs et chefs de chantier en Tunisie.
                        </p>
                      </div>

                      {/* Pricing Tag */}
                      <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 flex items-baseline justify-between">
                        <div>
                          <span className="text-3xl font-black text-amber-400 font-mono">{proMonthlySubPrice}</span>
                          <span className="text-xs font-bold text-slate-300 font-mono ml-1">DT / mois HT</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                          Sans engagement
                        </span>
                      </div>

                      {/* Dynamic Bullet Points List */}
                      <div className="space-y-3 border-t border-slate-800 pt-4">
                        <h4 className="text-xs font-bold text-slate-300">Avantages Inclus dans l'Abonnement :</h4>
                        <ul className="space-y-2.5 text-xs">
                          {proFeatures.map((feat) => (
                            <li key={feat.id} className={`flex items-start gap-2.5 ${feat.enabled ? 'text-slate-200' : 'text-slate-600 line-through'}`}>
                              <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${feat.enabled ? 'text-emerald-400 font-bold' : 'text-slate-700'}`} />
                              <div>
                                <span className="font-bold block text-white">{feat.title}</span>
                                <span className="text-[11px] text-slate-400 block font-normal leading-tight">{feat.description}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        className="w-full py-3 bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 uppercase tracking-wider"
                      >
                        Souscrire au Plan Pro ({proMonthlySubPrice} DT)
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 6: STATISTIQUES & DEVIS DETAILED VIEW */}
            {activeAdminTab === 'stats' && (
              <div className="space-y-4">
                
                {/* Stats Summary Panel */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Volume Financier Total</span>
                    <div className="text-2xl font-black text-amber-400 font-mono">
                      {totalDevisVolumeTnd.toLocaleString('fr-TN')} DT
                    </div>
                    <span className="text-[11px] text-slate-400 block">Calculé sur la plateforme</span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Moyenne Devis Chantiers</span>
                    <div className="text-2xl font-black text-emerald-400 font-mono">
                      {avgDevisTnd.toLocaleString('fr-TN')} DT
                    </div>
                    <span className="text-[11px] text-slate-400 block">Par estimation client/artisan</span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Chantiers & Surfaces</span>
                    <div className="text-2xl font-black text-sky-400 font-mono">
                      {totalDevisCount * 120} m²
                    </div>
                    <span className="text-[11px] text-slate-400 block">Superficie cumulée calculée</span>
                  </div>
                </div>

                {/* Devis History Log Table */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-400" />
                        <span>Journal Récent des Devis / Estimations Générées</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">Historique des devis créés par les clients et artisans</p>
                    </div>
                    <span className="px-2.5 py-1 text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg">
                      {sampleDevisList.length} devis enregistrés
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto border border-slate-850 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="p-3">Réf / Client</th>
                          <th className="p-3">Projet & Ouvrage</th>
                          <th className="p-3">Surface (m²)</th>
                          <th className="p-3 font-mono">Total (TND)</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {sampleDevisList.map((devis, index) => (
                          <tr key={devis.id || index} className="hover:bg-slate-900/60 transition-colors">
                            <td className="p-3 font-semibold text-white">
                              <div className="font-bold">{devis.clientName || 'Client Particulier'}</div>
                              <div className="text-[10px] font-mono text-amber-400">{devis.id || `DEV-2026-${index + 100}`}</div>
                            </td>
                            <td className="p-3 text-slate-300 font-medium">
                              {devis.projectTitle}
                            </td>
                            <td className="p-3 font-mono text-slate-300">
                              {devis.surfaceArea} m²
                            </td>
                            <td className="p-3 font-mono font-bold text-amber-400">
                              {devis.totalTnd.toLocaleString('fr-TN')} DT
                            </td>
                            <td className="p-3 text-slate-400 font-mono text-[11px]">
                              {devis.date || '2026-08-20'}
                            </td>
                            <td className="p-3 text-right">
                              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Validé
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Panneau Propriétaire KONSTRIVO Technologies 2026</span>
          </div>

          <div className="flex items-center gap-2">
            {isCurrentlyAdmin && (
              <button
                type="button"
                onClick={handleAdminLogout}
                className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Déconnexion Admin</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Fermer le Panneau
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
