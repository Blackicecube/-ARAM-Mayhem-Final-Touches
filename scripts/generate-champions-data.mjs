/**
 * Generates js/champions-data.js from Riot Data Dragon (same source as in-game art).
 * Reference: https://wiki.leagueoflegends.com/en-us/List_of_champions (roster alignment).
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = '14.8.1';
const OUT = path.join(__dirname, '..', 'js', 'champions-data.js');

const WIKI_REF = 'https://wiki.leagueoflegends.com/en-us/List_of_champions';

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => resolve(d));
      })
      .on('error', reject);
  });
}

function mapTagsToRoles(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => t.toLowerCase());
}

/** Healer / high sustain support fantasy */
const HEALER_IDS = new Set([
  'soraka',
  'yuumi',
  'sona',
  'nami',
  'taric',
  'karma',
  'renata',
  'milio',
  'ivern',
  'janna',
  'lulu',
  'bard',
  'seraphine',
  'kayle',
  'senna',
]);

const STEALTH_IDS = new Set([
  'twitch',
  'evelynn',
  'shaco',
  'akali',
  'khazix',
  'teemo',
  'pyke',
  'reksai',
  'viego',
  'akshan',
  'kayn',
]);

const ARTILLERY_IDS = new Set([
  'xerath',
  'ziggs',
  'velkoz',
  'jayce',
  'varus',
  'ezreal',
  'aphelios',
  'jhin',
  'caitlyn',
  'brand',
  'lux',
  'zoe',
  'zyra',
  'corki',
]);

const EXODIA_IDS = new Set([
  'kogmaw',
  'kayle',
  'veigar',
  'nasus',
  'sion',
  'kindred',
  'senna',
  'viego',
  'belveth',
]);

const HYBRID_IDS = new Set([
  'jayce',
  'ezreal',
  'corki',
  'kaisa',
  'varus',
  'nidalee',
  'gnar',
]);

const DRAINTANK_IDS = new Set([
  'aatrox',
  'swain',
  'vladimir',
  'mordekaiser',
  'illaoi',
  'warwick',
  'maokai',
  'drmundo',
  'urgot',
  'trundle',
]);

function inferPlaystyleTags({ id, roles }) {
  const r = roles;
  const out = [];
  const add = (s) => {
    if (!out.includes(s)) out.push(s);
  };

  if (r.includes('tank')) add('tank');
  if (r.includes('fighter')) add('fighter');
  if (r.includes('marksman')) add('marksman');

  if (r.includes('fighter') && r.includes('assassin')) add('dive-bomber');

  if (r.includes('mage') && r.includes('fighter')) add('battlemage');
  else if (r.includes('mage') && r.includes('tank')) add('battlemage');
  else if (r.includes('mage') && r.includes('assassin')) add('battlemage');
  else if (r.includes('mage') && !r.includes('assassin')) add('battlemage');

  if (HEALER_IDS.has(id)) add('healer');
  if (STEALTH_IDS.has(id)) add('stealthy');
  if (ARTILLERY_IDS.has(id)) add('artillery');
  if (EXODIA_IDS.has(id)) add('exodia');
  if (HYBRID_IDS.has(id)) add('hybrid-build');
  if (DRAINTANK_IDS.has(id)) add('draintank');

  if (out.length === 0) {
    if (r.length === 1 && r[0] === 'assassin') add('dive-bomber');
    else if (r.includes('support')) add('healer');
    else if (r.includes('tank')) add('tank');
    else if (r.includes('fighter')) add('fighter');
    else if (r.includes('marksman')) add('marksman');
    else if (r.includes('mage')) add('battlemage');
  }

  return out;
}

const json = await get(
  `https://ddragon.leagueoflegends.com/cdn/${VERSION}/data/en_US/champion.json`
);
const data = JSON.parse(json).data;
const keys = Object.keys(data).sort((a, b) =>
  data[a].name.localeCompare(data[b].name, 'en')
);

const list = keys.map((k) => {
  const c = data[k];
  const ddragonId = c.id;
  const slug = ddragonId.toLowerCase();
  const title = (c.title || '').replace(/^the /i, '').trim();
  const name = c.name;
  const tags = c.tags || [];
  const roles = mapTagsToRoles(tags);
  const icon = `https://ddragon.leagueoflegends.com/cdn/${VERSION}/img/champion/${ddragonId}.png`;
  const splash = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${ddragonId}_0.jpg`;
  const loading = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${ddragonId}_0.jpg`;
  const base = { id: slug, ddragonId, name, title, roles, tags, icon, splash, loading };
  return { ...base, playstyleTags: inferPlaystyleTags({ id: slug, roles }) };
});

const lines = [];
lines.push(`/**`);
lines.push(` * Full League roster for ARAM Bound (static site).`);
lines.push(` * Icons & splash art: Riot Data Dragon ${VERSION}.`);
lines.push(` * Champion list aligns with: ${WIKI_REF}`);
lines.push(` * Do not edit by hand — run: node scripts/generate-champions-data.mjs`);
lines.push(` */`);
lines.push(`var ARAM_CHAMPION_DDRAGON_VERSION = '${VERSION}';`);
lines.push(
  `/** @type {{ id: string, ddragonId: string, name: string, title: string, roles: string[], tags: string[], playstyleTags: string[], icon: string, splash: string, loading: string }[]} */`
);
lines.push(`var ARAM_CHAMPIONS = ${JSON.stringify(list)};`);
lines.push(`/** @type {Record<string, typeof ARAM_CHAMPIONS[0]>} */`);
lines.push(`var ARAM_CHAMPIONS_BY_ID = Object.fromEntries(ARAM_CHAMPIONS.map((c) => [c.id, c]));`);

fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
console.log(`Wrote ${list.length} champions to ${OUT}`);
