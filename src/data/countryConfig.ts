import { CountryCode, CountryConfig, CurrencyCode } from '../types';

export const COUNTRIES_CONFIG: Record<CountryCode, CountryConfig> = {
  TN: {
    code: 'TN',
    nameFr: 'Tunisie',
    nameAr: 'تونس',
    flag: '🇹🇳',
    defaultCurrency: 'TND',
    supportedCurrencies: ['TND', 'EUR', 'USD'],
    defaultVatRate: 19,
    vatRates: [
      { rate: 19, label: '19% (Taux Standard BTP Tunisie)' },
      { rate: 13, label: '13% (Taux Intermédiaire)' },
      { rate: 7, label: '7% (Régime Artisans & Patentes)' },
      { rate: 0, label: '0% (Exonéré / Net H.T)' }
    ],
    timbreFiscalDefault: 1.000,
    timbreLabel: '1.000 DT (Timbre Fiscal)',
    standardRetenueRate: 5,
    buildingCodes: 'DTU Tunisie / Normes NT 2026',
    unitSystem: 'metric'
  },
  FR: {
    code: 'FR',
    nameFr: 'France',
    nameAr: 'فرنسا',
    flag: '🇫🇷',
    defaultCurrency: 'EUR',
    supportedCurrencies: ['EUR', 'USD'],
    defaultVatRate: 20,
    vatRates: [
      { rate: 20, label: '20% (TVA Normal Travaux Neufs)' },
      { rate: 10, label: '10% (TVA Rénovation / Amélioration)' },
      { rate: 5.5, label: '5.5% (Rénovation Énergétique RGE)' },
      { rate: 0, label: '0% (Franchise en base / Auto-entrepreneur)' }
    ],
    timbreFiscalDefault: 0.0,
    timbreLabel: '0.00 € (Pas de timbre)',
    standardRetenueRate: 5,
    buildingCodes: 'NF DTU / Eurocodes / RE2020',
    unitSystem: 'metric'
  },
  DZ: {
    code: 'DZ',
    nameFr: 'Algérie',
    nameAr: 'الجزائر',
    flag: '🇩🇿',
    defaultCurrency: 'DZD',
    supportedCurrencies: ['DZD', 'EUR', 'USD'],
    defaultVatRate: 19,
    vatRates: [
      { rate: 19, label: '19% (TVA Standard BTP Algérie)' },
      { rate: 9, label: '9% (Taux Réduit Travaux Spéciaux)' },
      { rate: 0, label: '0% (Exonéré)' }
    ],
    timbreFiscalDefault: 100.0,
    timbreLabel: '100 DZD (Timbre de Quittance)',
    standardRetenueRate: 5,
    buildingCodes: 'DTR BTP Algérie / CNERIB',
    unitSystem: 'metric'
  },
  SA: {
    code: 'SA',
    nameFr: 'Arabie Saoudite',
    nameAr: 'المملكة العربية السعودية',
    flag: '🇸🇦',
    defaultCurrency: 'SAR',
    supportedCurrencies: ['SAR', 'USD'],
    defaultVatRate: 15,
    vatRates: [
      { rate: 15, label: '15% (ضريبة القيمة المضافة ZATCA VAT)' },
      { rate: 0, label: '0% (معفى / مسكن أول مدعوم)' }
    ],
    timbreFiscalDefault: 0.0,
    timbreLabel: '0.00 SAR',
    standardRetenueRate: 5,
    buildingCodes: 'كود البناء السعودي (SBC 2026)',
    unitSystem: 'metric'
  },
  AE: {
    code: 'AE',
    nameFr: 'Émirats Arabes Unis',
    nameAr: 'الإمارات العربية المتحدة',
    flag: '🇦🇪',
    defaultCurrency: 'AED',
    supportedCurrencies: ['AED', 'USD'],
    defaultVatRate: 5,
    vatRates: [
      { rate: 5, label: '5% (Standard UAE VAT FTA)' },
      { rate: 0, label: '0% (Designated Free Zones)' }
    ],
    timbreFiscalDefault: 0.0,
    timbreLabel: '0.00 AED',
    standardRetenueRate: 5,
    buildingCodes: 'Dubai Building Code / UAE Fire & Safety',
    unitSystem: 'metric'
  },
  US: {
    code: 'US',
    nameFr: 'États-Unis',
    nameAr: 'الولايات المتحدة',
    flag: '🇺🇸',
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR'],
    defaultVatRate: 8.25,
    vatRates: [
      { rate: 8.25, label: '8.25% (State & Local Sales Tax)' },
      { rate: 6.0, label: '6.00% (Reduced Material Tax)' },
      { rate: 0, label: '0% (Contractor Direct Resale Exemption)' }
    ],
    timbreFiscalDefault: 0.0,
    timbreLabel: '$0.00',
    standardRetenueRate: 10,
    buildingCodes: 'IBC / IRC / ASTM / OSHA 1926',
    unitSystem: 'imperial'
  },
  GLOBAL: {
    code: 'GLOBAL',
    nameFr: 'International / Multi-Pays',
    nameAr: 'نظام عالمي موحد',
    flag: '🌍',
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR', 'TND', 'SAR', 'AED', 'DZD'],
    defaultVatRate: 15,
    vatRates: [
      { rate: 20, label: '20% (Standard International VAT)' },
      { rate: 15, label: '15% (Standard Regional VAT)' },
      { rate: 10, label: '10% (Reduced Tax)' },
      { rate: 5, label: '5% (Low VAT)' },
      { rate: 0, label: '0% (Tax Exempt)' }
    ],
    timbreFiscalDefault: 0.0,
    timbreLabel: '0.00',
    standardRetenueRate: 5,
    buildingCodes: 'ISO 21542 / International Building Code',
    unitSystem: 'metric'
  }
};

// Base reference: 1 TND in other currencies (2026 economic conditions)
export const EXCHANGE_RATES_FROM_TND: Record<CurrencyCode, number> = {
  TND: 1.0,
  EUR: 0.295,
  DZD: 43.80,
  SAR: 1.21,
  AED: 1.18,
  USD: 0.322
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, { symbol: string; label: string; decimals: number }> = {
  TND: { symbol: 'DT', label: 'Dinar Tunisien', decimals: 3 },
  EUR: { symbol: '€', label: 'Euro', decimals: 2 },
  DZD: { symbol: 'DA', label: 'Dinar Algérien', decimals: 2 },
  SAR: { symbol: 'SR', label: 'Riyal Saoudien', decimals: 2 },
  AED: { symbol: 'AED', label: 'Dirham Émirati', decimals: 2 },
  USD: { symbol: '$', label: 'US Dollar', decimals: 2 }
};

export function convertFromTnd(amountInTnd: number, targetCurrency: CurrencyCode): number {
  const rate = EXCHANGE_RATES_FROM_TND[targetCurrency] || 1.0;
  return amountInTnd * rate;
}

export function formatPrice(amount: number, currency: CurrencyCode, country?: CountryCode): string {
  const meta = CURRENCY_SYMBOLS[currency] || { symbol: currency, decimals: 2 };
  return `${amount.toFixed(meta.decimals)} ${meta.symbol}`;
}
