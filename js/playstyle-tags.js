/**
 * Champion/build tags: class roles (Mage, Assassin, Support, Fighter, Marksman, Tank) + playstyle buckets.
 * Champions page + create-build use ARAM_BUILD_TAG_BY_SLUG (role vs playstyle category for styling).
 */
var ARAM_ROLE_TAG_LIST = [
  { slug: 'mage', label: 'Mage' },
  { slug: 'assassin', label: 'Assassin' },
  { slug: 'support', label: 'Support' },
  { slug: 'fighter', label: 'Fighter' },
  { slug: 'marksman', label: 'Marksman' },
  { slug: 'tank', label: 'Tank' },
];

var ARAM_PLAYSTYLE_TAG_LIST = [
  { slug: 'healer', label: 'Healer' },
  { slug: 'stealthy', label: 'Stealthy' },
  { slug: 'hybrid-build', label: 'Hybrid build' },
  { slug: 'dive-bomber', label: 'Dive Bomber' },
  { slug: 'exodia', label: 'Exodia' },
  { slug: 'artillery', label: 'Artillery' },
  { slug: 'battlemage', label: 'Battlemage' },
  { slug: 'draintank', label: 'Draintank' },
];

var ARAM_BUILD_TAG_BY_SLUG = {};
ARAM_ROLE_TAG_LIST.forEach((t) => {
  ARAM_BUILD_TAG_BY_SLUG[t.slug] = { ...t, category: 'role' };
});
ARAM_PLAYSTYLE_TAG_LIST.forEach((t) => {
  ARAM_BUILD_TAG_BY_SLUG[t.slug] = { ...t, category: 'playstyle' };
});

/** Alias: same slug → label map including role + playstyle (legacy name). */
var ARAM_PLAYSTYLE_TAG_BY_SLUG = ARAM_BUILD_TAG_BY_SLUG;
