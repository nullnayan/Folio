import { PDFDocument, PDFDict, PDFName, PDFRawStream, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as FS from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { createZip } from './zip';
import { toByteArray, fromByteArray } from 'base64-js';

export type ShrinkLevel = 'light' | 'medium' | 'strong';

const SHRINK_PHOTO: Record<ShrinkLevel, { maxWidth: number; compress: number }> = {
  light: { maxWidth: 1600, compress: 0.8 },
  medium: { maxWidth: 1200, compress: 0.65 },
  strong: { maxWidth: 900, compress: 0.5 },
};

/**
 * Read any local URI (file:// or content://) into bytes.
 * Classic string API — the only path proven readable in Expo Go.
 */
async function readFileAsBytes(uri: string): Promise<Uint8Array> {
  const base64 = await FS.readAsStringAsync(uri, {
    encoding: FS.EncodingType.Base64,
  });
  return toByteArray(base64);
}

async function fileSizeBytes(uri: string): Promise<number> {
  try {
    const info = await FS.getInfoAsync(uri);
    return info.exists && 'size' in info ? (info as any).size || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Save bytes into our own cache dir and return its URI.
 */
async function saveBytesAsPdf(bytes: Uint8Array, filenamePrefix: string): Promise<string> {
  const base64 = fromByteArray(bytes);
  const filename = `${filenamePrefix}_${Date.now()}.pdf`;
  const fileUri = `${FS.cacheDirectory}${filename}`;
  await FS.writeAsStringAsync(fileUri, base64, {
    encoding: FS.EncodingType.Base64,
  });
  return fileUri;
}

async function embedImageAuto(pdfDoc: PDFDocument, bytes: Uint8Array) {
  try {
    return await pdfDoc.embedJpg(bytes);
  } catch {
    return await pdfDoc.embedPng(bytes);
  }
}

/**
 * "2, 4, 6-8" -> sorted unique 1-based page numbers within [1, total].
 * (lives in ./pages so it can be unit-tested without expo)
 */
export { parsePageSpec } from './pages';

async function saveRawBytes(bytes: Uint8Array, filename: string): Promise<string> {
  const base64 = fromByteArray(bytes);
  const fileUri = `${FS.cacheDirectory}${filename}`;
  await FS.writeAsStringAsync(fileUri, base64, {
    encoding: FS.EncodingType.Base64,
  });
  return fileUri;
}

export const PDFEngine = {
  /** Photos to PDF: one or more images into a single PDF */
  async photosToPdf(imageUris: string[]): Promise<string> {
    const pdfDoc = await PDFDocument.create();
    for (const imageUri of imageUris) {
      const imageBytes = await readFileAsBytes(imageUri);
      const embeddedImage = await embedImageAuto(pdfDoc, imageBytes);
      const { width, height } = embeddedImage;
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(embeddedImage, { x: 0, y: 0, width, height });
    }
    const pdfBytes = await pdfDoc.save();
    return saveBytesAsPdf(pdfBytes, 'SoneDo_photos');
  },

  /** Add Photos to an Existing PDF (at beginning or end) */
  async addPhotosToPdf(
    pdfUri: string,
    imageUris: string[],
    position: 'end' | 'start' = 'end'
  ): Promise<string> {
    const pdfBytes = await readFileAsBytes(pdfUri);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    for (let i = 0; i < imageUris.length; i++) {
      const imageBytes = await readFileAsBytes(imageUris[i]);
      const embeddedImage = await embedImageAuto(pdfDoc, imageBytes);
      const { width, height } = embeddedImage;
      if (position === 'start') {
        const page = pdfDoc.insertPage(i, [width, height]);
        page.drawImage(embeddedImage, { x: 0, y: 0, width, height });
      } else {
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(embeddedImage, { x: 0, y: 0, width, height });
      }
    }
    const modifiedBytes = await pdfDoc.save();
    return saveBytesAsPdf(modifiedBytes, 'SoneDo_added_photos');
  },

  /** Merge Multiple PDFs into a single PDF */
  async mergePdfs(pdfUris: string[]): Promise<string> {
    const mergedDoc = await PDFDocument.create();
    for (const uri of pdfUris) {
      const bytes = await readFileAsBytes(uri);
      const doc = await PDFDocument.load(bytes);
      const pageIndices = doc.getPageIndices();
      const copiedPages = await mergedDoc.copyPages(doc, pageIndices);
      copiedPages.forEach((page) => mergedDoc.addPage(page));
    }
    const mergedBytes = await mergedDoc.save();
    return saveBytesAsPdf(mergedBytes, 'SoneDo_merged');
  },

  /** Split PDF: extract a range of pages (1-based inclusive) */
  async splitPdf(pdfUri: string, startPage: number, endPage: number): Promise<string> {
    const pdfBytes = await readFileAsBytes(pdfUri);
    const sourceDoc = await PDFDocument.load(pdfBytes);
    const totalPages = sourceDoc.getPageCount();
    const startIndex = Math.max(0, startPage - 1);
    const endIndex = Math.min(totalPages - 1, endPage - 1);
    if (startIndex > endIndex) throw new Error(`Pages ${startPage}-${endPage} are outside this PDF (${totalPages} pages)`);
    const indicesToCopy: number[] = [];
    for (let i = startIndex; i <= endIndex; i++) indicesToCopy.push(i);
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(sourceDoc, indicesToCopy);
    copiedPages.forEach((page) => newDoc.addPage(page));
    const resultBytes = await newDoc.save();
    return saveBytesAsPdf(resultBytes, 'SoneDo_split');
  },

  /**
   * Remove or keep pages.
   * mode 'remove': pages[] are deleted. mode 'keep': only pages[] are kept.
   */
  async filterPages(
    pdfUri: string,
    mode: 'remove' | 'keep',
    pages: number[]
  ): Promise<string> {
    const pdfBytes = await readFileAsBytes(pdfUri);
    const sourceDoc = await PDFDocument.load(pdfBytes);
    const total = sourceDoc.getPageCount();
    const valid = pages.filter((p) => p >= 1 && p <= total);
    const keepIdx =
      mode === 'remove'
        ? sourceDoc.getPageIndices().filter((i) => !valid.includes(i + 1))
        : valid.map((p) => p - 1).sort((a, b) => a - b);
    if (keepIdx.length === 0) throw new Error('Nothing would be left — keep at least 1 page');
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(sourceDoc, keepIdx);
    copiedPages.forEach((page) => newDoc.addPage(page));
    const resultBytes = await newDoc.save();
    return saveBytesAsPdf(resultBytes, 'SoneDo_pages');
  },

  /** Rotate all pages */
  async rotatePdf(pdfUri: string, rotationAngle: number = 90): Promise<string> {
    const pdfBytes = await readFileAsBytes(pdfUri);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const currentAngle = page.getRotation().angle;
      page.setRotation(degrees(currentAngle + rotationAngle));
    }
    const resultBytes = await pdfDoc.save();
    return saveBytesAsPdf(resultBytes, 'SoneDo_rotated');
  },

  /** Add Watermark to PDF */
  async addWatermark(pdfUri: string, watermarkText: string): Promise<string> {
    const pdfBytes = await readFileAsBytes(pdfUri);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();
      const fontSize = Math.min(width, height) / 10;
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
      const textHeight = font.heightAtSize(fontSize);
      page.drawText(watermarkText, {
        x: width / 2 - textWidth / 2,
        y: height / 2 - textHeight / 2,
        size: fontSize,
        font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.35,
        rotate: degrees(45),
      });
    }
    const resultBytes = await pdfDoc.save();
    return saveBytesAsPdf(resultBytes, 'SoneDo_watermarked');
  },

  /**
   * Sign: stamp a signature photo at the bottom-right of
   * the first page, last page, or all pages.
   */
  async addSignature(
    pdfUri: string,
    signatureImageUri: string,
    scope: 'first' | 'last' | 'all' = 'last'
  ): Promise<string> {
    const pdfBytes = await readFileAsBytes(pdfUri);
    const sigBytes = await readFileAsBytes(signatureImageUri);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const sig = await embedImageAuto(pdfDoc, sigBytes);
    const pages = pdfDoc.getPages();
    const targets =
      scope === 'first' ? [pages[0]] : scope === 'last' ? [pages[pages.length - 1]] : pages;
    for (const page of targets) {
      const { width: pw, height: ph } = page.getSize();
      const targetW = Math.min(190, pw * 0.38);
      const scale = targetW / sig.width;
      const targetH = sig.height * scale;
      page.drawImage(sig, {
        x: pw - targetW - 36,
        y: 48,
        width: targetW,
        height: targetH,
      });
      void ph;
    }
    const resultBytes = await pdfDoc.save();
    return saveBytesAsPdf(resultBytes, 'SoneDo_signed');
  },

  /**
   * Shrink Photos: downscale + recompress images, then build a light PDF.
   * Level controls how small: light / medium / strong.
   */
  async shrinkPhotosToPdf(imageUris: string[], level: ShrinkLevel = 'medium'): Promise<string> {
    const cfg = SHRINK_PHOTO[level];
    const small: string[] = [];
    for (let i = 0; i < imageUris.length; i++) {
      const out = await manipulateAsync(
        imageUris[i],
        [{ resize: { width: cfg.maxWidth } }],
        { compress: cfg.compress, format: SaveFormat.JPEG }
      );
      small.push(out.uri);
    }
    return this.photosToPdf(small);
  },

  /**
   * Shrink PDF: recompress embedded JPEG photos at the chosen level,
   * then re-save with object streams. Never returns a bigger file —
   * if nothing could be shrunk, the original bytes are kept.
   */
  async compressPdf(pdfUri: string, level: ShrinkLevel = 'medium'): Promise<string> {
    const original = await readFileAsBytes(pdfUri);
    const cfg =
      level === 'light'
        ? { maxWidth: 1500, compress: 0.75 }
        : level === 'strong'
        ? { maxWidth: 800, compress: 0.55 }
        : { maxWidth: 1100, compress: 0.65 };

    if (level !== 'light') {
      try {
        const pdfDoc = await PDFDocument.load(original);
        let touched = 0;
        for (const page of pdfDoc.getPages()) {
          const res: any = (page.node as any).Resources?.();
          if (!res) continue;
          const xobjRef = res.get(PDFName.of('XObject'));
          if (!xobjRef) continue;
          const xobjs = pdfDoc.context.lookup(xobjRef);
          if (!(xobjs instanceof PDFDict)) continue;
          for (const key of xobjs.keys()) {
            try {
              const obj = pdfDoc.context.lookup(xobjs.get(key));
              if (!(obj instanceof PDFRawStream)) continue;
              const subtype = obj.dict.lookup(PDFName.of('Subtype'));
              if (subtype !== PDFName.of('Image')) continue;
              const filter = obj.dict.lookup(PDFName.of('Filter'));
              const filters: string[] = [];
              if (filter) {
                const ctor = (filter as any).constructor?.name;
                if (ctor === 'PDFName') filters.push((filter as any).decodeText?.() ?? String(filter));
                else if (ctor === 'PDFArray' || Array.isArray((filter as any).array)) {
                  for (const f of ((filter as any).array ?? []) as any[]) {
                    filters.push(f.decodeText?.() ?? String(f));
                  }
                } else {
                  filters.push(String(filter));
                }
              }
              if (!filters.some((f) => f.includes('DCTDecode'))) continue;
              const jpgBytes = (obj as PDFRawStream).getContents();
              if (!jpgBytes || jpgBytes.length < 20_000) continue; // skip tiny icons
              const tmpUri = await saveRawBytes(jpgBytes, `sonedo_in_${Date.now()}_${touched}.jpg`);
              const small = await manipulateAsync(
                tmpUri,
                [{ resize: { width: cfg.maxWidth } }],
                { compress: cfg.compress, format: SaveFormat.JPEG }
              );
              const smallBytes = await readFileAsBytes(small.uri);
              if (smallBytes.length >= jpgBytes.length) {
                try { await FS.deleteAsync(tmpUri, { idempotent: true }); } catch {}
                continue;
              }
              const w = (small as any).width ?? 0;
              const h = (small as any).height ?? 0;
              const { PDFNumber } = await import('pdf-lib');
              const fresh = PDFRawStream.of(PDFDict.withContext(pdfDoc.context), smallBytes);
              fresh.dict.set(PDFName.of('Type'), PDFName.of('XObject'));
              fresh.dict.set(PDFName.of('Subtype'), PDFName.of('Image'));
              if (w) fresh.dict.set(PDFName.of('Width'), PDFNumber.of(w));
              if (h) fresh.dict.set(PDFName.of('Height'), PDFNumber.of(h));
              fresh.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
              fresh.dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
              fresh.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
              xobjs.set(key, fresh);
              touched++;
              try { await FS.deleteAsync(tmpUri, { idempotent: true }); } catch {}
              try { await FS.deleteAsync(small.uri, { idempotent: true }); } catch {}
            } catch {
              // keep going with the next image
            }
          }
        }
        if (touched > 0) {
          const out = await pdfDoc.save({ useObjectStreams: true });
          const finalBytes = out.length < original.length ? out : original;
          return saveBytesAsPdf(finalBytes, 'SoneDo_compressed');
        }
      } catch {
        // fall through to plain re-save
      }
    }

    const pdfDoc = await PDFDocument.load(original);
    const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
    const finalBytes = compressedBytes.length < original.length ? compressedBytes : original;
    return saveBytesAsPdf(finalBytes, 'SoneDo_compressed');
  },

  /**
   * Pull embedded JPEG photos out of a PDF (e.g. scanned pages).
   * Returns cache URIs of extracted .jpg files + counts.
   */
  async extractPhotosFromPdf(pdfUri: string): Promise<{
    photoUris: string[];
    found: number;
    skipped: number;
  }> {
    const bytes = await readFileAsBytes(pdfUri);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const out: string[] = [];
    let skipped = 0;
    let n = 0;
    for (const page of pdfDoc.getPages()) {
      try {
        const res: any = (page.node as any).Resources?.();
        if (!res) continue;
        const xobjRef = res.get(PDFName.of('XObject'));
        if (!xobjRef) continue;
        const xobjs = pdfDoc.context.lookup(xobjRef);
        if (!(xobjs instanceof PDFDict)) continue;
        for (const key of xobjs.keys()) {
          try {
            const obj = pdfDoc.context.lookup(xobjs.get(key));
            if (!(obj instanceof PDFRawStream)) continue;
            if (obj.dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Image')) continue;
            const w = obj.dict.lookup(PDFName.of('Width'));
            const h = obj.dict.lookup(PDFName.of('Height'));
            const width = (w as any)?.asNumber?.() ?? 0;
            const height = (h as any)?.asNumber?.() ?? 0;
            if (width < 100 || height < 100) {
              skipped++;
              continue; // icons / tinydecorations
            }
            const filter = obj.dict.lookup(PDFName.of('Filter'));
            const s = String(filter ?? '');
            if (!s.includes('DCTDecode')) {
              skipped++;
              continue; // vector/raw images we cannot rasterize offline
            }
            const jpg = (obj as PDFRawStream).getContents();
            if (!jpg || jpg.length < 4000) {
              skipped++;
              continue;
            }
            n++;
            const destUri = await saveRawBytes(jpg, `SoneDo_photo_${Date.now()}_${n}.jpg`);
            out.push(destUri);
          } catch {
            skipped++;
          }
        }
      } catch {
        // next page
      }
    }
    return { photoUris: out, found: out.length, skipped };
  },

  /** Bundle arbitrary files into a plain (no password) ZIP for sharing. */
  async zipFiles(fileUris: string[], filenamePrefix: string): Promise<string> {
    const entries: { name: string; data: Uint8Array }[] = [];
    for (let i = 0; i < fileUris.length; i++) {
      const data = await readFileAsBytes(fileUris[i]);
      const base = (fileUris[i].split('/').pop() || `file_${i + 1}`).split('?')[0];
      entries.push({ name: base, data });
    }
    return saveRawBytes(createZip(entries), `${filenamePrefix}_${Date.now()}.zip`);
  },

  /**
   * Lock a PDF with a password (offline).
   * The PDF is sealed inside a password-protected file that opens
   * in any file manager / unzip app with the password.
   */
  async lockPdfWithPassword(pdfUri: string, password: string): Promise<string> {
    if (!password || password.length < 4) throw new Error('Password must be at least 4 characters');
    const data = await readFileAsBytes(pdfUri);
    const base = (pdfUri.split('/').pop() || 'document.pdf').split('?')[0];
    const arcName = base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
    return saveRawBytes(createZip([{ name: arcName, data }], password), `Locked_${Date.now()}.zip`);
  },

  /** Basic metadata of a PDF (number of pages + size) */
  async getPdfInfo(pdfUri: string): Promise<{ pageCount: number; sizeBytes: number }> {
    const pdfBytes = await readFileAsBytes(pdfUri);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    return { pageCount: pdfDoc.getPageCount(), sizeBytes: await fileSizeBytes(pdfUri) };
  },

  /**
   * Copy a picked file into our own cache dir so it stays readable.
   * Uses classic copyAsync (handles content:// grants); falls back to
   * the original URI when the copy is unnecessary or fails.
   */
  async stabilizePickedFile(sourceUri: string, nameHint: string): Promise<string> {
    const safe = nameHint.replace(/[^\w.\-]+/g, '_').slice(-60) || 'file';
    const dest = `${FS.cacheDirectory}pick_${Date.now()}_${safe}`;
    try {
      await FS.copyAsync({ from: sourceUri, to: dest });
      return dest;
    } catch {
      return sourceUri;
    }
  },
};
