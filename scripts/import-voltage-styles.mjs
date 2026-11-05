import fs from 'node:fs/promises';
import vm from 'node:vm';

// The design reference stays a reference. Only its data and decorative motifs
// enter the application; none of its demo items, scripts or markup are shipped.
const source = await fs.readFile(new URL('../资料/voltage-tier-styles.html', import.meta.url), 'utf8');
const readArray = name => vm.runInNewContext(source.match(new RegExp('var '+name+' = (\\[[\\s\\S]*?\\n  \\]);'))[1], {}, {timeout: 1000});
const eras = readArray('ERAS');
const tiers = readArray('TIERS').map(t => ({
  code:t.code,index:t.idx,era:t.era,name:t.name,fullName:t.full,
  voltage:t.v,voltageShort:t.vShort,material:t.material,materialEn:t.materialEn,
  palette:{accent:[t.a,t.a2],casing:t.c,panel:t.p},
  background:t.bg,lcdBackground:t.lcdBg,texture:t.tex,detail:t.detail,light:!!t.light,
  tags:t.tags,spec:{texture:t.specTex,glow:t.specGlow,progress:t.specProg},description:t.desc
}));
await fs.writeFile(new URL('../src/data/voltage-tiers.js',import.meta.url),
  '// Extracted from 资料/voltage-tier-styles.html. Regenerate with node scripts/import-voltage-styles.mjs.\n'+
  'export const VOLTAGE_ERAS = '+JSON.stringify(eras,null,2)+';\n\n'+
  'export const VOLTAGE_TIERS = '+JSON.stringify(tiers,null,2)+';\n');
let motifs = source.slice(source.indexOf('  /* ---------- textures ---------- */'),source.indexOf('  #vt-tier-system[data-tier="LV"] .vt-sigline'));
motifs += source.slice(source.indexOf('  /* ---------- tier detail sigils ---------- */'), source.indexOf('  @media (max-width: 1120px)'));
motifs = motifs.replaceAll('#vt-tier-system','.tier-skin').replaceAll('.vt-detail','.tier-detail');
// Neutral pattern colors are material overlays; component colors use tokens.
motifs = motifs.replace(/rgba\(255, 255, 255, ([\d.]+)\)/g,(_,a)=>`color-mix(in srgb, var(--highlight) ${+(Number(a)*100).toFixed(2)}%, transparent)`)
  .replace(/rgba\(0, 0, 0, ([\d.]+)\)/g,(_,a)=>`color-mix(in srgb, var(--shadow) ${+(Number(a)*100).toFixed(2)}%, transparent)`);
// The full-spectrum exception is also defined centrally, shared by progress,
// gradient frames, prism texture and the detail emblem.
motifs = motifs.replace(/--tex: conic-gradient\([\s\S]*?\);/, '--tex: var(--spectrum-wash);')
  .replace(/background: conic-gradient\(from 0deg,[^;]+;/,'background: var(--spectrum);');
await fs.writeFile(new URL('../src/tier-motifs.css',import.meta.url),'/* Decorative textures and sigils extracted from the visual reference. */\n'+motifs);
console.log(`Imported ${tiers.length} voltage tiers and ${eras.length} eras.`);
