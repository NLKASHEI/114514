// ═══════════════ 业火归途小助手 ═══════════════
// 酒馆助手中粘贴以下一行即可：
//   import 'https://cdn.jsdelivr.net/gh/Usersser/Path-Back-Through-Hellfire@v1.2.1/业火归途小助手.js'
// ═══════════════════════════════════════════════════════════
const EWC_VERSION = '1.2.1';
const WORLDBOOK_NAME = '缄默之秋·业火归途 1.3';
const p = window.parent || window;

{
  const old = ['ewc-bubble', 'ewc-panel', 'ewc-style'];
  for (const id of old) { const el = p.document.getElementById(id); if (el) el.remove(); }
  if (typeof p._ewcCleanup === 'function') try { p._ewcCleanup(); } catch(e) {}
  delete p._ewcCleanup;
  delete p._ewcLastResult;
}

function runInParent(code) {
  return new Promise((resolve, reject) => {
    const token = 'ewc_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const onResult = (e) => {
      if (!e.detail || e.detail.token !== token) return;
      p.document.removeEventListener('ewc-result', onResult);
      e.detail.error ? reject(new Error(e.detail.error)) : resolve(e.detail.result);
    };
    p.document.addEventListener('ewc-result', onResult);
    const s = p.document.createElement('script');
    s.textContent = `(async()=>{try{var _r=await(${code});document.dispatchEvent(new CustomEvent('ewc-result',{detail:{token:'${token}',result:_r}}));}catch(_e){document.dispatchEvent(new CustomEvent('ewc-result',{detail:{token:'${token}',error:_e.message||String(_e)}}));}})();`;
    p.document.body.appendChild(s);
    s.remove();
  });
}

function readStatData() {
  if (typeof p.Mvu === 'undefined') return null;

  for (let i = -1; i >= -30; i--) {
    try {
      const d = p.Mvu.getMvuData({ type: 'message', message_id: i });
      if (d?.stat_data?.衍生状态?.nationality && d?.stat_data?.世界阶段) return d.stat_data;
    } catch (e) { break; }
  }

  let best = null;
  for (let i = 0; i < 200; i++) {
    try {
      const d = p.Mvu.getMvuData({ type: 'message', message_id: i });
      if (d?.stat_data?.衍生状态?.nationality && d?.stat_data?.世界阶段) best = d.stat_data;
    } catch (e) { break; }
  }
  return best;
}

function collectNpcNames(sd) {
  const names = [];
  for (const key of ['NPC', '队友', '敌人', '同伴', '幸存者']) {
    const obj = sd[key];
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) names.push(...Object.keys(obj));
  }
  return [...new Set(names)];
}

function buildEnableSet(sd) {
  const enable = new Set();
  const nat           = sd?.衍生状态?.nationality ?? null;
  const phase         = sd?.世界阶段 ?? '秩序期';
  const infMode       = sd?.感染者行为模式 ?? '狂病型';
  const npcMode       = sd?.NPC行为模式 ?? '正常型';
  const 魅魔契约      = sd?.魅魔契约 ?? null;
  const npcNames      = sd ? collectNpcNames(sd) : [];

  if (phase === '秩序期') {
    for (const e of [
      '世界观-各国政府情况',
      '大爆发前/大爆发前夕', '大爆发前/规则-异常事件应对', '大爆发前/规则-约束',
      '大爆发前/规则-物资获取', '大爆发前/规则-医疗与健康',
      '大爆发前/规则-社会秩序', '大爆发前/规则-冲突与应对',
    ]) enable.add(e);
  } else if (phase === '爆发期' || phase === '末世期') {
    for (const e of [
      '世界观-官方安全区', '世界观-半感染者', '世界观-ZCOM生化特种部队(彩蛋)',
      '世界观-流浪者', '世界观-无序者', '杂项-无序者行为强化',
      '杂项-幸存者据点动态生成', '机制-建造庇护所', '物品-灭杀疫苗', '物品-药物',
      '机制-COVID-30感染', '机制-找事儿', '机制-制造', '机制-完整度',
      '机制-战斗', '机制-恐慌', '机制-伤病与医疗',
      '杂项-搜刮结果动态生成', '杂项-幸存者NPC关系推进',
      '世界观-宇航员们（彩蛋）', '世界观-外星人(彩蛋)',
      '机制-搜刮物资', '机制-半感染者生存机制', '机制-沉浸式体验', '机制-种田！我要种田！',
    ]) enable.add(e);
    if (phase === '末世期') {
      for (const e of [
        '世界观-末世期', '世界观-COVID-30变体感染者',
        '机制-官方安全区行为', '机制-痛啊好痛啊！', '机制-死亡',
      ]) enable.add(e);
    }
  } else {
    for (const e of [
      '大爆发前/大爆发前夕', '大爆发前/规则-异常事件应对', '大爆发前/规则-物资获取',
      '大爆发前/规则-医疗与健康', '大爆发前/规则-社会秩序', '大爆发前/规则-冲突与应对',
    ]) enable.add(e);
  }

  if (infMode === '狂病型') {
    for (const e of ['世界观-COVID-30感染者行为总纲', '[mvu_plot]杂项-合理性审查', '杂项-场景强化(可选)']) enable.add(e);
    if (phase === '爆发期') enable.add('世界观-爆发期');
    if (phase === '爆发期' || phase === '末世期') enable.add('机制-动态威胁与安逸惩罚');
    if (phase === '末世期') enable.add('杂项-感染者遭遇动态生成');
  } else if (infMode === '普通型') {
    for (const e of ['普通丧尸COVID-30感染者', '[mvu_plot]普通审查', '普通场景强化(可选)']) enable.add(e);
    if (phase === '爆发期') enable.add('普通爆发期');
    if (phase === '爆发期' || phase === '末世期') {
      for (const e of ['普通感染者多样性', '普通-机制-丧尸尸潮', '普通的动态威胁与安逸惩罚']) enable.add(e);
    }
    if (phase === '末世期') enable.add('普通感染者遭遇');
  }

  if (魅魔契约?.激活) {
    enable.add('魅魔契约-审查');
    enable.add('魅魔契约-契约诅咒');
    if (魅魔契约.异能?.id) enable.add('魅魔契约-异能-' + 魅魔契约.异能.id);
  }

  const 地狱模式 = sd?.地狱模式 ?? null;
  if (地狱模式?.激活) {
    enable.add('地狱模式-旧设定');
    enable.add('地狱模式-废案');
    if (phase === '末世期') {
      enable.add('地狱模式-变种感染者');
    }
  }

  if (npcMode === '正常型') {
    enable.add('杂项-NPC动态生成');
    enable.add('杂项-末世社交互动法则');
  } else if (npcMode === '全员恶人型') {
    enable.add('恶意的NPC生成');
    enable.add('恶意社交法则');
  }

  const summaryMap = {
    '华国':'华国已定义NPC摘要', '美利坚国':'美利坚国已定义NPC摘要',
    '日本国':'日本国已定义NPC摘要', '大毛国':'大毛国已定义NPC摘要',
    '法国':'法国已定义NPC摘要', '巴西国':'巴西已定义NPC摘要', '北非':'北非已定义NPC摘要',
  };
  if (summaryMap[nat]) enable.add(summaryMap[nat]);

  if (nat === '华国' && (phase === '爆发期' || phase === '末世期')) {
    enable.add('世界观-无序者-华国血煞团体'); enable.add('世界观-无序者-华国月影团体');
  }
  if (nat === '日本国') {
    enable.add('世界观-日本国暗线');
    if (phase === '爆发期' || phase === '末世期') {
      for (const e of [
        '世界观-无序者-日本国狩人之牙', '世界观-无序者-日本国绝望残党',
        '世界观-幸存者-樱丘女子高中', '世界观-幸存者-藤美学园',
        '世界观-幸存者-弗兰秀秀', '世界观-安全区-警视厅',
      ]) enable.add(e);
    }
  }
  if (nat === '美利坚国') {
    if (phase === '秩序期') {
      enable.add('世界观-美利坚爆发前');
    } else if (phase === '爆发期' || phase === '末世期') {
      for (const e of [
        '世界观-美利坚爆发后势力格局', '世界观-美利坚特色流浪者行为',
        '世界观-美利坚特色无序者总体设定', '世界观-安布雷拉(彩蛋)',
        '世界观-无序者-美利坚国铁冠帮', '世界观-无序者-美利坚国净世神殿',
      ]) enable.add(e);
      if (phase === '末世期') enable.add('世界观-安布雷拉生物');
    }
  }
  if (nat === '大毛国') {
    enable.add('世界观-大毛生活图景');
    if (phase === '秩序期') {
      enable.add('世界观-大毛国爆发前'); enable.add('世界观-势力爆发前');
    } else if (phase === '爆发期' || phase === '末世期') {
      for (const e of [
        '世界观-统一党爆发后', '世界观-新布尔什维克党爆发后', '世界观-工人钢铁会爆发后',
        '世界观-黑雪势力', '世界观-零度教势力',
      ]) enable.add(e);
      if (phase === '末世期') enable.add('世界观-核爆区域');
    }
  }
  if (nat === '法国') {
    if (phase === '秩序期') {
      enable.add('世界观-法国爆发前');
    } else if (phase === '爆发期' || phase === '末世期') {
      for (const e of [
        '世界观-爆发期的法国', '世界观-白鹿堡', '世界观-鸢尾堡',
        '世界观-铁王冠领', '世界观-圣公教会', '世界观-混乱骑士团',
        '世界观-自由联合民', '世界观-戴高乐号流亡政府',
      ]) enable.add(e);
      if (phase === '末世期') enable.add('世界观-末世期的法国');
    }
  }
  if (nat === '巴西国') {
    enable.add(phase === '秩序期' ? '世界观-秩序期的巴西' : '世界观-爆发后的巴西');
  }
  if (nat === '北非') {
    enable.add(phase === '秩序期' ? '世界观-秩序期的北非' : '世界观-爆发后的北非');
  }
  for (const name of npcNames) {
    if (nat) enable.add(`${nat}/角色/${name}/基础信息`);
  }

  return enable;
}

const MANAGED_ENTRIES = new Set([
  '世界观-各国政府情况',
  '大爆发前/大爆发前夕','大爆发前/规则-异常事件应对','大爆发前/规则-约束',
  '大爆发前/规则-物资获取','大爆发前/规则-医疗与健康',
  '大爆发前/规则-社会秩序','大爆发前/规则-冲突与应对',
  '世界观-官方安全区','世界观-半感染者','世界观-ZCOM生化特种部队(彩蛋)',
  '世界观-流浪者','世界观-无序者','杂项-无序者行为强化',
  '杂项-幸存者据点动态生成','机制-建造庇护所','物品-灭杀疫苗','物品-药物',
  '机制-COVID-30感染','机制-找事儿','机制-制造','机制-完整度',
  '机制-战斗','机制-恐慌','机制-伤病与医疗',
  '杂项-搜刮结果动态生成','杂项-幸存者NPC关系推进',
  '世界观-宇航员们（彩蛋）','世界观-外星人(彩蛋)',
  '机制-搜刮物资','机制-半感染者生存机制','机制-沉浸式体验','机制-种田！我要种田！',
  '世界观-末世期','世界观-COVID-30变体感染者',
  '机制-官方安全区行为','机制-痛啊好痛啊！','机制-死亡',
  '世界观-COVID-30感染者行为总纲','[mvu_plot]杂项-合理性审查','杂项-场景强化(可选)',
  '世界观-爆发期','机制-动态威胁与安逸惩罚','杂项-感染者遭遇动态生成',
  '普通丧尸COVID-30感染者','[mvu_plot]普通审查','普通场景强化(可选)',
  '普通爆发期','普通感染者多样性','普通-机制-丧尸尸潮',
  '普通的动态威胁与安逸惩罚','普通感染者遭遇',
  '魅魔契约-审查','魅魔契约-契约诅咒',
  '地狱模式-旧设定','地狱模式-废案','地狱模式-变种感染者',
  '杂项-NPC动态生成','杂项-末世社交互动法则','恶意的NPC生成','恶意社交法则',
  '华国已定义NPC摘要','美利坚国已定义NPC摘要','日本国已定义NPC摘要',
  '大毛国已定义NPC摘要','法国已定义NPC摘要','巴西已定义NPC摘要','北非已定义NPC摘要',
  '世界观-无序者-华国血煞团体','世界观-无序者-华国月影团体',
  '世界观-日本国暗线','世界观-无序者-日本国狩人之牙','世界观-无序者-日本国绝望残党',
  '世界观-幸存者-樱丘女子高中','世界观-幸存者-藤美学园','世界观-幸存者-弗兰秀秀',
  '世界观-安全区-警视厅','世界观-美利坚爆发前','世界观-美利坚爆发后势力格局',
  '世界观-美利坚特色流浪者行为','世界观-美利坚特色无序者总体设定',
  '世界观-安布雷拉(彩蛋)','世界观-无序者-美利坚国铁冠帮',
  '世界观-无序者-美利坚国净世神殿','世界观-安布雷拉生物',
  '世界观-大毛生活图景','世界观-大毛国爆发前','世界观-势力爆发前',
  '世界观-统一党爆发后','世界观-新布尔什维克党爆发后','世界观-工人钢铁会爆发后',
  '世界观-黑雪势力','世界观-零度教势力','世界观-核爆区域',
  '世界观-法国爆发前','世界观-爆发期的法国','世界观-末世期的法国',
  '世界观-白鹿堡','世界观-鸢尾堡','世界观-铁王冠领','世界观-圣公教会',
  '世界观-混乱骑士团','世界观-自由联合民','世界观-戴高乐号流亡政府',
  '世界观-秩序期的巴西','世界观-爆发后的巴西',
  '世界观-秩序期的北非','世界观-爆发后的北非',
]);

const MANAGED_PREFIXES = [
  '华国/角色/', '美利坚国/角色/', '日本国/角色/',
  '大毛国/角色/', '法国/角色/', '巴西国/角色/', '北非/角色/',
  '魅魔契约-异能-',
];

function isManagedEntry(name) {
  if (MANAGED_ENTRIES.has(name)) return true;
  return MANAGED_PREFIXES.some(pfx => name.startsWith(pfx));
}

async function applyToWorldbook(enableSet) {
  const enableSetJSON    = JSON.stringify([...enableSet]);
  const managedSetJSON   = JSON.stringify([...MANAGED_ENTRIES]);
  const prefixesJSON     = JSON.stringify(MANAGED_PREFIXES);
  const isManagedStr     = isManagedEntry.toString();

  return runInParent(`(async () => {
    var enableSet       = new Set(${enableSetJSON});
    var MANAGED_ENTRIES = new Set(${managedSetJSON});
    var MANAGED_PREFIXES = ${prefixesJSON};
    var isManagedEntry  = ${isManagedStr};

    if (typeof TavernHelper === 'undefined')
      throw new Error('TavernHelper is not defined — 请确认 TavernHelper 扩展已安装并启用');

    var wbName = ${JSON.stringify(WORLDBOOK_NAME)};
    var entries;
    try { entries = await TavernHelper.getWorldbook(wbName); } catch(e) {
      throw new Error('无法获取世界书 "' + wbName + '": ' + (e.message || String(e)));
    }
    if (!Array.isArray(entries))
      throw new Error('世界书 "' + wbName + '" 返回数据格式异常');

    var totalChanged = 0;
    var log = [];
    var changed = false;
    var enabled_list = [], disabled_list = [];

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var entryName = e.name || '';
      if (!isManagedEntry(entryName)) continue;

      var should = enableSet.has(entryName);
      var dirty  = false;

      if (e.enabled !== should) { e.enabled = should; dirty = true; }

      if (!e.strategy || typeof e.strategy !== 'object') {
        e.strategy = { type: 'normal', keys: [], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' };
      }
      var targetType = should ? 'constant' : 'normal';
      if (e.strategy.type !== targetType) { e.strategy.type = targetType; dirty = true; }

      if (dirty) {
        changed = true;
        (should ? enabled_list : disabled_list).push(entryName);
      }
    }

    if (changed) {
      try { await TavernHelper.replaceWorldbook(wbName, entries); } catch(e) {
        throw new Error('无法保存世界书 "' + wbName + '": ' + (e.message || String(e)));
      }
      totalChanged += enabled_list.length + disabled_list.length;
      log.push({ wbName: wbName, enabled: enabled_list, disabled: disabled_list });
    }

    return { totalChanged: totalChanged, log: log, wbNames: [wbName] };
  })()`);
}

let _runningPromise = null;
let _pendingSwitch  = false;
let _debounceTimer  = null;

async function autoSwitch() {
  if (_runningPromise) {

    _pendingSwitch = true;
    return _runningPromise;
  }

  _runningPromise = (async () => {
    console.log('[EWC] autoSwitch 触发');
    bubble && bubble.classList.add('running');
    try {
      if (typeof p.Mvu === 'undefined') throw new Error('Mvu 不可用');

      const sd = readStatData();
      if (!sd) {
        console.warn('[EWC] 未找到有效 stat_data，重置所有受控条目');
      }

      const enableSet = sd ? buildEnableSet(sd) : new Set();
      console.log('[EWC] 应启用', enableSet.size, '条:', [...enableSet].slice(0, 10));

      const result = await applyToWorldbook(enableSet);
      const logSummary = result.log.map(l =>
        l.wbName + ' ▲' + l.enabled.length + ' ▼' + l.disabled.length
      ).join(' | ');
      console.log('[EWC] 完成 changed=' + result.totalChanged + (logSummary ? '  ' + logSummary : ''));

      p._ewcLastResult = {
        time: Date.now(), ok: true,
        stat: {
          phase:  sd?.世界阶段,
          nat:    sd?.衍生状态?.nationality,
          感染者: sd?.感染者行为模式,
          NPC模式:sd?.NPC行为模式,
          魅魔:   sd?.魅魔契约?.激活,
          地狱:   sd?.地狱模式?.激活,
        },
        want: [...enableSet],
        totalChanged: result.totalChanged,
        log: result.log,
      };
    } catch (err) {
      console.error('[EWC] 执行失败:', err);
      p._ewcLastResult = { time: Date.now(), ok: false, error: err.message };
    }
    p.document.dispatchEvent(new CustomEvent('ewc-done', { detail: p._ewcLastResult }));
  })();

  try { await _runningPromise; } finally {
    _runningPromise = null;

    if (_pendingSwitch) {
      _pendingSwitch = false;
      setTimeout(() => autoSwitch(), 100);
    }
  }
}

function onCriticalEvent() {
  clearTimeout(_debounceTimer);
  return autoSwitch();
}

function onSecondaryEvent() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(autoSwitch, 200);
}

const CRITICAL_EVENTS = [
  'message_sent',               'MESSAGE_SENT',
  'generate_before_combine_prompts', 'GENERATE_BEFORE_COMBINE_PROMPTS',
];

const SECONDARY_EVENTS = [
  'character_message_rendered', 'CHARACTER_MESSAGE_RENDERED',
  'message_received',           'MESSAGE_RECEIVED',
  'user_message_rendered',      'USER_MESSAGE_RENDERED',
];

const ALL_EVENTS = [...CRITICAL_EVENTS, ...SECONDARY_EVENTS];

if (typeof eventOn === 'function') {
  for (const evt of CRITICAL_EVENTS) {
    try { eventOn(evt, onCriticalEvent); console.log('[EWC] 注册关键事件:', evt); } catch(e) {}
  }
  for (const evt of SECONDARY_EVENTS) {
    try { eventOn(evt, onSecondaryEvent); console.log('[EWC] 注册次要事件:', evt); } catch(e) {}
  }
  p._ewcCleanup = function() {
    if (typeof eventOff === 'function') {
      for (const evt of ALL_EVENTS) { try { eventOff(evt, onCriticalEvent); } catch(e) {} }
      for (const evt of ALL_EVENTS) { try { eventOff(evt, onSecondaryEvent); } catch(e) {} }
    }
  };
} else {
  console.warn('[EWC] eventOn 不可用，将仅支持手动触发');
}

function ewcShowToast(msg, duration) {
  if (duration === undefined) duration = 2400;
  var animDelay = Math.max(0, duration - 300);

  let container = p.document.getElementById('ewc-toast-container');
  if (!container) {
    container = p.document.createElement('div');
    container.id = 'ewc-toast-container';
    container.style.cssText = [
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);',
      'z-index:1000010;display:flex;flex-direction:column;gap:6px;',
      'align-items:center;pointer-events:none;',
    ].join('');
    p.document.body.appendChild(container);
  }
  const t = p.document.createElement('div');
  t.className = 'ewc-toast-item';
  t.style.cssText = [
    'background:rgba(10,15,25,0.97);border:1px solid rgba(74,144,226,0.4);',
    'border-radius:8px;padding:9px 22px;color:#87cefa;font-size:13px;font-weight:600;',
    'box-shadow:0 4px 20px rgba(0,0,0,0.5);pointer-events:none;white-space:nowrap;',
    "font-family:'Noto Serif SC','Inter','Microsoft YaHei',sans-serif;",
    'animation:ewc-toast-in .25s ease,ewc-toast-out .25s ease ' + (animDelay / 1000) + 's forwards;',
  ].join('');
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.remove();
    if (!container.hasChildNodes()) container.remove();
  }, duration);
}

function ewcGetMvuCfg() {
  return (typeof SillyTavern !== 'undefined') ? SillyTavern.extensionSettings?.mvu_settings : null;
}

function ewcSaveSettings() {
  const ST = (typeof SillyTavern !== 'undefined') ? SillyTavern : null;
  const pST = p.SillyTavern || null;

  const immediate = (ST && typeof ST.saveSettings === 'function' && ST.saveSettings) ||
                    (pST && typeof pST.saveSettings === 'function' && pST.saveSettings) ||
                    (typeof p.saveSettings === 'function' ? p.saveSettings : null);
  if (immediate) {
    const r = immediate();
    return r instanceof Promise ? r : Promise.resolve(r);
  }

  const debounced = (ST && typeof ST.saveSettingsDebounced === 'function' && ST.saveSettingsDebounced) ||
                    (pST && typeof pST.saveSettingsDebounced === 'function' && pST.saveSettingsDebounced) ||
                    (typeof p.saveSettingsDebounced === 'function' ? p.saveSettingsDebounced : null);
  if (debounced) {
    if (typeof debounced.flush === 'function') debounced.flush();
    const r = debounced();
    return r instanceof Promise ? r : Promise.resolve(r);
  }

  throw new Error('saveSettings 不可用');
}

const EWC_EJS_OPTIMAL = {
  enabled: true, generate_enabled: true, generate_loader_enabled: true,
  render_enabled: true, render_loader_enabled: true, with_context_disabled: false,
  debug_enabled: false, autosave_enabled: false, preload_worldinfo_enabled: true,
  code_blocks_enabled: true, raw_message_evaluation_enabled: true, filter_message_enabled: true,
  inject_loader_enabled: false, invert_enabled: true, depth_limit: -1,
  compile_workers: false, sandbox: false,
};

function ewcCheckEjs(statusEl) {
  try {
    const ejs = (typeof SillyTavern !== 'undefined') && SillyTavern?.extensionSettings?.EjsTemplate;
    if (!ejs) { statusEl.innerHTML = '🔴 提示词模板未安装，请前往插件区安装'; return; }
    const disabled = SillyTavern.extensionSettings.disabledExtensions || [];
    if (disabled.includes('third-party/ST-Prompt-Template')) {
      statusEl.innerHTML = '🟠 提示词模板已禁用，请在扩展列表开启'; return;
    }
    const issues = [];
    for (const [k, v] of Object.entries(EWC_EJS_OPTIMAL)) {
      if (ejs[k] !== v) issues.push(k + ': 应为 ' + JSON.stringify(v));
    }
    statusEl.innerHTML = issues.length === 0
      ? '🟢 提示词模板配置最优'
      : '🟡 存在 ' + issues.length + ' 项偏差<br>' + issues.slice(0, 4).join('<br>');
  } catch (e) { statusEl.textContent = '检测失败: ' + e.message; }
}

function ewcApplyOptimalEjs(statusEl) {
  try {
    const ejs = (typeof SillyTavern !== 'undefined') && SillyTavern?.extensionSettings?.EjsTemplate;
    if (!ejs) { ewcShowToast('提示词模板未安装，请前往插件区安装'); return; }
    const disabled = SillyTavern.extensionSettings.disabledExtensions || [];
    if (disabled.includes('third-party/ST-Prompt-Template')) {
      ewcShowToast('提示词模板已禁用，请在扩展列表开启'); return;
    }
    Object.assign(ejs, EWC_EJS_OPTIMAL);
    ewcSaveSettings();
    ewcCheckEjs(statusEl);
    ewcShowToast('提示词模板已设为最优配置，2秒后刷新…');
    setTimeout(() => { window.parent.location.reload(); }, 2000);
  } catch (e) { ewcShowToast('配置失败: ' + e.message); }
}

function ewcGetMvuFormRefs() {
  const g = id => p.document.getElementById(id);
  return {
    updateMode:    g('ewc-mvu-update-mode'),
    modelSource:   g('ewc-mvu-model-source'),
    customApi:     g('ewc-mvu-custom-api'),
    extraPanel:    g('ewc-mvu-extra-panel'),
    jailbreak:     g('ewc-mvu-jailbreak'),
    respFormat:    g('ewc-mvu-resp-format'),
    reqMode:       g('ewc-mvu-req-mode'),
    reqCount:      g('ewc-mvu-req-count'),
    autoReq:       g('ewc-mvu-auto-req'),
    apiUrl:        g('ewc-mvu-api-url'),
    apiKey:        g('ewc-mvu-api-key'),
    fetchBtn:      g('ewc-mvu-fetch-models'),
    modelName:     g('ewc-mvu-model-name'),
    maxTokens:     g('ewc-mvu-max-tokens'),
    temperature:   g('ewc-mvu-temperature'),
    freqPenalty:   g('ewc-mvu-freq-penalty'),
    presPenalty:   g('ewc-mvu-pres-penalty'),
    topP:          g('ewc-mvu-top-p'),
    topK:          g('ewc-mvu-top-k'),
    autoClean:     g('ewc-mvu-auto-clean'),
    cleanPanel:    g('ewc-mvu-clean-panel'),
    cleanInterval: g('ewc-mvu-clean-interval'),
    cleanRecent:   g('ewc-mvu-clean-recent'),
    cleanTrigger:  g('ewc-mvu-clean-trigger'),
    compatChecks:  g('ewc-mvu-compat'),
    advToggle:     g('ewc-mvu-adv-toggle'),
    advArrow:      g('ewc-mvu-adv-arrow'),
    advPanel:      g('ewc-mvu-adv-panel'),
    manualToggle:  g('ewc-mvu-manual-toggle'),
    manualArrow:   g('ewc-mvu-manual-arrow'),
    manualPanel:   g('ewc-mvu-manual-panel'),
    applyBtn:      g('ewc-mvu-apply'),
    status:        g('ewc-mvu-status'),
    presetRow:     g('ewc-mvu-preset-row'),
    presetName:    g('ewc-mvu-preset-name'),
  };
}

function ewcBuildCompatChecks(fr) {
  const cfg = ewcGetMvuCfg();
  const compat = cfg?.兼容性 || {};
  fr.compatChecks.innerHTML = Object.keys(compat).map(k =>
    `<label class="ewc-mvu-check-row"><input type="checkbox" class="ewc-mvu-compat-check" data-key="${k}"${compat[k] ? ' checked' : ''}><span class="ewc-mvu-check-box"></span><span>${k}</span></label>`
  ).join('');
}

function ewcSyncMvuToForm() {
  const cfg = ewcGetMvuCfg();
  const fr = ewcGetMvuFormRefs();
  if (!cfg || !fr.updateMode) return;

  fr.updateMode.value = cfg.更新方式 ?? '随AI输出';
  fr.modelSource.value = cfg.额外模型解析配置?.模型来源 ?? '与插头相同';
  const isExtra = cfg.更新方式 === '额外模型解析';
  fr.extraPanel.style.display = isExtra ? '' : 'none';

  const em = cfg.额外模型解析配置 || {};
  fr.jailbreak.value = em.破限方案 || '使用内置破限';
  if (fr.presetRow) fr.presetRow.style.display = (em.破限方案 === '使用其他预设') ? '' : 'none';
  if (em.破限方案 === '使用其他预设' && fr.presetName) {

    const _savedPreset = em.预设名称 ||
      (typeof SillyTavern !== 'undefined' && SillyTavern.extensionSettings?._ewcYH?.presetName) || '';
    ewcPopulatePresets(fr, _savedPreset);
  }
  fr.respFormat.value = em.应答格式 || '聊天消息';
  fr.reqMode.value = em.请求方式 || '依次请求，失败后重试';
  fr.reqCount.value = em.请求次数 || 1;
  fr.autoReq.checked = em.启用自动请求 !== false;
  fr.apiUrl.value = em.api地址 || '';
  fr.apiKey.value = em.密钥 || '';
  if (em.模型名称 && ![...fr.modelName.options].some(o => o.value === em.模型名称)) {
    const opt = p.document.createElement('option');
    opt.value = opt.textContent = em.模型名称;
    fr.modelName.appendChild(opt);
  }
  if (em.模型名称) fr.modelName.value = em.模型名称;
  fr.maxTokens.value = em.最大回复token数 || 65535;
  fr.temperature.value = em.温度 || 1;
  fr.freqPenalty.value = em.频率惩罚 || 0;
  fr.presPenalty.value = em.存在惩罚 || 0;
  fr.topP.value = em.top_p || 1;
  fr.topK.value = em.top_k || 0;

  const ac = cfg.自动清理变量 || {};
  fr.autoClean.checked = !!ac.启用;
  fr.cleanPanel.style.display = ac.启用 ? '' : 'none';
  fr.cleanInterval.value = ac.快照保留间隔 || 50;
  fr.cleanRecent.value = ac.要保留变量的最近楼层数 || 20;
  fr.cleanTrigger.value = ac.触发恢复变量的最近楼层数 || 10;

  ewcBuildCompatChecks(fr);
  ewcRefreshModelSourceVisibility(fr);
}

function ewcWriteMvuConfig() {
  const cfg = ewcGetMvuCfg();
  const fr = ewcGetMvuFormRefs();
  if (!cfg || !fr.updateMode) return;

  cfg.更新方式 = fr.updateMode.value;
  cfg.额外模型解析配置 = cfg.额外模型解析配置 || {};
  const em = cfg.额外模型解析配置;
  em.模型来源 = fr.modelSource.value;
  em.破限方案 = fr.jailbreak.value;
  if (fr.jailbreak.value === '使用其他预设' && fr.presetName) {
    em.预设名称 = fr.presetName.value;

    if (typeof SillyTavern !== 'undefined') {
      SillyTavern.extensionSettings._ewcYH = SillyTavern.extensionSettings._ewcYH || {};
      SillyTavern.extensionSettings._ewcYH.presetName = fr.presetName.value;
    }
  } else {
    delete em.预设名称;

    if (typeof SillyTavern !== 'undefined' && SillyTavern.extensionSettings._ewcYH) {
      delete SillyTavern.extensionSettings._ewcYH.presetName;
    }
  }
  em.应答格式 = fr.respFormat.value;
  em.请求方式 = fr.reqMode.value;
  em.请求次数 = parseInt(fr.reqCount.value) || 1;
  em.启用自动请求 = fr.autoReq.checked;
  em.api地址 = fr.apiUrl.value;
  em.密钥 = fr.apiKey.value;
  em.模型名称 = fr.modelName.value;
  em.兼容假流式 = /假流/i.test(fr.modelName.value);
  em.最大回复token数 = parseInt(fr.maxTokens.value) || 65535;
  em.温度 = parseFloat(fr.temperature.value) || 1;
  em.频率惩罚 = parseFloat(fr.freqPenalty.value) || 0;
  em.存在惩罚 = parseFloat(fr.presPenalty.value) || 0;
  em.top_p = parseFloat(fr.topP.value) || 1;
  em.top_k = parseInt(fr.topK.value) || 0;

  cfg.自动清理变量 = cfg.自动清理变量 || {};
  const ac = cfg.自动清理变量;
  ac.启用 = fr.autoClean.checked;
  ac.快照保留间隔 = parseInt(fr.cleanInterval.value) || 50;
  ac.要保留变量的最近楼层数 = parseInt(fr.cleanRecent.value) || 20;
  ac.触发恢复变量的最近楼层数 = parseInt(fr.cleanTrigger.value) || 10;

  fr.compatChecks.querySelectorAll('.ewc-mvu-compat-check').forEach(cb => {
    if (cfg.兼容性) cfg.兼容性[cb.dataset.key] = cb.checked;
  });
}

let _ewcMvuSaveTimer = null;
function ewcOnMvuFieldChange() {
  ewcWriteMvuConfig();
  const fr = ewcGetMvuFormRefs();
  if (fr.status) fr.status.textContent = '已修改，待保存…';
  clearTimeout(_ewcMvuSaveTimer);
  _ewcMvuSaveTimer = setTimeout(async () => {
    try { ewcWriteMvuConfig(); await ewcSaveSettings(); if (fr.status) fr.status.textContent = '已保存（刷新后MVU生效）'; }
    catch (e) { if (fr.status) fr.status.textContent = '保存失败: ' + e.message; }
  }, 600);
}

function ewcRefreshModelSourceVisibility(fr) {
  if (!fr) fr = ewcGetMvuFormRefs();
  const isExtra = fr.updateMode?.value === '额外模型解析';
  const isCustom = fr.modelSource?.value === '自定义';
  if (fr.customApi) fr.customApi.style.display = (isExtra && isCustom) ? '' : 'none';
}

function ewcRefreshMvuStatus() {
  const fr = ewcGetMvuFormRefs();
  if (!fr.status) return;
  try {
    const cfg = ewcGetMvuCfg();
    if (!cfg) { fr.status.textContent = '无法读取MVU配置（MVU是否已安装？）'; return; }
    ewcSyncMvuToForm();
    const mode = cfg.更新方式;
    const n = cfg.通知 || {};
    const notifOk = n['MVU框架加载成功'] && n['变量初始化成功'] && n['变量更新出错'] && n['额外模型解析中'];
    fr.status.innerHTML =
      (mode === '额外模型解析' ? '🟢' : '🔴') + ' 更新方式: ' + (mode || '未知') + '<br>' +
      (notifOk ? '🟢' : '🔴') + ' 四项通知: ' + (notifOk ? '全部开启' : '未全部开启');
  } catch (e) { fr.status.textContent = '读取MVU配置出错'; }
}

async function ewcApplyOptimalMvu() {
  try {
    const cfg = ewcGetMvuCfg();
    if (!cfg) { ewcShowToast('mvu_settings 不存在，请确认已安装MVU变量框架'); return; }
    const fr = ewcGetMvuFormRefs();

    cfg.通知 = cfg.通知 || {};
    cfg.通知['MVU框架加载成功'] = true;
    cfg.通知['变量初始化成功'] = true;
    cfg.通知['变量更新出错'] = true;
    cfg.通知['额外模型解析中'] = true;

    cfg.额外模型解析配置 = cfg.额外模型解析配置 || {};
    const em = cfg.额外模型解析配置;
    em.破限方案 = '使用内置破限';
    em.应答格式 = '聊天消息'; em.请求方式 = '依次请求，失败后重试';
    em.请求次数 = 1; em.启用自动请求 = true;
    em.最大回复token数 = 65535; em.温度 = 1;
    em.频率惩罚 = 0; em.存在惩罚 = 0; em.top_p = 1; em.top_k = 0;
    em.api地址 = fr.apiUrl?.value || '';
    em.密钥 = fr.apiKey?.value || '';
    em.模型名称 = fr.modelName?.value || '';
    em.兼容假流式 = /假流/i.test(em.模型名称);
    em.模型来源 = '自定义';

    cfg.自动清理变量 = { 启用: true, 快照保留间隔: 50, 要保留变量的最近楼层数: 20, 触发恢复变量的最近楼层数: 10 };
    cfg.兼容性 = { 更新到聊天变量: true, 显示老旧功能: false, 'sandas不视为user消息': false };
    cfg.更新方式 = '额外模型解析';

    await ewcSaveSettings();
    ewcSyncMvuToForm();
    if (fr.status) fr.status.innerHTML = '🟢 更新方式: 额外模型解析<br>🟢 四项通知: 全部开启';
    ewcShowToast('MVU最优配置已应用，2秒后刷新…');
    setTimeout(() => { window.parent.location.reload(); }, 2000);
  } catch (e) {
    console.error('[EWC] MVU配置失败:', e);
    ewcShowToast('MVU配置失败: ' + e.message);
  }
}

async function ewcFetchModels() {
  const fr = ewcGetMvuFormRefs();
  const baseUrl = (fr.apiUrl?.value || '').trim().replace(/\/+$/, '');
  if (!baseUrl) { ewcShowToast('请先填写API地址'); return; }
  if (fr.fetchBtn) { fr.fetchBtn.disabled = true; fr.fetchBtn.textContent = '获取中…'; }
  try {
    const resp = await fetch(baseUrl + '/models', {
      headers: { 'Authorization': 'Bearer ' + (fr.apiKey?.value || '') }
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const models = data.data || data.models || data;
    const ids = (Array.isArray(models) ? models : []).map(m => m.id || m.model || (typeof m === 'string' ? m : '')).filter(Boolean);
    if (ids.length === 0) { ewcShowToast('未获取到模型列表'); return; }
    if (fr.modelName) {
      fr.modelName.innerHTML = ids.map(id => `<option value="${id}">${id}</option>`).join('');
      const preferred = ['gemini-2.5-pro','gemini-3.1-pro','gemini-3.5-flash'];
      fr.modelName.value = preferred.find(m => ids.includes(m)) || ids[0];
    }
    ewcShowToast('已获取 ' + ids.length + ' 个模型，已选推荐模型');
  } catch (e) {
    ewcShowToast('获取模型失败: ' + e.message);
  } finally {
    if (fr.fetchBtn) { fr.fetchBtn.disabled = false; fr.fetchBtn.textContent = '获取模型'; }
  }
}

let _ewcPresetCache = null;

async function ewcLoadPresetList() {
  if (_ewcPresetCache) return _ewcPresetCache;
  try {
    const result = await runInParent(`(async () => {

      const primary = document.querySelector('#settings_preset_openai');
      if (primary && primary.options && primary.options.length > 0) {
        const names = [...primary.options]
          .map(o => (o.textContent || '').trim())
          .filter(v => v);
        if (names.length) return names;
      }

      const byAttr = document.querySelector('select[data-preset-manager-for="openai"]');
      if (byAttr && byAttr.options && byAttr.options.length > 0) {
        const names = [...byAttr.options]
          .map(o => (o.textContent || '').trim())
          .filter(v => v);
        if (names.length) return names;
      }

      const tgwui = document.querySelector('#settings_preset_textgenerationwebui');
      if (tgwui && tgwui.options && tgwui.options.length > 0) {
        const names = [...tgwui.options]
          .map(o => (o.textContent || '').trim())
          .filter(v => v);
        if (names.length) return names;
      }

      return [];
    })()`);

    if (Array.isArray(result) && result.length) {
      _ewcPresetCache = result;
      return result;
    }
  } catch(e) {
  }
  return [];
}

async function ewcPopulatePresets(fr, selectedValue) {
  if (!fr || !fr.presetName) return;
  fr.presetName.innerHTML = '<option value="">– 加载中… –</option>';
  try {
    const list = await ewcLoadPresetList();
    if (!list || !list.length) {
      fr.presetName.innerHTML = '<option value="">– 未找到预设（请确认已启用额外模型解析）–</option>';
      return;
    }
    fr.presetName.innerHTML = list
      .map(name => `<option value="${name.replace(/"/g,'&quot;')}">${name}</option>`)
      .join('');

    if (selectedValue && [...fr.presetName.options].some(o => o.value === selectedValue)) {
      fr.presetName.value = selectedValue;
    }
  } catch(e) {
    fr.presetName.innerHTML = '<option value="">– 加载失败 –</option>';
  }
}

async function ewcSyncMvuNativePreset(presetName) {
  if (!presetName) return;
  try {
    const result = await runInParent(`(async () => {
      const target = ${JSON.stringify(presetName)};

      function findSelectNear(labelText) {
        for (const el of document.querySelectorAll('label, span, div, td, th')) {
          if (el.textContent.trim() !== labelText) continue;

          let sib = el.nextElementSibling;
          while (sib) {
            if (sib.tagName === 'SELECT') return sib;
            const s = sib.querySelector('select');
            if (s) return s;
            sib = sib.nextElementSibling;
          }

          const parent = el.closest('div,section,form,tr');
          if (parent) {
            const s = parent.querySelector('select');
            if (s) return s;
          }
        }
        return null;
      }

      const CANDIDATE_SELECTORS = [
        '#mvu_target_preset',
        '#mvu-target-preset',
        'select[data-mvu="target_preset"]',
        'select[name="mvu_target_preset"]',
        '.mvu_preset_select',
        '.mvu-preset-select',
      ];

      function findSelectByOption(value) {
        for (const sel of document.querySelectorAll('select')) {
          if ([...sel.options].some(o => o.value === value || o.textContent.trim() === value)) {

            if (!sel.closest('#ewc-panel')) return sel;
          }
        }
        return null;
      }

      let sel = findSelectNear('目标预设');
      if (!sel) {
        for (const s of CANDIDATE_SELECTORS) {
          sel = document.querySelector(s);
          if (sel) break;
        }
      }
      if (!sel) sel = findSelectByOption(target);

      if (!sel) return { ok: false, reason: '未找到目标预设 select 元素' };

      const opt = [...sel.options].find(o => o.value === target || o.textContent.trim() === target);
      if (!opt) return { ok: false, reason: '下拉中不含选项: ' + target, options: [...sel.options].map(o=>o.textContent.trim()) };

      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, selected: opt.value };
    })()`);

  } catch(e) {
  }
}

const CONFIG_BLACKLIST = ['次','血','特','惠','福','利','鹿','量','plus','Plus','PLUS','转','官','0'];

const CONFIG_URL_WHITELIST = ['ark.cn', 'siliconflow', 'openrouter'];

function ewcCheckModelConfig() {
  try {
    let model = '';
    if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getChatCompletionModel === 'function') {
      model = SillyTavern.getChatCompletionModel() || '';
    }
    if (!model) {
      const cs = (typeof SillyTavern !== 'undefined' && SillyTavern.chatCompletionSettings) || {};
      model = ewcInferModelFromSettings(cs);
    }
    const configStatus = p.document.getElementById('ewc-config-status');
    if (!configStatus) return false;

    const apiUrl = ewcGetMainApiUrl().toLowerCase();
    if (CONFIG_URL_WHITELIST.some(d => apiUrl.includes(d))) {
      configStatus.textContent = '配置运行正常';
      configStatus.classList.remove('warn');
      ewcUpdateBackendCode(false);
      return false;
    }

    if (!model) {
      configStatus.textContent = '无法获取当前模型名';
      configStatus.classList.add('warn');
      ewcUpdateBackendCode(true);
      return false;
    }
    const hit = CONFIG_BLACKLIST.some(kw => model.includes(kw));
    if (hit) {
      configStatus.textContent = 'MUV解析异常，请复制报错码并前往卡区询问原因';
      configStatus.classList.add('warn');

      if (!p._ewcConfigWarnedOnce) {
        p._ewcConfigWarnedOnce = true;
        ewcShowToast('⚠ MUV解析异常，请在小助手复制报错码并前往卡区询问原因', 5000);
      }
    } else {
      configStatus.textContent = '配置运行正常';
      configStatus.classList.remove('warn');
    }
    ewcUpdateBackendCode(hit);
    return hit;
  } catch (e) {
    console.warn('[EWC] 无法获取模型名:', e.message);
    return false;
  }
}

function ewcInferModelFromSettings(settings) {
  if (!settings || typeof settings !== 'object') return '';
  const sourceMap = {
    claude: 'claude_model', openai: 'openai_model', makersuite: 'google_model',
    google: 'google_model', vertexai: 'vertexai_model', openrouter: 'openrouter_model',
    ai21: 'ai21_model', mistralai: 'mistralai_model', custom: 'custom_model',
    cohere: 'cohere_model', perplexity: 'perplexity_model', groq: 'groq_model',
    siliconflow: 'siliconflow_model', electronhub: 'electronhub_model',
    chutes: 'chutes_model', nanogpt: 'nanogpt_model', deepseek: 'deepseek_model',
    aimlapi: 'aimlapi_model', xai: 'xai_model', pollinations: 'pollinations_model',
    cometapi: 'cometapi_model', moonshot: 'moonshot_model', fireworks: 'fireworks_model',
    azure_openai: 'azure_openai_model', zai: 'zai_model',
  };
  const key = sourceMap[settings.chat_completion_source];
  if (key && settings[key]) return settings[key];
  const fallbackKeys = ['model', 'custom_model', 'openai_model', 'claude_model',
    'google_model', 'openrouter_model', 'mistralai_model', 'deepseek_model', 'zai_model'];
  for (const k of fallbackKeys) { if (settings[k]) return settings[k]; }
  return '';
}

const _EWC_DES_KEY = 'ZODMVUKY';
const _DES_IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
const _DES_FP = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
const _DES_E = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
const _DES_P = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
const _DES_PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const _DES_PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
const _DES_ROT = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
const _DES_SBOX = [
  [14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
  [15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
  [10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
  [7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14],
  [2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
  [12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
  [4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
  [13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]
];

function _desPermute(bits, table) { return table.map(i => bits[i - 1]); }
function _desLeftShift(bits, count) { return bits.slice(count).concat(bits.slice(0, count)); }
function _desXor(a, b) { return a.map((v, i) => v ^ b[i]); }
function _desBytesToBits(bytes) {
  const bits = [];
  for (const byte of bytes) { for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1); }
  return bits;
}
function _desBitsToBytes(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    bytes.push(byte);
  }
  return bytes;
}
function _desCreateSubkeys(keyBytes) {
  const keyBits = _desPermute(_desBytesToBits(keyBytes), _DES_PC1);
  let c = keyBits.slice(0, 28), d = keyBits.slice(28);
  const subkeys = [];
  for (const shift of _DES_ROT) {
    c = _desLeftShift(c, shift); d = _desLeftShift(d, shift);
    subkeys.push(_desPermute(c.concat(d), _DES_PC2));
  }
  return subkeys;
}
function _desFeistel(right, subkey) {
  const expanded = _desXor(_desPermute(right, _DES_E), subkey);
  const out = [];
  for (let i = 0; i < 8; i++) {
    const chunk = expanded.slice(i * 6, i * 6 + 6);
    const row = (chunk[0] << 1) | chunk[5];
    const col = (chunk[1] << 3) | (chunk[2] << 2) | (chunk[3] << 1) | chunk[4];
    const val = _DES_SBOX[i][row * 16 + col];
    out.push((val >> 3) & 1, (val >> 2) & 1, (val >> 1) & 1, val & 1);
  }
  return _desPermute(out, _DES_P);
}
function _desEncryptBlock(block, subkeys) {
  const bits = _desPermute(_desBytesToBits(block), _DES_IP);
  let left = bits.slice(0, 32), right = bits.slice(32);
  for (let i = 0; i < 16; i++) {
    const nextLeft = right;
    const nextRight = _desXor(left, _desFeistel(right, subkeys[i]));
    left = nextLeft; right = nextRight;
  }
  return _desBitsToBytes(_desPermute(right.concat(left), _DES_FP));
}
function _stringToUtf8Bytes(text) {
  if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
  const encoded = unescape(encodeURIComponent(text));
  return Array.from(encoded, ch => ch.charCodeAt(0));
}
function _bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa === 'function') return btoa(binary);
  throw new Error('Base64 编码不可用');
}
function _desEcbPkcs7EncryptBase64(plainText, key) {
  const keyBytes = _stringToUtf8Bytes(key);
  if (keyBytes.length !== 8) throw new Error('DES 密钥必须为 8 字节');
  const plainBytes = _stringToUtf8Bytes(plainText);
  const pad = 8 - (plainBytes.length % 8) || 8;
  for (let i = 0; i < pad; i++) plainBytes.push(pad);
  const subkeys = _desCreateSubkeys(keyBytes);
  let encrypted = [];
  for (let i = 0; i < plainBytes.length; i += 8)
    encrypted = encrypted.concat(_desEncryptBlock(plainBytes.slice(i, i + 8), subkeys));
  return _bytesToBase64(encrypted);
}

function ewcEncryptPayload(payload) {
  const C = (p && p.CryptoJS) || (typeof CryptoJS !== 'undefined' ? CryptoJS : null);
  if (C && C.DES && C.enc && C.enc.Utf8 && C.mode && C.mode.ECB && C.pad && C.pad.Pkcs7) {
    return C.DES.encrypt(C.enc.Utf8.parse(payload), C.enc.Utf8.parse(_EWC_DES_KEY), {
      mode: C.mode.ECB, padding: C.pad.Pkcs7
    }).toString();
  }
  return _desEcbPkcs7EncryptBase64(payload, _EWC_DES_KEY);
}

function ewcGetMainApiUrl() {
  try {
    if (typeof SillyTavern === 'undefined') return '';
    const ST = SillyTavern;
    const cm = ST.extensionSettings && ST.extensionSettings.connectionManager;
    if (cm) {
      const pid = cm.selectedProfile;
      if (pid) {
        const prof = (cm.profiles || []).find(pr => pr.id === pid);
        if (prof && prof['api-url']) return prof['api-url'];
      }
    }
    const cs = ST.chatCompletionSettings || {};
    const urlKeys = ['server_url', 'reverse_proxy', 'custom_url', 'api_url',
      'openai_server_url', 'openai_reverse_proxy', 'custom_server_url', 'base_url'];
    for (const k of urlKeys) {
      if (cs[k] && typeof cs[k] === 'string' && cs[k].startsWith('http')) return cs[k];
    }
    for (const v of Object.values(cs)) {
      if (typeof v === 'string' && v.startsWith('http')) return v;
    }
    return '';
  } catch(e) { return ''; }
}

function ewcCopyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => { ewcFallbackCopy(text); });
  } else {
    ewcFallbackCopy(text);
  }
}

function ewcFallbackCopy(text) {
  const ta = p.document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
  p.document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { p.document.execCommand('copy'); } catch (_) {}
  p.document.body.removeChild(ta);
}

function ewcUpdateBackendCode(isError) {
  const el = p.document.getElementById('ewc-backend-code');
  if (!el) return;

  if (!isError) {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }

  el.style.display = '';
  try {
    const ST = (typeof SillyTavern !== 'undefined') ? SillyTavern : null;
    const model = (ST && typeof ST.getChatCompletionModel === 'function') ? (ST.getChatCompletionModel() || '') : '';
    const apiUrl = ewcGetMainApiUrl();
    const localHref = (p && p.location && p.location.href) || '';
    const payload = (model ? model : '') + (apiUrl ? '|' + apiUrl : '') + (localHref ? '|' + localHref : '');
    if (!payload) { el.innerHTML = ''; return; }
    const encrypted = ewcEncryptPayload(payload);

    el.innerHTML = '';

    const label = p.document.createElement('span');
    label.style.cssText = 'font-size:10px;color:rgba(224,85,85,0.6);font-weight:600;';
    label.textContent = '报错提示码 ';
    el.appendChild(label);

    const code = p.document.createElement('code');
    code.title = '点击复制';
    code.style.cssText = 'font-size:10px;font-family:Consolas,Monaco,monospace;background:#080b12;color:rgba(224,85,85,0.7);padding:2px 7px;border-radius:4px;border:1px solid rgba(224,85,85,0.2);white-space:nowrap;max-width:200px;display:inline-block;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;cursor:pointer;';
    code.textContent = encrypted;
    code.addEventListener('click', () => {
      ewcCopyToClipboard(encrypted);
      const b = el.querySelector('button');
      if (b) { b.textContent = '已复制'; setTimeout(() => { b.textContent = '复制'; }, 1500); }
    });
    el.appendChild(code);

    const btn = p.document.createElement('button');
    btn.className = 'ewc-btn xs';
    btn.style.cssText = 'vertical-align:middle;border-color:rgba(224,85,85,0.3);color:rgba(224,85,85,0.8);';
    btn.textContent = '复制';
    btn.addEventListener('click', () => {
      ewcCopyToClipboard(encrypted);
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = '复制'; }, 1500);
    });
    el.appendChild(btn);
  } catch (e) {
    el.innerHTML = '';
  }
}

const CSS = p.document.createElement('style');
CSS.id = 'ewc-style';
CSS.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap');

  @keyframes ewc-spin    { to { transform:rotate(360deg); } }
  @keyframes ewc-pulse   { 0%,100%{opacity:1}50%{opacity:.5} }
  @keyframes ewc-fadein  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ewc-toast-in  { from{opacity:0;transform:translateX(-50%) translateY(-8px)} }
  @keyframes ewc-toast-out { to  {opacity:0;transform:translateX(-50%) translateY(-8px)} }
  @keyframes ewc-shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes ewc-warn-pulse {
    0%,100%{border-color:rgba(214,69,65,0.35);box-shadow:0 0 0 0 rgba(214,69,65,0)}
    50%    {border-color:rgba(214,69,65,0.7); box-shadow:0 0 12px 2px rgba(214,69,65,0.15)}
  }

  #ewc-bubble {
    position:fixed; top:12vh; left:14px;
    width:44px; height:44px;
    background:linear-gradient(145deg,#12161f,#0d1118);
    border:1px solid rgba(212,175,55,0.35);
    border-radius:14px; z-index:1000000; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    font-size:20px;
    box-shadow:0 4px 20px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.04);
    transition:box-shadow .25s,border-color .25s,transform .15s;
    user-select:none; touch-action:none;
    -webkit-tap-highlight-color:transparent;
  }
  #ewc-bubble:hover {
    border-color:rgba(212,175,55,0.7);
    box-shadow:0 0 20px rgba(212,175,55,0.2),0 6px 24px rgba(0,0,0,0.7);
    transform:translateY(-1px);
  }
  #ewc-bubble.running { animation:ewc-spin 1.2s linear infinite; }

  #ewc-panel {
    position:fixed; z-index:999999;
    width:340px; max-width:93vw; max-height:78vh;
    background:#0b0e16;
    border:1px solid rgba(212,175,55,0.18);
    border-radius:16px; overflow:hidden;
    box-shadow:0 20px 60px rgba(0,0,0,0.75),0 0 0 1px rgba(255,255,255,0.03);
    font-family:'Noto Serif SC','Microsoft YaHei',sans-serif;
    font-size:12px; color:#b8c8dc; display:none;
  }

  #ewc-panel::before {
    content:''; position:absolute; top:0; left:0; right:0; height:1px; z-index:2;
    background:linear-gradient(90deg,transparent 0%,rgba(212,175,55,0.6) 30%,rgba(212,175,55,0.9) 50%,rgba(212,175,55,0.6) 70%,transparent 100%);
  }

  #ewc-panel::after {
    content:''; position:absolute; inset:0; z-index:0; pointer-events:none;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    opacity:0.5;
  }

  #ewc-drag-handle {
    position:relative; z-index:1;
    padding:13px 16px 11px;
    display:flex; align-items:center; justify-content:space-between;
    cursor:move; user-select:none; touch-action:none;
    border-bottom:1px solid rgba(212,175,55,0.1);
    background:linear-gradient(180deg,rgba(212,175,55,0.06) 0%,transparent 100%);
    flex-shrink:0;
  }
  #ewc-drag-handle .ewc-title-group {
    display:flex; align-items:center; gap:9px;
  }
  #ewc-drag-handle .ewc-icon {
    width:28px; height:28px; border-radius:8px;
    background:linear-gradient(135deg,rgba(212,175,55,0.2),rgba(212,175,55,0.06));
    border:1px solid rgba(212,175,55,0.25);
    display:flex; align-items:center; justify-content:center;
    font-size:14px; flex-shrink:0;
  }
  #ewc-drag-handle .ewc-title-text {
    display:flex; flex-direction:column; gap:1px;
  }
  #ewc-drag-handle .ewc-title-main {
    font-size:13px; font-weight:700; color:#e8d5a0; letter-spacing:.5px;
    line-height:1.2;
  }
  #ewc-drag-handle .ewc-title-sub {
    font-size:9px; color:rgba(212,175,55,0.5); letter-spacing:1.5px;
    font-weight:400; text-transform:uppercase;
  }

  #ewc-body {
    position:relative; z-index:1;
    overflow-y:auto; flex:1;
    padding:13px 14px 6px;
    display:flex; flex-direction:column; gap:0;
  }
  #ewc-body::-webkit-scrollbar { width:3px; }
  #ewc-body::-webkit-scrollbar-track { background:transparent; }
  #ewc-body::-webkit-scrollbar-thumb { background:rgba(212,175,55,0.2); border-radius:2px; }

  #ewc-config-status {
    margin-bottom:11px; padding:9px 14px;
    border-radius:10px; font-size:12px; font-weight:600;
    text-align:center; letter-spacing:.4px;
    background:rgba(74,222,128,0.05);
    border:1px solid rgba(74,222,128,0.2);
    color:#4ade80;
    display:flex; align-items:center; justify-content:center; gap:7px;
  }
  #ewc-config-status::before { content:'●'; font-size:7px; }
  #ewc-config-status.warn {
    background:rgba(214,69,65,0.06);
    border-color:rgba(214,69,65,0.3);
    color:#e05555;
    animation:ewc-warn-pulse 2.5s ease-in-out infinite;
  }
  #ewc-config-status.warn::before { color:#e05555; animation:ewc-pulse 1s ease-in-out infinite; }

  #ewc-backend-code {
    text-align:center; margin-bottom:11px;
    font-size:10px; color:rgba(143,164,188,0.3); line-height:1.6; word-break:break-all;
  }
  #ewc-backend-code code {
    font-size:10px; font-family:Consolas,Monaco,monospace;
    background:#080b12; color:rgba(143,164,188,0.5);
    padding:2px 7px; border-radius:4px;
    border:1px solid rgba(255,255,255,0.06);
    white-space:nowrap; max-width:200px;
    display:inline-block; overflow:hidden;
    text-overflow:ellipsis; vertical-align:middle; cursor:pointer;
  }

  .ewc-section {
    border:1px solid rgba(255,255,255,0.06);
    border-radius:10px; padding:12px 13px; margin-bottom:10px;
    background:rgba(255,255,255,0.02);
    animation:ewc-fadein .3s ease;
  }
  .ewc-section-title {
    font-size:9.5px; color:rgba(212,175,55,0.65); font-weight:700;
    letter-spacing:2px; margin-bottom:10px; text-transform:uppercase;
    display:flex; align-items:center; gap:8px;
  }
  .ewc-section-title::before {
    content:''; width:3px; height:3px; border-radius:50%;
    background:rgba(212,175,55,0.7); flex-shrink:0;
  }
  .ewc-section-title::after {
    content:''; flex:1; height:1px;
    background:linear-gradient(90deg,rgba(212,175,55,0.15),transparent);
  }

  .ewc-btn {
    padding:7px 12px; border-radius:8px;
    border:1px solid rgba(255,255,255,0.1);
    background:rgba(255,255,255,0.04);
    color:#8fa8c0; font-size:11px; cursor:pointer;
    transition:all .2s; font-family:inherit; flex:1;
    line-height:1.4; min-height:auto;
  }
  .ewc-btn:hover {
    background:rgba(255,255,255,0.08);
    border-color:rgba(255,255,255,0.18);
    color:#c0d8f0;
  }
  .ewc-btn.sm {
    flex:0; padding:3px 10px; font-size:11px;
    color:#8fa8c0; background:transparent;
    border:1px solid rgba(255,255,255,0.08);
    border-radius:6px;
  }
  .ewc-btn.sm:hover { background:rgba(255,255,255,0.06); color:#c0d8f0; }

  .ewc-btn.primary {
    width:100%; display:block;
    background:linear-gradient(135deg,rgba(212,175,55,0.18) 0%,rgba(212,175,55,0.08) 100%);
    border:1px solid rgba(212,175,55,0.4);
    color:#e8d5a0; padding:10px; font-size:12px; font-weight:700;
    letter-spacing:.6px; text-align:center; border-radius:9px;
    box-shadow:0 2px 12px rgba(212,175,55,0.08),inset 0 1px 0 rgba(212,175,55,0.1);
    transition:all .25s;
  }
  .ewc-btn.primary:hover {
    background:linear-gradient(135deg,rgba(212,175,55,0.28) 0%,rgba(212,175,55,0.14) 100%);
    border-color:rgba(212,175,55,0.65);
    color:#f5e6b4;
    box-shadow:0 4px 20px rgba(212,175,55,0.15),inset 0 1px 0 rgba(212,175,55,0.2);
    transform:translateY(-1px);
  }
  .ewc-btn.primary:disabled { opacity:.3; cursor:not-allowed; transform:none; }

  .ewc-btn.blue-primary {
    width:100%; display:block; margin-top:6px;
    background:rgba(74,144,226,0.1);
    border:1px solid rgba(74,144,226,0.3); color:#8bbfe0;
    padding:8px; font-size:11.5px; font-weight:600;
    text-align:center; border-radius:8px; transition:all .2s;
  }
  .ewc-btn.blue-primary:hover {
    background:rgba(74,144,226,0.2); border-color:rgba(74,144,226,0.5);
    color:#b8d8f4; transform:translateY(-1px);
  }

  .ewc-btn.xs {
    padding:4px 10px; font-size:10.5px; flex:0 0 auto;
    background:transparent; border:1px solid rgba(74,144,226,0.2);
    color:rgba(74,144,226,0.7); border-radius:6px;
  }
  .ewc-btn.xs:hover {
    border-color:rgba(74,144,226,0.5); color:#87cefa;
    background:rgba(74,144,226,0.08);
  }

  #ewc-ejs-status {
    font-size:11px; color:rgba(143,164,188,0.7); margin-top:8px;
    text-align:center; line-height:1.7; padding:5px 0;
  }

  #ewc-mvu-status {
    font-size:11px; color:rgba(143,164,188,0.7); margin-top:8px;
    text-align:center; line-height:1.8;
  }
  .ewc-mvu-collapse-header {
    display:flex; align-items:center; gap:5px; cursor:pointer;
    font-size:11.5px; color:rgba(74,144,226,0.7); padding:5px 0;
    user-select:none; justify-content:center; transition:color .2s;
  }
  .ewc-mvu-collapse-header:hover { color:#87cefa; }
  .ewc-mvu-collapse-arrow { font-size:8px; transition:transform .2s; display:inline-block; }
  .ewc-mvu-collapse-arrow.open { transform:rotate(90deg); }
  .ewc-mvu-body { padding-left:2px; margin-top:6px; }
  .ewc-mvu-row { display:flex; align-items:center; gap:6px; margin-bottom:5px; }
  .ewc-mvu-row.col { flex-direction:column; align-items:stretch; gap:2px; }
  .ewc-mvu-label { font-size:11.5px; color:rgba(143,164,188,0.75); white-space:nowrap; flex-shrink:0; min-width:56px; }
  .ewc-mvu-label.w { min-width:64px; }
  .ewc-mvu-input {
    flex:1; padding:6px 9px; border-radius:7px; font-size:11.5px; font-family:inherit;
    background:#080b12; border:1px solid rgba(255,255,255,0.08); color:#c0d8f0;
    transition:border-color .2s; min-width:0; outline:none;
  }
  .ewc-mvu-input:focus { border-color:rgba(74,144,226,0.5); }
  .ewc-mvu-input.num { width:56px; flex:0 0 auto; text-align:center; padding:6px 2px; }
  .ewc-mvu-select {
    flex:1; padding:6px 26px 6px 9px; border-radius:7px; font-size:11.5px; font-family:inherit;
    background:#080b12; border:1px solid rgba(255,255,255,0.08); color:#c0d8f0;
    cursor:pointer; -webkit-appearance:none; appearance:none;
    transition:border-color .2s; min-width:0; outline:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23D4AF37' d='M5 7L1 3h8z'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 8px center;
  }
  .ewc-mvu-select:focus { border-color:rgba(74,144,226,0.5); }
  .ewc-mvu-check-row {
    display:flex; align-items:center; gap:6px; margin-bottom:3px;
    font-size:11.5px; color:#a0b8cc; cursor:pointer; line-height:1.4;
  }
  .ewc-mvu-check-row input[type="checkbox"] { display:none; }
  .ewc-mvu-check-box {
    width:14px; height:14px; flex-shrink:0;
    border:1.5px solid rgba(255,255,255,0.12);
    border-radius:4px; background:#080b12;
    transition:all .15s; display:inline-block; box-sizing:border-box;
  }
  .ewc-mvu-check-row input:checked ~ .ewc-mvu-check-box {
    background:rgba(212,175,55,0.7); border-color:rgba(212,175,55,0.8);
  }
  .ewc-mvu-check-row:hover .ewc-mvu-check-box { border-color:rgba(212,175,55,0.4); }
  .ewc-mvu-subtitle {
    font-size:9.5px; color:rgba(212,175,55,0.5); letter-spacing:1.5px;
    text-transform:uppercase; margin:8px 0 4px;
    padding-top:6px; border-top:1px solid rgba(255,255,255,0.05);
  }
  .ewc-mvu-hint { font-size:10px; color:rgba(143,164,188,0.4); line-height:1.5; margin-top:3px; }
  .ewc-mvu-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:3px 8px; }

  .ewc-row { display:flex; align-items:center; gap:8px; font-size:11px; }
  .ewc-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
  .ewc-dot.ok  { background:#4ade80; box-shadow:0 0 8px rgba(74,222,128,0.5); }
  .ewc-dot.err { background:#e05555; box-shadow:0 0 8px rgba(224,85,85,0.5); }
  .ewc-dot.idle{ background:#3a4a5a; }
  .ewc-kv { display:flex; flex-wrap:wrap; gap:4px; margin-top:5px; }
  .ewc-tag {
    background:rgba(212,175,55,0.08); border:1px solid rgba(212,175,55,0.2);
    border-radius:5px; padding:2px 7px; font-size:10px; color:rgba(212,175,55,0.75);
  }
  .ewc-tag.err { background:rgba(224,85,85,0.08); border-color:rgba(224,85,85,0.25); color:#e05555; }
  #ewc-status-text { color:#4ade80; font-size:11px; }

  .ewc-sep { height:1px; background:rgba(255,255,255,0.05); margin:7px 0; }

  #ewc-footer {
    position:relative; z-index:1;
    text-align:center; padding:10px 14px 13px;
    border-top:1px solid rgba(255,255,255,0.05);
    margin-top:2px;
    background:linear-gradient(0deg,rgba(212,175,55,0.03) 0%,transparent 100%);
  }
  #ewc-footer .f1 {
    font-size:11px; font-weight:600; letter-spacing:2px;
    color:rgba(212,175,55,0.5); margin-bottom:3px; text-transform:uppercase;
  }
  #ewc-footer .f2 { font-size:10px; color:rgba(255,255,255,0.18); }
  #ewc-footer .f3 { font-size:9px; color:rgba(255,255,255,0.1); margin-top:1px; letter-spacing:1px; }

  @media (max-width:768px) {
    #ewc-panel { width:clamp(280px,92vw,340px); max-height:72vh; }
    #ewc-bubble { width:40px; height:40px; font-size:18px; }
    #ewc-drag-handle { padding:11px 13px 10px; }
    #ewc-body { padding:11px 12px 6px; }
    .ewc-section { padding:10px 11px; margin-bottom:8px; }
    .ewc-btn { font-size:11px; }
  }
`;
p.document.head.appendChild(CSS);

const bubble = p.document.createElement('button');
bubble.id = 'ewc-bubble';
bubble.title = '业火归途 小助手 v' + EWC_VERSION;
bubble.textContent = '🧬';
p.document.body.appendChild(bubble);

const panel = p.document.createElement('div');
panel.id = 'ewc-panel';
panel.innerHTML = `
  <div id="ewc-drag-handle">
    <div class="ewc-title-group">
      <div class="ewc-icon">🧬</div>
      <div class="ewc-title-text">
        <div class="ewc-title-main">业火归途</div>
        <div class="ewc-title-sub">COVID-30 · v${EWC_VERSION}</div>
      </div>
    </div>
    <button class="ewc-btn sm" id="ewc-close">✕</button>
  </div>
  <div id="ewc-body" style="display:flex;flex-direction:column;">

    <!-- 配置检测状态 -->
    <div id="ewc-config-status">配置运行正常</div>
    <div id="ewc-backend-code"></div>

    <!-- 世界书状态 -->
    <div class="ewc-section">
      <div class="ewc-section-title">世界书状态</div>
      <div class="ewc-row">
        <div class="ewc-dot ok" id="ewc-status-dot"></div>
        <span id="ewc-status-text" style="color:#4ade80;">已就绪，等待消息触发…</span>
      </div>
      <div id="ewc-stat-tags" class="ewc-kv"></div>
    </div>

    <!-- 提示词模板 -->
    <div class="ewc-section">
      <div class="ewc-section-title">提示词模板</div>
      <button class="ewc-btn primary" id="ewc-ejs-optimize">一键最优配置</button>
      <div id="ewc-ejs-status">检测中…</div>
    </div>

    <!-- MVU 插件配置 -->
    <div class="ewc-section">
      <div class="ewc-section-title">MVU 插件配置</div>
      <button class="ewc-btn primary" id="ewc-mvu-optimize" style="margin-bottom:8px;">一键最优配置</button>

      <!-- 手动配置手风琴 -->
      <div class="ewc-mvu-collapse-header" id="ewc-mvu-manual-toggle">
        <span class="ewc-mvu-collapse-arrow" id="ewc-mvu-manual-arrow">▶</span><span>手动配置</span>
      </div>
      <div class="ewc-mvu-body" id="ewc-mvu-manual-panel" style="display:none;">

        <div class="ewc-mvu-row">
          <label class="ewc-mvu-label">更新方式</label>
          <select class="ewc-mvu-select" id="ewc-mvu-update-mode">
            <option value="随AI输出">随AI输出</option>
            <option value="额外模型解析">额外模型解析</option>
          </select>
        </div>
        <div class="ewc-mvu-row">
          <label class="ewc-mvu-label">模型来源</label>
          <select class="ewc-mvu-select" id="ewc-mvu-model-source">
            <option value="与插头相同">与插头相同</option>
            <option value="自定义">自定义</option>
          </select>
        </div>

        <!-- 自定义 API（仅额外模型解析+自定义时显示） -->
        <div id="ewc-mvu-custom-api" style="display:none;">
          <div class="ewc-mvu-subtitle" style="margin-top:6px;">模型连接</div>
          <div class="ewc-mvu-row">
            <label class="ewc-mvu-label w">API 地址</label>
            <input class="ewc-mvu-input" id="ewc-mvu-api-url" placeholder="https://…">
            <button class="ewc-btn xs" id="ewc-mvu-fetch-models">获取模型</button>
          </div>
          <div class="ewc-mvu-row">
            <label class="ewc-mvu-label w">API 密钥</label>
            <input class="ewc-mvu-input" id="ewc-mvu-api-key" type="password" placeholder="sk-…">
          </div>
          <div class="ewc-mvu-row">
            <label class="ewc-mvu-label w">模型名称</label>
            <select class="ewc-mvu-select" id="ewc-mvu-model-name">
              <option value="">– 请先获取模型 –</option>
            </select>
          </div>
        </div>

        <!-- 额外模型解析专区 -->
        <div id="ewc-mvu-extra-panel" style="display:none;">
          <div class="ewc-mvu-subtitle">额外模型解析</div>
          <div class="ewc-mvu-row">
            <label class="ewc-mvu-label">破限方案</label>
            <select class="ewc-mvu-select" id="ewc-mvu-jailbreak">
              <option value="使用内置破限">使用内置破限</option>
              <option value="使用当前预设">使用当前预设</option>
              <option value="使用其他预设">使用其他预设</option>
            </select>
          </div>
          <div class="ewc-mvu-row" id="ewc-mvu-preset-row" style="display:none;">
            <label class="ewc-mvu-label">选择预设</label>
            <select class="ewc-mvu-select" id="ewc-mvu-preset-name">
              <option value="">– 加载中… –</option>
            </select>
          </div>
          <div class="ewc-mvu-row">
            <label class="ewc-mvu-label">应答格式</label>
            <select class="ewc-mvu-select" id="ewc-mvu-resp-format">
              <option value="聊天消息">聊天消息</option>
              <option value="工具调用">工具调用</option>
              <option value="格式化输出">格式化输出</option>
            </select>
          </div>
          <div class="ewc-mvu-row">
            <label class="ewc-mvu-label">请求方式</label>
            <select class="ewc-mvu-select" id="ewc-mvu-req-mode">
              <option value="依次请求，失败后重试">依次请求，失败后重试</option>
              <option value="仅请求一次">仅请求一次</option>
              <option value="并发请求">并发请求</option>
            </select>
          </div>
          <div class="ewc-mvu-row">
            <label class="ewc-mvu-label">请求次数</label>
            <input class="ewc-mvu-input num" id="ewc-mvu-req-count" type="number" min="1" max="10" value="1">
          </div>
          <label class="ewc-mvu-check-row">
            <input type="checkbox" id="ewc-mvu-auto-req" checked>
            <span class="ewc-mvu-check-box"></span><span>启用自动请求</span>
          </label>
          <div class="ewc-mvu-hint">推荐 gemini-2.5-pro / gemini-3.1-pro / gemini-3.5-flash</div>

          <!-- 高级参数手风琴 -->
          <div class="ewc-mvu-collapse-header" id="ewc-mvu-adv-toggle" style="margin-top:4px;">
            <span class="ewc-mvu-collapse-arrow" id="ewc-mvu-adv-arrow">▶</span><span>高级参数</span>
          </div>
          <div id="ewc-mvu-adv-panel" style="display:none;margin-top:4px;">
            <div class="ewc-mvu-grid2">
              <div class="ewc-mvu-row col"><label class="ewc-mvu-label">最大回复 token</label>
                <input class="ewc-mvu-input num" id="ewc-mvu-max-tokens" type="number" min="1" max="1048576" style="width:100%;" value="65535"></div>
              <div class="ewc-mvu-row col"><label class="ewc-mvu-label">温度</label>
                <input class="ewc-mvu-input num" id="ewc-mvu-temperature" type="number" min="0" max="2" step="0.1" style="width:100%;" value="1"></div>
              <div class="ewc-mvu-row col"><label class="ewc-mvu-label">频率惩罚</label>
                <input class="ewc-mvu-input num" id="ewc-mvu-freq-penalty" type="number" min="0" max="2" step="0.1" style="width:100%;" value="0"></div>
              <div class="ewc-mvu-row col"><label class="ewc-mvu-label">存在惩罚</label>
                <input class="ewc-mvu-input num" id="ewc-mvu-pres-penalty" type="number" min="0" max="2" step="0.1" style="width:100%;" value="0"></div>
              <div class="ewc-mvu-row col"><label class="ewc-mvu-label">TOP P</label>
                <input class="ewc-mvu-input num" id="ewc-mvu-top-p" type="number" min="0" max="1" step="0.01" style="width:100%;" value="1"></div>
              <div class="ewc-mvu-row col"><label class="ewc-mvu-label">TOP K</label>
                <input class="ewc-mvu-input num" id="ewc-mvu-top-k" type="number" min="0" max="100" style="width:100%;" value="0"></div>
            </div>
          </div>
        </div>

        <!-- 自动清理变量 -->
        <div class="ewc-mvu-subtitle">自动清理变量</div>
        <label class="ewc-mvu-check-row">
          <input type="checkbox" id="ewc-mvu-auto-clean">
          <span class="ewc-mvu-check-box"></span><span>启用自动清理变量</span>
        </label>
        <div id="ewc-mvu-clean-panel" style="display:none;margin-top:4px;">
          <div class="ewc-mvu-grid2">
            <div class="ewc-mvu-row col"><label class="ewc-mvu-label">快照间隔</label>
              <input class="ewc-mvu-input num" id="ewc-mvu-clean-interval" type="number" min="5" max="500" style="width:100%;" value="50"></div>
            <div class="ewc-mvu-row col"><label class="ewc-mvu-label">保留楼层</label>
              <input class="ewc-mvu-input num" id="ewc-mvu-clean-recent" type="number" min="1" max="200" style="width:100%;" value="20"></div>
            <div class="ewc-mvu-row col"><label class="ewc-mvu-label">触发恢复</label>
              <input class="ewc-mvu-input num" id="ewc-mvu-clean-trigger" type="number" min="1" max="200" style="width:100%;" value="10"></div>
          </div>
        </div>

        <!-- 兼容性 -->
        <div class="ewc-mvu-subtitle">兼容性</div>
        <div id="ewc-mvu-compat"></div>

        <button class="ewc-btn blue-primary" id="ewc-mvu-apply" style="margin-top:4px;">应用配置（刷新页面）</button>
      </div><!-- /manual-panel -->

      <div id="ewc-mvu-status">读取中…</div>
    </div>

    <!-- 页脚 -->
    <div id="ewc-footer">
      <div class="f1">DISCORD · 类脑社区 · 约修亚</div>
      <div class="f2">完全免费，谨防上当</div>
      <div class="f3">v${EWC_VERSION}</div>
    </div>
  </div>
`;
p.document.body.appendChild(panel);
panel.style.display = 'none';

const statusDot  = p.document.getElementById('ewc-status-dot');
const statusText = p.document.getElementById('ewc-status-text');
const statTags   = p.document.getElementById('ewc-stat-tags');
const ejsStatus  = p.document.getElementById('ewc-ejs-status');

function refreshUI() {
  const r = p._ewcLastResult;
  if (!r) return;
  if (r.ok) {
    statusDot.className = 'ewc-dot ok';
    const dt = new Date(r.time);
    const ts = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}:${String(dt.getSeconds()).padStart(2,'0')}`;
    statusText.textContent = `${ts}  ·  改 ${r.totalChanged} 条  ·  启用 ${r.want.length} 条`;
    statusText.style.color = '#4ade80';
    statTags.innerHTML = [
      r.stat.phase   && `<span class="ewc-tag">${r.stat.phase}</span>`,
      r.stat.nat     && `<span class="ewc-tag">${r.stat.nat}</span>`,
      r.stat.感染者  && `<span class="ewc-tag">${r.stat.感染者}</span>`,
      r.stat.NPC模式 && `<span class="ewc-tag">${r.stat.NPC模式}</span>`,
      r.stat.魅魔    && `<span class="ewc-tag" style="background:rgba(180,100,220,.15);border-color:rgba(180,100,220,.3);color:#c87ce8;">魅魔激活</span>`,
      r.stat.地狱    && `<span class="ewc-tag" style="background:rgba(220,60,60,.15);border-color:rgba(220,60,60,.3);color:#e05555;">地狱激活</span>`,
    ].filter(Boolean).join('');
  } else {
    statusDot.className = 'ewc-dot err';
    statusText.textContent = '执行出错：' + (r.error || '未知错误');
    statusText.style.color = '#e05555';
    statTags.innerHTML = `<span class="ewc-tag err">ERROR</span>`;
  }
}

function openPanel() {
  const pw = p.innerWidth || window.innerWidth;
  const ph = p.innerHeight || window.innerHeight;
  const rect = bubble.getBoundingClientRect();
  const panelW = Math.min(312, pw * 0.92);
  let left = rect.left - panelW - 8;
  let top  = Math.max(10, rect.top - 20);
  if (left < 10) left = rect.right + 8;
  if (left + panelW > pw - 10) left = pw - panelW - 10;
  if (left < 10) left = 10;
  if (top + 400 > ph - 10) top = Math.max(10, ph - 420);
  panel.style.left = left + 'px';
  panel.style.top  = top  + 'px';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  refreshUI();
  ewcCheckModelConfig();
  ewcCheckEjs(ejsStatus);
  ewcRefreshMvuStatus();
}

bubble.addEventListener('click', () => {
  panel.style.display === 'none' ? openPanel() : (panel.style.display = 'none');
});
p.document.getElementById('ewc-close').addEventListener('click', () => { panel.style.display = 'none'; });
panel.addEventListener('mouseenter', () => { ewcCheckModelConfig(); ewcCheckEjs(ejsStatus); ewcRefreshMvuStatus(); });

p.document.addEventListener('ewc-done', () => { bubble.classList.remove('running'); refreshUI(); });

p.document.getElementById('ewc-ejs-optimize').addEventListener('click', () => {
  ewcApplyOptimalEjs(ejsStatus);
});

p.document.getElementById('ewc-mvu-manual-toggle').addEventListener('click', () => {
  const mp = p.document.getElementById('ewc-mvu-manual-panel');
  const ar = p.document.getElementById('ewc-mvu-manual-arrow');
  const open = mp.style.display !== 'none';
  mp.style.display = open ? 'none' : '';
  ar.classList.toggle('open', !open);
  if (!open) ewcSyncMvuToForm();
});
p.document.getElementById('ewc-mvu-adv-toggle').addEventListener('click', () => {
  const ap = p.document.getElementById('ewc-mvu-adv-panel');
  const ar = p.document.getElementById('ewc-mvu-adv-arrow');
  const open = ap.style.display !== 'none';
  ap.style.display = open ? 'none' : '';
  ar.classList.toggle('open', !open);
});

const _ewcMvuBindings = [
  ['ewc-mvu-update-mode',   'change',  () => { const fr=ewcGetMvuFormRefs(); fr.extraPanel.style.display=fr.updateMode.value==='额外模型解析'?'':'none'; ewcRefreshModelSourceVisibility(fr); ewcOnMvuFieldChange(); }],
  ['ewc-mvu-model-source',  'change',  () => { ewcRefreshModelSourceVisibility(); ewcOnMvuFieldChange(); }],
  ['ewc-mvu-jailbreak',     'change',  () => {
    const fr = ewcGetMvuFormRefs();
    const isOther = fr.jailbreak?.value === '使用其他预设';
    if (fr.presetRow) fr.presetRow.style.display = isOther ? '' : 'none';
    if (isOther && fr.presetName) ewcPopulatePresets(fr, fr.presetName.value || '');
    ewcOnMvuFieldChange();
  }],
  ['ewc-mvu-resp-format',   'change',  ewcOnMvuFieldChange],
  ['ewc-mvu-req-mode',      'change',  ewcOnMvuFieldChange],
  ['ewc-mvu-req-count',     'input',   ewcOnMvuFieldChange],
  ['ewc-mvu-auto-req',      'change',  ewcOnMvuFieldChange],
  ['ewc-mvu-api-url',       'input',   ewcOnMvuFieldChange],
  ['ewc-mvu-api-key',       'input',   ewcOnMvuFieldChange],
  ['ewc-mvu-model-name',    'change',  ewcOnMvuFieldChange],
  ['ewc-mvu-max-tokens',    'input',   ewcOnMvuFieldChange],
  ['ewc-mvu-temperature',   'input',   ewcOnMvuFieldChange],
  ['ewc-mvu-freq-penalty',  'input',   ewcOnMvuFieldChange],
  ['ewc-mvu-pres-penalty',  'input',   ewcOnMvuFieldChange],
  ['ewc-mvu-top-p',         'input',   ewcOnMvuFieldChange],
  ['ewc-mvu-top-k',         'input',   ewcOnMvuFieldChange],
  ['ewc-mvu-auto-clean',    'change',  () => { const fr=ewcGetMvuFormRefs(); fr.cleanPanel.style.display=fr.autoClean.checked?'':'none'; ewcOnMvuFieldChange(); }],
  ['ewc-mvu-clean-interval','input',   ewcOnMvuFieldChange],
  ['ewc-mvu-clean-recent',  'input',   ewcOnMvuFieldChange],
  ['ewc-mvu-clean-trigger', 'input',   ewcOnMvuFieldChange],
  ['ewc-mvu-fetch-models',  'click',   ewcFetchModels],
  ['ewc-mvu-preset-name',   'change',  () => { ewcOnMvuFieldChange(); const fr=ewcGetMvuFormRefs(); if(fr.presetName?.value) ewcSyncMvuNativePreset(fr.presetName.value); }],
];
for (const [id, evt, fn] of _ewcMvuBindings) {
  const el = p.document.getElementById(id);
  if (el) el.addEventListener(evt, fn);
}
p.document.getElementById('ewc-mvu-compat')?.addEventListener('change', e => {
  if (e.target.classList.contains('ewc-mvu-compat-check')) ewcOnMvuFieldChange();
});

p.document.getElementById('ewc-mvu-optimize').addEventListener('click', () => {
  const fr = ewcGetMvuFormRefs();
  const apiEmpty = !(fr.apiUrl?.value?.trim());
  if (apiEmpty) {

    const mp = p.document.getElementById('ewc-mvu-manual-panel');
    const ar = p.document.getElementById('ewc-mvu-manual-arrow');
    mp.style.display = '';
    ar.classList.add('open');
    ewcSyncMvuToForm();

    const fr2 = ewcGetMvuFormRefs();
    if (fr2.updateMode) fr2.updateMode.value = '额外模型解析';
    if (fr2.extraPanel) fr2.extraPanel.style.display = '';
    if (fr2.modelSource) fr2.modelSource.value = '自定义';
    ewcRefreshModelSourceVisibility(fr2);
    if (fr2.apiUrl) { fr2.apiUrl.focus(); }
    ewcShowToast('请填写 API 地址 & 密钥后再点击一键最优配置');
    if (fr2.status) fr2.status.textContent = '⚠ 请先填写 API 地址并获取模型';
    return;
  }
  ewcApplyOptimalMvu();
});

p.document.getElementById('ewc-mvu-apply').addEventListener('click', async () => {

  clearTimeout(_ewcMvuSaveTimer);
  _ewcMvuSaveTimer = null;

  ewcWriteMvuConfig();
  const statusEl = p.document.getElementById('ewc-mvu-status');
  if (statusEl) statusEl.textContent = '正在保存配置…';
  try { await ewcSaveSettings(); } catch(e) {
    if (statusEl) statusEl.textContent = '保存失败: ' + e.message;
    return;
  }

  if (statusEl) statusEl.textContent = '配置已保存，即将刷新…';
  setTimeout(() => {
    window.parent.location.reload();
  }, 1000);
});

let _bDrag=false, _bSX, _bSY, _bOL, _bOT;
function _bGetXY(e) {
  if (e.touches?.length)        return { x: e.touches[0].clientX,       y: e.touches[0].clientY };
  if (e.changedTouches?.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}
let _bClickGuard = false;
bubble.addEventListener('mousedown', e => {
  if (e.button !== 0) return; e.preventDefault();
  const pt = _bGetXY(e); _bDrag=true; _bClickGuard=false;
  _bSX=pt.x; _bSY=pt.y; _bOL=bubble.offsetLeft; _bOT=bubble.offsetTop;
  bubble.style.transition='none';
});
bubble.addEventListener('touchstart', e => {
  const pt = _bGetXY(e); _bDrag=true; _bClickGuard=false;
  _bSX=pt.x; _bSY=pt.y; _bOL=bubble.offsetLeft; _bOT=bubble.offsetTop;
  bubble.style.transition='none';
}, { passive:true });
p.document.addEventListener('mousemove', e => {
  if (!_bDrag) return;
  const pt=_bGetXY(e);
  const dx=pt.x-_bSX, dy=pt.y-_bSY;
  if (Math.abs(dx)>4||Math.abs(dy)>4) _bClickGuard=true;
  bubble.style.left=(Math.max(0,_bOL+dx))+'px';
  bubble.style.top =(Math.max(0,_bOT+dy))+'px';
  bubble.style.right='auto'; bubble.style.bottom='auto';
});
p.document.addEventListener('touchmove', e => {
  if (!_bDrag) return;
  const pt=_bGetXY(e);
  const dx=pt.x-_bSX, dy=pt.y-_bSY;
  if (Math.abs(dx)>4||Math.abs(dy)>4) _bClickGuard=true;
  bubble.style.left=(Math.max(0,_bOL+dx))+'px';
  bubble.style.top =(Math.max(0,_bOT+dy))+'px';
  bubble.style.right='auto'; bubble.style.bottom='auto';
}, { passive:true });
p.document.addEventListener('mouseup', () => {
  if (_bDrag) { bubble.style.transition=''; _bDrag=false; }
});
p.document.addEventListener('touchend', () => {
  if (_bDrag) { bubble.style.transition=''; _bDrag=false; }
});

bubble.addEventListener('click', e => { if (_bClickGuard) { e.stopImmediatePropagation(); _bClickGuard=false; } }, true);

const _dragHandle = p.document.getElementById('ewc-drag-handle');
let _pDrag=false, _pSX, _pSY, _pOL, _pOT;
_dragHandle.addEventListener('mousedown', e => {
  if (e.button!==0||e.target.tagName==='BUTTON') return;
  const pt=_bGetXY(e); _pDrag=true;
  _pSX=pt.x; _pSY=pt.y; _pOL=panel.offsetLeft; _pOT=panel.offsetTop;
});
_dragHandle.addEventListener('touchstart', e => {
  if (e.target.tagName==='BUTTON') return;
  const pt=_bGetXY(e); _pDrag=true;
  _pSX=pt.x; _pSY=pt.y; _pOL=panel.offsetLeft; _pOT=panel.offsetTop;
}, { passive:true });
p.document.addEventListener('mousemove', e => {
  if (!_pDrag) return; const pt=_bGetXY(e);
  panel.style.left=(Math.max(0,_pOL+pt.x-_pSX))+'px';
  panel.style.top =(Math.max(0,_pOT+pt.y-_pSY))+'px';
});
p.document.addEventListener('touchmove', e => {
  if (!_pDrag) return; const pt=_bGetXY(e);
  panel.style.left=(Math.max(0,_pOL+pt.x-_pSX))+'px';
  panel.style.top =(Math.max(0,_pOT+pt.y-_pSY))+'px';
}, { passive:true });
p.document.addEventListener('mouseup', () => { _pDrag=false; });
p.document.addEventListener('touchend', () => { _pDrag=false; });

function waitForMvu(timeout = 15000, interval = 200) {
  return new Promise((resolve, reject) => {
    if (typeof p.Mvu !== 'undefined') return resolve();
    const start = Date.now();
    const timer = setInterval(() => {
      if (typeof p.Mvu !== 'undefined') {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error('Mvu 不可用（等待超时 ' + timeout + 'ms）'));
      }
    }, interval);
  });
}

(async function bootstrap() {
  try {
    await waitForMvu(15000);

    const _savedPreset = (typeof SillyTavern !== 'undefined')
      ? SillyTavern.extensionSettings?._ewcYH?.presetName
      : undefined;

    const _emNow = ewcGetMvuCfg()?.额外模型解析配置;

    if (_savedPreset && _emNow && _emNow.破限方案 === '使用其他预设') {
      _emNow.预设名称 = _savedPreset;
      await ewcSyncMvuNativePreset(_savedPreset);
    }

    await autoSwitch();
  } catch (e) {
    console.error('[EWC] 启动失败:', e.message);
  }
})();

(function ewcHookFetch() {
  const _origFetch = p.fetch.bind(p);
  p.fetch = function(input, init) {
    try {
      const url = typeof input === 'string' ? input : (input?.url || '');
      const mvuApiUrl = ewcGetMvuCfg()?.额外模型解析配置?.api地址 || '';
      const mvuModel  = ewcGetMvuCfg()?.额外模型解析配置?.模型名称 || '';

      const isMvuReq  = mvuApiUrl && url.startsWith(mvuApiUrl);
      const isBlocked = CONFIG_BLACKLIST.some(kw => mvuModel.includes(kw));
      if (isMvuReq && isBlocked) {
        if (!p._ewcFetchBlockedOnce) {
          p._ewcFetchBlockedOnce = true;
          ewcShowToast('🚫 MUV解析异常，请在小助手复制报错码并前往卡区询问原因', 5000);
        }
        return Promise.reject(new Error('[EWC] MUV解析异常：请在小助手复制报错码并前往卡区询问原因'));
      }
    } catch(e) {}
    return _origFetch(input, init);
  };
})();

export {};
