import * as fs from 'fs';
import * as path from 'path';

// pdf-parse does not ship with @types — use require to avoid TS errors
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;

export interface StandardsChunk {
  index: number;
  title: string;
  content: string;
}

let cachedChunks: StandardsChunk[] | null = null;

export async function getChunks(): Promise<StandardsChunk[]> {
  if (cachedChunks !== null) return cachedChunks;

  const pdfPath = path.join(__dirname, '../../data/standards.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.warn('[standardsService] standards.pdf not found at', pdfPath, '— proceeding without context');
    cachedChunks = [];
    return cachedChunks;
  }

  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);
  cachedChunks = splitIntoChunks(data.text);
  console.log(`[standardsService] Loaded ${cachedChunks.length} chunks from standards.pdf`);
  return cachedChunks;
}

function splitIntoChunks(text: string): StandardsChunk[] {
  const lines = text.split('\n');
  // Match numbered headers like "1.", "2.1", "3.1.2" or ALL-CAPS Ukrainian/Latin lines ≥5 chars
  const numberedHeader = /^\d+(\.\d+)*[.\s]\s*\S/;
  const uppercaseHeader = /^[А-ЯІЇЄЁA-Z][А-ЯІЇЄЁA-Z\s\-–—]{4,}$/;

  const chunks: StandardsChunk[] = [];
  let currentTitle = 'Загальні положення';
  let currentLines: string[] = [];
  let index = 0;

  const flush = () => {
    const content = currentLines.join('\n').trim();
    if (content.length > 50) {
      chunks.push({ index: index++, title: currentTitle, content });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && (numberedHeader.test(trimmed) || uppercaseHeader.test(trimmed))) {
      flush();
      currentTitle = trimmed;
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return chunks;
}
