import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, Plus, Share2, Copy, Check, Info, Layers, Maximize2, 
  Ruler, HelpCircle, Shield, AlertTriangle, ArrowRight, Sparkles,
  Droplet, Zap, Umbrella, Sun, Trees, Paintbrush, Trash2, Hammer,
  DoorClosed, Percent, Receipt, FileText, CheckCircle2, Eye,
  SlidersHorizontal, Printer, ChevronDown, ChevronUp, Clock, Wrench,
  ShieldCheck, FileCheck
} from 'lucide-react';
import { 
  TradeCategory, MaterialRate, Language, DevisItem, CalculationResult, 
  CountryCode, CurrencyCode, UnitSystem 
} from '../types';
import { 
  calculatePlaco, calculatePeinture, calculateCarrelage, calculateMaconnerie,
  calculatePlomberie, calculateElectricite, calculateEtancheite, calculateIsolation,
  calculateMenuiserie, calculateSols, calculateFacade, calculateDemolition,
  PlacoInput, PeintureInput, CarrelageInput, MaconnerieInput,
  PlomberieInput, ElectriciteInput, EtancheiteInput, IsolationInput,
  MenuiserieInput, SolsInput, FacadeInput, DemolitionInput
} from '../utils/calculations';
import { formatCalculationForWhatsApp, openWhatsApp } from '../utils/whatsapp';
import { COUNTRIES_CONFIG, CURRENCY_SYMBOLS, convertFromTnd, formatPrice } from '../data/countryConfig';
import { auditCalculationResult, generateAuditPdfHtml } from '../utils/auditEngine';

interface CalculatorTabProps {
  rates: MaterialRate[];
  lang: Language;
  country: CountryCode;
  currency: CurrencyCode;
  unitSystem: UnitSystem;
  onAddToDevis: (item: DevisItem) => void;
  onAddMultipleToDevis: (items: DevisItem[]) => void;
  wasteMarginDefault: number;
}

export const CalculatorTab: React.FC<CalculatorTabProps> = ({
  rates,
  lang,
  country,
  currency,
  unitSystem,
  onAddToDevis,
  onAddMultipleToDevis,
  wasteMarginDefault
}) => {
  const currentCountry = COUNTRIES_CONFIG[country] || COUNTRIES_CONFIG.TN;
  const currMeta = CURRENCY_SYMBOLS[currency] || { symbol: currency, decimals: 2 };

  const [selectedTrade, setSelectedTrade] = useState<TradeCategory>('placo');
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);

  // FISCAL & DISPLAY OPTIONS (INGÉNIERIE & FISCALITÉ 2026)
  const [tvaPercent, setTvaPercent] = useState<number>(currentCountry.defaultVatRate);
  const [includeTimbre, setIncludeTimbre] = useState<boolean>(country === 'TN' || country === 'DZ');
  const [retenueGarantie, setRetenueGarantie] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'detail' | 'compact'>('detail');
  const [showSteps, setShowSteps] = useState<boolean>(true);
  const [showAuditDetails, setShowAuditDetails] = useState<boolean>(false);

  // When country changes, adapt default TVA and Timbre
  useEffect(() => {
    setTvaPercent(currentCountry.defaultVatRate);
    setIncludeTimbre(country === 'TN' || country === 'DZ');
  }, [country, currentCountry.defaultVatRate]);

  // 1. PLACO STATE
  const [placoSubType, setPlacoSubType] = useState<'faux_plafond_ba13' | 'cloison_fixe' | 'doublage_colle' | 'plafond_demontable' | 'aquapanel_exterieur' | 'caisson_retombee' | 'arc_forme_complexe'>('cloison_fixe');
  const [placoLength, setPlacoLength] = useState<number>(5.0);
  const [placoHeight, setPlacoHeight] = useState<number>(2.8);
  const [placoOpeningsCount, setPlacoOpeningsCount] = useState<number>(1);
  const [placoOpeningArea, setPlacoOpeningArea] = useState<number>(1.68);
  const [placoBoardType, setPlacoBoardType] = useState<string>('plaque_ba13_standard');
  const [placoThickness, setPlacoThickness] = useState<string>('12.5mm');
  const [placoDimension, setPlacoDimension] = useState<string>('120x250');
  const [placoStudType, setPlacoStudType] = useState<string>('48mm');
  const [placoSkinType, setPlacoSkinType] = useState<'single_side' | 'two_sides_single_skin' | 'two_sides_double_skin'>('two_sides_single_skin');
  const [placoSpacing, setPlacoSpacing] = useState<60 | 40>(60);
  const [placoInsulation, setPlacoInsulation] = useState<boolean>(false);
  const [placoWaste, setPlacoWaste] = useState<number>(wasteMarginDefault || 10);
  const [placoLaborRate, setPlacoLaborRate] = useState<number>(18.0);
  const [placoCaissonHeight, setPlacoCaissonHeight] = useState<number>(20);
  const [placoCaissonWidth, setPlacoCaissonWidth] = useState<number>(40);
  const [placoWithGorge, setPlacoWithGorge] = useState<boolean>(true);
  const [placoArcCount, setPlacoArcCount] = useState<number>(1);
  const [placoForfaitPrice, setPlacoForfaitPrice] = useState<number>(150);

  // 2. PEINTURE STATE
  const [peintureLength, setPeintureLength] = useState<number>(6.0);
  const [peintureHeight, setPeintureHeight] = useState<number>(2.8);
  const [peintureOpeningsArea, setPeintureOpeningsArea] = useState<number>(3.0);
  const [peintureType, setPeintureType] = useState<'peinture_acrylique_10l' | 'peinture_satinee_10l' | 'peinture_elastique_10l'>('peinture_acrylique_10l');
  const [peintureCoats, setPeintureCoats] = useState<number>(2);
  const [peintureSurface, setPeintureSurface] = useState<'smooth' | 'normal' | 'rough'>('normal');
  const [peintureLaborRate, setPeintureLaborRate] = useState<number>(8.0);

  // 3. CARRELAGE STATE
  const [carrelageLength, setCarrelageLength] = useState<number>(6.0);
  const [carrelageWidth, setCarrelageWidth] = useState<number>(4.0);
  const [carrelageFormat, setCarrelageFormat] = useState<'30x30' | '40x40' | '60x60' | '60x120'>('60x60');
  const [carrelagePose, setCarrelagePose] = useState<'droit' | 'diagonale'>('droit');
  const [carrelageLaborRate, setCarrelageLaborRate] = useState<number>(22.0);

  // 4. MAÇONNERIE STATE
  const [maconnerieLength, setMaconnerieLength] = useState<number>(10.0);
  const [maconnerieHeight, setMaconnerieHeight] = useState<number>(2.8);
  const [maconnerieOpenings, setMaconnerieOpenings] = useState<number>(4.0);
  const [maconnerieType, setMaconnerieType] = useState<'brique_12trous' | 'bloc_beton_20x20x40'>('brique_12trous');
  const [maconnerieLaborRate, setMaconnerieLaborRate] = useState<number>(15.0);

  // 5. PLOMBERIE STATE
  const [plomberiePoints, setPlomberiePoints] = useState<number>(4);
  const [plomberieNetworkLength, setPlomberieNetworkLength] = useState<number>(18);
  const [plomberiePipeType, setPlomberiePipeType] = useState<'ppr' | 'multicouche' | 'pvc_evac'>('ppr');
  const [plomberieLaborPerPoint, setPlomberieLaborPerPoint] = useState<number>(65.0);

  // 6. ÉLECTRICITÉ STATE
  const [elecArea, setElecArea] = useState<number>(30.0);
  const [elecLightPoints, setElecLightPoints] = useState<number>(6);
  const [elecPowerOutlets, setElecPowerOutlets] = useState<number>(8);
  const [elecForceLines, setElecForceLines] = useState<number>(2);
  const [elecLaborPerPoint, setElecLaborPerPoint] = useState<number>(25.0);

  // 7. ÉTANCHÉITÉ STATE
  const [etancheiteArea, setEtancheiteArea] = useState<number>(50.0);
  const [etancheiteAcrotere, setEtancheiteAcrotere] = useState<number>(28.0);
  const [etancheiteSystem, setEtancheiteSystem] = useState<'membrane_bitumineuse' | 'resine_liquide_sdb'>('membrane_bitumineuse');
  const [etancheiteLaborRate, setEtancheiteLaborRate] = useState<number>(14.0);

  // 8. ISOLATION STATE
  const [isolationArea, setIsolationArea] = useState<number>(45.0);
  const [isolationType, setIsolationType] = useState<'laine_de_verre_50mm' | 'laine_de_roche_50mm' | 'polystyrene'>('laine_de_roche_50mm');
  const [isolationLaborRate, setIsolationLaborRate] = useState<number>(6.0);

  // 9. MENUISERIE STATE
  const [menuiserieSubType, setMenuiserieSubType] = useState<'bloc_porte_isoplane' | 'bloc_porte_decor' | 'porte_fenetre_alu' | 'fenetre_pvc'>('bloc_porte_decor');
  const [menuiserieUnits, setMenuiserieUnits] = useState<number>(4);
  const [menuiserieLaborRate, setMenuiserieLaborRate] = useState<number>(45.0);

  // 10. SOLS STATE
  const [solsArea, setSolsArea] = useState<number>(35.0);
  const [solsType, setSolsType] = useState<'parquet_stratifie' | 'beton_cire'>('parquet_stratifie');
  const [solsLaborRate, setSolsLaborRate] = useState<number>(12.0);

  // 11. FAÇADE STATE
  const [facadeArea, setFacadeArea] = useState<number>(80.0);
  const [facadeOpenings, setFacadeOpenings] = useState<number>(12.0);
  const [facadeType, setFacadeType] = useState<'enduit_monocouche' | 'peinture_facade'>('enduit_monocouche');
  const [facadeLaborRate, setFacadeLaborRate] = useState<number>(18.0);

  // 12. DÉMOLITION STATE
  const [demoArea, setDemoArea] = useState<number>(20.0);
  const [demoThickness, setDemoThickness] = useState<number>(15.0);
  const [demoType, setDemoType] = useState<'cloison_brique_placo' | 'carrelage_chape' | 'beton'>('cloison_brique_placo');
  const [demoLaborRate, setDemoLaborRate] = useState<number>(12.0);

  // CALCULATED RESULT
  const calculationResult: CalculationResult = useMemo(() => {
    const fiscalOpts = {
      tvaPercent,
      includeTimbre,
      retenueGarantiePercent: retenueGarantie
    };

    let result: CalculationResult;

    if (selectedTrade === 'placo') {
      const input: PlacoInput = {
        subType: placoSubType,
        length: placoLength,
        heightOrWidth: placoHeight,
        openingsCount: placoOpeningsCount,
        openingArea: placoOpeningArea,
        boardType: placoBoardType,
        boardThickness: placoThickness as any,
        boardDimension: placoDimension as any,
        studType: placoStudType as any,
        skinType: placoSkinType,
        montantsSpacingCm: placoSpacing,
        withInsulation: placoInsulation,
        wasteMarginPercent: placoWaste,
        laborRatePerM2: placoLaborRate,
        caissonHeightCm: placoCaissonHeight,
        caissonWidthCm: placoCaissonWidth,
        withGorgeLumineuse: placoWithGorge,
        arcCount: placoArcCount,
        forfaitPriceTnd: placoForfaitPrice,
        ...fiscalOpts
      };
      result = calculatePlaco(input, rates);
    } else if (selectedTrade === 'peinture') {
      const input: PeintureInput = {
        length: peintureLength,
        height: peintureHeight,
        openingsArea: peintureOpeningsArea,
        paintType: peintureType,
        rendementM2L: 10,
        coats: peintureCoats,
        surfaceCondition: peintureSurface,
        wasteMarginPercent: wasteMarginDefault,
        laborRatePerM2: peintureLaborRate,
        ...fiscalOpts
      };
      result = calculatePeinture(input, rates);
    } else if (selectedTrade === 'carrelage') {
      const input: CarrelageInput = {
        length: carrelageLength,
        width: carrelageWidth,
        tileFormat: carrelageFormat,
        poseType: carrelagePose,
        tileType: carrelageFormat === '60x60' || carrelageFormat === '60x120' ? 'carreau_grand_60x60' : 'carreau_standard_30x30',
        wasteMarginPercent: wasteMarginDefault,
        laborRatePerM2: carrelageLaborRate,
        ...fiscalOpts
      };
      result = calculateCarrelage(input, rates);
    } else if (selectedTrade === 'maconnerie') {
      const input: MaconnerieInput = {
        length: maconnerieLength,
        height: maconnerieHeight,
        openingsArea: maconnerieOpenings,
        type: maconnerieType,
        wasteMarginPercent: wasteMarginDefault,
        laborRatePerM2: maconnerieLaborRate,
        ...fiscalOpts
      };
      result = calculateMaconnerie(input, rates);
    } else if (selectedTrade === 'plomberie') {
      const input: PlomberieInput = {
        pointsCount: plomberiePoints,
        networkLengthM: plomberieNetworkLength,
        pipeType: plomberiePipeType,
        wasteMarginPercent: wasteMarginDefault,
        laborRatePerPoint: plomberieLaborPerPoint,
        ...fiscalOpts
      };
      result = calculatePlomberie(input, rates);
    } else if (selectedTrade === 'electricite') {
      const input: ElectriciteInput = {
        areaM2: elecArea,
        lightPointsCount: elecLightPoints,
        powerOutletsCount: elecPowerOutlets,
        forceLinesCount: elecForceLines,
        wasteMarginPercent: wasteMarginDefault,
        laborRatePerPoint: elecLaborPerPoint,
        ...fiscalOpts
      };
      result = calculateElectricite(input, rates);
    } else if (selectedTrade === 'etancheite') {
      const input: EtancheiteInput = {
        areaM2: etancheiteArea,
        acroterePerimeterM: etancheiteAcrotere,
        system: etancheiteSystem,
        wasteMarginPercent: wasteMarginDefault,
        laborRatePerM2: etancheiteLaborRate,
        ...fiscalOpts
      };
      result = calculateEtancheite(input, rates);
    } else if (selectedTrade === 'isolation') {
      const input: IsolationInput = {
        areaM2: isolationArea,
        insulationType: isolationType,
        wasteMarginPercent: wasteMarginDefault,
        laborRatePerM2: isolationLaborRate,
        ...fiscalOpts
      };
      result = calculateIsolation(input, rates);
    } else if (selectedTrade === 'menuiserie') {
      const input: MenuiserieInput = {
        subType: menuiserieSubType,
        unitsCount: menuiserieUnits,
        wasteMarginPercent: wasteMarginDefault,
        laborRatePerUnit: menuiserieLaborRate,
        ...fiscalOpts
      };
      result = calculateMenuiserie(input, rates);
    } else if (selectedTrade === 'sols') {
      const input: SolsInput = {
        areaM2: solsArea,
        solType: solsType,
        wasteMarginPercent: wasteMarginDefault,
        laborRatePerM2: solsLaborRate,
        ...fiscalOpts
      };
      result = calculateSols(input, rates);
    } else if (selectedTrade === 'facade') {
      const input: FacadeInput = {
        areaM2: facadeArea,
        openingsArea: facadeOpenings,
        type: facadeType,
        wasteMarginPercent: wasteMarginDefault,
        laborRatePerM2: facadeLaborRate,
        ...fiscalOpts
      };
      result = calculateFacade(input, rates);
    } else {
      const input: DemolitionInput = {
        areaM2: demoArea,
        thicknessCm: demoThickness,
        type: demoType,
        wasteMarginPercent: wasteMarginDefault,
        laborRatePerM2: demoLaborRate,
        ...fiscalOpts
      };
      result = calculateDemolition(input, rates);
    }

    // Convert result to target currency
    const totalMatConverted = convertFromTnd(result.totalMaterialTnd, currency);
    const estLaborConverted = convertFromTnd(result.estimatedLaborTnd, currency);
    const grandTotalConverted = totalMatConverted + estLaborConverted;
    const tvaAmountConverted = (grandTotalConverted * tvaPercent) / 100;
    const timbreConverted = includeTimbre ? currentCountry.timbreFiscalDefault : 0;
    const totalTtcConverted = grandTotalConverted + tvaAmountConverted + timbreConverted;
    const retenueConverted = (grandTotalConverted * retenueGarantie) / 100;
    const netAPayerConverted = totalTtcConverted - retenueConverted;
    const estLaborDays = Math.max(0.5, Math.round((result.estimatedLaborTnd / 75) * 2) / 2);

    const convertedItems = result.materialItems.map(item => ({
      ...item,
      unitPriceConverted: convertFromTnd(item.unitPriceTnd, currency),
      totalConverted: convertFromTnd(item.totalTnd, currency)
    }));

    return {
      ...result,
      materialItems: convertedItems,
      currency,
      currencySymbol: currMeta.symbol,
      totalMaterialConverted: totalMatConverted,
      estimatedLaborConverted: estLaborConverted,
      grandTotalConverted,
      tvaPercent,
      tvaAmountConverted,
      timbreFiscalConverted: timbreConverted,
      retenueGarantiePercent: retenueGarantie,
      retenueGarantieConverted: retenueConverted,
      totalTtcConverted,
      netAPayerConverted,
      estimatedLaborDays: estLaborDays
    };
  }, [
    selectedTrade, rates, wasteMarginDefault, tvaPercent, includeTimbre, retenueGarantie, currency, currentCountry,
    placoSubType, placoLength, placoHeight, placoOpeningsCount, placoOpeningArea, placoBoardType, placoSkinType, placoSpacing, placoInsulation, placoWaste, placoLaborRate,
    placoCaissonHeight, placoCaissonWidth, placoWithGorge, placoArcCount, placoForfaitPrice,
    peintureLength, peintureHeight, peintureOpeningsArea, peintureType, peintureCoats, peintureSurface, peintureLaborRate,
    carrelageLength, carrelageWidth, carrelageFormat, carrelagePose, carrelageLaborRate,
    maconnerieLength, maconnerieHeight, maconnerieOpenings, maconnerieType, maconnerieLaborRate,
    plomberiePoints, plomberieNetworkLength, plomberiePipeType, plomberieLaborPerPoint,
    elecArea, elecLightPoints, elecPowerOutlets, elecForceLines, elecLaborPerPoint,
    etancheiteArea, etancheiteAcrotere, etancheiteSystem, etancheiteLaborRate,
    isolationArea, isolationType, isolationLaborRate,
    menuiserieSubType, menuiserieUnits, menuiserieLaborRate,
    solsArea, solsType, solsLaborRate,
    facadeArea, facadeOpenings, facadeType, facadeLaborRate,
    demoArea, demoThickness, demoType, demoLaborRate
  ]);

  // Automated Calculation Verification & Audit Engine
  const auditResult = useMemo(() => {
    return auditCalculationResult(calculationResult, country);
  }, [calculationResult, country]);

  const handleDownloadAuditPdf = () => {
    const html = generateAuditPdfHtml(calculationResult, auditResult, currMeta.symbol);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handleAddAllToDevis = () => {
    const devisItems: DevisItem[] = calculationResult.materialItems.map(item => {
      const uPrice = item.unitPriceConverted ?? item.unitPriceTnd;
      const tot = item.totalConverted ?? item.totalTnd;
      return {
        id: `${item.id}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        trade: selectedTrade,
        title: `${item.nameFr} (${calculationResult.subTypeTitle})`,
        quantity: item.qty,
        unit: item.unit,
        unitPrice: uPrice,
        total: tot,
        unitPriceTnd: item.unitPriceTnd,
        totalTnd: item.totalTnd,
        unitPriceConverted: item.unitPriceConverted,
        totalConverted: item.totalConverted,
        details: item.packageInfo ? `${item.packageInfo} • Métré ${calculationResult.netAreaM2.toFixed(1)}m²` : `Projet ${calculationResult.netAreaM2.toFixed(1)}m²`
      };
    });

    // Add labor as an explicit devis line
    if (calculationResult.estimatedLaborTnd > 0) {
      const area = calculationResult.netAreaM2 || 1;
      const laborTot = calculationResult.estimatedLaborConverted || calculationResult.estimatedLaborTnd;
      const laborUnitPrice = laborTot / area;
      devisItems.push({
        id: `labor-${Date.now()}`,
        trade: selectedTrade,
        title: `Main d'œuvre (Chantier) - ${calculationResult.subTypeTitle}`,
        quantity: Number(calculationResult.netAreaM2.toFixed(1)) || 1,
        unit: calculationResult.subType === 'caisson_retombee' ? 'ml' : selectedTrade === 'menuiserie' ? 'u' : 'm²',
        unitPrice: laborUnitPrice,
        total: laborTot,
        unitPriceTnd: calculationResult.estimatedLaborTnd / area,
        totalTnd: calculationResult.estimatedLaborTnd,
        unitPriceConverted: laborUnitPrice,
        totalConverted: laborTot,
        details: `Pose, mise à niveau et finition selon ${currentCountry.buildingCodes}`
      });
    }

    onAddMultipleToDevis(devisItems);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = formatCalculationForWhatsApp(calculationResult, lang === 'fr' ? 'fr' : 'derja');
    openWhatsApp(text);
  };

  const handleCopySummary = () => {
    const text = formatCalculationForWhatsApp(calculationResult, lang === 'fr' ? 'fr' : 'derja');
    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  // Convert m² to sq ft when imperial
  const displayArea = unitSystem === 'imperial' 
    ? `${(calculationResult.netAreaM2 * 10.7639).toFixed(1)} sq ft (${calculationResult.netAreaM2.toFixed(1)} m²)`
    : `${calculationResult.netAreaM2.toFixed(1)} m²`;

  return (
    <div className="space-y-6">
      
      {/* Top Banner Trade Selector with Blueprint CAD Aesthetic */}
      <div className="relative overflow-hidden bg-[#131b2e] rounded-3xl p-5 sm:p-6 border border-[#1e293b] shadow-2xl space-y-5 bg-blueprint">
        
        {/* Subtle CAD Grid Accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Calculator className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>{lang === 'derja' ? 'الحاسبة الهندسية الذكية 2026' : lang === 'ar' ? 'حاسبة المهن والمواد الهندسية' : 'Calculateur de Métré & Ingénierie BTP'}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-950 text-amber-400 font-mono border border-slate-800 font-bold">
                  {currentCountry.flag} {currency}
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {lang === 'derja' ? 'اختر نوع الشغلة وادخل القياسات لاستخراج جدول السليعة، الأداءات (TVA) واليد العاملة بدقة' : 'Sélectionnez le corps d’état, configurez les dimensions et obtenez le bordereau exact de fournitures et main d’œuvre selon DTU.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => setViewMode(prev => prev === 'detail' ? 'compact' : 'detail')}
              className="text-xs font-bold px-3.5 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>{viewMode === 'detail' ? 'Vue Ingénieur' : 'Vue Synthétique'}</span>
            </button>

            <div className="text-xs font-semibold px-3 py-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/30 text-center">
              Marge chute : <span className="font-bold text-white">{calculationResult.wasteMarginPercent}%</span>
            </div>
          </div>
        </div>

        {/* Specialized Visual Quick Selectors: Placo, Ceilings, Drywall, and Material Estimators */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <button
            onClick={() => { setSelectedTrade('placo'); setPlacoSubType('faux_plafond_ba13'); }}
            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              selectedTrade === 'placo' && placoSubType === 'faux_plafond_ba13'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-amber-500/40 hover:bg-slate-900'
            }`}
          >
            <div className={`p-2 rounded-xl ${selectedTrade === 'placo' && placoSubType === 'faux_plafond_ba13' ? 'bg-slate-950 text-amber-400' : 'bg-slate-900 text-amber-400 border border-slate-800'}`}>
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black block">Faux Plafonds BA13</span>
              <span className="text-[10px] opacity-80 block">Fourrures & Suspentes</span>
            </div>
          </button>

          <button
            onClick={() => { setSelectedTrade('placo'); setPlacoSubType('cloison_fixe'); }}
            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              selectedTrade === 'placo' && placoSubType === 'cloison_fixe'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-amber-500/40 hover:bg-slate-900'
            }`}
          >
            <div className={`p-2 rounded-xl ${selectedTrade === 'placo' && placoSubType === 'cloison_fixe' ? 'bg-slate-950 text-amber-400' : 'bg-slate-900 text-amber-400 border border-slate-800'}`}>
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black block">Cloisons & Séparations</span>
              <span className="text-[10px] opacity-80 block">Rails 48 & Montants</span>
            </div>
          </button>

          <button
            onClick={() => { setSelectedTrade('placo'); setPlacoSubType('plafond_demontable'); }}
            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              selectedTrade === 'placo' && placoSubType === 'plafond_demontable'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-amber-500/40 hover:bg-slate-900'
            }`}
          >
            <div className={`p-2 rounded-xl ${selectedTrade === 'placo' && placoSubType === 'plafond_demontable' ? 'bg-slate-950 text-amber-400' : 'bg-slate-900 text-amber-400 border border-slate-800'}`}>
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black block">Plafond Démontable</span>
              <span className="text-[10px] opacity-80 block">Dalles 60x60 T24</span>
            </div>
          </button>

          <button
            onClick={() => { setSelectedTrade('placo'); setPlacoSubType('caisson_retombee'); }}
            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
              selectedTrade === 'placo' && placoSubType === 'caisson_retombee'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-amber-500/40 hover:bg-slate-900'
            }`}
          >
            <div className={`p-2 rounded-xl ${selectedTrade === 'placo' && placoSubType === 'caisson_retombee' ? 'bg-slate-950 text-amber-400' : 'bg-slate-900 text-amber-400 border border-slate-800'}`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black block">Caissons & Gorges LED</span>
              <span className="text-[10px] opacity-80 block">Métré Linéaire (ml)</span>
            </div>
          </button>
        </div>

        {/* 12 Trade Badges Grid */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            { id: 'placo', label: 'PLACO / PLÂTRE', sub: 'أسقف وجدران جبس', icon: Layers },
            { id: 'peinture', label: 'PEINTURE', sub: 'دهان وطلاء', icon: Paintbrush },
            { id: 'carrelage', label: 'CARRELAGE', sub: 'تبليط وسيراميك', icon: Ruler },
            { id: 'maconnerie', label: 'MAÇONNERIE', sub: 'بناء بالأجر', icon: Hammer },
            { id: 'plomberie', label: 'PLOMBERIE', sub: 'سباكة وصحي', icon: Droplet },
            { id: 'electricite', label: 'ÉLECTRICITÉ', sub: 'كهرباء وإنارة', icon: Zap },
            { id: 'etancheite', label: 'ÉTANCHÉITÉ', sub: 'عزل مائي', icon: Umbrella },
            { id: 'isolation', label: 'ISOLATION', sub: 'عزل حراري', icon: Sun },
            { id: 'menuiserie', label: 'MENUISERIE', sub: 'أبواب وشبابيك', icon: DoorClosed },
            { id: 'sols', label: 'SOLS & PARQUET', sub: 'أرضيات وباركيه', icon: Trees },
            { id: 'facade', label: 'FAÇADE', sub: 'واجهات خارجية', icon: Shield },
            { id: 'demolition', label: 'DÉMOLITION', sub: 'هدم وأنقاض', icon: Trash2 },
          ].map(t => {
            const isSelected = selectedTrade === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTrade(t.id as TradeCategory)}
                className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/20 font-black'
                    : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <t.icon className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-950' : 'text-amber-400'}`} />
                  <div className="text-xs font-black tracking-tight truncate">{t.label}</div>
                </div>
                <div className={`text-[10px] font-bold truncate ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                  {t.sub}
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Grid: Inputs (Left) & Output Results (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* INPUTS COLUMN */}
        <div className="lg:col-span-7 bg-[#131b2e] rounded-3xl p-6 border border-[#1e293b] space-y-5 shadow-xl">
          
          {/* Fiscal Parameters Bar (TVA, Timbre, Retenue) */}
          <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                <span>{lang === 'derja' ? 'الخيارات الجبائية والمالية:' : 'Fiscalité & Régime de Taxe :'}</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {currentCountry.flag} {currentCountry.nameFr}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Dynamic TVA Rate */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 mb-1 block">Taux TVA :</label>
                <select
                  value={tvaPercent}
                  onChange={(e) => setTvaPercent(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold cursor-pointer"
                >
                  {currentCountry.vatRates.map((vr) => (
                    <option key={vr.rate} value={vr.rate}>
                      {vr.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timbre Fiscal */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 mb-1 block">Timbre Fiscal :</label>
                <button
                  type="button"
                  onClick={() => setIncludeTimbre(!includeTimbre)}
                  className={`w-full py-1.5 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    includeTimbre 
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300' 
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  <span>{currentCountry.timbreLabel}</span>
                  <span>{includeTimbre ? '✓ Oui' : 'Non'}</span>
                </button>
              </div>

              {/* Retenue de Garantie */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 mb-1 block">Retenue de Garantie :</label>
                <select
                  value={retenueGarantie}
                  onChange={(e) => setRetenueGarantie(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold cursor-pointer"
                >
                  <option value={0}>0% (Sans Retenue)</option>
                  <option value={5}>5% (Chantiers Standard)</option>
                  <option value={10}>10% (Marchés Publics)</option>
                </select>
              </div>
            </div>
          </div>

          {/* TRADE SPECIFIC INPUT FORMS */}
          {selectedTrade === 'placo' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-200 mb-1.5 block">Type d'Ouvrage Plâtre & Placo :</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'faux_plafond_ba13', label: 'Faux Plafond Simple BA13' },
                    { id: 'cloison_fixe', label: 'Cloison de Séparation' },
                    { id: 'doublage_colle', label: 'Doublage Mural Collé' },
                    { id: 'plafond_demontable', label: 'Plafond Démontable (60x60)' },
                    { id: 'aquapanel_exterieur', label: 'Aquapanel Ciment Extérieur' },
                    { id: 'caisson_retombee', label: 'Caisson / Retombée (الكرتوش)' },
                    { id: 'arc_forme_complexe', label: 'Arcs & Formes Complexes' },
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setPlacoSubType(st.id as any)}
                      className={`p-2 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer ${
                        placoSubType === st.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimensions */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {placoSubType === 'caisson_retombee' ? 'Longueur Caisson (ml) :' : 'Longueur (m) :'}
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.5}
                    value={placoLength}
                    onChange={(e) => setPlacoLength(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">
                    {placoSubType === 'faux_plafond_ba13' || placoSubType === 'plafond_demontable' 
                      ? 'Largeur Pièce (m) :' 
                      : placoSubType === 'caisson_retombee' 
                      ? 'Hauteur Retombée (cm) :' 
                      : 'Hauteur Mur (m) :'}
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.1}
                    value={placoHeight}
                    onChange={(e) => setPlacoHeight(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>

                {placoSubType !== 'caisson_retombee' && placoSubType !== 'arc_forme_complexe' && (
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">
                      Ouvertures & Portes (u) :
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={placoOpeningsCount}
                      onChange={(e) => setPlacoOpeningsCount(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Plaque Type & Technical Specs Selector */}
              {placoSubType !== 'plafond_demontable' && placoSubType !== 'arc_forme_complexe' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">Type de Plaque Placo / Ciment :</label>
                      <select
                        value={placoBoardType}
                        onChange={(e) => setPlacoBoardType(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold cursor-pointer"
                      >
                        <option value="plaque_ba13_standard">BA13 Standard (Blanche / standard)</option>
                        <option value="plaque_ba13_hydrofuge">BA13 Hydrofuge (Verte / SDB & Cuisine)</option>
                        <option value="plaque_ba13_coupe_feu">BA13 Coupe-Feu (Rose / Sécurité Feu)</option>
                        <option value="plaque_ba13_phonique">BA13 Phonique (Bleue / Haute Acoustique)</option>
                        <option value="plaque_habito_haute_durete">Habito® Ultra Haute Dureté</option>
                        <option value="plaque_aquapanel_ciment">Aquapanel Ciment Extérieur (Outdoor)</option>
                        <option value="plaque_aquapanel_interieur">Aquapanel Ciment Intérieur (Piscine/Spa)</option>
                        <option value="plaque_silicate_calcium">Silicate de Calcium (Résistant Humidité/Feu)</option>
                        <option value="plaque_pvc_alveolaire">Lambris / Plaque PVC Alvéolaire</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">Main d'œuvre ({currMeta.symbol}/m² ou /ml) :</label>
                      <input
                        type="number"
                        step={0.5}
                        value={placoLaborRate}
                        onChange={(e) => setPlacoLaborRate(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Advanced Technical Matrix: Thickness, Dimension & Metal Profile */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 mb-1 block">Épaisseur Plaque :</label>
                      <select
                        value={placoThickness}
                        onChange={(e) => setPlacoThickness(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold cursor-pointer"
                      >
                        <option value="6mm">6 mm (Cintrage & Arcs)</option>
                        <option value="9.5mm">9.5 mm (BA10 Plafond)</option>
                        <option value="12.5mm">12.5 mm (BA13 Standard)</option>
                        <option value="15mm">15 mm (BA15 Coupe-feu)</option>
                        <option value="18mm">18 mm (BA18 Phonique)</option>
                        <option value="25mm">25 mm (BA25 Blindé)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 mb-1 block">Dimension Plaque :</label>
                      <select
                        value={placoDimension}
                        onChange={(e) => setPlacoDimension(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold cursor-pointer"
                      >
                        <option value="120x250">1.20m x 2.50m (3.00 m² - Standard)</option>
                        <option value="120x280">1.20m x 2.80m (3.36 m² - Grande Hauteur)</option>
                        <option value="120x300">1.20m x 3.00m (3.60 m² - Commercial)</option>
                        <option value="90x200">0.90m x 2.00m (1.80 m² - Manutention Facile)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 mb-1 block">Profilé Ossature :</label>
                      <select
                        value={placoStudType}
                        onChange={(e) => setPlacoStudType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold cursor-pointer"
                      >
                        <option value="48mm">M48 / R48 (Standard 48mm)</option>
                        <option value="70mm">M70 / R70 (Grande Hauteur 70mm)</option>
                        <option value="90mm">M90 / R90 (Renforcé 90mm)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Cloison Specific Options: Skin & Spacing */}
              {placoSubType === 'cloison_fixe' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 mb-1 block">Configuration Peaux & Parements :</label>
                    <select
                      value={placoSkinType}
                      onChange={(e) => setPlacoSkinType(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold cursor-pointer"
                    >
                      <option value="single_side">Simple Face 1 Peau (Habillage unilatéral)</option>
                      <option value="two_sides_single_skin">Double Face 2 Peaux (Standard 72/48)</option>
                      <option value="two_sides_double_skin">Double Face 4 Peaux (Phonique Renforcé 98/48)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 mb-1 block">Entraxe des Montants :</label>
                    <select
                      value={placoSpacing}
                      onChange={(e) => setPlacoSpacing(Number(e.target.value) as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold cursor-pointer"
                    >
                      <option value={60}>Tous les 60 cm (Standard DTU 25.41)</option>
                      <option value={40}>Tous les 40 cm (Renforcé / Pièce humide & Carrelage)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Options checkboxes */}
              {placoSubType === 'cloison_fixe' && (
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={placoInsulation}
                      onChange={(e) => setPlacoInsulation(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0"
                    />
                    <span>Ajouter Isolation Acoustique (Laine minérale 50mm + Bande résiliente)</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* 2. PEINTURE */}
          {selectedTrade === 'peinture' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Longueur Mur/Plafond (m) :</label>
                  <input
                    type="number"
                    step={0.1}
                    value={peintureLength}
                    onChange={(e) => setPeintureLength(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Hauteur / Largeur (m) :</label>
                  <input
                    type="number"
                    step={0.1}
                    value={peintureHeight}
                    onChange={(e) => setPeintureHeight(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Ouvertures à déduire (m²) :</label>
                  <input
                    type="number"
                    step={0.5}
                    value={peintureOpeningsArea}
                    onChange={(e) => setPeintureOpeningsArea(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Gamme de Peinture :</label>
                  <select
                    value={peintureType}
                    onChange={(e) => setPeintureType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold cursor-pointer"
                  >
                    <option value="peinture_acrylique_10l">Acrylique Mate Standard (10L)</option>
                    <option value="peinture_satinee_10l">Satinée Lessivable Haut de Gamme (10L)</option>
                    <option value="peinture_elastique_10l">Élastomère Façade / Imperméable (10L)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Main d'œuvre ({currMeta.symbol}/m²) :</label>
                  <input
                    type="number"
                    step={0.5}
                    value={peintureLaborRate}
                    onChange={(e) => setPeintureLaborRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. CARRELAGE */}
          {selectedTrade === 'carrelage' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Longueur Pièce (m) :</label>
                  <input
                    type="number"
                    step={0.1}
                    value={carrelageLength}
                    onChange={(e) => setCarrelageLength(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Largeur Pièce (m) :</label>
                  <input
                    type="number"
                    step={0.1}
                    value={carrelageWidth}
                    onChange={(e) => setCarrelageWidth(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Format Carreau :</label>
                  <select
                    value={carrelageFormat}
                    onChange={(e) => setCarrelageFormat(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold cursor-pointer"
                  >
                    <option value="30x30">30x30 cm</option>
                    <option value="40x40">40x40 cm</option>
                    <option value="60x60">60x60 cm (Standard)</option>
                    <option value="60x120">60x120 cm (Grand Format)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Type de Pose :</label>
                  <select
                    value={carrelagePose}
                    onChange={(e) => setCarrelagePose(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold cursor-pointer"
                  >
                    <option value="droit">Pose Droite</option>
                    <option value="diagonale">Pose Diagonale (+10% chute)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Main d'œuvre ({currMeta.symbol}/m²) :</label>
                  <input
                    type="number"
                    step={0.5}
                    value={carrelageLaborRate}
                    onChange={(e) => setCarrelageLaborRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. MAÇONNERIE */}
          {selectedTrade === 'maconnerie' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Longueur Mur (m) :</label>
                  <input
                    type="number"
                    step={0.1}
                    value={maconnerieLength}
                    onChange={(e) => setMaconnerieLength(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Hauteur Mur (m) :</label>
                  <input
                    type="number"
                    step={0.1}
                    value={maconnerieHeight}
                    onChange={(e) => setMaconnerieHeight(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Ouvertures (m²) :</label>
                  <input
                    type="number"
                    step={0.5}
                    value={maconnerieOpenings}
                    onChange={(e) => setMaconnerieOpenings(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Type de Matériau Maçonnerie :</label>
                  <select
                    value={maconnerieType}
                    onChange={(e) => setMaconnerieType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold cursor-pointer"
                  >
                    <option value="brique_12trous">Brique Rouge 12 Trous (Cloisons & Murs)</option>
                    <option value="bloc_beton_20x20x40">Bloc Béton / Parpaing 20x20x40</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Main d'œuvre ({currMeta.symbol}/m²) :</label>
                  <input
                    type="number"
                    step={0.5}
                    value={maconnerieLaborRate}
                    onChange={(e) => setMaconnerieLaborRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. PLOMBERIE */}
          {selectedTrade === 'plomberie' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Nombre de Points d'Eau :</label>
                  <input
                    type="number"
                    min={1}
                    value={plomberiePoints}
                    onChange={(e) => setPlomberiePoints(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Longueur Réseau (m) :</label>
                  <input
                    type="number"
                    step={1}
                    value={plomberieNetworkLength}
                    onChange={(e) => setPlomberieNetworkLength(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Main d'œuvre ({currMeta.symbol}/point) :</label>
                  <input
                    type="number"
                    step={5}
                    value={plomberieLaborPerPoint}
                    onChange={(e) => setPlomberieLaborPerPoint(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">Type de Tuyauterie :</label>
                <select
                  value={plomberiePipeType}
                  onChange={(e) => setPlomberiePipeType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold cursor-pointer"
                >
                  <option value="ppr">PPR Polypropylène Thermosoudable (Alimentation)</option>
                  <option value="multicouche">Multicouche à sertir</option>
                  <option value="pvc_evac">PVC Évacuation Eaux Usées</option>
                </select>
              </div>
            </div>
          )}

          {/* 6. ÉLECTRICITÉ */}
          {selectedTrade === 'electricite' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Surface (m²) :</label>
                  <input
                    type="number"
                    value={elecArea}
                    onChange={(e) => setElecArea(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Points Lumineux :</label>
                  <input
                    type="number"
                    value={elecLightPoints}
                    onChange={(e) => setElecLightPoints(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Prises 16A :</label>
                  <input
                    type="number"
                    value={elecPowerOutlets}
                    onChange={(e) => setElecPowerOutlets(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Lignes Force / Clim :</label>
                  <input
                    type="number"
                    value={elecForceLines}
                    onChange={(e) => setElecForceLines(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 7. ÉTANCHÉITÉ */}
          {selectedTrade === 'etancheite' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Surface Toiture / Terrasse (m²) :</label>
                  <input
                    type="number"
                    value={etancheiteArea}
                    onChange={(e) => setEtancheiteArea(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Périmètre Acrotères (ml) :</label>
                  <input
                    type="number"
                    value={etancheiteAcrotere}
                    onChange={(e) => setEtancheiteAcrotere(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 8. ISOLATION */}
          {selectedTrade === 'isolation' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Surface à Isoler (m²) :</label>
                  <input
                    type="number"
                    value={isolationArea}
                    onChange={(e) => setIsolationArea(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Type d'Isolant Thermique/Phonique :</label>
                  <select
                    value={isolationType}
                    onChange={(e) => setIsolationType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold cursor-pointer"
                  >
                    <option value="laine_de_roche_50mm">Laine de Roche 50mm (Acoustique & Feu)</option>
                    <option value="laine_de_verre_50mm">Laine de Verre 50mm (Thermique)</option>
                    <option value="polystyrene">Polystyrène Extrudé XPS</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 9. MENUISERIE */}
          {selectedTrade === 'menuiserie' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Type d'Ouvrage :</label>
                  <select
                    value={menuiserieSubType}
                    onChange={(e) => setMenuiserieSubType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold cursor-pointer"
                  >
                    <option value="bloc_porte_decor">Bloc-Porte Décor Bois</option>
                    <option value="bloc_porte_isoplane">Bloc-Porte Isoplane Standard</option>
                    <option value="porte_fenetre_alu">Porte-Fenêtre Aluminium</option>
                    <option value="fenetre_pvc">Fenêtre PVC Double Vitrage</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Nombre d'Unités :</label>
                  <input
                    type="number"
                    min={1}
                    value={menuiserieUnits}
                    onChange={(e) => setMenuiserieUnits(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 10. SOLS */}
          {selectedTrade === 'sols' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Surface Sol (m²) :</label>
                  <input
                    type="number"
                    value={solsArea}
                    onChange={(e) => setSolsArea(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Revêtement :</label>
                  <select
                    value={solsType}
                    onChange={(e) => setSolsType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold cursor-pointer"
                  >
                    <option value="parquet_stratifie">Parquet Stratifié AC4 8mm + Sous-couche</option>
                    <option value="beton_cire">Béton Ciré Décoratif</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 11. FAÇADE */}
          {selectedTrade === 'facade' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Surface Façade Brute (m²) :</label>
                  <input
                    type="number"
                    value={facadeArea}
                    onChange={(e) => setFacadeArea(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Ouvertures (m²) :</label>
                  <input
                    type="number"
                    value={facadeOpenings}
                    onChange={(e) => setFacadeOpenings(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Type Revêtement :</label>
                  <select
                    value={facadeType}
                    onChange={(e) => setFacadeType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold cursor-pointer"
                  >
                    <option value="enduit_monocouche">Enduit Monocouche Projeté</option>
                    <option value="peinture_facade">Peinture Plastifiée RPE Façade</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 12. DÉMOLITION */}
          {selectedTrade === 'demolition' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Surface à Démolir (m²) :</label>
                  <input
                    type="number"
                    value={demoArea}
                    onChange={(e) => setDemoArea(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Élément à Démolir :</label>
                  <select
                    value={demoType}
                    onChange={(e) => setDemoType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold cursor-pointer"
                  >
                    <option value="cloison_brique_placo">Cloisons Briques / Plâtre</option>
                    <option value="carrelage_chape">Carrelage et Chape</option>
                    <option value="beton">Béton / Dalle</option>
                  </select>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* OUTPUT RESULTS COLUMN */}
        <div className="lg:col-span-5 bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-5 shadow-xl flex flex-col justify-between">
          
          <div className="space-y-5">
            {/* Header of Results */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-amber-400">
                  Résultat du Métré & Devis
                </span>
                <h3 className="text-base font-black text-white">{calculationResult.subTypeTitle}</h3>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-medium">Surface Net</span>
                <span className="text-sm font-black font-mono text-slate-100">{displayArea}</span>
              </div>
            </div>

            {/* 🛡️ AUTOMATED CALCULATION AUDIT BADGE & CONTROL PANEL */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              auditResult.isConforme
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${auditResult.isConforme ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black flex items-center gap-1.5">
                      <span>{lang === 'derja' ? auditResult.statusBadgeTextAr : auditResult.statusBadgeTextFr}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-amber-400 font-mono border border-slate-700">
                        {auditResult.score}% DTU
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono flex items-center gap-2">
                      <span>Ref: {auditResult.auditId}</span>
                      <span>•</span>
                      <span>{auditResult.checks.length} contrôles exécutés</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadAuditPdf}
                    className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                    title="Télécharger le Rapport d'Audit Officiel PDF"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>{lang === 'derja' ? 'تقرير التدقيق PDF' : 'Rapport Audit PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAuditDetails(!showAuditDetails)}
                    className="p-1.5 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                    title="Voir le détail de l'audit"
                  >
                    {showAuditDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expandable Audit Details breakdown */}
              {showAuditDetails && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 text-xs animate-in fade-in slide-in-from-top-2">
                  <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>Détail du Contrôle Qualité Algorithmique (V&V) :</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-normal">Calcul Arithmétique 100% Exact</span>
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                    {auditResult.checks.map((chk) => (
                      <div
                        key={chk.id}
                        className={`p-2 rounded-xl border text-[11px] flex items-start justify-between gap-2 ${
                          chk.status === 'passed'
                            ? 'bg-slate-950/80 border-emerald-900/50 text-slate-200'
                            : chk.status === 'warning'
                            ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                            : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${chk.status === 'passed' ? 'bg-emerald-400' : chk.status === 'warning' ? 'bg-amber-400' : 'bg-rose-500'}`} />
                            <span>{lang === 'derja' ? chk.titleAr : chk.titleFr}</span>
                          </div>
                          <div className="text-[10px] opacity-90 leading-tight">
                            {lang === 'derja' ? chk.messageAr : chk.messageFr}
                          </div>
                        </div>

                        {chk.valueTested && (
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-amber-400 font-bold block">
                              {chk.valueTested}
                            </span>
                            {chk.standardNorm && (
                              <span className="text-[9px] text-slate-400 block mt-0.5">{chk.standardNorm}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Metrics Bar: Estimated Days & Crew */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">Durée Chantier Estimée</span>
                  <span className="font-bold text-white font-mono">{calculationResult.estimatedLaborDays} Jours / Équipe</span>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 flex items-center gap-2.5">
                <Wrench className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">Normes & DTU</span>
                  <span className="font-bold text-slate-200 truncate block text-[11px]">{currentCountry.buildingCodes}</span>
                </div>
              </div>
            </div>

            {/* Materials Bill of Quantities */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Bordereau des Matériaux & Fournitures :</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {calculationResult.materialItems.length} articles
                </span>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 pr-1">
                {calculationResult.materialItems.map((item, idx) => (
                  <div 
                    key={idx}
                    className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-100 leading-snug">{item.nameFr}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">{item.nameAr}</div>
                      </div>
                      <div className="text-right font-black text-emerald-400 font-mono text-xs shrink-0">
                        {(item.totalConverted || item.totalTnd).toFixed(currMeta.decimals)} <span className="text-[10px] text-slate-400">{currMeta.symbol}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900 gap-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded-lg border border-amber-500/20">
                          {item.qty} {item.unit}
                        </span>
                        <span>P.U : <strong className="text-slate-200 font-mono">{(item.unitPriceConverted || item.unitPriceTnd).toFixed(currMeta.decimals)} {currMeta.symbol}</strong></span>
                      </div>

                      {item.packageInfo && viewMode === 'detail' && (
                        <div className="text-slate-400 italic text-[10px]">
                          📦 {item.packageInfo}
                        </div>
                      )}
                    </div>

                    {item.formulaUsed && viewMode === 'detail' && (
                      <div className="text-[9px] text-slate-400 font-mono bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-800/80">
                        Formule: {item.formulaUsed}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Execution Steps (DTU Norms) Accordion */}
            {calculationResult.executionSteps && calculationResult.executionSteps.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setShowSteps(!showSteps)}
                  className="w-full p-3 flex items-center justify-between text-left font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'derja' ? 'مراحل التنفيذ الفني (DTU):' : 'Méthodologie d’Exécution & DTU :'}</span>
                  </span>
                  {showSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showSteps && (
                  <div className="p-3 pt-0 space-y-1.5 border-t border-slate-800/60">
                    {calculationResult.executionSteps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-300 leading-relaxed">
                        <span className="font-mono text-amber-400 font-bold">{idx + 1}.</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Financial & Fiscal Breakdown */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Total Fournitures H.T :</span>
                <span className="font-bold text-white font-mono">
                  {(calculationResult.totalMaterialConverted || calculationResult.totalMaterialTnd).toFixed(currMeta.decimals)} {currMeta.symbol}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Main d’œuvre Chantier H.T :</span>
                <span className="font-bold text-amber-400 font-mono">
                  {(calculationResult.estimatedLaborConverted || calculationResult.estimatedLaborTnd).toFixed(currMeta.decimals)} {currMeta.symbol}
                </span>
              </div>
              <div className="flex justify-between text-slate-200 font-black pt-1 border-t border-slate-900">
                <span>Total Général H.T :</span>
                <span className="font-mono text-slate-100">
                  {(calculationResult.grandTotalConverted || calculationResult.grandTotalTnd).toFixed(currMeta.decimals)} {currMeta.symbol}
                </span>
              </div>

              {/* TVA Line */}
              {calculationResult.tvaPercent > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>TVA ({calculationResult.tvaPercent}%) :</span>
                  <span className="font-mono text-slate-300">
                    +{(calculationResult.tvaAmountConverted || calculationResult.tvaAmountTnd || 0).toFixed(currMeta.decimals)} {currMeta.symbol}
                  </span>
                </div>
              )}

              {/* Timbre Fiscal Line */}
              {includeTimbre && currentCountry.timbreFiscalDefault > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Timbre Fiscal ({currentCountry.timbreLabel}) :</span>
                  <span className="font-mono text-slate-300">
                    +{(calculationResult.timbreFiscalConverted || calculationResult.timbreFiscalTnd || 0).toFixed(currMeta.decimals)} {currMeta.symbol}
                  </span>
                </div>
              )}

              {/* Total TTC Line */}
              <div className="flex justify-between text-sm font-black pt-2 border-t border-slate-800 text-white">
                <span>TOTAL GÉNÉRAL TTC :</span>
                <span className="text-amber-400 font-mono text-base">
                  {(calculationResult.totalTtcConverted || calculationResult.totalTtcTnd || calculationResult.grandTotalTnd).toFixed(currMeta.decimals)} {currMeta.symbol}
                </span>
              </div>

              {/* Retenue de Garantie Line */}
              {calculationResult.retenueGarantiePercent > 0 && (
                <>
                  <div className="flex justify-between text-rose-400 text-[11px]">
                    <span>Retenue de Garantie ({calculationResult.retenueGarantiePercent}%) :</span>
                    <span className="font-mono">
                      -{(calculationResult.retenueGarantieConverted || calculationResult.retenueGarantieTnd || 0).toFixed(currMeta.decimals)} {currMeta.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-black pt-1 border-t border-slate-800 text-emerald-400">
                    <span>NET À PAYER (APRÈS RETENUE) :</span>
                    <span className="font-mono text-sm">
                      {(calculationResult.netAPayerConverted || calculationResult.netAPayerTnd || 0).toFixed(currMeta.decimals)} {currMeta.symbol}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Field Notes & Engineering Rules */}
            {calculationResult.fieldNotes.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl space-y-1 text-xs">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>{lang === 'derja' ? 'ملاحظات الشانطي والقواعد الميدانية:' : 'Remarques Chantier & Règles Techniques :'}</span>
                </div>
                {calculationResult.fieldNotes.map((note, i) => (
                  <div key={i} className="text-slate-300 text-[11px] leading-relaxed">
                    • {note}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons: Add to Devis & Share */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={handleAddAllToDevis}
              className="flex-1 py-3 px-4 rounded-2xl font-black text-xs bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              {addedSuccess ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{addedSuccess ? (lang === 'derja' ? 'تمت الإضافة للـ Devis!' : 'Ajouté au Devis !') : (lang === 'derja' ? 'إضافة إلى التقرير والـ Devis' : 'Ajouter tous les postes au Devis')}</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="py-3 px-4 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="Partager par WhatsApp"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              onClick={handleCopySummary}
              className="py-3 px-4 rounded-2xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="Copier le texte"
            >
              {copiedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
