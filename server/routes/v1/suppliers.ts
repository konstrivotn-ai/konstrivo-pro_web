/**
 * Phase 2 — Supplier Import Routes (/api/v1/suppliers)
 *
 * POST /upload              — upload CSV/XLSX metadata (isolated, no catalog mutation)
 * GET  /imports/:id         — get import status + parsed items
 * POST /imports/:id/approve — approve an import (requires SUPPLIER_IMPORT_APPROVE)
 *
 * State machine: UPLOADED → PARSED → PENDING_APPROVAL → APPROVED → PUBLISHED
 */
import { Router, Response } from 'express';
import express from 'express';
import { supplierImportRepository } from '../../repositories/supplierImportRepository';
import { materialRepository } from '../../repositories/materialRepository';
import {
  authenticate, requireEntitlement, AuthenticatedRequest,
} from '../../middleware/auth';
import { handleUpload, getField, getFile, UploadRequest } from '../../middleware/upload';
import { parseCsv, CsvRow } from '../../utils/csv';
import { sha256Hex, generateId } from '../../utils/crypto';
import { notFound, badRequest, forbidden, conflict, unsupportedMediaType } from '../../utils/errors';
import { SupplierCatalogItem } from '../../types';

const router = Router();

// ── POST /upload ──────────────────────────────────────────────────────────

router.post('/upload',
  authenticate,
  express.raw({ type: ['multipart/form-data', 'text/csv'], limit: '10mb' }),
  handleUpload,
  (req: UploadRequest & AuthenticatedRequest, res: Response, next) => {
    try {
      const file = req.uploadedFiles?.[0];
      const contentType = req.headers['content-type'] || '';

      // Accept raw text/csv body OR multipart file
      let csvContent: string | null = null;
      let fileName = 'upload.csv';
      let mimeType = 'text/csv';
      let fileBuffer: Buffer | null = null;

      if (file) {
        fileBuffer = file.buffer;
        csvContent = file.value;
        fileName = file.filename || 'upload.csv';
        mimeType = file.contentType || mimeType;
      } else if (Buffer.isBuffer(req.body)) {
        fileBuffer = req.body;
        csvContent = req.body.toString('utf8');
      }

      if (!fileBuffer || !csvContent) {
        throw badRequest('No file uploaded. Provide a CSV/XLSX file.');
      }
      if (!fileName.toLowerCase().endsWith('.csv')) {
        throw unsupportedMediaType(`Only .csv files supported in Phase 2. Got: ${fileName}`);
      }
      const lowerType = mimeType.toLowerCase();
      if (!lowerType.includes('csv') && !lowerType.includes('excel') && !lowerType.includes('spreadsheet') && !lowerType.includes('multipart')) {
        throw unsupportedMediaType(`Unsupported media type: ${mimeType}. Use text/csv.`);
      }

      const sha256 = sha256Hex(fileBuffer);
      const supplierName = getField(req.uploadedFields, 'supplierName')
        || req.body?.supplierName
        || undefined;

      const imp = supplierImportRepository.create({
        fileName,
        fileSizeBytes: fileBuffer.length,
        fileSha256: sha256,
        fileMimeType: mimeType,
        supplierId: req.user?.companyId,
        supplierName,
      });

      // Parse CSV rows → SupplierCatalogItem[] (ISOLATED — never mutates official data)
      try {
        const rows: CsvRow[] = parseCsv(csvContent);
        const items: SupplierCatalogItem[] = rows.map(row => {
          const nameFr = row['Designation'] || row['nameFr'] || '';
          const category = row['Categorie'] || row['category'] || row['trade'] || '';
          const unit = row['Unite'] || row['unit'] || 'unit';
          const priceStr = row['Prix_HT_TND'] || row['price'] || '0';
          const priceTnd = parseFloat(String(priceStr).replace(',', '.')) || 0;
          const materialCode = row['Reference'] || row['materialCode'] || '';

          // Try to match against official materials (read-only lookup)
          const matched = materialRepository.findByCode(materialCode);

          return {
            id: generateId(),
            importId: imp.id,
            materialCode: materialCode || undefined,
            nameFr,
            category,
            unit,
            priceTnd,
            tvaIncluded: false,
            matchedMaterialId: matched?.id,
            matchedRateId: matched?.code,
            status: (matched ? 'matched' : 'unmatched') as SupplierCatalogItem['status'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });
        supplierImportRepository.setParsedItems(imp.id, items);
      } catch (parseErr) {
        // Parsing failure keeps the import in UPLOADED state with a note.
      }

      const updated = supplierImportRepository.findById(imp.id)!;
      res.status(201).json({ data: updated });
    } catch (err) { next(err); }
  }
);

// ── GET /imports/:id ──────────────────────────────────────────────────────

router.get('/imports/:id',
  authenticate,
  (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const imp = supplierImportRepository.findById(req.params.id);
      if (!imp) throw notFound(`Import '${req.params.id}' not found`);
      // Company isolation
      if (req.user!.role !== 'admin' && imp.supplierId && imp.supplierId !== req.user!.companyId) {
        throw forbidden('You do not have access to this import');
      }
      res.json({ data: imp });
    } catch (err) { next(err); }
  }
);

// ── POST /imports/:id/approve ─────────────────────────────────────────────
// Requires SUPPLIER_IMPORT_APPROVE. Does NOT publish to official catalog.

router.post('/imports/:id/approve',
  authenticate,
  requireEntitlement('SUPPLIER_IMPORT_APPROVE'),
  (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const imp = supplierImportRepository.findById(req.params.id);
      if (!imp) throw notFound(`Import '${req.params.id}' not found`);

      if (imp.status === 'APPROVED') {
        return res.status(200).json({ data: imp, message: 'Already approved' });
      }
      if (!['PARSED', 'PENDING_APPROVAL'].includes(imp.status)) {
        throw conflict(`Cannot approve import in status '${imp.status}'. Expected PARSED or PENDING_APPROVAL.`);
      }

      const approved = supplierImportRepository.setStatus(req.params.id, 'APPROVED', {
        approvedAt: new Date().toISOString(),
        approvedByUserId: req.user!.uid,
      });

      // NOTE: We do NOT modify official Materials or official Prices here.
      // Publishing to the official catalog is a separate controlled action.

      res.json({ data: approved, message: 'Import approved. Publishing requires a separate explicit action.' });
    } catch (err) { next(err); }
  }
);

export { router as suppliersRouter };
