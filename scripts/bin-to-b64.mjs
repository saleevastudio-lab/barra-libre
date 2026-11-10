#!/usr/bin/env node
/** Convierte un archivo binario en un módulo TS con su contenido en base64.
 *  Uso: node scripts/bin-to-b64.mjs <entrada> <salida.ts> <nombreExport>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [input, output, exportName] = process.argv.slice(2);
if (!input || !output || !exportName) {
  console.error('Uso: node scripts/bin-to-b64.mjs <entrada> <salida.ts> <nombreExport>');
  process.exit(1);
}
const b64 = readFileSync(input).toString('base64');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  `// GENERADO desde ${input} — no editar a mano. Regenerar con:\n` +
    `//   node scripts/bin-to-b64.mjs "${input}" "${output}" ${exportName}\n` +
    `export const ${exportName} =\n  '${b64}';\n`,
);
console.log(`${input} → ${output} (${b64.length} chars base64)`);
