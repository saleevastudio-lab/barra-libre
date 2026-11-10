#!/usr/bin/env node
/** Genera public/barra-libre-template.b64 a partir de la plantilla Excel.
 *
 * La app carga la plantilla como texto base64 (.b64) para poder publicarse
 * en GitHub Pages; el workflow de Actions genera este mismo .b64 en CI
 * con `base64 -w0`. Aquí, en local, se genera antes de `npm run dev` y
 * `npm run build` (scripts "predev"/"prebuild").
 *
 * Fuentes, en orden de preferencia:
 *   1. public/barra-libre-template.xlsm  (el binario real, subido al repo)
 *   2. src/assets/generated/template.partNN.ts  (desarrollo local heredado)
 */
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const genDir = join(root, 'src/assets/generated');
const xlsmPath = join(root, 'public/barra-libre-template.xlsm');
const outPath = join(root, 'public/barra-libre-template.b64');

let b64 = null;
let fuente = null;

if (existsSync(xlsmPath)) {
  b64 = readFileSync(xlsmPath).toString('base64');
  fuente = 'public/barra-libre-template.xlsm';
} else {
  try {
    const files = readdirSync(genDir)
      .filter((f) => f.startsWith('template.part') && f.endsWith('.ts'))
      .sort();
    if (files.length > 0) {
      b64 = files
        .map((f) => {
          const src = readFileSync(join(genDir, f), 'utf8');
          const segs = src.match(/'([A-Za-z0-9+/=]+)'/g);
          if (!segs || segs.length === 0)
            throw new Error(`No se encontró base64 en ${f}`);
          return segs.map((s) => s.slice(1, -1)).join('');
        })
        .join('');
      fuente = 'partes src/assets/generated';
    }
  } catch {
    // sin partes disponibles
  }
}

if (!b64) {
  console.warn(
    '[gen-assets] Falta public/barra-libre-template.xlsm (y no hay partes base64).',
  );
  console.warn(
    '[gen-assets] Sube la plantilla a public/ (ver README); sin ella la app no puede generar el Excel.',
  );
  process.exit(0);
}

writeFileSync(outPath, b64 + '\n');
console.log(
  `generado public/barra-libre-template.b64 (${Math.round(b64.length / 1024)} KB b64) desde ${fuente}`,
);
