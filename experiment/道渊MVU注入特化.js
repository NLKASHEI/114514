// ═══════════════════════════════════════════════════════════════
// 道渊 MVU 注入特化 · experiment 2.1
// ---------------------------------------------------------------
// 不动世界书、不动 MVU 源码、不动 ZOD，只在"请求组装"这一步：
//   1) 把 <status_current_variables> 里的整棵 stat_data 换成"投影"
//   2) 追加 <mvu变量上一轮次修改日志>：时间校验 + 上轮净变化
//   3) 可选：时间越界时回滚（BEFORE_MESSAGE_UPDATE 钩子）
//
// 投影规则：
//   - 长文本按字段截断；仙姿/群芳谱/引言不进提示词（状态栏照旧显示）
//   - 道侣/人物/灵宠/玉简：只在"最近消息或当前地点"出现时全文注入，
//     否则压成摘要（境界/亲密/关系等），并标 在场: false
//   - stat_data 本身不动
//
// 回滚：禁用脚本即可。
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const VERSION = '2.1.0-experiment';
  const TAG = '[道渊EXPR]';
  const MVU_DIAGNOSTIC_EVENT = 'daoyuan_mvu_extra_model_diagnostic';
  const extraAttempts = new Map();
  const helperStateBlocks = new Map();
  const MAIN_GENERATIONS = new Set(['normal', 'regenerate', 'swipe', 'continue']);
  let mainRequestPending = false;

  function viewerLog(level, message) {
    try {
      const logger = typeof _th_impl === 'undefined' ? window.parent?.TavernHelper?._th_impl : _th_impl;
      const name = typeof getIframeName === 'function' ? getIframeName() : '道渊EXPR';
      logger?._log(name, level, TAG + ' ' + message);
    } catch {
      // 诊断不可中断正文或 MVU。
    }
  }

  function attemptHeader(id) {
    return '额外模型 [' + id + '] ';
  }

  function responseText(response) {
    if (response === undefined || response === null) return '（本次没有收到模型输出）';
    if (response === '') return '（模型返回空字符串）';
    return typeof response === 'string' ? response : JSON.stringify(response, null, 2);
  }

  function isMvuExtra(parts) {
    return parts.some((part) => part?.role === 'system' && typeof part.content === 'string' &&
      (part.content.includes('<past_observe>') || part.content.includes('<additional_information>')));
  }

  function registerAttempt(id, _type, config) {
    if (!id) return;
    const parts = [...(config?.injects || []), ...(config?.ordered_prompts || [])];
    // generateRaw 可以复用正文系统消息。按本次已知的状态块排除这类请求。
    const blocks = parts.flatMap(part => typeof part?.content === 'string' ?
      [...part.content.matchAll(new RegExp(STATUS_RE.source, 'g'))].map(match => match[0]) : []);
    if (blocks.length) {
      helperStateBlocks.set(id, blocks);
      if (helperStateBlocks.size > 64) helperStateBlocks.delete(helperStateBlocks.keys().next().value);
    }
    if (extraAttempts.has(id)) return;
    if (!isMvuExtra(parts)) return;
    extraAttempts.set(id, {
      source: String(config?.custom_api?.model || '').startsWith('mvu-pi-prompt-capture:') ? 'Pi' : 'helper',
    });
    if (extraAttempts.size > 64) extraAttempts.delete(extraAttempts.keys().next().value);
  }

  function observeMvuAttempt(data) {
    if (!data?.generationId) return;
    const id = data.generationId;
    if (data.status === 'started') {
      extraAttempts.set(id, { source: 'mvu' });
      return;
    }
    if (extraAttempts.get(id)?.source !== 'mvu') return;
    extraAttempts.delete(id);
    helperStateBlocks.delete(id);
    if (data.status === 'accepted') {
      viewerLog('info', attemptHeader(id) + '输出通过 MVU 解析检查，等待变量写入');
      return;
    }
    viewerLog('error', attemptHeader(id) + '解析未通过：' + (data.error || '未知错误') +
      '\n完整输出：\n' + responseText(data.response));
  }

  function observeHelperResponse(text, id, reasoning) {
    helperStateBlocks.delete(id);
    const attempt = extraAttempts.get(id);
    if (attempt?.source !== 'helper') return;
    extraAttempts.delete(id);
    const body = typeof reasoning === 'string' && reasoning ? { content: text, reasoning } : text;
    viewerLog('info', attemptHeader(id) + '收到完整可见输出，解析和写入由 MVU 决定\n' + responseText(body));
  }

  const CFG = {
    maxText: 28,          // 长文本默认保留字数
    maxTextIdle: 12,      // 在场但没被提到时的描写保留字数
    yujianKeep: 3,        // 玉简保留最近几条（在场的）
    log: false,           // 是否把净变化一并发给模型
    logMax: 24,           // 单组最多展示多少条差异
    presence: true,       // 是否按在场裁剪道侣/人物/灵宠/玉简
    presenceFloors: 4,    // 往前看几楼判断"在场"
    activeFloors: 2,      // 往前看几楼算"正在被写"（描写保留更长）
    presenceHold: 2,      // 上一轮在场的人，继续保持全文几轮（防"刚做完就失忆"）
    timeFix: false,       // 时间越界时是否回滚（实验性，默认关闭）
  };

  const STATUS_RE = /<status_current_variables>[\s\S]*?<\/status_current_variables>/;
  const LOG_OPEN = '<mvu变量上一轮次修改日志>';
  const LOG_CLOSE = '</mvu变量上一轮次修改日志>';

  const KEEP_FULL = new Set(['当前时间', '姓名', '性别', '境界', '宗门', '所在界', '灵根']);
  const DROP_FIELDS = new Set(['仙姿', '群芳谱', '引言']);
  // 描写类字段：活跃 24 字，在场但没被提到 12 字，不在场整段删
  // [活跃时, 在场但没被提到时]
  const DESC_LIMITS = {
    外观: [24, 12], 容貌外观: [24, 12], 心声: [24, 12], 背景: [16, 8], 性格: [10, 6],
  };

  const FIELD_LIMIT = {
    描述: 20, 当前地点: 16, 神念: 12, 衣着: 14, 容貌: 14, 身形: 12, 目标: 12, 状态: 12, 效果: 16,
  };

  // 不在场时保留的字段
  const COMPACT_KEEP = {
    道侣: ['性别', '种族', '境界', '亲密', '状态', '修为'],
    人物: ['性别', '头衔', '境界', '好感', '关系阶段', '状态'],
    灵宠: ['性别', '种族', '境界', '亲密度', '状态'],
    玉简: ['性别', '境界', '关系', '好感度'],
  };

  const escRe = (s) => s.replace(/[.*+?^$(){}|[\]\\]/g, (m) => '\\' + m);

  // ───────────────────────── 基础工具 ─────────────────────────

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  function deepClone(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(deepClone);
    const out = {};
    for (const k of Object.keys(v)) out[k] = deepClone(v[k]);
    return out;
  }

  function truncate(text, n) {
    const s = String(text);
    return s.length <= n ? s : s.slice(0, n) + '…';
  }

  function scalar(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    const s = String(v);
    const needsQuote = !s || /^[\-?:,\[\]{}#&*!|>'"%@\x60]/.test(s) || /[:#]\s/.test(s) || /\s$/.test(s) || /[\n\r]/.test(s);
    return needsQuote ? JSON.stringify(s) : s;
  }

  function toYaml(value, indent) {
    const level = indent || 0;
    const pad = '  '.repeat(level);
    if (Array.isArray(value)) {
      if (!value.length) return '[]';
      return value.map((item) => {
        if (isObj(item) || Array.isArray(item)) {
          return pad + '- ' + toYaml(item, level + 1).trimStart();
        }
        return pad + '- ' + scalar(item);
      }).join('\n');
    }
    if (isObj(value)) {
      const keys = Object.keys(value);
      if (!keys.length) return '{}';
      const out = [];
      for (const k of keys) {
        const v = value[k];
        if (isObj(v)) {
          if (Object.keys(v).length) out.push(pad + k + ':\n' + toYaml(v, level + 1));
          else out.push(pad + k + ': {}');
        } else if (Array.isArray(v)) {
          if (v.length) out.push(pad + k + ':\n' + toYaml(v, level + 1));
          else out.push(pad + k + ': []');
        } else {
          out.push(pad + k + ': ' + scalar(v));
        }
      }
      return out.join('\n');
    }
    return pad + scalar(value);
  }

  // ───────────────────────── 时间解析 ─────────────────────────

  function parseTime(raw) {
    if (typeof raw !== 'string') return { ok: false, error: '不是字符串' };
    const s = raw.trim();
    if (!s) return { ok: false, error: '为空' };

    let era = '';
    let y, mo, d, h, mi;

    let m = s.match(/^(.*?)(\d{1,6})\s*年[·\-.\s]*(\d{1,2})\s*月[·\-.\s]*(\d{1,2})\s*日[·\-.\s]*(\d{1,2})\s*[点时][·:：\s]*(\d{1,2})?/);
    if (m) {
      era = (m[1] || '').replace(/[·\s]+$/, '');
      y = Number(m[2]); mo = Number(m[3]); d = Number(m[4]);
      h = Number(m[5]); mi = Number(m[6] || 0);
    } else {
      m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})/);
      if (!m) return { ok: false, error: '格式不符，应为「元会历·YYYY年·M月·D日·H点MM分」' };
      y = Number(m[1]); mo = Number(m[2]); d = Number(m[3]);
      h = Number(m[4]); mi = Number(m[5]);
    }

    if (!Number.isFinite(y) || y < 1) return { ok: false, error: '年份无效' };
    if (mo < 1 || mo > 12) return { ok: false, error: '月份' + mo + '越界（1~12）' };
    const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    if (d < 1 || d > days) return { ok: false, error: y + '年' + mo + '月日期' + d + '越界（1~' + days + '）' };
    if (h > 23 || mi > 59) return { ok: false, error: '时分' + h + ':' + mi + '越界' };

    return { ok: true, era, year: y, month: mo, day: d, hour: h, minute: mi, ms: Date.UTC(y, mo - 1, d, h, mi), raw: s };
  }

  function humanGap(ms) {
    let rest = Math.abs(ms);
    const day = Math.floor(rest / 86400000); rest -= day * 86400000;
    const hour = Math.floor(rest / 3600000); rest -= hour * 3600000;
    const minute = Math.round(rest / 60000);
    const parts = [];
    if (day) parts.push(day + '天');
    if (hour) parts.push(hour + '小时');
    if (minute && !day) parts.push(minute + '分钟');
    return parts.join('') || '0分钟';
  }

  // ───────────────────────── 状态读取 ─────────────────────────

  function statOfMessage(msg) {
    const v = msg && msg.variables;
    if (!v || typeof v !== 'object') return null;
    if (isObj(v.stat_data)) return v.stat_data;
    const swipe = v[msg.swipe_id ?? 0];
    if (isObj(swipe?.stat_data)) return swipe.stat_data;
    return null;
  }

  function chatList() {
    return (typeof SillyTavern !== 'undefined' && SillyTavern.chat) || [];
  }

  function recentStates() {
    const chat = chatList();
    const list = [];
    for (let i = chat.length - 1; i >= 0 && list.length < 2; i--) {
      const msg = chat[i];
      if (msg.is_user || msg.is_system) continue;
      const st = statOfMessage(msg);
      if (st) list.push({ id: i, stat: st });
    }
    return list;
  }

  function recentText(floors) {
    const chat = chatList();
    const parts = [];
    for (let i = chat.length - 1; i >= 0 && parts.length < floors; i--) {
      const m = chat[i];
      if (!m || typeof m.mes !== 'string') continue;
      parts.push(m.mes.length > 3000 ? m.mes.slice(-3000) : m.mes);
    }
    return parts.join('\n');
  }

  function latestState() {
    try {
      if (typeof Mvu !== 'undefined' && Mvu.getMvuData) {
        const data = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
        if (data && isObj(data.stat_data)) return data.stat_data;
      }
    } catch (e) { /* 兜底 */ }
    try {
      const vars = typeof getVariables === 'function' ? getVariables({ type: 'message', message_id: 'latest' }) : null;
      if (vars && isObj(vars.stat_data)) return vars.stat_data;
      if (vars) {
        for (const k of Object.keys(vars)) {
          if (isObj(vars[k]) && isObj(vars[k].stat_data)) return vars[k].stat_data;
        }
      }
    } catch (e) { /* 兜底 */ }
    const chat = chatList();
    for (let i = chat.length - 1; i >= 0; i--) {
      const st = statOfMessage(chat[i]);
      if (st) return st;
    }
    return null;
  }

  // ───────────────────────── 投影 ─────────────────────────

  function limitOf(key, tier) {
    if (KEEP_FULL.has(key)) return Infinity;
    if (Object.prototype.hasOwnProperty.call(DESC_LIMITS, key)) {
      const pair = DESC_LIMITS[key];
      return tier === 'present' ? pair[1] : pair[0];
    }
    if (Object.prototype.hasOwnProperty.call(FIELD_LIMIT, key)) return FIELD_LIMIT[key];
    return CFG.maxText;
  }

  function projectValue(key, value, tier) {
    if (DROP_FIELDS.has(key)) return undefined;
    if (typeof value === 'string') {
      const n = limitOf(key, tier);
      return n === Infinity ? value : truncate(value, n);
    }
    if (Array.isArray(value)) return value.map((v) => projectValue('', v)).filter((v) => v !== undefined);
    if (isObj(value)) {
      const out = {};
      for (const k of Object.keys(value)) {
        const pv = projectValue(k, value[k], tier);
        if (pv !== undefined) out[k] = pv;
      }
      return out;
    }
    return value;
  }

  function compact(entry, keep) {
    const out = {};
    for (const k of keep) if (entry[k] !== undefined) out[k] = projectValue(k, entry[k]);
    out.在场 = false;
    return out;
  }

  // 在场延续：记住每个名字最后出现在第几轮，允许"冷却" presenceHold 轮
  let presenceTurn = 0;
  const presenceSeen = new Map();

  function resetPresence() {
    presenceSeen.clear();
    presenceTurn = 0;
  }

  function buildContext(stat) {
    const place = String((stat && stat.世界 && stat.世界.当前地点) || '');
    const text = CFG.presence ? recentText(CFG.presenceFloors) : '';
    const hotText = CFG.presence ? recentText(CFG.activeFloors) : '';
    return {
      place,
      hot(name) {
        if (!CFG.presence) return true;
        return !!name && hotText.indexOf(name) >= 0;
      },
      hit(name) {
        if (!CFG.presence) return true;
        if (!name) return false;
        const mentioned = text.indexOf(name) >= 0 || place.indexOf(name) >= 0;
        if (mentioned) {
          presenceSeen.set(name, presenceTurn);
          return true;
        }
        const last = presenceSeen.get(name);
        return last !== undefined && presenceTurn - last <= CFG.presenceHold;
      },
    };
  }

  function project(stat) {
    const ctx = buildContext(stat);
    const out = {};
    for (const key of Object.keys(stat || {})) {
      if (key === '玉简') {
        const friends = {};
        for (const name of Object.keys(stat.玉简 || {})) {
          const f = deepClone(stat.玉简[name] || {});
          const present = ctx.hit(name);
          if (!present) {
            friends[name] = compact(f, COMPACT_KEEP.玉简);
            continue;
          }
          if (isObj(f.历史记录)) {
            const keys = Object.keys(f.历史记录);
            const kept = {};
            for (const k of keys.slice(Math.max(0, keys.length - CFG.yujianKeep))) kept[k] = f.历史记录[k];
            f.历史记录 = kept;
          }
          friends[name] = projectValue('', f, ctx.hot(name) ? 'active' : 'present');
        }
        out.玉简 = friends;
        continue;
      }

      if (COMPACT_KEEP[key] && isObj(stat[key])) {
        const section = {};
        for (const name of Object.keys(stat[key])) {
          const entry = stat[key][name];
          if (!isObj(entry)) {
            section[name] = projectValue(name, entry);
            continue;
          }
          section[name] = ctx.hit(name)
            ? projectValue('', entry, ctx.hot(name) ? 'active' : 'present')
            : compact(entry, COMPACT_KEEP[key]);
        }
        out[key] = section;
        continue;
      }

      out[key] = projectValue(key, stat[key]);
    }
    return out;
  }

  // ───────────────────────── 差异 ─────────────────────────

  function diffLines(before, after) {
    const groups = new Map();
    const bucket = (group) => {
      if (!groups.has(group)) groups.set(group, { updates: [], others: [] });
      return groups.get(group);
    };
    const label = (path) => (path.length >= 3 ? path.slice(-2).join('.') : path[path.length - 1] || '');

    const walk = (a, b, path) => {
      const group = path.length ? path[0] : 'stat_data';
      if (path.length === 2 && path[0] === '世界' && path[1] === '当前时间') return;

      if (isObj(a) && isObj(b)) {
        const keys = new Set(Object.keys(a).concat(Object.keys(b)));
        keys.forEach((k) => {
          if (!(k in b)) bucket(group).others.push('移除「' + k + '」');
          else if (!(k in a)) bucket(group).others.push('新增「' + k + '」');
          else walk(a[k], b[k], path.concat(k));
        });
        return;
      }
      const g = bucket(group);
      if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
        const d = b - a;
        if (d !== 0) g.others.push(label(path) + (d > 0 ? '+' : '') + Number(d.toFixed(2)));
        return;
      }
      if (typeof a === 'string' && typeof b === 'string') {
        if (a !== b) g.updates.push(label(path));
        return;
      }
      if (JSON.stringify(a) !== JSON.stringify(b)) g.updates.push(label(path));
    };

    walk(before, after, []);
    const lines = [];
    groups.forEach((g, name) => {
      const parts = [];
      if (g.updates.length) parts.push(g.updates.slice(0, CFG.logMax).join('、') + '更新');
      if (g.others.length) parts.push(g.others.slice(0, CFG.logMax).join('、'));
      if (parts.length) lines.push(name + '：' + parts.join('；') + '。');
    });
    return lines;
  }

  // ───────────────────────── 日志 ─────────────────────────

  function timeLinesOf(prevTime, curTime) {
    const lines = [];
    const curP = parseTime(curTime);
    const prevP = parseTime(prevTime);

    if (!curP.ok) {
      lines.push('⚠ /世界/当前时间 无法解析：' + JSON.stringify(curTime) + '；' + curP.error + '。');
      lines.push('下次更新必须把它改成「元会历·YYYY年·M月·D日·H点MM分」；只修正写法，不额外推进剧情时间。');
    } else if (!prevP.ok) {
      lines.push('时间：' + curP.raw + '。');
    } else if (curP.era !== prevP.era) {
      lines.push('时间：纪元变更 ' + JSON.stringify(prevTime) + ' → ' + JSON.stringify(curTime) + '。');
    } else {
      const delta = curP.ms - prevP.ms;
      if (delta > 0) lines.push('时间：推进' + humanGap(delta) + '。');
      else if (delta < 0) {
        lines.push('⚠ /世界/当前时间 回退：' + prevP.raw + ' → ' + curP.raw + '（-' + humanGap(delta) + '）。');
        lines.push('下次更新必须把时间修正为不早于「' + prevP.raw + '」，并按剧情补足应经过的时长。');
      } else if (String(curTime) !== String(prevTime)) {
        lines.push('时间：写法变了，时点未变（' + curP.raw + '）。');
      } else {
        lines.push('时间：未变。');
      }
    }
    return lines;
  }

  function buildLog(current, previous, diffs) {
    const last = window.__DAOYUAN_EXPR_LASTUPDATE;
    const lines = [];

    if (last && Array.isArray(last.diffs) && last.at) {
      lines.push.apply(lines, timeLinesOf(last.preTime, last.postTime));
      lines.push.apply(lines, last.diffs);
    } else {
      const curTime = current && current.世界 && current.世界.当前时间;
      const prevTime = previous && previous.世界 && previous.世界.当前时间;
      lines.push.apply(lines, timeLinesOf(prevTime, curTime));
      if (previous) lines.push.apply(lines, diffs || diffLines(previous, current));
    }

    if (window.__DAOYUAN_EXPR_FIX) {
      lines.push('⚠ 上一楼时间越界，已由脚本回滚至「' + window.__DAOYUAN_EXPR_FIX + '」。');
    }

    if (!lines.length) return '';
    return LOG_OPEN + '\n上轮净变化已生效，勿重复执行；此处仅记录变动信息。\n' +
      lines.slice(0, CFG.logMax + 4).join('\n') + '\n' + LOG_CLOSE;
  }

  // ───────────────────────── 请求改写 ─────────────────────────

  function stripOldLogs(text) {
    if (!text || text.indexOf(LOG_OPEN) < 0) return text;
    const re = new RegExp(escRe(LOG_OPEN) + '[\\s\\S]*?' + escRe(LOG_CLOSE), 'g');
    return text.replace(re, '').replace(/\n{3,}/g, '\n\n');
  }

  function buildView() {
    const current = latestState();
    if (!current) return null;
    const previous = CFG.log ? recentStates()[1]?.stat : null;
    return {
      projection: toYaml(project(current)),
      log: previous ? buildLog(current, previous) : '',
      raw: JSON.stringify(current),
    };
  }

  function rewriteRequest(payload) {
    const messages = payload?.messages;
    if (!mainRequestPending || !Array.isArray(messages) || payload.dryRun || payload.dry_run) return;
    if (String(payload.model || '').startsWith('mvu-pi-prompt-capture:') || isMvuExtra(messages)) return;

    // 只替换原请求已提供的状态，不向缺少状态块的后台请求注入角色数据。
    const targets = messages.filter((m) => m?.role === 'system' &&
      typeof m.content === 'string' && m.content.includes('【以下内容仅供参考，严禁出现在正文！】') &&
      m.content.includes('【以上内容仅供参考，严禁出现在正文！】') && STATUS_RE.test(m.content));
    if (targets.length !== 1) return;
    const [target] = targets;
    const blocks = [...target.content.matchAll(new RegExp(STATUS_RE.source, 'g'))];
    if (blocks.length !== 1) return;
    const originalBlock = blocks[0][0];
    const helper = [...helperStateBlocks].find(([, states]) => states.includes(originalBlock));
    if (helper) {
      helperStateBlocks.delete(helper[0]);
      return;
    }

    mainRequestPending = false;
    presenceTurn += 1;
    const view = buildView();
    if (!view) return;
    const projection = '<status_current_variables>\n' + view.projection + '\n</status_current_variables>';
    const replacement = projection + (view.log ? '\n' + view.log : '');
    window.__DAOYUAN_EXPR_LAST = view;
    if (replacement.length >= originalBlock.length) {
      viewerLog('info', '正文状态原样发送：投影未减少字数');
      return;
    }
    // 替换函数保留角色数据中 $&、$' 等字面文本。
    target.content = stripOldLogs(target.content).replace(STATUS_RE, () => replacement);
    window.__DAOYUAN_EXPR_FIX = null;
    viewerLog('info', '正文状态投影：' + originalBlock.length + ' → ' + replacement.length +
      ' 字，减少 ' + (originalBlock.length - replacement.length) + ' 字');
  }

  // ───────────────────────── 更新块捕获 ─────────────────────────

  function captureUpdate(pre, post) {
    if (!pre || !post) return;
    const diffs = diffLines(pre, post);
    window.__DAOYUAN_EXPR_LASTUPDATE = {
      at: new Date().toLocaleTimeString(),
      preTime: pre.世界?.当前时间,
      postTime: post.世界?.当前时间,
      diffs,
    };
    const commands = window.__DAOYUAN_EXPR_CMDS || [];
    window.__DAOYUAN_EXPR_CMDS = null;
    const text = 'MVU 变量结算：' + commands.length + ' 条命令，' + diffs.length + ' 组变化' +
      (diffs.length ? '\n' + diffs.join('\n') : '');
    window.__DAOYUAN_EXPR_UPDATE = text;
    viewerLog('info', text);
  }

  // ───────────────────────── 时间守卫 ─────────────────────────

  function previousValidTime(beforeId) {
    const chat = chatList();
    const start = Math.min(beforeId - 1, chat.length - 1);
    for (let i = start; i >= 0; i--) {
      const st = statOfMessage(chat[i]);
      if (!st || !st.世界) continue;
      const t = st.世界.当前时间;
      if (parseTime(t).ok) return t;
    }
    return null;
  }

  function guardTime(variables, messageId) {
    if (!CFG.timeFix) return;
    try {
      const st = variables && variables.stat_data;
      if (!st || !st.世界) return;
      const cur = st.世界.当前时间;
      const curP = parseTime(cur);
      const prevRaw = previousValidTime(messageId);
      if (!prevRaw) return;
      const prevP = parseTime(prevRaw);
      if (!prevP.ok) return;
      if (!curP.ok || (curP.ok && curP.era === prevP.era && curP.ms < prevP.ms)) {
        st.世界.当前时间 = prevRaw;
        window.__DAOYUAN_EXPR_FIX = prevRaw;
        viewerLog('warn', '时间越界已回滚：' + JSON.stringify(cur) + ' → ' + prevRaw);
      }
    } catch (e) {
      viewerLog('error', '时间守卫失败：' + String(e));
    }
  }

  function presentNames() {
    const names = [];
    presenceSeen.forEach((turn, name) => {
      if (presenceTurn - turn <= CFG.presenceHold) names.push(name);
    });
    return names;
  }

  // ───────────────────────── 挂载 ─────────────────────────
  (async function boot() {
    if (window.__DAOYUAN_EXPR_LOADED__) return;
    if (typeof eventOn !== 'function' || typeof tavern_events === 'undefined') {
      viewerLog('error', '缺少酒馆助手事件接口');
      return;
    }
    window.__DAOYUAN_EXPR_LOADED__ = true;

    eventOn(tavern_events.GENERATION_AFTER_COMMANDS || 'GENERATION_AFTER_COMMANDS', (type, _options, dryRun) => {
      if (!dryRun && MAIN_GENERATIONS.has(type)) mainRequestPending = true;
    });
    if (tavern_events.GENERATION_ENDED) {
      eventOn(tavern_events.GENERATION_ENDED, () => { mainRequestPending = false; });
    }
    eventOn(tavern_events.CHAT_COMPLETION_SETTINGS_READY, (payload) => {
      try { rewriteRequest(payload); }
      catch (e) { viewerLog('error', '状态投影失败：' + String(e)); }
    });
    eventOn(MVU_DIAGNOSTIC_EVENT, observeMvuAttempt);
    eventOn('js_generation_requested', registerAttempt);
    eventOn('js_generation_ended', observeHelperResponse);
    if (tavern_events.GENERATION_STOPPED) {
      eventOn(tavern_events.GENERATION_STOPPED, (id) => {
        if (typeof id !== 'string') mainRequestPending = false;
        helperStateBlocks.delete(id);
        const attempt = extraAttempts.get(id);
        if (!attempt || attempt.source === 'mvu') return;
        extraAttempts.delete(id);
        if (attempt.source === 'Pi') {
          viewerLog('warn', attemptHeader(id) + 'Pi 的原始回复需要带诊断事件的 MVU 构建');
        } else {
          viewerLog('info', attemptHeader(id) + '生成已停止，没有完整回复');
        }
      });
    }
    eventOn(tavern_events.CHAT_CHANGED, () => {
      extraAttempts.clear();
      helperStateBlocks.clear();
      mainRequestPending = false;
      window.__DAOYUAN_EXPR_LAST = null;
      window.__DAOYUAN_EXPR_LASTUPDATE = null;
      window.__DAOYUAN_EXPR_UPDATE = null;
      window.__DAOYUAN_EXPR_CMDS = null;
      window.__DAOYUAN_EXPR_FIX = null;
      resetPresence();
    });

    window.DaoYuanEXPR = {
      version: VERSION,
      cfg: CFG,
      set(patch) {
        Object.assign(CFG, patch || {});
        return CFG;
      },
      who: presentNames,
      update() {
        return window.__DAOYUAN_EXPR_UPDATE || '';
      },
      preview() {
        const view = window.__DAOYUAN_EXPR_LAST;
        if (view) viewerLog('info', '最近一次投影\n' + view.projection + (view.log ? '\n' + view.log : ''));
        return view;
      },
      stats() {
        const view = window.__DAOYUAN_EXPR_LAST;
        if (!view) return null;
        return {
          raw: view.raw.length,
          projection: view.projection.length,
          log: view.log.length,
          saved: view.raw.length - view.projection.length - view.log.length,
        };
      },
    };

    try {
      if (typeof waitGlobalInitialized === 'function') await waitGlobalInitialized('Mvu');
      const events = typeof Mvu === 'undefined' ? {} : Mvu.events || {};
      if (events.VARIABLE_UPDATE_ENDED) {
        eventOn(events.VARIABLE_UPDATE_ENDED, (next, prev) => {
          try { captureUpdate(prev?.stat_data, next?.stat_data); }
          catch (e) { viewerLog('error', '变量结算日志失败：' + String(e)); }
        });
      }
      if (events.COMMAND_PARSED) {
        eventOn(events.COMMAND_PARSED, (_variables, commands) => {
          window.__DAOYUAN_EXPR_CMDS = Array.isArray(commands) ? commands : [];
        });
      }
      eventOn(events.BEFORE_MESSAGE_UPDATE || 'mag_before_message_update', (context, legacyId) => {
        if (Number.isInteger(legacyId)) {
          guardTime(context, legacyId);
          return;
        }
        const chat = chatList();
        const messageId = chat.length - 1;
        const latest = chat[messageId];
        if (typeof context?.message_content === 'string' && latest?.mes === context.message_content &&
            !latest.is_user && !latest.is_system) {
          guardTime(context.variables, messageId);
        }
      });
    } catch (e) {
      viewerLog('error', 'MVU 事件监听失败：' + String(e));
    }
  })();
})();
