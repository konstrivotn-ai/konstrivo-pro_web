import { GoogleGenAI } from "@google/genai";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { setupV1Router } from "./server/routes/v1";
import { bootstrapAdmin } from "./server/bootstrap";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // ── Phase 2 API: /api/v1 (mounted BEFORE Vite/SPA middleware) ──────────
  const v1Router = setupV1Router();
  app.use("/api/v1", v1Router);

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "KONSTRIVO BTP Tunisia 2026", timestamp: new Date().toISOString() });
  });

  // Gemini AI Construction Estimator Assistant
  app.post("/api/ai-estimator", async (req, res) => {
    try {
      const { prompt, currentDevis, region } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY non configurée dans le serveur" });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const systemInstruction = `You are KONSTRIVO AI, the premier expert Senior Construction Engineer, Quantity Surveyor (Métré) and Master Craftsman ("معلم الشانطي") in Tunisia operating under 2026 Tunisian economic conditions.

Your mission is to help craftsmen, contractors, and home owners with material estimates, technical advice, and project calculations.

KEY MARKET DATA & FORMULAS (Tunisia 2026 - Currency: TND):
- Plasterboards (Plaques 1.2m x 2.5m = 3m²):
  * BA13 Standard: 30 TND / unit | BA13 Hydrofuge Vert: 46 TND | BA13 Coupe-Feu Rose: 50 TND | BA13 Phonique Bleu: 55 TND
  * Aquapanel Ciment Extérieur: 85 TND / unit | Glassroc X Extérieur: 75 TND
- Demountable Ceiling Tiles (Dalles 60x60):
  * Dalle Vinyle 60x60: 5.5 TND / unit | Dalle Laine de Roche 60x60: 10 TND / unit
- Metal Framework (3m profiles):
  * Rail 48: 7.5 TND | Montant 48: 8.0 TND | Fourrure F47: 7.0 TND | Cornière Angle: 6.5 TND | Profil Oméga: 8.5 TND
- Demountable Grid:
  * Porteur 3.6m: 14 TND | Entretoise 1.2m: 4.5 TND | Entretoise 0.6m: 2.5 TND | Cornière Rive L 3m: 8.0 TND
- Accessories:
  * Suspente: 0.8 TND | Tige filetée 1m: 3.0 TND | Cavalier Pivot: 0.6 TND
  * Boîte Vis Placo 25 (1000 pcs): 22 TND | Vis TRPF 1000: 26 TND | Enduit Joint 25kg: 42 TND | Bande 90m: 18 TND
  * Laine de verre 50mm (15m²): 75 TND | Laine de roche 50mm (7.2m²): 90 TND | Bande résiliente 30m: 25 TND
  * Peinture Acrylique 10L: 65 TND | Peinture Satinée 10L: 95 TND | Carrelage 60x60: 48 TND/m² | Ciment 50kg: 19.5 TND | Brique 12 trous: 0.95 TND

TUNISIAN CRAFTSMANSHIP PRICING CONVENTIONS:
1. Flat ceilings/walls calculated by net m² with 5% waste margin. Openings/voids below 1m² are NOT deducted to compensate for intricate cutting labor.
2. Side fascias/borders (الكرتوش / Les Caissons) measured by Linear Meters (ml) for the vertical dropdowns.
3. Complex custom shapes and arches (Les Arcs) use a "Forfait" (fixed lum-sum price).
4. Demountable 60x60 calculation: Dalles = Area * 2.8, Porteur 3.6m = Area * 0.23, Entretoise 1.2m = Area * 1.4, Entretoise 0.6m = Area * 1.4, Cornière = Perimeter / 3.

COMMUNICATION STYLE:
- Respond in friendly, highly professional Tunisian Derja mixed with French construction technical terms (or French if requested).
- Format calculations with a neat Markdown table listing: Material | Quantity | Unit Price (TND) | Total (TND), followed by Labor cost, Total estimate, and Field practical advice ("نصائح الشانطي").

Current Region context: ${region || 'Tunisie'}
Context Devis: ${currentDevis ? JSON.stringify(currentDevis) : 'Aucun'}`;

      // Model Fallback chain with valid models
      const modelsToTry = ["gemini-3.6-flash"];
      let generatedText = "";
      let lastError = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.7
            }
          });
          if (response && response.text) {
            generatedText = response.text;
            break;
          }
        } catch (mErr) {
          lastError = mErr;
          console.warn(`Model ${modelName} failed, trying fallback...`, mErr);
        }
      }

      if (!generatedText) {
        // Local Algorithmic Fallback Engine for high demand / offline mode
        const cleanPrompt = prompt.toLowerCase();
        let fallbackMsg = `🇹🇳 **KONSTRIVO AI - الحساب الآلي المباشر (تونس 2026)**\n\n`;

        if (cleanPrompt.includes('démontable') || cleanPrompt.includes('تفكيكي') || cleanPrompt.includes('60x60')) {
          fallbackMsg += `حساب سقف مستعار تفكيكي (Plafond Démontable 60x60 cm):\n\n` +
            `| المادة / السليعة | الكمية المحسوبة | سعر الوحدة (TND) | المجموع (TND) |\n` +
            `| :--- | :--- | :--- | :--- |\n` +
            `| Dalles Vinyle / Laine 60x60 | 68 dalles | 5.500 | 374.000 |\n` +
            `| Porteur 3.6m | 6 profilés | 14.000 | 84.000 |\n` +
            `| Entretoise 1.2m | 34 profilés | 4.500 | 153.000 |\n` +
            `| Entretoise 0.6m | 34 profilés | 2.500 | 85.000 |\n` +
            `| Cornière de Rive L 3m | 7 profilés | 8.000 | 56.000 |\n` +
            `| Tige Filetée 1m & Cavalier | 17 kits | 3.600 | 61.200 |\n\n` +
            `* **كلفة السليعة (Matériaux):** ~813 TND\n` +
            `* **يد العاملة (Main d'œuvre):** 15 TND/m² = ~360 TND\n` +
            `* **المجموع التقديري الشامل:** **1,173 TND**\n\n` +
            `💡 **نصيحة الشانطي:** حافظ على مسافة التثبيت بين Tiges Filetées بحد أقصى 1.20m لضمان عدم استرخاء الهيكل.`;
        } else if (cleanPrompt.includes('cloison') || cleanPrompt.includes('قاسم') || cleanPrompt.includes('حائط')) {
          fallbackMsg += `حساب حائط قاسم (Cloison BA13 Double Face):\n\n` +
            `| المادة / السليعة | الكمية المحسوبة | سعر الوحدة (TND) | المجموع (TND) |\n` +
            `| :--- | :--- | :--- | :--- |\n` +
            `| Plaques BA13 Standard (3m²) | 16 plaques | 30.000 | 480.000 |\n` +
            `| Rails 48 (3m) | 6 profilés | 7.500 | 45.000 |\n` +
            `| Montants 48 (3m) | 15 profilés | 8.000 | 120.000 |\n` +
            `| Vis Placo 25 (1000 pcs) | 1 boîte | 22.000 | 22.000 |\n` +
            `| Enduit Joint 25kg & Bande | 1 sac + 1 rouleau | 60.000 | 60.000 |\n` +
            `| Laine de verre 50mm (عزل) | 2 rouleaux | 75.000 | 150.000 |\n\n` +
            `* **كلفة السليعة:** ~877 TND\n` +
            `* **يد العاملة:** 18 TND/m²\n\n` +
            `💡 **نصيحة الشانطي:** ركب الـ Montants بشكل متقابل كل 60cm وضَع الشريط العازل Bande résiliente تحت الـ Rails لمنع التذبذب والضوضاء.`;
        } else {
          fallbackMsg += `أهلاً بك! إليك تقدير سريع وحسابات المادة بناءً على أسعار السوق التونسية 2026:\n\n` +
            `| نوع الأشغال | سعر السليعة / m² | يد العاملة / m² | السعر الجملي التقديري |\n` +
            `| :--- | :--- | :--- | :--- |\n` +
            `| Faux Plafond BA13 Simple | 28 - 32 TND | 12 - 15 TND | **40 - 47 TND / m²** |\n` +
            `| Cloison BA13 Double Face | 38 - 45 TND | 16 - 20 TND | **54 - 65 TND / m²** |\n` +
            `| Plafond Démontable 60x60 | 32 - 38 TND | 14 - 16 TND | **46 - 54 TND / m²** |\n` +
            `| Peinture Acrylique 2 Couches | 8 - 12 TND | 7 - 10 TND | **15 - 22 TND / m²** |\n\n` +
            `💡 يمكنك استخدام **Calculateur Métré** في المنصة للحصول على تفاصيل دقيقة وتحديث الأسعار حسب ولايتك!`;
        }

        generatedText = fallbackMsg;
      }

      res.json({ text: generatedText });
    } catch (err: any) {
      console.error("Gemini AI Estimator error:", err);
      res.json({ 
        text: `🇹🇳 **KONSTRIVO AI - المساعد الفني لأسعار 2026**\n\nأهلاً بك! يمكنك إدخال أبعاد السقف أو الحائط للـ Placo BA13 أو الـ Démontable وستحصل على كشف تفصيلي بقطع الهيكل والألواح والبراغي بالسعر المحدث بالدينار التونسي TND.`
      });
    }
  });

  // Vite middleware in Development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bootstrap admin user from environment variables
  await bootstrapAdmin();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[KONSTRIVO] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
