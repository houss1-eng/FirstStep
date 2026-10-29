// Génère toutes les images de l'application à partir du logo de First Step (assets/logo-source.png) :
// icônes PWA (www/icons), logo de l'interface (www/img), logo des PDF (server), sources Capacitor (assets/),
// icône des notifications (Android) et bannière de la page de connexion
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SOURCE = 'assets/logo-source.png';
const CREME = { r: 255, g: 251, b: 243, alpha: 1 };   // fond de l'application (#fffbf3)
const VIDE = { r: 0, g: 0, b: 0, alpha: 0 };
mkdirSync('www/icons', { recursive: true });
mkdirSync('www/img', { recursive: true });

// ---- Logo sans son fond crème ----
// Le fond est la zone de couleur crème reliée aux bords de l'image (remplissage depuis les bords) :
// le blanc des yeux du « F » et des dents de l'enfant, entourés d'un trait noir, restent donc opaques.
// Bords doux : plus un pixel du fond est proche du crème, plus il est transparent (couleur « dé-mélangée »).
// (l'image d'origine a une colonne noire à droite : on la retire)
const source = await sharp(SOURCE).metadata();
const { data, info } = await sharp(SOURCE).extract({ left: 0, top: 0, width: source.width - 1, height: source.height })
  .removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, N = W * H;
// Couleur du fond : moyenne de la première ligne
const fondSource = [0, 1, 2].map(j => { let s = 0; for (let x = 0; x < W; x++) s += data[x * 3 + j]; return Math.round(s / W); });
const ecart = k => Math.max(...[0, 1, 2].map(j => Math.abs(data[k * 3 + j] - fondSource[j])));
const PROCHE = 24, LOIN = 90;   // en dessous : fond (transparent) ; au-dessus : logo (opaque)
const fond = new Uint8Array(N), pile = [];
for (let x = 0; x < W; x++) pile.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) pile.push(y * W, y * W + W - 1);
while (pile.length) {
  const k = pile.pop();
  if (fond[k] || ecart(k) >= LOIN) continue;
  fond[k] = 1;
  const x = k % W;
  if (x > 0) pile.push(k - 1);
  if (x < W - 1) pile.push(k + 1);
  if (k >= W) pile.push(k - W);
  if (k < N - W) pile.push(k + W);
}
const sansFond = Buffer.alloc(N * 4);
for (let k = 0; k < N; k++) {
  const a = fond[k] ? Math.max(0, Math.min(1, (ecart(k) - PROCHE) / (LOIN - PROCHE))) : 1;
  for (let j = 0; j < 3; j++)
    sansFond[k * 4 + j] = a ? Math.max(0, Math.min(255, Math.round((data[k * 3 + j] - (1 - a) * fondSource[j]) / a))) : 0;
  sansFond[k * 4 + 3] = Math.round(a * 255);
}
const LOGO = await sharp(sansFond, { raw: { width: W, height: H, channels: 4 } }).trim().png().toBuffer();

const transparent = size => sharp(LOGO).resize(size, size, { fit: 'contain', background: VIDE });
const logo = (size, fond = CREME) => transparent(size).flatten({ background: fond });
// Logo centré sur un carré (crème par défaut), avec une marge (icônes « maskable » et Android : rien n'est coupé)
const avecMarge = async (taille, logoTaille, fond = CREME) => sharp({ create: { width: taille, height: taille, channels: 4, background: fond } })
  .composite([{ input: await transparent(logoTaille).png().toBuffer(), gravity: 'center' }]);

// Navigateur / PWA
await logo(192).png().toFile('www/icons/icon-192.png');
await logo(512).png().toFile('www/icons/icon-512.png');
await (await avecMarge(512, 400)).png().toFile('www/icons/icon-maskable-512.png');
// Interface (menu sur fond bleu nuit, page de connexion) et en-tête bleu nuit des PDF : logo transparent
await transparent(420).png({ compressionLevel: 9 }).toFile('www/img/logo.png');
await transparent(300).png({ compressionLevel: 9 }).toFile('server/logo.png');

// Sources Capacitor : icône adaptative Android = premier plan (logo transparent) + arrière-plan (crème)
await (await avecMarge(1024, 900)).png().toFile('assets/icon-only.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CREME } }).png().toFile('assets/icon-background.png');
await (await avecMarge(1024, 620, VIDE)).png().toFile('assets/icon-foreground.png');

// Écran de démarrage : fond crème + logo au centre
for (const nom of ['splash.png', 'splash-dark.png']) await (await avecMarge(2732, 1000)).png().toFile('assets/' + nom);
console.log('Images générées à partir du logo ✔');

// Bannière de l'école (assets/banniere.png) en haut de la page de connexion, sans sa ligne d'adresses en bas
{
  const b = await sharp('assets/banniere.png').metadata();
  await sharp('assets/banniere.png').extract({ left: 0, top: 0, width: b.width, height: Math.round(b.height * 0.9) })
    .resize(1000).webp({ quality: 78 }).toFile('www/img/banniere.webp');
  console.log('Bannière générée ✔');
}

// Petite icône des notifications (barre d'état) : une empreinte de pied (« le premier pas »),
// en blanc sur fond transparent (Android n'affiche que la silhouette de cette icône)
const EMPREINTE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#fff">
  <path d="M38 40c10-3 22 1 25 12 3 10-1 18-2 26-1 10-6 18-16 18S30 89 30 78c0-8 4-13 2-21-2-8-3-14 6-17z"/>
  <ellipse cx="62" cy="31" rx="8" ry="10"/><ellipse cx="47" cy="25" rx="6.5" ry="8"/><ellipse cx="34" cy="25" rx="5.5" ry="6.5"/>
  <ellipse cx="24" cy="31" rx="4.5" ry="5.5"/><ellipse cx="17" cy="40" rx="4" ry="4.5"/></svg>`;
const badge = taille => sharp(Buffer.from(EMPREINTE), { density: 72 * taille / 100 * 4 }).resize(taille, taille).png();
await badge(96).toFile('www/icons/badge-96.png');
for (const [dossier, taille] of [['mdpi', 24], ['hdpi', 36], ['xhdpi', 48], ['xxhdpi', 72], ['xxxhdpi', 96]]) {
  mkdirSync(`android/app/src/main/res/drawable-${dossier}`, { recursive: true });
  await badge(taille).toFile(`android/app/src/main/res/drawable-${dossier}/ic_stat_notif.png`);
}
console.log('Icône des notifications générée ✔');
