BEGIN;

-- Production TN/TND official seed (public catalog only — 78 materials).
-- Source of truth, mirrored 1:1 (no invented values):
--   - server/db/seedCatalog.ts     → seeding logic + todayIso() semantics
--   - src/data/marketRates.ts      → DEFAULT_MARKET_RATES (78 materials, TND)
--   - server/repositories/seed.ts  → PRICE_SOURCES['OFFICIAL_DEFAULT']
--
-- Guarantees:
--   - Idempotent: re-running inserts nothing new; rows are updated only when
--     the canonical values actually changed (same lookup keys as seedCatalog.ts).
--   - Public rows only: every statement filters/sets company_id IS NULL.
--     Company-owned rows (company_id IS NOT NULL) are never read or touched.
--   - TN/TND market only (country_code='TN', currency_code='TND').
--     FR, MY, SA and every other market are untouched.
--   - price_sources: only OFFICIAL_DEFAULT — the single source required by
--     this seed — is ensured with ON CONFLICT DO NOTHING. Existing source
--     rows are never updated, and no source is ever deleted.
--   - effective_from = (now() AT TIME ZONE 'UTC')::date, i.e. the exact value
--     of todayIso() in server/db/seedCatalog.ts (UTC run date), regardless of
--     the session timezone (seedCatalog.ts does not use a fixed date).
--   - notes stay NULL on insert: no DEFAULT_MARKET_RATES entry has
--     defaultPriceTnd differing from unitPriceTnd (seedCatalog.ts only writes
--     a note in that case). Price updates never touch notes (same as TS).
--   - Verified before COMMIT (same transaction): exactly 78 public official
--     materials and exactly 78 official TN/TND current prices for the 78
--     canonical codes. Any mismatch raises an exception, which aborts the
--     transaction — PostgreSQL then executes the trailing COMMIT as ROLLBACK,
--     so nothing is persisted.
--   - No schema change, no migration, no DELETE, no TRUNCATE.

-- 1) price_sources — only the source this seed requires. PK `code` makes this
--    naturally idempotent (same pattern as seedCatalog.ts / PRICE_SOURCES).
INSERT INTO public.price_sources (code, name, is_verified, priority_weight)
VALUES ('OFFICIAL_DEFAULT', 'KONSTRIVO Official Barème 2026', TRUE, 100)
ON CONFLICT (code) DO NOTHING;

WITH canonical_materials AS (
  SELECT * FROM (
    VALUES
      ('plaque_ba13_standard', 'placo', 'placo', 'Plaque BA13 Standard (1.2m x 2.5m = 3m²)', 'لوح جبس BA13 عادي', 'بلاكة placo BA13 عادية', 'unit', 'Standard 12.5mm pour cloisons et plafonds intérieurs'),
      ('plaque_ba13_hydrofuge', 'placo', 'placo', 'Plaque BA13 Hydrofuge Vert (1.2m x 2.5m = 3m²)', 'لوح جبس BA13 مقاوم للرطوبة (خضراء)', 'بلاكة placo خضراء hydrofuge للمطابخ والحمامات', 'unit', 'Salles de bain, cuisines et pièces humides'),
      ('plaque_ba13_coupe_feu', 'placo', 'placo', 'Plaque BA13 Coupe-Feu Rose (1.2m x 2.5m = 3m²)', 'لوح جبس BA13 مقاوم للحريق (وردية)', 'بلاكة placo وردية anti-feu', 'unit', 'Résistance élevée au feu et hautes températures'),
      ('plaque_ba13_phonique', 'placo', 'placo', 'Plaque BA13 Phonique Bleu (1.2m x 2.5m = 3m²)', 'لوح جبس BA13 عازل للصوت (زرقاء)', 'بلاكة placo زرقاء phonique عازلة للصوت', 'unit', 'Isolation acoustique renforcée (+50% d’atténuation)'),
      ('plaque_habito_durete', 'placo', 'placo', 'Plaque Haute Dureté / Habito (1.2m x 2.5m = 3m²)', 'لوح جبس عالي الصلابة والصدمات Habito', 'بلاكة Habito صلابة فائقة ومقاومة للصدمات', 'unit', 'Supporte charges lourdes (jusqu''à 20kg par vis sans cheville)'),
      ('plaque_aquapanel_ciment', 'placo', 'placo', 'Plaque Cement Board Aquapanel Outdoor (1.2m x 2.4m = 2.88m²)', 'لوح إسمنتي ألواباك Aquapanel خارجي للواجهات', 'بلاكة سيمون ciment board خارجي للواجهات والرطوبة القصوى', 'unit', 'Portland cement + armature fibre pour façades et zones exposées à l''eau'),
      ('plaque_aquapanel_exterieur', 'placo', 'placo', 'Cement Board / Aquapanel Outdoor (1.2m x 2.4m = 2.88m²)', 'لوح إسمنتي بورتلاند للواجهات الخارجية Aquapanel', 'بلاكة سيمون ciment board خارجي للواجهات والرطوبة القصوى', 'unit', 'Portland cement + armature fibre pour façades et zones exposées à l''eau'),
      ('plaque_aquapanel_interieur', 'placo', 'placo', 'Cement Board Indoor / Tile Backer (1.2m x 2.4m = 2.88m²)', 'لوح إسمنتي داخلي لدعم السيراميك والحمامات', 'بلاكة سيمون داخلية داعمة للتلييس والكارلاج في الحمامات', 'unit', 'Support étanche haute adhérence pour carrelage mural'),
      ('plaque_silicate_calcium', 'placo', 'placo', 'Plaque Silicate de Calcium Protex / FireStop (1.2m x 2.5m)', 'لوح سيليكات الكالسيوم مضاد فائق للحريق Protex', 'بلاكة سيلكات كالسيوم coupe-feu 2h إلى 4h', 'unit', 'Résistance extrême au feu (EI 120 / EI 240) et gaines techniques'),
      ('panneau_pvc_plafond', 'placo', 'placo', 'Panneau PVC Décoratif Plafond (0.25m x 3.0m = 0.75m²)', 'شريحة PVC ديكورية للسقف والأماكن الرطبة', 'لامة PVC سقف مضاد للماء وسهل التنظيف', 'unit', 'Résistance 100% à l''eau sans peinture, finition brillante/mate'),
      ('plaque_glassroc_exterieur', 'placo', 'placo', 'Plaque Glassroc X Extérieur (1.2m x 2.4m)', 'لوح Glassroc للواجهات والأسقف الخارجية', 'بلاكة Glassroc خارجية مقاومة للطقس', 'unit', 'Plaque spéciale extérieure sous enduit'),
      ('dalle_vinyl_60x60', 'placo', 'placo', 'Dalle Vinyle 60x60 cm pour Plafond Démontable', 'بلاطة سقف تفكيكي فينيل 60×60 سم', 'دالة فينيل 60x60 سقف démontable', 'unit', 'Lavable, idéal pour bureaux et locaux médicaux'),
      ('dalle_laine_roche_60x60', 'placo', 'placo', 'Dalle Laine de Roche 60x60 cm Acoustique', 'بلاطة صوف صخري 60×60 سم عازلة', 'دالة laine de roche 60x60 acoustic', 'unit', 'Haute absorption acoustique et thermique'),
      ('rail_48', 'placo', 'placo', 'Rail 48 mm (Longueur 3 mètres)', 'قضيب سفلي Rail 48 (3 أمتار)', 'ريل Rail 48 متراج 3m', 'unit', 'Sert de guide horizontal sol et plafond (largeur 48mm)'),
      ('montant_48', 'placo', 'placo', 'Montant 48 mm (Longueur 3 mètres)', 'عمود رأسي Montant 48 (3 أمتار)', 'مونطون Montant 48 متراج 3m', 'unit', 'Structure verticale espacée de 40cm ou 60cm'),
      ('rail_70', 'placo', 'placo', 'Rail 70 mm Renforcé (Longueur 3 mètres)', 'قضيب سفلي Rail 70 مدعم (3 أمتار)', 'ريل Rail 70 متراج 3m للقواطع العريضة', 'unit', 'Guide horizontal pour cloisons acoustiques et de grande hauteur'),
      ('montant_70', 'placo', 'placo', 'Montant 70 mm Renforcé (Longueur 3 mètres)', 'عمود رأسي Montant 70 مدعم (3 أمتار)', 'مونطون Montant 70 متراج 3m للصلابة العالية', 'unit', 'Montant vertical pour hauteurs jusqu''à 3.60m sans renfort'),
      ('rail_90', 'placo', 'placo', 'Rail 90 mm Heavy Duty (Longueur 3 mètres)', 'قضيب سفلي Rail 90 عريض (3 أمتار)', 'ريل Rail 90 متراج 3m للعزل الفائق والارتفاعات', 'unit', 'Guide horizontal 90mm pour isolation phonique maximale'),
      ('montant_90', 'placo', 'placo', 'Montant 90 mm Heavy Duty (Longueur 3 mètres)', 'عمود رأسي Montant 90 عريض (3 أمتار)', 'مونطون Montant 90 متراج 3m للأماكن المرتفعة', 'unit', 'Montant vertical pour hauteurs supérieures à 4.20m'),
      ('fourrure', 'placo', 'placo', 'Fourrure F47 (Longueur 3 mètres)', 'مجاري سقوف Fourrure (3 أمتار)', 'فورور Fourrure للأسقف المستعارة', 'unit', 'Profilé métallique pour plafond fixe BA13'),
      ('corniere_angle', 'placo', 'placo', 'Cornière L de Rive (Longueur 3 mètres)', 'زاوية حافة L (3 أمتار)', 'كورنيار Cornière L للريف والزوايا', 'unit', 'Finition périphérique plafond et z-angles'),
      ('omega_profil', 'placo', 'placo', 'Profilé Oméga (Longueur 3 mètres)', 'بروفيل أوميغا تقوية (3 أمتار)', 'بروفيل Oméga للتقوية والشد', 'unit', 'Renfort métallique pour sur-charges'),
      ('porteur_3600', 'placo', 'placo', 'Porteur T24 / T15 (3.60 mètres)', 'حامل رئيسي T24 (3.6 متر)', 'بورتور Porteur 3.6m سقف تفكيكي', 'unit', 'Profile principal du système démontable'),
      ('entretoise_1200', 'placo', 'placo', 'Entretoise T24 (1.20 mètres)', 'عريضة وسطية (1.2 متر)', 'انترتواز Entretoise 1.2m', 'unit', 'Profilé secondaire intermédiaire'),
      ('entretoise_600', 'placo', 'placo', 'Entretoise T24 (0.60 mètres)', 'عريضة قصيرة (0.6 متر)', 'انترتواز Entretoise 0.6m', 'unit', 'Ferme la maille 60x60cm'),
      ('corniere_rive_L', 'placo', 'placo', 'Cornière de Rive L 3m (Démontable)', 'زاوية حافة سقف تفكيكي (3 أمتار)', 'كورنيار دو ريف Cornière rive 3m', 'unit', 'Tour de pièce pour plafond démontable'),
      ('vis_placo_25', 'placo', 'placo', 'Vis Placo TTPC 25mm (Boîte de 1000)', 'براغي جبس 25 ملم (علبة 1000)', 'فيس vis placo 25mm باكو 1000', 'boite_1000', 'Fixation des plaques BA13 sur ossature'),
      ('vis_trpf', 'placo', 'placo', 'Vis TRPF Métal-Métal (Boîte de 1000)', 'براغي هيكل معدني TRPF (علبة 1000)', 'فيس TRPF باكو 1000 للتثبيت المعدني', 'boite_1000', 'Assemblage des profilés métal et rallonges'),
      ('vis_aquapanel', 'placo', 'placo', 'Vis Inox Aquapanel (Boîte de 500)', 'براغي إينوكس ألواباك (علبة 500)', 'فيس Aquapanel باكو 500', 'boite', 'Traitement anti-corrosion spécial ciment'),
      ('suspente', 'placo', 'placo', 'Suspente Pivot ou Articulée', 'تعليقة سقف Suspente', 'سوسپانت Suspente للأسقف', 'unit', 'Soutient les fourrures sous la dalle'),
      ('tige_filetee_1m', 'placo', 'placo', 'Tige Filetée M6 (Longueur 1m)', 'ساق مسننة 1 متر', 'تيج فيليطي Tige filetée 1m', 'unit', 'Pour suspensions de plafond haut'),
      ('cavalier_pivot', 'placo', 'placo', 'Cavalier Pivot Fourrure', 'مشبك تثبيت Cavalier', 'كافالييه Cavalier pivot', 'unit', 'Liaison tige filetée et fourrure'),
      ('enduit_joint_25kg', 'placo', 'placo', 'Enduit de Jointage Placo (Sac de 25kg)', 'معجون مفاصل الجبس (كيس 25كغ)', 'أندو اندوي jointage شكارة 25kg', 'sac', '3 passes de finition sur joints'),
      ('colle_gypse_25kg', 'placo', 'placo', 'Colle Gypse pour Doublage Collé (Sac 25kg)', 'غراء جبس للتثبيت المباشر (كيس 25كغ)', 'غراء Colle Gypse شكارة 25kg للدوبلاج', 'sac', 'Consommation ~2.5 kg/m²'),
      ('bande_a_joint_90m', 'placo', 'placo', 'Bande à Joint Papier (Rouleau de 90m)', 'شريط مفاصل ورقي (90 متر)', 'باندا bande à joint رولو 90m', 'rouleau', 'Armature de jointure entre plaques'),
      ('trame_fibre_exterieur', 'placo', 'placo', 'Trame de Renfort Fibre de Verre (Rouleau 50m)', 'شبكة ألياف خارجية (50 متر)', 'ترام trame fibre للواجهات 50m', 'rouleau', 'Tissu d’armature sous enduit ciment'),
      ('colle_ciment_exterieur_25kg', 'placo', 'placo', 'Colle Ciment Spéciale Extérieur / Aquapanel (Sac 25kg)', 'إسمنت لاصق خارجي (كيس 25كغ)', 'سيمون لاصق Colle ciment خارجي 25kg', 'sac', 'Haute adhérence résistant aux intempéries'),
      ('laine_de_verre_50mm', 'isolation', 'isolation', 'Laine de Verre 50mm (Rouleau de 15m²)', 'صوف زجاجي 50ملم (رول 15m²)', 'لان دو فار Laine de verre رولو 15 متر', 'rouleau', 'Isolation thermique et phonique légère'),
      ('laine_de_roche_50mm', 'isolation', 'isolation', 'Laine de Roche Densité Forte 50mm (Panneau 7.2m²)', 'صوف صخري 50ملم عالي الكثافة (7.2m²)', 'لان دو روش Laine de roche باكو 7.2m²', 'boite', 'Excellente isolation phonique et protection feu'),
      ('bande_resiliente_48mm', 'isolation', 'isolation', 'Bande Résiliente Acoustique 48mm (Rouleau 30m)', 'شريط عازل تحت الهيكل المعدني (30 متر)', 'باندا عازلة Bande résiliente sous rail 30m', 'rouleau', 'Évite la transmission des vibrations acoustiques'),
      ('silicone_coupe_feu', 'isolation', 'isolation', 'Cartouche Silicone Coupe-Feu', 'سيليكون مقاوم للحريق', 'سيليكون silicone coupe-feu', 'tube', 'Calfeutrement étanche des joints feu'),
      ('peinture_acrylique_10l', 'peinture', 'peinture', 'Peinture Acrylique Mate Intérieur (Seau 10L)', 'دهان أكرليك مات داخلي (سطال 10L)', 'دهان Acrylique مات سطل 10 ليتر', 'unit', 'Rendement ~10 m²/L par couche'),
      ('peinture_satinee_10l', 'peinture', 'peinture', 'Peinture Satinée / Gloss Lavable (Seau 10L)', 'دهان ساتينيه نصف لامع قابل للغسل (سطال 10L)', 'دهان Satinée lavable سطل 10 ليتر', 'unit', 'Très résistante aux taches et au nettoyage'),
      ('peinture_elastique_10l', 'peinture', 'peinture', 'Peinture Élastique Façade Extérieure (Seau 10L)', 'دهان مطاطي إيلاستيك للواجهات (سطال 10L)', 'دهان elastique façade سطل 10L للواجهة', 'unit', 'Pontage des micro-fissures extérieures'),
      ('impression_primer_10l', 'peinture', 'peinture', 'Impression / Primer Placo Spécial (Seau 10L)', 'طبقة أساسية بريمر للجبس (سطال 10L)', 'طبقة impression / primer سطل 10L', 'unit', 'Régule la porosité du Placo avant peinture'),
      ('carreau_standard_30x30', 'carrelage', 'carrelage', 'Carrelage Sols / Murs 30x30 ou 40x40 (au m²)', 'تبليط أرضيات/حوائط 30×30 سم (بالـ m²)', 'كاريو Carrelage 30x30 أو 40x40 للمتر', 'm²', 'Grès cérame / Céramique standard'),
      ('carreau_grand_60x60', 'carrelage', 'carrelage', 'Grès Cérame 60x60 cm Rectifié (au m²)', 'تبليط خزف كبير 60×60 سم (بالـ m²)', 'كاريو كباري 60x60 Grès Cérame للمتر', 'm²', 'Finition moderne rectifiée joints fins'),
      ('brique_rouge_12trous', 'maconnerie', 'maconnerie', 'Brique Rouge 12 Trous (Unité)', 'آجر أحمر 12 ثقب (قطعة)', 'ياجورة حمراء 12 عين Brique 12 trous', 'unit', 'Brique de cloisonnement standard'),
      ('bloc_beton_20x20x40', 'maconnerie', 'maconnerie', 'Bloc Béton / Parpaing 20x20x40 cm (Unité)', 'بلوك خرساني باربان 20×20×40 (قطعة)', 'ياجورة سيما Parpaing 20x20x40', 'unit', 'Mur porteur et maçonnerie lourde'),
      ('sac_ciment_50kg', 'maconnerie', 'maconnerie', 'Sac de Ciment 50kg (CEM I / CEM II)', 'كيس أسمنت 50 كغ', 'شكارة سيمون Ciment 50kg', 'sac', 'Prix réglementé en Tunisie'),
      ('ppr_tube_20_4m', 'plomberie', 'plomberie', 'Tube PPR PN20 Diamètre 20mm (Barre 4m)', 'أنبوب بولي بروبيلين PPR 20ملم (قضيب 4 أمتار)', 'جعبة PPR 20mm بار 4 متر', 'unit', 'Alimentation eau chaude et froide sanitaire'),
      ('ppr_tube_25_4m', 'plomberie', 'plomberie', 'Tube PPR PN20 Diamètre 25mm (Barre 4m)', 'أنبوب PPR 25ملم للشبكة الرئيسية (4 أمتار)', 'جعبة PPR 25mm كولون رئيسي', 'unit', 'Colonne montante et débit principal'),
      ('pvc_tube_110_4m', 'plomberie', 'plomberie', 'Tube PVC Évacuation 110mm (Barre 4m)', 'أنبوب صرف صحي PVC 110ملم (4 أمتار)', 'جعبة تفريغ PVC 110 للـ WC', 'unit', 'Évacuation des eaux vannes (WC)'),
      ('pvc_tube_40_4m', 'plomberie', 'plomberie', 'Tube PVC Évacuation 40mm (Barre 4m)', 'أنبوب صرف صحي PVC 40ملم (4 أمتار)', 'جعبة تفريغ PVC 40 لافابو ودوش', 'unit', 'Évacuation lavabo, douche et évier'),
      ('raccord_ppr_coude_te', 'plomberie', 'plomberie', 'Raccord PPR Coude / Té / Manchon (Unité)', 'كوع / موصل PPR للتلحيم', 'كود / تي PPR للتلحيم الحراري', 'unit', 'Soudure par thermo-fusion à 260°C'),
      ('colle_pvc_pot', 'plomberie', 'plomberie', 'Colle PVC Pression avec pinceau (Pot 250g)', 'غراء أنابيب PVC (علبة 250 غرام)', 'كول Colle PVC 250g', 'unit', 'Collage étanche des raccords d’évacuation'),
      ('cable_1_5mm_100m', 'electricite', 'electricite', 'Câble Électrique Cuivre 1.5 mm² (Rouleau 100m)', 'سلك نحاسي معزول 1.5 ملم² (لفة 100 متر)', 'خيط ضو 1.5mm² رولو 100 متر للإضاءة', 'rouleau', 'Circuit d’éclairage et commande'),
      ('cable_2_5mm_100m', 'electricite', 'electricite', 'Câble Électrique Cuivre 2.5 mm² (Rouleau 100m)', 'سلك نحاسي معزول 2.5 ملم² (لفة 100 متر)', 'خيط ضو 2.5mm² رولو 100 متر للبريزات', 'rouleau', 'Circuit des prises de courant standard'),
      ('cable_4mm_100m', 'electricite', 'electricite', 'Câble Électrique Cuivre 4.0 / 6.0 mm² (Rouleau 100m)', 'سلك كهربائي قوي 4-6 ملم² (لفة 100 متر)', 'خيط ضو غليظ 4-6mm² للمكيف والسخان', 'rouleau', 'Pour climatiseurs, cuisinières et chauffe-eau'),
      ('gaine_icta_16_50m', 'electricite', 'electricite', 'Gaine Annulée ICTA 16mm (Couronne 50m)', 'أنبوب حماية الأسلاك ICTA 16ملم (50 متر)', 'قين كحلة Gaine ICTA 16mm رولو 50m', 'rouleau', 'Passage encastré des fils d’éclairage'),
      ('gaine_icta_20_50m', 'electricite', 'electricite', 'Gaine Annulée ICTA 20mm (Couronne 50m)', 'أنبوب حماية الأسلاك ICTA 20ملم (50 متر)', 'قين كحلة Gaine ICTA 20mm رولو 50m', 'rouleau', 'Passage des câbles de prises et puissance'),
      ('prise_complete_16a', 'electricite', 'electricite', 'Prise de Courant 16A avec Terre Complète', 'مقبس كهربائي 16 أمبير مع أرضي', 'بريز ضو Prise 16A مع الأرضي', 'unit', 'Mécanisme encastrable complet'),
      ('spot_led_encastrable', 'electricite', 'electricite', 'Spot LED Encastrable 7W / 9W (Complet)', 'سبوت ليد 7 واط مدمج في الجبس', 'سبوت ليد Spot LED للجبس', 'unit', 'Finition plafond placo et caissons'),
      ('bitume_liquide_bidon_20l', 'etancheite', 'etancheite', 'Bitume Liquide d’Imprégnation à Froid (Bidon 20L)', 'قطران بيتوميني سائل للعزل المائي (20 لتر)', 'قطران بيتومين سائل Bidon 20L للأسطح', 'unit', 'Couche primaire pour terrasses et fondations'),
      ('membrane_etancheite_4mm_10m2', 'etancheite', 'etancheite', 'Membrane Bitumineuse SBS 4mm Ardoisée (Rouleau 10m²)', 'غشاء عازل مطاطي بيتومين 4 ملم (10m²)', 'زفت مسبوك عازل Membrane 4mm رولو 10m²', 'rouleau', 'Étanchéité soudée au chalumeau pour toiture terrasse'),
      ('resine_etancheite_liquide_20kg', 'etancheite', 'etancheite', 'Résine Liquide d’Étanchéité Sous Carrelage (Seau 20kg)', 'عازل سائل تحت التبليط للحمامات (20كغ)', 'عازل ماء سائل Résine للحمام سطل 20kg', 'unit', 'Protection imperméable pour douches à l’italienne'),
      ('mousse_pu_750ml', 'menuiserie', 'menuiserie', 'Mousse Polyuréthane Expansive (Aérosol 750ml)', 'رغوة بولي يوريثان عازلة للمنيرية (750 مل)', 'رغوة موس Mousse PU 750ml', 'unit', 'Calfeutrement et fixation des dormants de portes et fenêtres'),
      ('bloc_porte_isoplane_83', 'menuiserie', 'menuiserie', 'Bloc-Porte Intérieur Isoplane Bois 83x204cm', 'باب داخلي إيزوبلان خشب 83×204 سم', 'باب داخل إيزوبلان كامل 83x204', 'unit', 'Avec bâti, chambranle et paumelles'),
      ('mastic_silicone_neutre_310ml', 'menuiserie', 'menuiserie', 'Mastic Silicone Neutre / Acrylique (Cartouche 310ml)', 'سيليكون عازل لمفاصل النوافذ والأبواب 310 مل', 'سيليكون Mastic neutre للشبابيك والبيبان', 'tube', 'Étanchéité périphérique air/eau'),
      ('vis_ancrage_maconnerie_boite', 'menuiserie', 'menuiserie', 'Vis d’Ancrage Cadre Maçonnerie (Boîte de 100)', 'براغي تثبيت إطارات في الخرسانة (علبة 100)', 'براغي فيس كادر باكو 100', 'boite', 'Fixation directe sans cheville des dormants'),
      ('parquet_stratifie_8mm_m2', 'sols', 'sols', 'Parquet Stratifié HDF 8mm AC4 Haute Résistance (au m²)', 'باركيه رقائقي 8 ملم HDF مقاوم (بالـ m²)', 'باركيه خشب Stratifié 8mm للمتر', 'm²', 'Pose flottante clipsable avec sous-couche'),
      ('sous_couche_acoustique_sol_m2', 'sols', 'sols', 'Sous-Couche Mousse Acoustique & Pare-Vapeur (au m²)', 'طبقة عازلة للصوت والرطوبة تحت الباركيه', 'فوطرة sous-couche عازلة للباركيه', 'm²', 'Isolation phonique aux bruits d’impact'),
      ('plinthes_mdf_decor_2_4m', 'sols', 'sols', 'Plinthe MDF Décor Bois 2.40m', 'حواف أرضية MDF ديكور خشب (2.40 متر)', 'بلانت plinthe MDF ديكور خشب 2.4m', 'unit', 'Finition périphérique des sols stratifiés'),
      ('barre_seuil_porte_alu', 'sols', 'sols', 'Barre de Seuil de Porte Alu Anodisé (90cm)', 'فاصل عتبة باب ألومنيوم (90 سم)', 'بار دو سوي Barre de seuil ألمنيوم 90cm', 'unit', 'Transition et dilatation entre pièces'),
      ('enduit_monocouche_facade_25kg', 'facade', 'facade', 'Enduit Monocouche Hydrofuge pour Façade (Sac 25kg)', 'لياسة إسمنتية ملونة مقاومة للرطوبة (25كغ)', 'لياسة واجهة Enduit de façade شكارة 25kg', 'sac', 'Imperméabilisation et décoration des murs extérieurs'),
      ('corniere_facade_entoilee_pvc', 'facade', 'facade', 'Baguette d’Angle Entoilée PVC pour Façade (2.5m)', 'زاوية واجهة PVC مع شبكة 2.5 متر', 'باقات زاوية بافيسي مع الترام 2.5m', 'unit', 'Protection des arêtes extérieures'),
      ('camion_evacuation_gravats_6m3', 'demolition', 'demolition', 'Forfait Camionnette / Camion Évacuation Gravats (6m³)', 'نقل وتفريغ الأنقاض والحطام (شاحنة 6m³)', 'كميون نقل الرديم والأوساخ الشانطي 6m³', 'unit', 'Transport agréé vers décharge publique'),
      ('sacs_gravats_renforces_10pcs', 'demolition', 'demolition', 'Sacs à Gravats Tissés Ultra-Résistants (Lot de 10)', 'أكياس أنقاض مقواة للشوانط (حزمة 10)', 'شخاير رديم صحاح باكو 10', 'boite', 'Manutention propre en étages et appartements')
  ) AS v(code, trade, category, name_fr, name_ar, name_derja, base_unit, technical_specs)
)
-- 2a) materials — insert only the public official rows that do not exist yet
--     (same lookup key as seedCatalog.ts: code + company_id IS NULL).
--     created_at/updated_at/version/is_deleted/deleted_at rely on the same DB
--     defaults the TS insert leaves to PostgreSQL.
INSERT INTO public.materials (
  code,
  trade,
  category,
  name_fr,
  name_ar,
  name_derja,
  base_unit,
  is_official,
  company_id,
  technical_specs
)
SELECT
  v.code,
  v.trade,
  v.category,
  v.name_fr,
  v.name_ar,
  v.name_derja,
  v.base_unit,
  TRUE,
  NULL,
  v.technical_specs
FROM canonical_materials v
WHERE NOT EXISTS (
  SELECT 1
  FROM public.materials m
  WHERE m.code = v.code
    AND m.company_id IS NULL
);

-- 2b) materials — update in place (and resurrect soft-deleted rows) only when
--     a canonical field actually changed; never duplicates (same behavior as
--     seedCatalog.ts: isDeleted=false, deletedAt=null, updatedAt=now on update).
UPDATE public.materials m
SET
  trade = v.trade,
  category = v.category,
  name_fr = v.name_fr,
  name_ar = v.name_ar,
  name_derja = v.name_derja,
  base_unit = v.base_unit,
  is_official = TRUE,
  technical_specs = v.technical_specs,
  is_deleted = FALSE,
  deleted_at = NULL,
  updated_at = NOW()
FROM (
  SELECT * FROM (
    VALUES
      ('plaque_ba13_standard', 'placo', 'placo', 'Plaque BA13 Standard (1.2m x 2.5m = 3m²)', 'لوح جبس BA13 عادي', 'بلاكة placo BA13 عادية', 'unit', 'Standard 12.5mm pour cloisons et plafonds intérieurs'),
      ('plaque_ba13_hydrofuge', 'placo', 'placo', 'Plaque BA13 Hydrofuge Vert (1.2m x 2.5m = 3m²)', 'لوح جبس BA13 مقاوم للرطوبة (خضراء)', 'بلاكة placo خضراء hydrofuge للمطابخ والحمامات', 'unit', 'Salles de bain, cuisines et pièces humides'),
      ('plaque_ba13_coupe_feu', 'placo', 'placo', 'Plaque BA13 Coupe-Feu Rose (1.2m x 2.5m = 3m²)', 'لوح جبس BA13 مقاوم للحريق (وردية)', 'بلاكة placo وردية anti-feu', 'unit', 'Résistance élevée au feu et hautes températures'),
      ('plaque_ba13_phonique', 'placo', 'placo', 'Plaque BA13 Phonique Bleu (1.2m x 2.5m = 3m²)', 'لوح جبس BA13 عازل للصوت (زرقاء)', 'بلاكة placo زرقاء phonique عازلة للصوت', 'unit', 'Isolation acoustique renforcée (+50% d’atténuation)'),
      ('plaque_habito_durete', 'placo', 'placo', 'Plaque Haute Dureté / Habito (1.2m x 2.5m = 3m²)', 'لوح جبس عالي الصلابة والصدمات Habito', 'بلاكة Habito صلابة فائقة ومقاومة للصدمات', 'unit', 'Supporte charges lourdes (jusqu''à 20kg par vis sans cheville)'),
      ('plaque_aquapanel_ciment', 'placo', 'placo', 'Plaque Cement Board Aquapanel Outdoor (1.2m x 2.4m = 2.88m²)', 'لوح إسمنتي ألواباك Aquapanel خارجي للواجهات', 'بلاكة سيمون ciment board خارجي للواجهات والرطوبة القصوى', 'unit', 'Portland cement + armature fibre pour façades et zones exposées à l''eau'),
      ('plaque_aquapanel_exterieur', 'placo', 'placo', 'Cement Board / Aquapanel Outdoor (1.2m x 2.4m = 2.88m²)', 'لوح إسمنتي بورتلاند للواجهات الخارجية Aquapanel', 'بلاكة سيمون ciment board خارجي للواجهات والرطوبة القصوى', 'unit', 'Portland cement + armature fibre pour façades et zones exposées à l''eau'),
      ('plaque_aquapanel_interieur', 'placo', 'placo', 'Cement Board Indoor / Tile Backer (1.2m x 2.4m = 2.88m²)', 'لوح إسمنتي داخلي لدعم السيراميك والحمامات', 'بلاكة سيمون داخلية داعمة للتلييس والكارلاج في الحمامات', 'unit', 'Support étanche haute adhérence pour carrelage mural'),
      ('plaque_silicate_calcium', 'placo', 'placo', 'Plaque Silicate de Calcium Protex / FireStop (1.2m x 2.5m)', 'لوح سيليكات الكالسيوم مضاد فائق للحريق Protex', 'بلاكة سيلكات كالسيوم coupe-feu 2h إلى 4h', 'unit', 'Résistance extrême au feu (EI 120 / EI 240) et gaines techniques'),
      ('panneau_pvc_plafond', 'placo', 'placo', 'Panneau PVC Décoratif Plafond (0.25m x 3.0m = 0.75m²)', 'شريحة PVC ديكورية للسقف والأماكن الرطبة', 'لامة PVC سقف مضاد للماء وسهل التنظيف', 'unit', 'Résistance 100% à l''eau sans peinture, finition brillante/mate'),
      ('plaque_glassroc_exterieur', 'placo', 'placo', 'Plaque Glassroc X Extérieur (1.2m x 2.4m)', 'لوح Glassroc للواجهات والأسقف الخارجية', 'بلاكة Glassroc خارجية مقاومة للطقس', 'unit', 'Plaque spéciale extérieure sous enduit'),
      ('dalle_vinyl_60x60', 'placo', 'placo', 'Dalle Vinyle 60x60 cm pour Plafond Démontable', 'بلاطة سقف تفكيكي فينيل 60×60 سم', 'دالة فينيل 60x60 سقف démontable', 'unit', 'Lavable, idéal pour bureaux et locaux médicaux'),
      ('dalle_laine_roche_60x60', 'placo', 'placo', 'Dalle Laine de Roche 60x60 cm Acoustique', 'بلاطة صوف صخري 60×60 سم عازلة', 'دالة laine de roche 60x60 acoustic', 'unit', 'Haute absorption acoustique et thermique'),
      ('rail_48', 'placo', 'placo', 'Rail 48 mm (Longueur 3 mètres)', 'قضيب سفلي Rail 48 (3 أمتار)', 'ريل Rail 48 متراج 3m', 'unit', 'Sert de guide horizontal sol et plafond (largeur 48mm)'),
      ('montant_48', 'placo', 'placo', 'Montant 48 mm (Longueur 3 mètres)', 'عمود رأسي Montant 48 (3 أمتار)', 'مونطون Montant 48 متراج 3m', 'unit', 'Structure verticale espacée de 40cm ou 60cm'),
      ('rail_70', 'placo', 'placo', 'Rail 70 mm Renforcé (Longueur 3 mètres)', 'قضيب سفلي Rail 70 مدعم (3 أمتار)', 'ريل Rail 70 متراج 3m للقواطع العريضة', 'unit', 'Guide horizontal pour cloisons acoustiques et de grande hauteur'),
      ('montant_70', 'placo', 'placo', 'Montant 70 mm Renforcé (Longueur 3 mètres)', 'عمود رأسي Montant 70 مدعم (3 أمتار)', 'مونطون Montant 70 متراج 3m للصلابة العالية', 'unit', 'Montant vertical pour hauteurs jusqu''à 3.60m sans renfort'),
      ('rail_90', 'placo', 'placo', 'Rail 90 mm Heavy Duty (Longueur 3 mètres)', 'قضيب سفلي Rail 90 عريض (3 أمتار)', 'ريل Rail 90 متراج 3m للعزل الفائق والارتفاعات', 'unit', 'Guide horizontal 90mm pour isolation phonique maximale'),
      ('montant_90', 'placo', 'placo', 'Montant 90 mm Heavy Duty (Longueur 3 mètres)', 'عمود رأسي Montant 90 عريض (3 أمتار)', 'مونطون Montant 90 متراج 3m للأماكن المرتفعة', 'unit', 'Montant vertical pour hauteurs supérieures à 4.20m'),
      ('fourrure', 'placo', 'placo', 'Fourrure F47 (Longueur 3 mètres)', 'مجاري سقوف Fourrure (3 أمتار)', 'فورور Fourrure للأسقف المستعارة', 'unit', 'Profilé métallique pour plafond fixe BA13'),
      ('corniere_angle', 'placo', 'placo', 'Cornière L de Rive (Longueur 3 mètres)', 'زاوية حافة L (3 أمتار)', 'كورنيار Cornière L للريف والزوايا', 'unit', 'Finition périphérique plafond et z-angles'),
      ('omega_profil', 'placo', 'placo', 'Profilé Oméga (Longueur 3 mètres)', 'بروفيل أوميغا تقوية (3 أمتار)', 'بروفيل Oméga للتقوية والشد', 'unit', 'Renfort métallique pour sur-charges'),
      ('porteur_3600', 'placo', 'placo', 'Porteur T24 / T15 (3.60 mètres)', 'حامل رئيسي T24 (3.6 متر)', 'بورتور Porteur 3.6m سقف تفكيكي', 'unit', 'Profile principal du système démontable'),
      ('entretoise_1200', 'placo', 'placo', 'Entretoise T24 (1.20 mètres)', 'عريضة وسطية (1.2 متر)', 'انترتواز Entretoise 1.2m', 'unit', 'Profilé secondaire intermédiaire'),
      ('entretoise_600', 'placo', 'placo', 'Entretoise T24 (0.60 mètres)', 'عريضة قصيرة (0.6 متر)', 'انترتواز Entretoise 0.6m', 'unit', 'Ferme la maille 60x60cm'),
      ('corniere_rive_L', 'placo', 'placo', 'Cornière de Rive L 3m (Démontable)', 'زاوية حافة سقف تفكيكي (3 أمتار)', 'كورنيار دو ريف Cornière rive 3m', 'unit', 'Tour de pièce pour plafond démontable'),
      ('vis_placo_25', 'placo', 'placo', 'Vis Placo TTPC 25mm (Boîte de 1000)', 'براغي جبس 25 ملم (علبة 1000)', 'فيس vis placo 25mm باكو 1000', 'boite_1000', 'Fixation des plaques BA13 sur ossature'),
      ('vis_trpf', 'placo', 'placo', 'Vis TRPF Métal-Métal (Boîte de 1000)', 'براغي هيكل معدني TRPF (علبة 1000)', 'فيس TRPF باكو 1000 للتثبيت المعدني', 'boite_1000', 'Assemblage des profilés métal et rallonges'),
      ('vis_aquapanel', 'placo', 'placo', 'Vis Inox Aquapanel (Boîte de 500)', 'براغي إينوكس ألواباك (علبة 500)', 'فيس Aquapanel باكو 500', 'boite', 'Traitement anti-corrosion spécial ciment'),
      ('suspente', 'placo', 'placo', 'Suspente Pivot ou Articulée', 'تعليقة سقف Suspente', 'سوسپانت Suspente للأسقف', 'unit', 'Soutient les fourrures sous la dalle'),
      ('tige_filetee_1m', 'placo', 'placo', 'Tige Filetée M6 (Longueur 1m)', 'ساق مسننة 1 متر', 'تيج فيليطي Tige filetée 1m', 'unit', 'Pour suspensions de plafond haut'),
      ('cavalier_pivot', 'placo', 'placo', 'Cavalier Pivot Fourrure', 'مشبك تثبيت Cavalier', 'كافالييه Cavalier pivot', 'unit', 'Liaison tige filetée et fourrure'),
      ('enduit_joint_25kg', 'placo', 'placo', 'Enduit de Jointage Placo (Sac de 25kg)', 'معجون مفاصل الجبس (كيس 25كغ)', 'أندو اندوي jointage شكارة 25kg', 'sac', '3 passes de finition sur joints'),
      ('colle_gypse_25kg', 'placo', 'placo', 'Colle Gypse pour Doublage Collé (Sac 25kg)', 'غراء جبس للتثبيت المباشر (كيس 25كغ)', 'غراء Colle Gypse شكارة 25kg للدوبلاج', 'sac', 'Consommation ~2.5 kg/m²'),
      ('bande_a_joint_90m', 'placo', 'placo', 'Bande à Joint Papier (Rouleau de 90m)', 'شريط مفاصل ورقي (90 متر)', 'باندا bande à joint رولو 90m', 'rouleau', 'Armature de jointure entre plaques'),
      ('trame_fibre_exterieur', 'placo', 'placo', 'Trame de Renfort Fibre de Verre (Rouleau 50m)', 'شبكة ألياف خارجية (50 متر)', 'ترام trame fibre للواجهات 50m', 'rouleau', 'Tissu d’armature sous enduit ciment'),
      ('colle_ciment_exterieur_25kg', 'placo', 'placo', 'Colle Ciment Spéciale Extérieur / Aquapanel (Sac 25kg)', 'إسمنت لاصق خارجي (كيس 25كغ)', 'سيمون لاصق Colle ciment خارجي 25kg', 'sac', 'Haute adhérence résistant aux intempéries'),
      ('laine_de_verre_50mm', 'isolation', 'isolation', 'Laine de Verre 50mm (Rouleau de 15m²)', 'صوف زجاجي 50ملم (رول 15m²)', 'لان دو فار Laine de verre رولو 15 متر', 'rouleau', 'Isolation thermique et phonique légère'),
      ('laine_de_roche_50mm', 'isolation', 'isolation', 'Laine de Roche Densité Forte 50mm (Panneau 7.2m²)', 'صوف صخري 50ملم عالي الكثافة (7.2m²)', 'لان دو روش Laine de roche باكو 7.2m²', 'boite', 'Excellente isolation phonique et protection feu'),
      ('bande_resiliente_48mm', 'isolation', 'isolation', 'Bande Résiliente Acoustique 48mm (Rouleau 30m)', 'شريط عازل تحت الهيكل المعدني (30 متر)', 'باندا عازلة Bande résiliente sous rail 30m', 'rouleau', 'Évite la transmission des vibrations acoustiques'),
      ('silicone_coupe_feu', 'isolation', 'isolation', 'Cartouche Silicone Coupe-Feu', 'سيليكون مقاوم للحريق', 'سيليكون silicone coupe-feu', 'tube', 'Calfeutrement étanche des joints feu'),
      ('peinture_acrylique_10l', 'peinture', 'peinture', 'Peinture Acrylique Mate Intérieur (Seau 10L)', 'دهان أكرليك مات داخلي (سطال 10L)', 'دهان Acrylique مات سطل 10 ليتر', 'unit', 'Rendement ~10 m²/L par couche'),
      ('peinture_satinee_10l', 'peinture', 'peinture', 'Peinture Satinée / Gloss Lavable (Seau 10L)', 'دهان ساتينيه نصف لامع قابل للغسل (سطال 10L)', 'دهان Satinée lavable سطل 10 ليتر', 'unit', 'Très résistante aux taches et au nettoyage'),
      ('peinture_elastique_10l', 'peinture', 'peinture', 'Peinture Élastique Façade Extérieure (Seau 10L)', 'دهان مطاطي إيلاستيك للواجهات (سطال 10L)', 'دهان elastique façade سطل 10L للواجهة', 'unit', 'Pontage des micro-fissures extérieures'),
      ('impression_primer_10l', 'peinture', 'peinture', 'Impression / Primer Placo Spécial (Seau 10L)', 'طبقة أساسية بريمر للجبس (سطال 10L)', 'طبقة impression / primer سطل 10L', 'unit', 'Régule la porosité du Placo avant peinture'),
      ('carreau_standard_30x30', 'carrelage', 'carrelage', 'Carrelage Sols / Murs 30x30 ou 40x40 (au m²)', 'تبليط أرضيات/حوائط 30×30 سم (بالـ m²)', 'كاريو Carrelage 30x30 أو 40x40 للمتر', 'm²', 'Grès cérame / Céramique standard'),
      ('carreau_grand_60x60', 'carrelage', 'carrelage', 'Grès Cérame 60x60 cm Rectifié (au m²)', 'تبليط خزف كبير 60×60 سم (بالـ m²)', 'كاريو كباري 60x60 Grès Cérame للمتر', 'm²', 'Finition moderne rectifiée joints fins'),
      ('brique_rouge_12trous', 'maconnerie', 'maconnerie', 'Brique Rouge 12 Trous (Unité)', 'آجر أحمر 12 ثقب (قطعة)', 'ياجورة حمراء 12 عين Brique 12 trous', 'unit', 'Brique de cloisonnement standard'),
      ('bloc_beton_20x20x40', 'maconnerie', 'maconnerie', 'Bloc Béton / Parpaing 20x20x40 cm (Unité)', 'بلوك خرساني باربان 20×20×40 (قطعة)', 'ياجورة سيما Parpaing 20x20x40', 'unit', 'Mur porteur et maçonnerie lourde'),
      ('sac_ciment_50kg', 'maconnerie', 'maconnerie', 'Sac de Ciment 50kg (CEM I / CEM II)', 'كيس أسمنت 50 كغ', 'شكارة سيمون Ciment 50kg', 'sac', 'Prix réglementé en Tunisie'),
      ('ppr_tube_20_4m', 'plomberie', 'plomberie', 'Tube PPR PN20 Diamètre 20mm (Barre 4m)', 'أنبوب بولي بروبيلين PPR 20ملم (قضيب 4 أمتار)', 'جعبة PPR 20mm بار 4 متر', 'unit', 'Alimentation eau chaude et froide sanitaire'),
      ('ppr_tube_25_4m', 'plomberie', 'plomberie', 'Tube PPR PN20 Diamètre 25mm (Barre 4m)', 'أنبوب PPR 25ملم للشبكة الرئيسية (4 أمتار)', 'جعبة PPR 25mm كولون رئيسي', 'unit', 'Colonne montante et débit principal'),
      ('pvc_tube_110_4m', 'plomberie', 'plomberie', 'Tube PVC Évacuation 110mm (Barre 4m)', 'أنبوب صرف صحي PVC 110ملم (4 أمتار)', 'جعبة تفريغ PVC 110 للـ WC', 'unit', 'Évacuation des eaux vannes (WC)'),
      ('pvc_tube_40_4m', 'plomberie', 'plomberie', 'Tube PVC Évacuation 40mm (Barre 4m)', 'أنبوب صرف صحي PVC 40ملم (4 أمتار)', 'جعبة تفريغ PVC 40 لافابو ودوش', 'unit', 'Évacuation lavabo, douche et évier'),
      ('raccord_ppr_coude_te', 'plomberie', 'plomberie', 'Raccord PPR Coude / Té / Manchon (Unité)', 'كوع / موصل PPR للتلحيم', 'كود / تي PPR للتلحيم الحراري', 'unit', 'Soudure par thermo-fusion à 260°C'),
      ('colle_pvc_pot', 'plomberie', 'plomberie', 'Colle PVC Pression avec pinceau (Pot 250g)', 'غراء أنابيب PVC (علبة 250 غرام)', 'كول Colle PVC 250g', 'unit', 'Collage étanche des raccords d’évacuation'),
      ('cable_1_5mm_100m', 'electricite', 'electricite', 'Câble Électrique Cuivre 1.5 mm² (Rouleau 100m)', 'سلك نحاسي معزول 1.5 ملم² (لفة 100 متر)', 'خيط ضو 1.5mm² رولو 100 متر للإضاءة', 'rouleau', 'Circuit d’éclairage et commande'),
      ('cable_2_5mm_100m', 'electricite', 'electricite', 'Câble Électrique Cuivre 2.5 mm² (Rouleau 100m)', 'سلك نحاسي معزول 2.5 ملم² (لفة 100 متر)', 'خيط ضو 2.5mm² رولو 100 متر للبريزات', 'rouleau', 'Circuit des prises de courant standard'),
      ('cable_4mm_100m', 'electricite', 'electricite', 'Câble Électrique Cuivre 4.0 / 6.0 mm² (Rouleau 100m)', 'سلك كهربائي قوي 4-6 ملم² (لفة 100 متر)', 'خيط ضو غليظ 4-6mm² للمكيف والسخان', 'rouleau', 'Pour climatiseurs, cuisinières et chauffe-eau'),
      ('gaine_icta_16_50m', 'electricite', 'electricite', 'Gaine Annulée ICTA 16mm (Couronne 50m)', 'أنبوب حماية الأسلاك ICTA 16ملم (50 متر)', 'قين كحلة Gaine ICTA 16mm رولو 50m', 'rouleau', 'Passage encastré des fils d’éclairage'),
      ('gaine_icta_20_50m', 'electricite', 'electricite', 'Gaine Annulée ICTA 20mm (Couronne 50m)', 'أنبوب حماية الأسلاك ICTA 20ملم (50 متر)', 'قين كحلة Gaine ICTA 20mm رولو 50m', 'rouleau', 'Passage des câbles de prises et puissance'),
      ('prise_complete_16a', 'electricite', 'electricite', 'Prise de Courant 16A avec Terre Complète', 'مقبس كهربائي 16 أمبير مع أرضي', 'بريز ضو Prise 16A مع الأرضي', 'unit', 'Mécanisme encastrable complet'),
      ('spot_led_encastrable', 'electricite', 'electricite', 'Spot LED Encastrable 7W / 9W (Complet)', 'سبوت ليد 7 واط مدمج في الجبس', 'سبوت ليد Spot LED للجبس', 'unit', 'Finition plafond placo et caissons'),
      ('bitume_liquide_bidon_20l', 'etancheite', 'etancheite', 'Bitume Liquide d’Imprégnation à Froid (Bidon 20L)', 'قطران بيتوميني سائل للعزل المائي (20 لتر)', 'قطران بيتومين سائل Bidon 20L للأسطح', 'unit', 'Couche primaire pour terrasses et fondations'),
      ('membrane_etancheite_4mm_10m2', 'etancheite', 'etancheite', 'Membrane Bitumineuse SBS 4mm Ardoisée (Rouleau 10m²)', 'غشاء عازل مطاطي بيتومين 4 ملم (10m²)', 'زفت مسبوك عازل Membrane 4mm رولو 10m²', 'rouleau', 'Étanchéité soudée au chalumeau pour toiture terrasse'),
      ('resine_etancheite_liquide_20kg', 'etancheite', 'etancheite', 'Résine Liquide d’Étanchéité Sous Carrelage (Seau 20kg)', 'عازل سائل تحت التبليط للحمامات (20كغ)', 'عازل ماء سائل Résine للحمام سطل 20kg', 'unit', 'Protection imperméable pour douches à l’italienne'),
      ('mousse_pu_750ml', 'menuiserie', 'menuiserie', 'Mousse Polyuréthane Expansive (Aérosol 750ml)', 'رغوة بولي يوريثان عازلة للمنيرية (750 مل)', 'رغوة موس Mousse PU 750ml', 'unit', 'Calfeutrement et fixation des dormants de portes et fenêtres'),
      ('bloc_porte_isoplane_83', 'menuiserie', 'menuiserie', 'Bloc-Porte Intérieur Isoplane Bois 83x204cm', 'باب داخلي إيزوبلان خشب 83×204 سم', 'باب داخل إيزوبلان كامل 83x204', 'unit', 'Avec bâti, chambranle et paumelles'),
      ('mastic_silicone_neutre_310ml', 'menuiserie', 'menuiserie', 'Mastic Silicone Neutre / Acrylique (Cartouche 310ml)', 'سيليكون عازل لمفاصل النوافذ والأبواب 310 مل', 'سيليكون Mastic neutre للشبابيك والبيبان', 'tube', 'Étanchéité périphérique air/eau'),
      ('vis_ancrage_maconnerie_boite', 'menuiserie', 'menuiserie', 'Vis d’Ancrage Cadre Maçonnerie (Boîte de 100)', 'براغي تثبيت إطارات في الخرسانة (علبة 100)', 'براغي فيس كادر باكو 100', 'boite', 'Fixation directe sans cheville des dormants'),
      ('parquet_stratifie_8mm_m2', 'sols', 'sols', 'Parquet Stratifié HDF 8mm AC4 Haute Résistance (au m²)', 'باركيه رقائقي 8 ملم HDF مقاوم (بالـ m²)', 'باركيه خشب Stratifié 8mm للمتر', 'm²', 'Pose flottante clipsable avec sous-couche'),
      ('sous_couche_acoustique_sol_m2', 'sols', 'sols', 'Sous-Couche Mousse Acoustique & Pare-Vapeur (au m²)', 'طبقة عازلة للصوت والرطوبة تحت الباركيه', 'فوطرة sous-couche عازلة للباركيه', 'm²', 'Isolation phonique aux bruits d’impact'),
      ('plinthes_mdf_decor_2_4m', 'sols', 'sols', 'Plinthe MDF Décor Bois 2.40m', 'حواف أرضية MDF ديكور خشب (2.40 متر)', 'بلانت plinthe MDF ديكور خشب 2.4m', 'unit', 'Finition périphérique des sols stratifiés'),
      ('barre_seuil_porte_alu', 'sols', 'sols', 'Barre de Seuil de Porte Alu Anodisé (90cm)', 'فاصل عتبة باب ألومنيوم (90 سم)', 'بار دو سوي Barre de seuil ألمنيوم 90cm', 'unit', 'Transition et dilatation entre pièces'),
      ('enduit_monocouche_facade_25kg', 'facade', 'facade', 'Enduit Monocouche Hydrofuge pour Façade (Sac 25kg)', 'لياسة إسمنتية ملونة مقاومة للرطوبة (25كغ)', 'لياسة واجهة Enduit de façade شكارة 25kg', 'sac', 'Imperméabilisation et décoration des murs extérieurs'),
      ('corniere_facade_entoilee_pvc', 'facade', 'facade', 'Baguette d’Angle Entoilée PVC pour Façade (2.5m)', 'زاوية واجهة PVC مع شبكة 2.5 متر', 'باقات زاوية بافيسي مع الترام 2.5m', 'unit', 'Protection des arêtes extérieures'),
      ('camion_evacuation_gravats_6m3', 'demolition', 'demolition', 'Forfait Camionnette / Camion Évacuation Gravats (6m³)', 'نقل وتفريغ الأنقاض والحطام (شاحنة 6m³)', 'كميون نقل الرديم والأوساخ الشانطي 6m³', 'unit', 'Transport agréé vers décharge publique'),
      ('sacs_gravats_renforces_10pcs', 'demolition', 'demolition', 'Sacs à Gravats Tissés Ultra-Résistants (Lot de 10)', 'أكياس أنقاض مقواة للشوانط (حزمة 10)', 'شخاير رديم صحاح باكو 10', 'boite', 'Manutention propre en étages et appartements')
  ) AS v(code, trade, category, name_fr, name_ar, name_derja, base_unit, technical_specs)
) v
WHERE m.code = v.code
  AND m.company_id IS NULL
  AND (
    m.trade IS DISTINCT FROM v.trade
    OR m.category IS DISTINCT FROM v.category
    OR m.name_fr IS DISTINCT FROM v.name_fr
    OR m.name_ar IS DISTINCT FROM v.name_ar
    OR m.name_derja IS DISTINCT FROM v.name_derja
    OR m.base_unit IS DISTINCT FROM v.base_unit
    OR m.is_official IS DISTINCT FROM TRUE
    OR m.technical_specs IS DISTINCT FROM v.technical_specs
    OR m.is_deleted IS DISTINCT FROM FALSE
  );

-- 3) material_prices — canonical OFFICIAL_DEFAULT TN/TND prices for the 78
--    codes, resolved against the freshly ensured public materials.
WITH canonical_prices AS (
  SELECT
    m.id AS material_id,
    m.code,
    CASE m.code
      WHEN 'plaque_ba13_standard' THEN 30.000
      WHEN 'plaque_ba13_hydrofuge' THEN 46.000
      WHEN 'plaque_ba13_coupe_feu' THEN 50.000
      WHEN 'plaque_ba13_phonique' THEN 55.000
      WHEN 'plaque_habito_durete' THEN 68.000
      WHEN 'plaque_aquapanel_ciment' THEN 85.000
      WHEN 'plaque_aquapanel_exterieur' THEN 85.000
      WHEN 'plaque_aquapanel_interieur' THEN 72.000
      WHEN 'plaque_silicate_calcium' THEN 95.000
      WHEN 'panneau_pvc_plafond' THEN 12.000
      WHEN 'plaque_glassroc_exterieur' THEN 75.000
      WHEN 'dalle_vinyl_60x60' THEN 5.500
      WHEN 'dalle_laine_roche_60x60' THEN 10.000
      WHEN 'rail_48' THEN 7.500
      WHEN 'montant_48' THEN 8.000
      WHEN 'rail_70' THEN 10.500
      WHEN 'montant_70' THEN 11.500
      WHEN 'rail_90' THEN 14.000
      WHEN 'montant_90' THEN 15.500
      WHEN 'fourrure' THEN 7.000
      WHEN 'corniere_angle' THEN 6.500
      WHEN 'omega_profil' THEN 8.500
      WHEN 'porteur_3600' THEN 14.000
      WHEN 'entretoise_1200' THEN 4.500
      WHEN 'entretoise_600' THEN 2.500
      WHEN 'corniere_rive_L' THEN 8.000
      WHEN 'vis_placo_25' THEN 22.000
      WHEN 'vis_trpf' THEN 26.000
      WHEN 'vis_aquapanel' THEN 35.000
      WHEN 'suspente' THEN 0.800
      WHEN 'tige_filetee_1m' THEN 3.000
      WHEN 'cavalier_pivot' THEN 0.600
      WHEN 'enduit_joint_25kg' THEN 42.000
      WHEN 'colle_gypse_25kg' THEN 35.000
      WHEN 'bande_a_joint_90m' THEN 18.000
      WHEN 'trame_fibre_exterieur' THEN 45.000
      WHEN 'colle_ciment_exterieur_25kg' THEN 65.000
      WHEN 'laine_de_verre_50mm' THEN 75.000
      WHEN 'laine_de_roche_50mm' THEN 90.000
      WHEN 'bande_resiliente_48mm' THEN 25.000
      WHEN 'silicone_coupe_feu' THEN 22.000
      WHEN 'peinture_acrylique_10l' THEN 65.000
      WHEN 'peinture_satinee_10l' THEN 95.000
      WHEN 'peinture_elastique_10l' THEN 140.000
      WHEN 'impression_primer_10l' THEN 55.000
      WHEN 'carreau_standard_30x30' THEN 28.000
      WHEN 'carreau_grand_60x60' THEN 48.000
      WHEN 'brique_rouge_12trous' THEN 0.950
      WHEN 'bloc_beton_20x20x40' THEN 1.600
      WHEN 'sac_ciment_50kg' THEN 19.500
      WHEN 'ppr_tube_20_4m' THEN 9.500
      WHEN 'ppr_tube_25_4m' THEN 14.000
      WHEN 'pvc_tube_110_4m' THEN 24.000
      WHEN 'pvc_tube_40_4m' THEN 9.000
      WHEN 'raccord_ppr_coude_te' THEN 1.800
      WHEN 'colle_pvc_pot' THEN 11.000
      WHEN 'cable_1_5mm_100m' THEN 58.000
      WHEN 'cable_2_5mm_100m' THEN 92.000
      WHEN 'cable_4mm_100m' THEN 148.000
      WHEN 'gaine_icta_16_50m' THEN 32.000
      WHEN 'gaine_icta_20_50m' THEN 42.000
      WHEN 'prise_complete_16a' THEN 7.500
      WHEN 'spot_led_encastrable' THEN 8.500
      WHEN 'bitume_liquide_bidon_20l' THEN 78.000
      WHEN 'membrane_etancheite_4mm_10m2' THEN 95.000
      WHEN 'resine_etancheite_liquide_20kg' THEN 125.000
      WHEN 'mousse_pu_750ml' THEN 18.000
      WHEN 'bloc_porte_isoplane_83' THEN 185.000
      WHEN 'mastic_silicone_neutre_310ml' THEN 12.500
      WHEN 'vis_ancrage_maconnerie_boite' THEN 28.000
      WHEN 'parquet_stratifie_8mm_m2' THEN 34.000
      WHEN 'sous_couche_acoustique_sol_m2' THEN 3.500
      WHEN 'plinthes_mdf_decor_2_4m' THEN 11.000
      WHEN 'barre_seuil_porte_alu' THEN 15.000
      WHEN 'enduit_monocouche_facade_25kg' THEN 26.000
      WHEN 'corniere_facade_entoilee_pvc' THEN 5.500
      WHEN 'camion_evacuation_gravats_6m3' THEN 160.000
      WHEN 'sacs_gravats_renforces_10pcs' THEN 15.000
    END::numeric AS unit_price
  FROM public.materials m
  WHERE m.company_id IS NULL
    AND m.code IN (
      'plaque_ba13_standard','plaque_ba13_hydrofuge','plaque_ba13_coupe_feu','plaque_ba13_phonique','plaque_habito_durete',
      'plaque_aquapanel_ciment','plaque_aquapanel_exterieur','plaque_aquapanel_interieur','plaque_silicate_calcium','panneau_pvc_plafond',
      'plaque_glassroc_exterieur','dalle_vinyl_60x60','dalle_laine_roche_60x60','rail_48','montant_48','rail_70','montant_70',
      'rail_90','montant_90','fourrure','corniere_angle','omega_profil','porteur_3600','entretoise_1200','entretoise_600',
      'corniere_rive_L','vis_placo_25','vis_trpf','vis_aquapanel','suspente','tige_filetee_1m','cavalier_pivot',
      'enduit_joint_25kg','colle_gypse_25kg','bande_a_joint_90m','trame_fibre_exterieur','colle_ciment_exterieur_25kg',
      'laine_de_verre_50mm','laine_de_roche_50mm','bande_resiliente_48mm','silicone_coupe_feu','peinture_acrylique_10l',
      'peinture_satinee_10l','peinture_elastique_10l','impression_primer_10l','carreau_standard_30x30','carreau_grand_60x60',
      'brique_rouge_12trous','bloc_beton_20x20x40','sac_ciment_50kg','ppr_tube_20_4m','ppr_tube_25_4m','pvc_tube_110_4m',
      'pvc_tube_40_4m','raccord_ppr_coude_te','colle_pvc_pot','cable_1_5mm_100m','cable_2_5mm_100m','cable_4mm_100m',
      'gaine_icta_16_50m','gaine_icta_20_50m','prise_complete_16a','spot_led_encastrable','bitume_liquide_bidon_20l',
      'membrane_etancheite_4mm_10m2','resine_etancheite_liquide_20kg','mousse_pu_750ml','bloc_porte_isoplane_83',
      'mastic_silicone_neutre_310ml','vis_ancrage_maconnerie_boite','parquet_stratifie_8mm_m2','sous_couche_acoustique_sol_m2',
      'plinthes_mdf_decor_2_4m','barre_seuil_porte_alu','enduit_monocouche_facade_25kg','corniere_facade_entoilee_pvc',
      'camion_evacuation_gravats_6m3','sacs_gravats_renforces_10pcs'
    )
)
-- 3a) material_prices — one OFFICIAL_DEFAULT current price per material
--     (TN/TND, company_id IS NULL): same insert as seedCatalog.ts.
--     notes = NULL (no rate has defaultPriceTnd != unitPriceTnd);
--     effective_to/created_at/updated_at/version/is_deleted rely on the DB
--     defaults the TS insert leaves to PostgreSQL.
INSERT INTO public.material_prices (
  material_id,
  source_code,
  country_code,
  currency_code,
  unit_price,
  company_id,
  supplier_id,
  is_current,
  effective_from,
  notes
)
SELECT
  cp.material_id,
  'OFFICIAL_DEFAULT',
  'TN',
  'TND',
  cp.unit_price,
  NULL,
  NULL,
  TRUE,
  (now() AT TIME ZONE 'UTC')::date,  -- == todayIso() in seedCatalog.ts
  NULL
FROM canonical_prices cp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.material_prices mp
  WHERE mp.material_id = cp.material_id
    AND mp.source_code = 'OFFICIAL_DEFAULT'
    AND mp.country_code = 'TN'
    AND mp.currency_code = 'TND'
    AND mp.company_id IS NULL
    AND mp.is_current = TRUE
    AND mp.is_deleted = FALSE
);

-- 3b) material_prices — update the official current price in place only when
--     the barème actually changed (same fields as seedCatalog.ts: unit_price,
--     effective_from, updated_at — notes are never touched here; CUSTOM /
--     supplier / company prices are not read, touched or replaced).
UPDATE public.material_prices mp
SET
  unit_price = cp.unit_price,
  effective_from = (now() AT TIME ZONE 'UTC')::date,  -- == todayIso() in seedCatalog.ts
  updated_at = NOW()
FROM (
  SELECT
    m.id AS material_id,
    CASE m.code
      WHEN 'plaque_ba13_standard' THEN 30.000
      WHEN 'plaque_ba13_hydrofuge' THEN 46.000
      WHEN 'plaque_ba13_coupe_feu' THEN 50.000
      WHEN 'plaque_ba13_phonique' THEN 55.000
      WHEN 'plaque_habito_durete' THEN 68.000
      WHEN 'plaque_aquapanel_ciment' THEN 85.000
      WHEN 'plaque_aquapanel_exterieur' THEN 85.000
      WHEN 'plaque_aquapanel_interieur' THEN 72.000
      WHEN 'plaque_silicate_calcium' THEN 95.000
      WHEN 'panneau_pvc_plafond' THEN 12.000
      WHEN 'plaque_glassroc_exterieur' THEN 75.000
      WHEN 'dalle_vinyl_60x60' THEN 5.500
      WHEN 'dalle_laine_roche_60x60' THEN 10.000
      WHEN 'rail_48' THEN 7.500
      WHEN 'montant_48' THEN 8.000
      WHEN 'rail_70' THEN 10.500
      WHEN 'montant_70' THEN 11.500
      WHEN 'rail_90' THEN 14.000
      WHEN 'montant_90' THEN 15.500
      WHEN 'fourrure' THEN 7.000
      WHEN 'corniere_angle' THEN 6.500
      WHEN 'omega_profil' THEN 8.500
      WHEN 'porteur_3600' THEN 14.000
      WHEN 'entretoise_1200' THEN 4.500
      WHEN 'entretoise_600' THEN 2.500
      WHEN 'corniere_rive_L' THEN 8.000
      WHEN 'vis_placo_25' THEN 22.000
      WHEN 'vis_trpf' THEN 26.000
      WHEN 'vis_aquapanel' THEN 35.000
      WHEN 'suspente' THEN 0.800
      WHEN 'tige_filetee_1m' THEN 3.000
      WHEN 'cavalier_pivot' THEN 0.600
      WHEN 'enduit_joint_25kg' THEN 42.000
      WHEN 'colle_gypse_25kg' THEN 35.000
      WHEN 'bande_a_joint_90m' THEN 18.000
      WHEN 'trame_fibre_exterieur' THEN 45.000
      WHEN 'colle_ciment_exterieur_25kg' THEN 65.000
      WHEN 'laine_de_verre_50mm' THEN 75.000
      WHEN 'laine_de_roche_50mm' THEN 90.000
      WHEN 'bande_resiliente_48mm' THEN 25.000
      WHEN 'silicone_coupe_feu' THEN 22.000
      WHEN 'peinture_acrylique_10l' THEN 65.000
      WHEN 'peinture_satinee_10l' THEN 95.000
      WHEN 'peinture_elastique_10l' THEN 140.000
      WHEN 'impression_primer_10l' THEN 55.000
      WHEN 'carreau_standard_30x30' THEN 28.000
      WHEN 'carreau_grand_60x60' THEN 48.000
      WHEN 'brique_rouge_12trous' THEN 0.950
      WHEN 'bloc_beton_20x20x40' THEN 1.600
      WHEN 'sac_ciment_50kg' THEN 19.500
      WHEN 'ppr_tube_20_4m' THEN 9.500
      WHEN 'ppr_tube_25_4m' THEN 14.000
      WHEN 'pvc_tube_110_4m' THEN 24.000
      WHEN 'pvc_tube_40_4m' THEN 9.000
      WHEN 'raccord_ppr_coude_te' THEN 1.800
      WHEN 'colle_pvc_pot' THEN 11.000
      WHEN 'cable_1_5mm_100m' THEN 58.000
      WHEN 'cable_2_5mm_100m' THEN 92.000
      WHEN 'cable_4mm_100m' THEN 148.000
      WHEN 'gaine_icta_16_50m' THEN 32.000
      WHEN 'gaine_icta_20_50m' THEN 42.000
      WHEN 'prise_complete_16a' THEN 7.500
      WHEN 'spot_led_encastrable' THEN 8.500
      WHEN 'bitume_liquide_bidon_20l' THEN 78.000
      WHEN 'membrane_etancheite_4mm_10m2' THEN 95.000
      WHEN 'resine_etancheite_liquide_20kg' THEN 125.000
      WHEN 'mousse_pu_750ml' THEN 18.000
      WHEN 'bloc_porte_isoplane_83' THEN 185.000
      WHEN 'mastic_silicone_neutre_310ml' THEN 12.500
      WHEN 'vis_ancrage_maconnerie_boite' THEN 28.000
      WHEN 'parquet_stratifie_8mm_m2' THEN 34.000
      WHEN 'sous_couche_acoustique_sol_m2' THEN 3.500
      WHEN 'plinthes_mdf_decor_2_4m' THEN 11.000
      WHEN 'barre_seuil_porte_alu' THEN 15.000
      WHEN 'enduit_monocouche_facade_25kg' THEN 26.000
      WHEN 'corniere_facade_entoilee_pvc' THEN 5.500
      WHEN 'camion_evacuation_gravats_6m3' THEN 160.000
      WHEN 'sacs_gravats_renforces_10pcs' THEN 15.000
    END::numeric AS unit_price
  FROM public.materials m
  WHERE m.company_id IS NULL
    AND m.code IN (
      'plaque_ba13_standard','plaque_ba13_hydrofuge','plaque_ba13_coupe_feu','plaque_ba13_phonique','plaque_habito_durete',
      'plaque_aquapanel_ciment','plaque_aquapanel_exterieur','plaque_aquapanel_interieur','plaque_silicate_calcium','panneau_pvc_plafond',
      'plaque_glassroc_exterieur','dalle_vinyl_60x60','dalle_laine_roche_60x60','rail_48','montant_48','rail_70','montant_70',
      'rail_90','montant_90','fourrure','corniere_angle','omega_profil','porteur_3600','entretoise_1200','entretoise_600',
      'corniere_rive_L','vis_placo_25','vis_trpf','vis_aquapanel','suspente','tige_filetee_1m','cavalier_pivot',
      'enduit_joint_25kg','colle_gypse_25kg','bande_a_joint_90m','trame_fibre_exterieur','colle_ciment_exterieur_25kg',
      'laine_de_verre_50mm','laine_de_roche_50mm','bande_resiliente_48mm','silicone_coupe_feu','peinture_acrylique_10l',
      'peinture_satinee_10l','peinture_elastique_10l','impression_primer_10l','carreau_standard_30x30','carreau_grand_60x60',
      'brique_rouge_12trous','bloc_beton_20x20x40','sac_ciment_50kg','ppr_tube_20_4m','ppr_tube_25_4m','pvc_tube_110_4m',
      'pvc_tube_40_4m','raccord_ppr_coude_te','colle_pvc_pot','cable_1_5mm_100m','cable_2_5mm_100m','cable_4mm_100m',
      'gaine_icta_16_50m','gaine_icta_20_50m','prise_complete_16a','spot_led_encastrable','bitume_liquide_bidon_20l',
      'membrane_etancheite_4mm_10m2','resine_etancheite_liquide_20kg','mousse_pu_750ml','bloc_porte_isoplane_83',
      'mastic_silicone_neutre_310ml','vis_ancrage_maconnerie_boite','parquet_stratifie_8mm_m2','sous_couche_acoustique_sol_m2',
      'plinthes_mdf_decor_2_4m','barre_seuil_porte_alu','enduit_monocouche_facade_25kg','corniere_facade_entoilee_pvc',
      'camion_evacuation_gravats_6m3','sacs_gravats_renforces_10pcs'
    )
) cp
WHERE mp.material_id = cp.material_id
  AND mp.source_code = 'OFFICIAL_DEFAULT'
  AND mp.country_code = 'TN'
  AND mp.currency_code = 'TND'
  AND mp.company_id IS NULL
  AND mp.is_current = TRUE
  AND mp.is_deleted = FALSE
  AND mp.unit_price::numeric IS DISTINCT FROM cp.unit_price::numeric;

-- 4) Verification — inside this same transaction, before COMMIT.
--    Exactly 78 public official materials and exactly 78 official TN/TND
--    current prices must exist for the 78 canonical codes. On any mismatch
--    the DO block raises an exception, which aborts the transaction, so the
--    trailing COMMIT below is executed by PostgreSQL as ROLLBACK and nothing
--    is persisted (run psql with ON_ERROR_STOP=1 to also stop the script).
DO $verify_seed_tn$
DECLARE
  v_material_count integer;
  v_price_count    integer;
BEGIN
  SELECT
    count(DISTINCT m.id) FILTER (
      WHERE m.id IS NOT NULL
        AND m.is_official = TRUE
        AND m.is_deleted = FALSE
    ),
    count(mp.id) FILTER (
      WHERE mp.id IS NOT NULL
        AND mp.source_code = 'OFFICIAL_DEFAULT'
        AND mp.country_code = 'TN'
        AND mp.currency_code = 'TND'
        AND mp.company_id IS NULL
        AND mp.is_current = TRUE
        AND mp.is_deleted = FALSE
    )
  INTO
    v_material_count,
    v_price_count
  FROM (
    VALUES
      ('plaque_ba13_standard'),('plaque_ba13_hydrofuge'),('plaque_ba13_coupe_feu'),('plaque_ba13_phonique'),
      ('plaque_habito_durete'),('plaque_aquapanel_ciment'),('plaque_aquapanel_exterieur'),('plaque_aquapanel_interieur'),
      ('plaque_silicate_calcium'),('panneau_pvc_plafond'),('plaque_glassroc_exterieur'),('dalle_vinyl_60x60'),
      ('dalle_laine_roche_60x60'),('rail_48'),('montant_48'),('rail_70'),('montant_70'),('rail_90'),('montant_90'),
      ('fourrure'),('corniere_angle'),('omega_profil'),('porteur_3600'),('entretoise_1200'),('entretoise_600'),
      ('corniere_rive_L'),('vis_placo_25'),('vis_trpf'),('vis_aquapanel'),('suspente'),('tige_filetee_1m'),
      ('cavalier_pivot'),('enduit_joint_25kg'),('colle_gypse_25kg'),('bande_a_joint_90m'),('trame_fibre_exterieur'),
      ('colle_ciment_exterieur_25kg'),('laine_de_verre_50mm'),('laine_de_roche_50mm'),('bande_resiliente_48mm'),
      ('silicone_coupe_feu'),('peinture_acrylique_10l'),('peinture_satinee_10l'),('peinture_elastique_10l'),
      ('impression_primer_10l'),('carreau_standard_30x30'),('carreau_grand_60x60'),('brique_rouge_12trous'),
      ('bloc_beton_20x20x40'),('sac_ciment_50kg'),('ppr_tube_20_4m'),('ppr_tube_25_4m'),('pvc_tube_110_4m'),
      ('pvc_tube_40_4m'),('raccord_ppr_coude_te'),('colle_pvc_pot'),('cable_1_5mm_100m'),('cable_2_5mm_100m'),
      ('cable_4mm_100m'),('gaine_icta_16_50m'),('gaine_icta_20_50m'),('prise_complete_16a'),('spot_led_encastrable'),
      ('bitume_liquide_bidon_20l'),('membrane_etancheite_4mm_10m2'),('resine_etancheite_liquide_20kg'),
      ('mousse_pu_750ml'),('bloc_porte_isoplane_83'),('mastic_silicone_neutre_310ml'),('vis_ancrage_maconnerie_boite'),
      ('parquet_stratifie_8mm_m2'),('sous_couche_acoustique_sol_m2'),('plinthes_mdf_decor_2_4m'),
      ('barre_seuil_porte_alu'),('enduit_monocouche_facade_25kg'),('corniere_facade_entoilee_pvc'),
      ('camion_evacuation_gravats_6m3'),('sacs_gravats_renforces_10pcs')
  ) AS v(code)
  LEFT JOIN public.materials m
    ON m.code = v.code
   AND m.company_id IS NULL
  LEFT JOIN public.material_prices mp
    ON mp.material_id = m.id;

  IF v_material_count <> 78 OR v_price_count <> 78 THEN
    RAISE EXCEPTION
      'SEED-TN verification failed: public official materials=%/78, official TN/TND current prices=%/78 -> rolling back',
      v_material_count, v_price_count;
  END IF;

  RAISE NOTICE 'SEED-TN verification OK: materials 78/78, official TN/TND current prices 78/78.';
END
$verify_seed_tn$;

COMMIT;
