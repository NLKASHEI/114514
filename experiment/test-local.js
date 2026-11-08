// 本地自测：不依赖酒馆环境，用 vm 模拟事件与变量
// 用法：node experiment/test-local.js [聊天存档.jsonl]
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '道渊MVU注入特化.js'), 'utf8');

function loadChat(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const raw = lines.slice(1).map((l) => JSON.parse(l));
  return raw.map((m) => ({
    is_user: !!m.is_user,
    is_system: !!m.is_system,
    mes: m.mes || '',
    variables: m.variables || null,
  }));
}

function fakeChat() {
  const long = '这是一段很长的外观描写，'.repeat(6);
  const mk = (t, hp) => ({
    世界: { 当前时间: t, 当前地点: '中央神州·神都·凤仪宫·寝殿', 危机程度: '低', 遭遇冷却: 7, 动向: {} },
    主角: { 姓名: '沈道渊', 生命: hp, 灵力: 66, 修为: 42, 境界: '筑基初期（DC:25）', 容貌: long },
    道侣: {
      苏清雪: { 性别: '女', 种族: '人族', 境界: '筑基后期', 亲密: 72, 状态: '正常', 修为: 30, 外观: long, 背景: long, 心声: long },
      白薇: { 性别: '女', 种族: '人族', 境界: '金丹初期', 亲密: 40, 状态: '正常', 修为: 12, 外观: long, 背景: long, 心声: long },
    },
    灵宠: {}, 人物: { 青练: { 性别: '女', 头衔: '妖圣', 境界: '大乘', 好感: 88, 关系阶段: '信任期', 描述: long } },
    机遇: {}, 绝色榜: { 朱离: { 排名: '五', 头衔: '湮丹宗圣女', 仙姿: long, 群芳谱: long } },
    玉简: {}, '$器灵台词': ['主人，这炉丹药火候快过了。'],
  });
  return {
    chat: [
      { is_user: false, is_system: false, mes: '苏清雪看着你，指尖点在案上。', variables: { 0: { stat_data: mk('元会历·3728年·5月15日·14点30分', 88) } } },
      { is_user: true, is_system: false, mes: '我把她按在案上。', variables: null },
      { is_user: false, is_system: false, mes: '苏清雪低喘，青练在门外。', variables: { 0: { stat_data: mk('元会历·3728年·5月15日·14点15分', 68) } } },
    ],
  };
}

const file = process.argv[2];
const chat = file ? loadChat(file) : fakeChat().chat;

const withStat = chat.filter((m) => m.variables && m.variables['0'] && m.variables['0'].stat_data);
const cur = withStat[withStat.length - 1].variables['0'].stat_data;
const prev = withStat[Math.max(0, withStat.length - 2)].variables['0'].stat_data;

const handlers = {};
const ctx = {
  console, JSON, Math, Date, Object, Array, String, Number, Set, Map, RegExp, isFinite,
  waitGlobalInitialized: async () => {},
  eventOn: (n, f) => { (handlers[n] = handlers[n] || []).push(f); },
  tavern_events: { CHAT_COMPLETION_SETTINGS_READY: 'ready', CHAT_CHANGED: 'changed' },
  SillyTavern: { chat },
  Mvu: { getMvuData: () => ({ stat_data: cur }), events: { BEFORE_MESSAGE_UPDATE: 'before' } },
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
  const content = messages[1].content;
  console.log(content.length > 2600 ? content.slice(0, 2600) + '\n…（截断显示）' : content);

  // 时间守卫自测
  ctx.window.DaoYuanEXPR.set({ timeFix: true });
  const vars = { stat_data: JSON.parse(JSON.stringify(cur)), 世界: {} };
  handlers.before && handlers.before.forEach((f) => f({ stat_data: { 世界: { 当前时间: '元会历·3728年·5月15日·14点00分' } } }, 3));
  console.log('--- 时间守卫（开启 timeFix） ---');
  console.log('回滚标记：', ctx.window.__DAOYUAN_EXPR_FIX || '(未触发)');
}, 30);
