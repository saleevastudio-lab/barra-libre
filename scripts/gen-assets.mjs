#!/usr/bin/env node
/** Regenera public/plantilla-eventos.b64 a partir de la plantilla Excel.
 *
 * La app carga la plantilla como texto base64 (.b64) para poder publicarse
 * en GitHub Pages; el .b64 se versiona en el repo (la xlsx no puede subirse
 * como binario por la API de GitHub). Aquí, en local, se regenera antes de
 * `npm run dev` y `npm run build` (scripts "predev"/"prebuild") cuando el
 * binario public/plantilla-eventos.xlsx está presente.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const xlsxPath = join(root, 'public/plantilla-eventos.xlsx');
const outPath = join(root, 'public/plantilla-eventos.b64');

if (!existsSync(xlsxPath)) {
  // En CI no hay binario: el .b64 versionado en el repo ya está listo.
  console.log(
    '[gen-assets] Sin public/plantilla-eventos.xlsx; se usa el plantilla-eventos.b64 versionado.',
  );
  process.exit(0);
}

const b64 = readFileSync(xlsxPath).toString('base64');
writeFileSync(outPath, b64 + '\n');
console.log(
  `generado public/plantilla-eventos.b64 (${Math.round(b64.length / 1024)} KB b64) desde public/plantilla-eventos.xlsx`,
);
