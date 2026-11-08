// 本地自测：不依赖酒馆环境，用 vm 模拟事件与变量
// 用法：node experiment/test-local.js [聊天存档.jsonl]
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const scriptPath = path.join(__dirname, '道渊MVU注入特化.js');
const code = fs.readFileSync(scriptPath, 'utf8');

function loadStat(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const msgs = lines.slice(1).map((l) => JSON.parse(l));
  const withStat = msgs.filter((m) => m.variables && m.variables['0'] && m.variables['0'].stat_data);
  if (!withStat.length) throw new Error('存档里没有 stat_data');
  return {
    cur: withStat[withStat.length - 1].variables['0'].stat_data,
    prev: withStat[Math.max(0, withStat.length - 2)].variables['0'].stat_data,
  };
}

const file = process.argv[2];
const fallback = {
  cur: { 世界: { 当前时间: '元会历·3728年·5月15日·14点15分', 当前地点: '中央神州·神都', 危机程度: '低', 遭遇冷却: 7, 动向: {} },
    主角: { 姓名: '沈道渊', 生命: 68, 修为: 42, 境界: '筑基初期（DC:25）', 容貌: '很长的描写'.repeat(10) },
    道侣: { 苏清雪: { 境界: '筑基后期', 亲密: 72, 外观: '很长的描写'.repeat(8), 心声: '很长的描写'.repeat(6) } },
    人物: {}, 机遇: {}, 绝色榜: {}, 玉简: {}, 灵宠: {}, '$器灵台词': ['主人'] },
  prev: null,
};
let data;
if (file) data = loadStat(file);
else {
  data = fallback;
  data.prev = JSON.parse(JSON.stringify(data.cur));
  data.prev.世界.当前时间 = '元会历·3728年·5月15日·14点30分';
  data.prev.主角.生命 = 88;
}
const cur = data.cur;
const prev = data.prev || cur;

const handlers = {};
const ctx = {
  console, JSON, Math, Date, Object, Array, String, Number, Set, Map, RegExp, isFinite,
  waitGlobalInitialized: async () => {},
  eventOn: (n, f) => { (handlers[n] = handlers[n] || []).push(f); },
  tavern_events: { CHAT_COMPLETION_SETTINGS_READY: 'ready', CHAT_CHANGED: 'changed' },
  SillyTavern: { chat: [
    { is_user: false, is_system: false, mes: 'prev', variables: { '0': { stat_data: prev } } },
    { is_user: true, mes: '...' },
    { is_user: false, is_system: false, mes: 'cur', variables: { '0': { stat_data: cur } } },
  ] },
  Mvu: { getMvuData: () => ({ stat_data: cur }) },
  getVariables: () => ({ stat_data: cur }),
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx);

setTimeout(() => {
  const messages = [
    { role: 'user', content: 'x' },
    { role: 'system', content: '<status_current_variables>\nRAW\n</status_current_variables>' },
    { role: 'user', content: 'continue' },
  ];
  handlers.ready.forEach((f) => f({ messages }));
  console.log('--- stats ---');
  console.log(ctx.window.DaoYuanEXPR.stats());
  console.log('--- 注入内容 ---');
  console.log(messages[1].content);
}, 30);
