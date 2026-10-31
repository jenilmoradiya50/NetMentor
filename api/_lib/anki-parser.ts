import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import initSqlJs from 'sql.js';

let cachedSqlPromise: Promise<any> | null = null;

/**
 * Initializes and caches the SQL.js WebAssembly engine.
 * Handles both local disk paths and Vercel serverless environments with CDN fallback.
 */
export async function getSqlInstance(): Promise<any> {
  if (cachedSqlPromise) {
    return cachedSqlPromise;
  }

  cachedSqlPromise = (async () => {
    // 1. Check common filesystem locations for sql-wasm.wasm
    const searchDirs = [
      process.cwd(),
      path.join(process.cwd(), 'node_modules/sql.js/dist'),
      '/var/task/node_modules/sql.js/dist',
      '/var/task',
    ];

    let wasmArrayBuffer: ArrayBuffer | undefined;

    for (const dir of searchDirs) {
      const candidate = path.join(dir, 'sql-wasm.wasm');
      if (fs.existsSync(candidate)) {
        try {
          const buf = fs.readFileSync(candidate);
          wasmArrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
          break;
        } catch {}
      }
    }

    // 2. If not found on local disk, fetch from reliable CDN as serverless fallback
    if (!wasmArrayBuffer) {
      try {
        const cdnRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.15.2/sql-wasm.wasm');
        if (cdnRes.ok) {
          wasmArrayBuffer = await cdnRes.arrayBuffer();
        }
      } catch (err: any) {
        console.warn('[SQL.js Warning]: Could not fetch wasm from CDN:', err?.message);
      }
    }

    return initSqlJs(wasmArrayBuffer ? { wasmBinary: wasmArrayBuffer } : undefined);
  })();

  return cachedSqlPromise;
}

export interface ParsedCard {
  orderIndex: number;
  frontMarkdown: string;
  backMarkdown: string;
  cardType: 'basic' | 'cloze' | 'fill_in_blank';
  clozeData?: Record<string, any>;
  tags: string[];
  sourceNoteId: string;
}

export interface ParsedDeck {
  deckName: string;
  title: string;
  description: string;
  sourceHash: string;
  cardCount: number;
  noteCount: number;
  cards: ParsedCard[];
  warnings: string[];
  mediaCount: number;
}

// 50 MB max file size limit to prevent memory exhaustion
export const MAX_APKG_SIZE = 50 * 1024 * 1024;
// 100 MB max uncompressed archive limit (zip bomb defense)
export const MAX_UNCOMPRESSED_SIZE = 100 * 1024 * 1024;

/**
 * Sanitizes raw HTML from Anki notes:
 * - Strips dangerous scripts, iframes, and event handlers
 * - Converts HTML entities
 * - Replaces local image references with embedded base64 data URIs or clean labels
 * - Preserves technical formatting (monospace, code blocks, bold, line breaks)
 */
export function sanitizeAnkiHtml(
  rawHtml: string,
  _mediaMap: Record<string, string>,
  mediaFiles: Map<string, Uint8Array>,
  warnings: string[],
): string {
  if (!rawHtml) return '';

  let html = rawHtml;

  // 1. Remove dangerous tags and attributes
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  html = html.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/javascript:/gi, '');

  // 2. Replace Anki <img src="..."> tags
  html = html.replace(/<img\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi, (_match, srcName) => {
    const cleanSrc = decodeURIComponent(srcName).trim();
    // Look up in mediaFiles
    const fileBytes = mediaFiles.get(cleanSrc);
    if (fileBytes && fileBytes.length > 0 && fileBytes.length <= 1024 * 1024) { // max 1MB per inline image
      // Determine MIME type
      const ext = cleanSrc.split('.').pop()?.toLowerCase() || 'jpeg';
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
      const b64 = Buffer.from(fileBytes).toString('base64');
      return `<img src="data:${mime};base64,${b64}" alt="${cleanSrc}" class="inline-block max-h-48 rounded my-2 border border-slate-700 shadow-sm" />`;
    }

    warnings.push(`Image reference preserved as label: [Figure: ${cleanSrc}]`);
    return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-brand-300 border border-slate-700 my-1">[Figure: ${cleanSrc}]</span>`;
  });

  // 3. Normalize line breaks and formatting
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<\/div>/gi, '\n');
  html = html.replace(/<div>/gi, '');
  html = html.replace(/<\/p>/gi, '\n\n');
  html = html.replace(/<p>/gi, '');
  html = html.replace(/&nbsp;/gi, ' ');
  html = html.replace(/&lt;/gi, '<');
  html = html.replace(/&gt;/gi, '>');
  html = html.replace(/&amp;/gi, '&');
  html = html.replace(/&quot;/gi, '"');

  // Trim whitespace
  return html.trim();
}

/**
 * Parses an Anki (.apkg) buffer into a structured NetMentor deck.
 */
export async function parseAnkiApkg(
  buffer: Buffer | Uint8Array,
  fallbackTitle = 'Imported CCNA Deck',
): Promise<ParsedDeck> {
  if (buffer.length > MAX_APKG_SIZE) {
    throw new Error(`File exceeds maximum permitted size of ${MAX_APKG_SIZE / (1024 * 1024)} MB.`);
  }

  // Calculate SHA-256 hash for duplicate detection
  const sourceHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const warnings: string[] = [];

  // Load zip archive
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err: any) {
    throw new Error('Failed to parse archive: File is not a valid zip archive or is corrupted.');
  }

  // Validate uncompressed size to defend against zip bombs
  let totalUncompressed = 0;
  zip.forEach((_relativePath, file) => {
    // @ts-ignore - JSZip internal _data
    totalUncompressed += file._data?.uncompressedSize || 0;
  });
  if (totalUncompressed > MAX_UNCOMPRESSED_SIZE) {
    throw new Error('Archive expansion exceeds safe processing limit (Archive bomb defense triggered).');
  }

  // Look for collection.anki2 (or collection.anki21)
  let anki2Entry = zip.file('collection.anki2');
  if (!anki2Entry) {
    anki2Entry = zip.file('collection.anki21');
  }
  if (!anki2Entry) {
    throw new Error('Invalid Anki deck package: collection.anki2 database file was not found inside the archive.');
  }

  const anki2Bytes = await anki2Entry.async('uint8array');

  // Extract media map
  const mediaMap: Record<string, string> = {}; // { "0": "router.JPG" }
  const mediaFiles = new Map<string, Uint8Array>(); // { "router.JPG": <bytes> }

  const mediaEntry = zip.file('media');
  if (mediaEntry) {
    try {
      const mediaJsonStr = await mediaEntry.async('text');
      const parsedMap = JSON.parse(mediaJsonStr);
      Object.assign(mediaMap, parsedMap);

      for (const [key, filename] of Object.entries(mediaMap)) {
        const fileEntry = zip.file(key);
        if (fileEntry) {
          const bytes = await fileEntry.async('uint8array');
          mediaFiles.set(filename, bytes);
        }
      }
    } catch {
      warnings.push('Media index could not be completely parsed. Media references will be rendered as placeholders.');
    }
  }

  // Initialize SQLite WebAssembly
  const SQL = await getSqlInstance();
  const db = new SQL.Database(anki2Bytes);

  let deckName = fallbackTitle;
  let title = fallbackTitle;
  let description = '';

  try {
    // 1. Read collection metadata
    const colRes = db.exec('SELECT decks, models FROM col LIMIT 1;');
    if (colRes.length > 0 && colRes[0].values.length > 0) {
      const decksJson = JSON.parse(colRes[0].values[0][0] as string);

      // Find non-Default deck
      for (const [dId, d] of Object.entries(decksJson)) {
        const dObj = d as any;
        if (dId !== '1' && dObj.name && dObj.name !== 'Default') {
          deckName = dObj.name;
          if (dObj.desc) {
            description = sanitizeAnkiHtml(dObj.desc, mediaMap, mediaFiles, []);
          }
          break;
        }
      }
    }

    // Clean human title if deckName is like "01networkdevices"
    title = formatDeckTitle(deckName, fallbackTitle);

    // 2. Query notes and cards
    // Note: in Anki, notes contain fields, and cards map notes to decks.
    const query = `
      SELECT 
        n.id as note_id,
        n.mid as model_id,
        n.tags as tags,
        n.flds as flds,
        c.ord as card_ord
      FROM notes n
      JOIN cards c ON c.nid = n.id
      ORDER BY n.id ASC, c.ord ASC;
    `;

    const notesRes = db.exec(query);
    const parsedCards: ParsedCard[] = [];

    if (notesRes.length > 0 && notesRes[0].values.length > 0) {
      const rows = notesRes[0].values;
      let orderIndex = 0;

      for (const row of rows) {
        const noteId = String(row[0]);
        const tagsRaw = String(row[2] || '').trim();
        const tags = tagsRaw.split(/\s+/).filter(Boolean);
        const fldsRaw = String(row[3] || '');
        const cardOrd = Number(row[4] || 0);

        const flds = fldsRaw.split('\x1f'); // Anki field separator is 0x1F (Unit Separator)
        const frontRaw = flds[0] || '';
        const backRaw = flds[1] || '';

        const front = sanitizeAnkiHtml(frontRaw, mediaMap, mediaFiles, warnings);
        const back = sanitizeAnkiHtml(backRaw, mediaMap, mediaFiles, warnings);

        if (!front && !back) {
          continue; // Skip completely empty notes
        }

        // Determine card type and cloze data
        let cardType: 'basic' | 'cloze' | 'fill_in_blank' = 'basic';
        let clozeData: Record<string, any> | undefined;

        // Check for standard Anki cloze syntax {{c1::answer}}
        const ankiClozeMatches = [...front.matchAll(/\{\{c(\d+)::([^:]+?)(?:::([^}]+))?\}\}/g)];
        if (ankiClozeMatches.length > 0) {
          cardType = 'cloze';
          clozeData = {
            clozeType: 'anki',
            blanks: ankiClozeMatches.map((m) => ({
              index: parseInt(m[1], 10),
              answer: m[2],
              hint: m[3] || null,
            })),
          };
        } else if (front.includes('[...]')) {
          cardType = 'fill_in_blank';
          clozeData = {
            clozeType: 'bracket',
            answer: back,
          };
        }

        parsedCards.push({
          orderIndex: orderIndex++,
          frontMarkdown: front,
          backMarkdown: back,
          cardType,
          clozeData,
          tags,
          sourceNoteId: `${noteId}_${cardOrd}`,
        });
      }
    }

    const uniqueWarnings = Array.from(new Set(warnings));

    return {
      deckName,
      title,
      description,
      sourceHash,
      cardCount: parsedCards.length,
      noteCount: parsedCards.length,
      cards: parsedCards,
      warnings: uniqueWarnings,
      mediaCount: mediaFiles.size,
    };
  } finally {
    db.close();
  }
}

/**
 * Formats machine deck names into clean, readable titles.
 * e.g., "01networkdevices" -> "Day 01 - Network Devices"
 */
function formatDeckTitle(deckName: string, fallbackTitle: string): string {
  if (fallbackTitle && fallbackTitle !== 'Imported CCNA Deck') {
    return fallbackTitle.replace(/\.apkg$/i, '').trim();
  }

  const match = deckName.match(/^(\d{2})([a-z0-9_-]+)$/i);
  if (match) {
    const day = match[1];
    const rest = match[2]
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    return `Day ${day} - ${rest}`;
  }

  return deckName || fallbackTitle;
}
