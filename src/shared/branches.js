/**
 * Extensible SCP Foundation branch registry.
 * To add a new branch (e.g., Japanese 'jp' or Korean 'ko'), call registerBranch({ ... })
 * or add an entry to DEFAULT_BRANCHES below.
 */

const DEFAULT_BRANCHES = [
  {
    id: 'cn',
    code: 'CN',
    names: {
      'zh-CN': '中文分部',
      'en-US': 'Chinese (CN)'
    },
    defaultBaseUrl: 'https://scp-wiki-cn.wikidot.com',
    cromBaseUrl: 'http://scp-wiki-cn.wikidot.com',
    hostMatchers: ['scp-wiki-cn.wikidot.com', 'scp-wiki-cn.org'],
    hasOriginalSeries: true,
    tagMap: {
      scp: ['scp'],
      original: ['scp', '原创'],
      tale: ['故事'],
      safe: ['scp', 'safe'],
      euclid: ['scp', 'euclid'],
      keter: ['scp', 'keter'],
      thaumiel: ['scp', 'thaumiel'],
      joke: ['搞笑']
    },
    quickTags: [
      { tag: 'safe', labels: { 'zh-CN': 'Safe', 'en-US': 'Safe' } },
      { tag: 'euclid', labels: { 'zh-CN': 'Euclid', 'en-US': 'Euclid' } },
      { tag: 'keter', labels: { 'zh-CN': 'Keter', 'en-US': 'Keter' } },
      { tag: 'thaumiel', labels: { 'zh-CN': 'Thaumiel', 'en-US': 'Thaumiel' } },
      { tag: '原创', labels: { 'zh-CN': '中分原创', 'en-US': 'CN Original' } },
      { tag: '故事', labels: { 'zh-CN': '外围故事', 'en-US': 'Tales' } },
      { tag: '模因', labels: { 'zh-CN': '模因', 'en-US': 'Memetic' } },
      { tag: '搞笑', labels: { 'zh-CN': '搞笑', 'en-US': 'Joke' } },
      { tag: '精品', labels: { 'zh-CN': '精品', 'en-US': 'Featured' } }
    ],
    series: [
      { group: { 'zh-CN': '主系列 (翻译)', 'en-US': 'Main Series (CN)' }, slug: 'scp-series', labels: { 'zh-CN': '系列 I (001–999)', 'en-US': 'Series I (001–999)' } },
      { group: { 'zh-CN': '主系列 (翻译)', 'en-US': 'Main Series (CN)' }, slug: 'scp-series-2', labels: { 'zh-CN': '系列 II (1000–1999)', 'en-US': 'Series II (1000–1999)' } },
      { group: { 'zh-CN': '主系列 (翻译)', 'en-US': 'Main Series (CN)' }, slug: 'scp-series-3', labels: { 'zh-CN': '系列 III (2000–2999)', 'en-US': 'Series III (2000–2999)' } },
      { group: { 'zh-CN': '主系列 (翻译)', 'en-US': 'Main Series (CN)' }, slug: 'scp-series-4', labels: { 'zh-CN': '系列 IV (3000–3999)', 'en-US': 'Series IV (3000–3999)' } },
      { group: { 'zh-CN': '主系列 (翻译)', 'en-US': 'Main Series (CN)' }, slug: 'scp-series-5', labels: { 'zh-CN': '系列 V (4000–4999)', 'en-US': 'Series V (4000–4999)' } },
      { group: { 'zh-CN': '主系列 (翻译)', 'en-US': 'Main Series (CN)' }, slug: 'scp-series-6', labels: { 'zh-CN': '系列 VI (5000–5999)', 'en-US': 'Series VI (5000–5999)' } },
      { group: { 'zh-CN': '主系列 (翻译)', 'en-US': 'Main Series (CN)' }, slug: 'scp-series-7', labels: { 'zh-CN': '系列 VII (6000–6999)', 'en-US': 'Series VII (6000–6999)' } },
      { group: { 'zh-CN': '主系列 (翻译)', 'en-US': 'Main Series (CN)' }, slug: 'scp-series-8', labels: { 'zh-CN': '系列 VIII (7000–7999)', 'en-US': 'Series VIII (7000–7999)' } },
      { group: { 'zh-CN': '主系列 (翻译)', 'en-US': 'Main Series (CN)' }, slug: 'scp-series-9', labels: { 'zh-CN': '系列 IX (8000–8999)', 'en-US': 'Series IX (8000–8999)' } },
      { group: { 'zh-CN': '主系列 (翻译)', 'en-US': 'Main Series (CN)' }, slug: 'scp-series-10', labels: { 'zh-CN': '系列 X (9000–9999)', 'en-US': 'Series X (9000–9999)' } },
      { group: { 'zh-CN': '中文分部原创', 'en-US': 'CN Original Series' }, slug: 'scp-series-cn', labels: { 'zh-CN': 'CN 系列 I (CN-001–999)', 'en-US': 'CN Series I (CN-001–999)' } },
      { group: { 'zh-CN': '中文分部原创', 'en-US': 'CN Original Series' }, slug: 'scp-series-cn-2', labels: { 'zh-CN': 'CN 系列 II (CN-1000–1999)', 'en-US': 'CN Series II (CN-1000–1999)' } },
      { group: { 'zh-CN': '中文分部原创', 'en-US': 'CN Original Series' }, slug: 'scp-series-cn-3', labels: { 'zh-CN': 'CN 系列 III (CN-2000–2999)', 'en-US': 'CN Series III (CN-2000–2999)' } },
      { group: { 'zh-CN': '中文分部原创', 'en-US': 'CN Original Series' }, slug: 'scp-series-cn-4', labels: { 'zh-CN': 'CN 系列 IV (CN-3000–3999)', 'en-US': 'CN Series IV (CN-3000–3999)' } },
      { group: { 'zh-CN': '特殊与专题', 'en-US': 'Special' }, slug: 'scp-001', labels: { 'zh-CN': 'SCP-001 提案合集', 'en-US': 'SCP-001 Proposals' } },
      { group: { 'zh-CN': '特殊与专题', 'en-US': 'Special' }, slug: 'scp-cn-001', labels: { 'zh-CN': 'SCP-CN-001 提案合集', 'en-US': 'SCP-CN-001 Proposals' } },
      { group: { 'zh-CN': '特殊与专题', 'en-US': 'Special' }, slug: 'joke-scps', labels: { 'zh-CN': '搞笑 SCP (-J)', 'en-US': 'Joke SCPs (-J)' } },
      { group: { 'zh-CN': '特殊与专题', 'en-US': 'Special' }, slug: 'joke-scps-cn', labels: { 'zh-CN': 'CN 搞笑 SCP (-CN-J)', 'en-US': 'CN Joke SCPs (-CN-J)' } },
      { group: { 'zh-CN': '特殊与专题', 'en-US': 'Special' }, slug: 'scp-ex', labels: { 'zh-CN': '已解明 SCP (-EX)', 'en-US': 'Explained SCPs (-EX)' } },
      { group: { 'zh-CN': '特殊与专题', 'en-US': 'Special' }, slug: 'scp-ex-cn', labels: { 'zh-CN': 'CN 已解明 SCP (-CN-EX)', 'en-US': 'CN Explained SCPs (-CN-EX)' } }
    ]
  },
  {
    id: 'en',
    code: 'EN',
    names: {
      'zh-CN': '英文主站',
      'en-US': 'English (EN)'
    },
    defaultBaseUrl: 'https://scp-wiki.wikidot.com',
    cromBaseUrl: 'http://scp-wiki.wikidot.com',
    hostMatchers: ['scp-wiki.wikidot.com', 'scpwiki.com', 'www.scpwiki.com'],
    hasOriginalSeries: false,
    tagMap: {
      scp: ['scp'],
      original: ['scp'],
      tale: ['tale'],
      safe: ['scp', 'safe'],
      euclid: ['scp', 'euclid'],
      keter: ['scp', 'keter'],
      thaumiel: ['scp', 'thaumiel'],
      joke: ['joke']
    },
    quickTags: [
      { tag: 'safe', labels: { 'zh-CN': 'Safe', 'en-US': 'Safe' } },
      { tag: 'euclid', labels: { 'zh-CN': 'Euclid', 'en-US': 'Euclid' } },
      { tag: 'keter', labels: { 'zh-CN': 'Keter', 'en-US': 'Keter' } },
      { tag: 'thaumiel', labels: { 'zh-CN': 'Thaumiel', 'en-US': 'Thaumiel' } },
      { tag: 'tale', labels: { 'zh-CN': 'Tales', 'en-US': 'Tales' } },
      { tag: 'memetic', labels: { 'zh-CN': 'Memetic', 'en-US': 'Memetic' } },
      { tag: 'cognitohazard', labels: { 'zh-CN': 'Cognitohazard', 'en-US': 'Cognitohazard' } },
      { tag: 'joke', labels: { 'zh-CN': 'Joke', 'en-US': 'Joke' } }
    ],
    series: [
      { group: { 'zh-CN': '主系列', 'en-US': 'Main Series' }, slug: 'scp-series', labels: { 'zh-CN': 'Series I (001–999)', 'en-US': 'Series I (001–999)' } },
      { group: { 'zh-CN': '主系列', 'en-US': 'Main Series' }, slug: 'scp-series-2', labels: { 'zh-CN': 'Series II (1000–1999)', 'en-US': 'Series II (1000–1999)' } },
      { group: { 'zh-CN': '主系列', 'en-US': 'Main Series' }, slug: 'scp-series-3', labels: { 'zh-CN': 'Series III (2000–2999)', 'en-US': 'Series III (2000–2999)' } },
      { group: { 'zh-CN': '主系列', 'en-US': 'Main Series' }, slug: 'scp-series-4', labels: { 'zh-CN': 'Series IV (3000–3999)', 'en-US': 'Series IV (3000–3999)' } },
      { group: { 'zh-CN': '主系列', 'en-US': 'Main Series' }, slug: 'scp-series-5', labels: { 'zh-CN': 'Series V (4000–4999)', 'en-US': 'Series V (4000–4999)' } },
      { group: { 'zh-CN': '主系列', 'en-US': 'Main Series' }, slug: 'scp-series-6', labels: { 'zh-CN': 'Series VI (5000–5999)', 'en-US': 'Series VI (5000–5999)' } },
      { group: { 'zh-CN': '主系列', 'en-US': 'Main Series' }, slug: 'scp-series-7', labels: { 'zh-CN': 'Series VII (6000–6999)', 'en-US': 'Series VII (6000–6999)' } },
      { group: { 'zh-CN': '主系列', 'en-US': 'Main Series' }, slug: 'scp-series-8', labels: { 'zh-CN': 'Series VIII (7000–7999)', 'en-US': 'Series VIII (7000–7999)' } },
      { group: { 'zh-CN': '主系列', 'en-US': 'Main Series' }, slug: 'scp-series-9', labels: { 'zh-CN': 'Series IX (8000–8999)', 'en-US': 'Series IX (8000–8999)' } },
      { group: { 'zh-CN': '主系列', 'en-US': 'Main Series' }, slug: 'scp-series-10', labels: { 'zh-CN': 'Series X (9000–9999)', 'en-US': 'Series X (9000–9999)' } },
      { group: { 'zh-CN': '特殊与专题', 'en-US': 'Special' }, slug: 'scp-001', labels: { 'zh-CN': 'SCP-001 Proposals', 'en-US': 'SCP-001 Proposals' } },
      { group: { 'zh-CN': '特殊与专题', 'en-US': 'Special' }, slug: 'joke-scps', labels: { 'zh-CN': 'Joke SCPs (-J)', 'en-US': 'Joke SCPs (-J)' } },
      { group: { 'zh-CN': '特殊与专题', 'en-US': 'Special' }, slug: 'scp-ex', labels: { 'zh-CN': 'Explained SCPs (-EX)', 'en-US': 'Explained SCPs (-EX)' } },
      { group: { 'zh-CN': '特殊与专题', 'en-US': 'Special' }, slug: 'archived-scps', labels: { 'zh-CN': 'Archived SCPs (-ARC)', 'en-US': 'Archived SCPs (-ARC)' } }
    ]
  }
];

/*
 * Example for adding Japanese branch in the future:
 * registerBranch({
 *   id: 'jp',
 *   code: 'JP',
 *   names: { 'zh-CN': '日文分部', 'en-US': 'Japanese (JP)', 'ja-JP': '日本支部' },
 *   defaultBaseUrl: 'https://scp-jp.wikidot.com',
 *   cromBaseUrl: 'http://scp-jp.wikidot.com',
 *   hostMatchers: ['scp-jp.wikidot.com'],
 *   hasOriginalSeries: true,
 *   tagMap: { scp: ['scp'], original: ['scp', 'jp'], tale: ['tale'], safe: ['scp', 'safe'], euclid: ['scp', 'euclid'], keter: ['scp', 'keter'], thaumiel: ['scp', 'thaumiel'], joke: ['joke'] },
 *   quickTags: [...],
 *   series: [{ group: { 'ja-JP': 'メインシリーズ', 'en-US': 'Main Series' }, slug: 'scp-series', labels: { 'ja-JP': 'シリーズ I', 'en-US': 'Series I' } }, ...]
 * });
 */

const branchRegistry = new Map();
for (const b of DEFAULT_BRANCHES) {
  branchRegistry.set(b.id, b);
}

function registerBranch(branchConfig) {
  if (!branchConfig || !branchConfig.id) {
    throw new Error('Branch config must include an id');
  }
  branchRegistry.set(branchConfig.id, branchConfig);
  return branchConfig;
}

function getBranch(id) {
  return branchRegistry.get(id) || branchRegistry.get('cn');
}

function listBranches() {
  return Array.from(branchRegistry.values());
}

module.exports = {
  DEFAULT_BRANCHES,
  registerBranch,
  getBranch,
  listBranches
};
