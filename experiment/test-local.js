// 本地自测：不依赖酒馆环境，用 vm 模拟事件与变量
// 用法：node experiment/test-local.js [聊天存档.jsonl]
const assert = require('node:assert/strict');
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
const logs = [];
const consoleWrites = [];
const stateBlock = '【以下内容仅供参考，严禁出现在正文！】\n<status_current_variables>\n' +
  JSON.stringify(cur) + '\n</status_current_variables>\n【以上内容仅供参考，严禁出现在正文！】';
const ctx = {
  console: Object.fromEntries(['log', 'info', 'warn', 'error'].map(level => [level, (...args) => consoleWrites.push(args)])),
  _th_impl: { _log: (name, level, text) => logs.push({ name, level, text }) },
  JSON, Math, Date, Object, Array, String, Number, Set, Map, RegExp, isFinite,
  waitGlobalInitialized: async () => {},
  eventOn: (n, f) => { (handlers[n] = handlers[n] || []).push(f); },
  tavern_events: {
    CHAT_COMPLETION_SETTINGS_READY: 'ready',
    GENERATION_AFTER_COMMANDS: 'main',
    GENERATION_ENDED: 'main-ended',
    GENERATION_STOPPED: 'stopped',
    MESSAGE_RECEIVED: 'message-received',
    CHAT_CHANGED: 'changed',
  },
  SillyTavern: { chat },
  Mvu: { getMvuData: () => ({ stat_data: cur }), events: { BEFORE_MESSAGE_UPDATE: 'before', VARIABLE_UPDATE_ENDED: 'ended', COMMAND_PARSED: 'parsed' } },
  getVariables: () => ({ stat_data: cur }),
  document: { body: null, getElementById: () => null },
  navigator: {},
  setTimeout,
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx);

setTimeout(() => {
  const messages = [
    { role: 'user', content: 'x' },
    { role: 'system', content: stateBlock },
    { role: 'user', content: 'continue' },
  ];
  const fire = (event, ...args) => (handlers[event] || []).forEach(fn => fn(...args));
  const currentBeforeProjection = JSON.stringify(cur);
  fire('main', 'normal', {}, false);
  fire('ready', { messages });
  assert.equal(JSON.stringify(cur), currentBeforeProjection);

  console.log('--- stats ---');
  console.log(ctx.window.DaoYuanEXPR.stats());
  assert.notEqual(messages[1].content, stateBlock);
  assert.doesNotMatch(messages[1].content, /<mvu变量上一轮次修改日志>/);
  assert.ok(logs.some(log => log.text.includes('正文状态投影')));
  assert.equal(consoleWrites.length, 0);
  console.log('--- 注入内容 ---');
  const content = messages[1].content;
  console.log(content.length > 2600 ? content.slice(0, 2600) + '\n…（截断显示）' : content);

  // ── 在场延续自测 ──
  function projectText() {
    const m = [
      { role: 'user', content: 'x' },
      { role: 'system', content: stateBlock },
      { role: 'user', content: 'continue' },
    ];
    fire('main', 'normal', {}, false);
    fire('ready', { messages: m });
    return m[1].content;
  }
  function isFull(text, name) {
    const lines = text.split('\n');
    const i = lines.findIndex((l) => l === '  ' + name + ':');
    if (i < 0) return null;
    const block = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^ {0,2}[^\s]/.test(lines[j])) break;
      block.push(lines[j]);
    }
    return !block.join('\n').includes('在场: false');
  }

  const chat2 = ctx.SillyTavern.chat;
  chat2[chat2.length - 1].mes = '白薇推门进来，压低声音说了一句话。';
  const t1 = projectText();
  chat2[chat2.length - 1].mes = '你们继续赶路。';
  const t2 = projectText();
  const t3 = projectText();
  const t4 = projectText();
  console.log('--- 在场延续（白薇只在第1轮被提到） ---');
  console.log('第1轮 提到 → 全文:', isFull(t1, '白薇'));
  console.log('第2轮 未提 → 全文:', isFull(t2, '白薇'), '（延续中）');
  console.log('第3轮 未提 → 全文:', isFull(t3, '白薇'), '（延续第2轮）');
  console.log('第4轮 未提 → 全文:', isFull(t4, '白薇'), '（应压成摘要）');
  console.log('当前在场名单:', ctx.window.DaoYuanEXPR.who());
  if (!file) assert.deepEqual([t1, t2, t3, t4].map(text => isFull(text, '白薇')), [true, true, true, false]);

  // 时间守卫自测
  ctx.window.DaoYuanEXPR.set({ timeFix: true });
  handlers.before && handlers.before.forEach((f) => f({ stat_data: { 世界: { 当前时间: '元会历·3728年·5月15日·14点00分' } } }, 3));
  console.log('--- 时间守卫（开启 timeFix） ---');
  console.log('回滚标记：', ctx.window.__DAOYUAN_EXPR_FIX || '(未触发)');

  // ── 更新块捕获自测 ──
  const block = [
    '<UpdateVariable>',
    '<Analysis>',
    '世界.当前时间: Y',
    '</Analysis>',
    '<JSONPatch>',
    JSON.stringify([
      { op: 'replace', path: '/世界/当前时间', value: '元会历·3728年·5月16日·15点30分' },
      { op: 'delta', path: '/主角/生命', value: -20 },
      { op: 'insert', path: '/人物/青练', value: { 好感: 90 } },
    ], null, 2),
    '</JSONPatch>',
    '</UpdateVariable>',
  ].join('\n');
  const lastMsg = chat[chat.length - 1];
  lastMsg.mes = '正文……\n\n' + block;

  const nextState = JSON.parse(JSON.stringify(cur));
  nextState.主角.生命 = (nextState.主角.生命 || 100) - 20;
  nextState.世界.当前时间 = '元会历·3728年·5月16日·15点30分';

  const nextVariables = { stat_data: { ...nextState, $internal: { temp: true } } };
  const parsedCommands = [
    { type: 'replace', args: ['/世界/当前时间'] },
    { type: 'delta', args: ['/主角/生命'] },
  ];
  // Streaming may unlock the UI before emitting MESSAGE_RECEIVED.
  fire('main-ended');
  fire('message-received', chat.length - 1, 'normal');
  // A later native generation can start while the earlier MVU update is still pending.
  fire('main', 'normal', {}, false);
  const preliminary = { stat_data: cur };
  fire('parsed', preliminary, [], 'unrelated MVU update');
  fire('ended', preliminary, { stat_data: cur });
  assert.ok(logs.at(-1).text.endsWith('没有此楼层的正文投影记录'));
  fire('parsed', nextVariables, parsedCommands, lastMsg.mes);
  parsedCommands.length = 0;
  fire('ended', nextVariables, { stat_data: cur });
  const payloadBlockLength = text => text.match(/<status_current_variables>[\s\S]*?<\/status_current_variables>/)[0].length;
  const beforeChars = payloadBlockLength(stateBlock);
  const afterChars = payloadBlockLength(t4);
  assert.ok(logs.some(log => log.text.endsWith('MVU 变量结算：2 条命令，2 组变化 ｜ 正文状态压缩：' +
    beforeChars + ' → ' + afterChars + ' 字，节省 ' + (beforeChars - afterChars) + ' 字')));
  fire('ended', nextVariables, { stat_data: cur });
  assert.ok(logs.at(-1).text.endsWith('没有此楼层的正文投影记录'));
  assert.ok(!logs.some(log => log.text.includes('$internal')));
  console.log('--- 额外模型输出（更新块）---');
  console.log(ctx.window.DaoYuanEXPR.update().split('\n').slice(0, 14).join('\n'));

  // 落地更新之后，下一次请求的日志应该基于这次更新
  ctx.window.DaoYuanEXPR.set({ log: true });
  const after = projectText();
  const logBlock = (after.match(/<mvu变量上一轮次修改日志>[\s\S]*?<\/mvu变量上一轮次修改日志>/) || [''])[0];
  console.log('--- 落地更新后的日志 ---');
  console.log(logBlock || '(无)');
  if (!file) assert.match(logBlock, /生命-20/);
  assert.match(ctx.window.DaoYuanEXPR.update(), /正文状态压缩/);

  const messagesWithoutState = [{ role: 'system', content: '记忆插件请求' }];
  fire('main', 'normal', {}, false);
  fire('ready', { messages: messagesWithoutState });
  assert.equal(messagesWithoutState.length, 1);
  chat.push({ mes: '未压缩的新回复', is_user: false });
  fire('message-received', chat.length - 1, 'normal');
  fire('parsed', nextVariables, [], chat.at(-1).mes);
  fire('ended', nextVariables, { stat_data: cur });
  assert.ok(logs.at(-1).text.endsWith('节省 0 字（未找到道渊状态块）'));
  chat.pop();
  fire('main', 'normal', {}, false);

  const extraMarker = { role: 'system', content: '<past_observe>' };
  const extraMessages = [{ role: 'system', content: stateBlock }, extraMarker];
  fire('ready', { messages: extraMessages });
  assert.equal(extraMessages[0].content, stateBlock);
  const piMessages = [{ role: 'system', content: stateBlock }];
  fire('ready', { messages: piMessages, model: 'mvu-pi-prompt-capture:pi-1' });
  assert.equal(piMessages[0].content, stateBlock);
  fire('ready', { messages: piMessages, dryRun: true });
  assert.equal(piMessages[0].content, stateBlock);

  const pluginPrompt = [{ role: 'system', content: stateBlock }];
  fire('js_generation_requested', 'memory-overlap', 'generateRaw', { ordered_prompts: pluginPrompt });
  fire('ready', { messages: pluginPrompt });
  assert.equal(pluginPrompt[0].content, stateBlock, 'a copied status block stays unchanged during a native generation');
  const nativePrompt = [{ role: 'system', content: stateBlock }];
  fire('ready', { messages: nativePrompt });
  assert.notEqual(nativePrompt[0].content, stateBlock, 'the pending native generation still projects');
  const memoryOnly = [{ role: 'system', content: stateBlock }];
  fire('ready', { messages: memoryOnly });
  assert.equal(memoryOnly[0].content, stateBlock, 'no projection without a native generation');

  const ambiguousPrompt = [{ role: 'system', content: stateBlock + '\n' + stateBlock }];
  fire('main', 'swipe', {}, false);
  fire('ready', { messages: ambiguousPrompt });
  assert.equal(ambiguousPrompt[0].content, stateBlock + '\n' + stateBlock);
  fire('main-ended');
  fire('main', 'quiet', {}, false);
  fire('ready', { messages: memoryOnly });
  assert.equal(memoryOnly[0].content, stateBlock, 'quiet requests are not native narrative');

  fire('js_generation_requested', 'other', 'generate', { injects: [] });
  fire('js_generation_ended', '不属于额外模型', 'other');
  const malformed = '没有闭合的<UpdateVariable>\n' + '甲'.repeat(61000) + '\n末尾完整';
  fire('js_generation_requested', 'legacy', 'generateRaw', { ordered_prompts: [extraMarker] });
  fire('js_generation_ended', malformed, 'legacy');
  assert.ok(logs.some(log => log.text.endsWith('收到回复 ' + malformed.length + ' 字')));
  assert.ok(!logs.some(log => log.text.includes(malformed)));
  assert.ok(!logs.some(log => log.text.includes('不属于额外模型')));

  const diagnostic = 'daoyuan_mvu_extra_model_diagnostic';
  fire(diagnostic, { generationId: 'ok', status: 'started' });
  fire(diagnostic, { generationId: 'ok', status: 'accepted', response: '成功原文不可见' });
  assert.ok(!logs.some(log => log.text.includes('成功原文不可见')));

  const toolResult = { content: malformed, tool_calls: [{ function: { arguments: '{broken' } }] };
  fire(diagnostic, { generationId: 'pi-1', status: 'started' });
  fire('js_generation_requested', 'pi-1', 'generateRaw', { ordered_prompts: [extraMarker] });
  fire('js_generation_ended', '占位请求内容', 'pi-1');
  fire(diagnostic, { generationId: 'pi-1', status: 'rejected', error: '格式不符', response: toolResult });
  assert.ok(logs.some(log => log.level === 'error' && log.text.endsWith(JSON.stringify(toolResult, null, 2))));
  assert.ok(!logs.some(log => log.text.includes('占位请求内容')));

  fire(diagnostic, { generationId: 'empty', status: 'started' });
  fire(diagnostic, { generationId: 'empty', status: 'rejected', response: '' });
  assert.ok(logs.some(log => log.text.endsWith('（模型返回空字符串）')));

  fire(diagnostic, { generationId: 'cancelled', status: 'started' });
  fire('changed');
  fire(diagnostic, { generationId: 'cancelled', status: 'rejected', response: '上一个聊天的回复' });
  assert.ok(!logs.some(log => log.text.includes('上一个聊天的回复')));
  assert.equal(consoleWrites.length, 0);
  console.log('PASS：投影范围、静默日志、完整失败原文、并发请求编号和切换聊天隔离');
}, 30);
