#!/usr/bin/env node
/* Aggiunge un'icona di Font Awesome Free alla libreria _partials/icone.svg.

   Le icone non arrivano più dal CDN di Font Awesome: ogni pagina ha i suoi
   <symbol> SVG nel blocco <!-- comune:icone -->, copiati da componi.mjs
   prendendo dalla libreria solo quelli che la pagina usa.

   Uso:
     npm run icona -- solid arrow-right    id "ico-arrow-right"
     npm run icona -- brands instagram     id "ico-instagram"
     npm run icona -- regular calendar     id "ico-calendar-regular"
   (lo stile e il nome sono quelli di fontawesome.com: fa-solid fa-arrow-right)

   Il comando stampa il codice da incollare nella pagina; poi "npm run componi". */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const VERSIONE = '6.5.2';
const STILI = ['solid', 'regular', 'brands'];
const libreria = join(dirname(fileURLToPath(import.meta.url)), '..', '_partials', 'icone.svg');

const [stile, nome] = process.argv.slice(2).map((a) => a.replace(/^fa-/, ''));
if (!STILI.includes(stile) || !/^[a-z0-9-]+$/.test(nome ?? '')) {
  console.error('Uso: npm run icona -- <solid|regular|brands> <nome>\n  es. npm run icona -- solid arrow-right');
  process.exit(1);
}

// "regular" ha spesso lo stesso nome di una solid (clock, calendar...)
const id = 'ico-' + nome + (stile === 'regular' ? '-regular' : '');
const testo = readFileSync(libreria, 'utf8');
let simbolo = testo.match(new RegExp(`<symbol id="${id}"[^>]*>[\\s\\S]*?</symbol>`))?.[0];

if (!simbolo) {
  const url = `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@${VERSIONE}/svgs/${stile}/${nome}.svg`;
  const risposta = await fetch(url);
  if (!risposta.ok) {
    console.error(`Icona non trovata: ${stile}/${nome} (${risposta.status}). Controlla il nome su fontawesome.com`);
    process.exit(1);
  }
  const svg = await risposta.text();
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const forme = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<!--[\s\S]*?-->/g, '');
  simbolo = `<symbol id="${id}" viewBox="${viewBox}">${forme}</symbol>`;
  writeFileSync(libreria, testo.trimEnd() + '\n' + simbolo + '\n');
  console.log(`Aggiunta ${id} a _partials/icone.svg`);
} else {
  console.log(`${id} è già in _partials/icone.svg`);
}

const viewBox = simbolo.match(/viewBox="([^"]+)"/)[1];
console.log(`\n<i class="ico" aria-hidden="true"><svg viewBox="${viewBox}"><use href="#${id}"/></svg></i>\n`);
