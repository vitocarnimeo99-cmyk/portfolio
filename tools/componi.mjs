#!/usr/bin/env node
/* Copia le parti comuni del sito (cartella _partials/) dentro ogni pagina.

   In ogni pagina le parti comuni stanno tra due commenti:
     <!-- comune:header · non modificare qui: _partials/header.html -->
     ...
     <!-- /comune:header -->
   Lo script riscrive solo quello che sta in mezzo: tutto il resto della
   pagina (contenuti, <style>, script del progetto) resta com'è.

   Nei file di _partials/ i {{segnaposto}} vengono sostituiti con i dati
   della pagina presi da _partials/pagine.json (scritti come testo normale:
   & e " vengono convertiti in automatico), più:
     {{sito}}  indirizzo del sito pubblicato
     {{url}}   indirizzo completo della pagina
     {{home}}  "" nella home, "index.html" nelle altre pagine

   Uso:
     npm run componi              aggiorna le pagine
     node tools/componi.mjs --controlla
                                  non scrive nulla, esce con errore se
                                  qualche pagina non è aggiornata */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SITO = 'https://vitocarnimeo99-cmyk.github.io/portfolio/';
const PARTI = ['head', 'header', 'footer'];

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const percorso = (...p) => join(radice, ...p);
const soloControllo = process.argv.includes('--controlla');

const escape = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pagine = JSON.parse(readFileSync(percorso('_partials', 'pagine.json'), 'utf8'));
const modelli = Object.fromEntries(PARTI.map((p) => [p, readFileSync(percorso('_partials', `${p}.html`), 'utf8')]));

const errori = [];
const daAggiornare = [];

for (const file of readdirSync(radice).filter((f) => f.endsWith('.html')).sort()) {
  if (!pagine[file]) errori.push(`${file}: manca in _partials/pagine.json`);
}

for (const [file, dati] of Object.entries(pagine)) {
  let html;
  try {
    html = readFileSync(percorso(file), 'utf8');
  } catch {
    errori.push(`${file}: è in pagine.json ma il file non esiste`);
    continue;
  }

  const valori = {
    ...Object.fromEntries(Object.entries(dati).map(([k, v]) => [k, escape(v)])),
    sito: SITO,
    url: file === 'index.html' ? SITO : SITO + file,
    home: file === 'index.html' ? '' : 'index.html',
  };
  const riempi = (modello) => modello.replace(/\{\{(\w+)\}\}/g, (_, nome) => {
    if (!(nome in valori)) {
      errori.push(`${file}: in pagine.json manca "${nome}"`);
      return '';
    }
    return valori[nome];
  });

  let nuovo = html;
  for (const parte of PARTI) {
    const blocco = new RegExp(`(<!-- comune:${parte}\\b[^>]*-->\\n)[\\s\\S]*?(<!-- /comune:${parte} -->)`);
    if (!blocco.test(nuovo)) {
      errori.push(`${file}: mancano i commenti <!-- comune:${parte} --> ... <!-- /comune:${parte} -->`);
      continue;
    }
    nuovo = nuovo.replace(blocco, (_, inizio, fine) => inizio + riempi(modelli[parte]) + fine);
  }

  if (nuovo !== html) {
    daAggiornare.push(file);
    if (!soloControllo) writeFileSync(percorso(file), nuovo);
  }
}

if (errori.length) {
  console.error('Errori:\n  ' + errori.join('\n  '));
  process.exit(1);
}
if (soloControllo) {
  if (daAggiornare.length) {
    console.error('Pagine non aggiornate con _partials/: ' + daAggiornare.join(', ') +
      '\nLancia "npm run componi" e ripeti il commit.');
    process.exit(1);
  }
  console.log('Tutte le pagine sono aggiornate.');
} else {
  console.log(daAggiornare.length ? 'Aggiornate: ' + daAggiornare.join(', ') : 'Nessuna pagina da aggiornare.');
}
