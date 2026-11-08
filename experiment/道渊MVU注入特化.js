// ═══════════════════════════════════════════════════════════════
// 道渊 MVU 注入特化 · experiment 1.0
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

  const VERSION = '1.4.0-experiment';
  const TAG = '[道渊EXPR]';

  const CFG = {
    maxText: 28,          // 长文本默认保留字数
    yujianKeep: 3,        // 玉简保留最近几条（在场的）
    log: true,            // 是否追加变更日志
    logMax: 24,           // 单组最多展示多少条差异
    presence: true,       // 是否按在场裁剪道侣/人物/灵宠/玉简
    presenceFloors: 4,    // 往前看几楼判断"在场"
    presenceHold: 2,      // 上一轮在场的人，继续保持全文几轮（防"刚做完就失忆"）
    timeFix: false,       // 时间越界时是否回滚（实验性，默认关闭）
    debug: true,
    debugPanel: true,     // 左下角调试面板
  };

  const STATUS_RE = /<status_current_variables>[\s\S]*?<\/status_current_variables>/;
  const LOG_OPEN = '<mvu变量上一轮次修改日志>';
  const LOG_CLOSE = '</mvu变量上一轮次修改日志>';

  const KEEP_FULL = new Set(['当前时间', '姓名', '性别', '境界', '宗门', '所在界', '灵根']);
  const DROP_FIELDS = new Set(['仙姿', '群芳谱', '引言']);
  const FIELD_LIMIT = {
    外观: 24, 容貌外观: 24, 心声: 24, 描述: 24, 背景: 16, 性格: 10,
    当前地点: 20, 神念: 16, 衣着: 18, 容貌: 18, 身形: 14, 目标: 20,
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
    for (const k of Object.keys(v)) {
      if (isObj(v[k]) && isObj(v[k].stat_data)) return v[k].stat_data;
    }
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

  function limitOf(key) {
    if (KEEP_FULL.has(key)) return Infinity;
    if (Object.prototype.hasOwnProperty.call(FIELD_LIMIT, key)) return FIELD_LIMIT[key];
    return CFG.maxText;
  }

  function projectValue(key, value) {
    if (DROP_FIELDS.has(key)) return undefined;
    if (typeof value === 'string') {
      const n = limitOf(key);
      return n === Infinity ? value : truncate(value, n);
    }
    if (Array.isArray(value)) return value.map((v) => projectValue('', v)).filter((v) => v !== undefined);
    if (isObj(value)) {
      const out = {};
      for (const k of Object.keys(value)) {
        const pv = projectValue(k, value[k]);
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
    return {
      place,
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
          friends[name] = projectValue('', f);
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
          section[name] = ctx.hit(name) ? projectValue('', entry) : compact(entry, COMPACT_KEEP[key]);
        }
        out[key] = section;
        continue;
      }

      out[key] = projectValue(key, stat[key]);
    }
    return out;
  }

  function brief(stat) {
    if (!stat) return '';
    const w = stat.世界 || {};
    const p = stat.主角 || {};
    return '时间 ' + JSON.stringify(w.当前时间 || '') + ' ｜ 修为 ' + (p.修为 === undefined ? '?' : p.修为) +
      ' ｜ 生命 ' + (p.生命 === undefined ? '?' : p.生命) + ' ｜ 冷却 ' + (w.遭遇冷却 === undefined ? '?' : w.遭遇冷却) +
      ' ｜ 地点 ' + String(w.当前地点 || '').slice(0, 16);
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

  function buildLog(current, previous, diffs) {
    const lines = [];
    const curTime = current && current.世界 && current.世界.当前时间;
    const prevTime = previous && previous.世界 && previous.世界.当前时间;
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

    if (window.__DAOYUAN_EXPR_FIX) {
      lines.push('⚠ 上一楼时间越界，已由脚本回滚至「' + window.__DAOYUAN_EXPR_FIX + '」。');
      window.__DAOYUAN_EXPR_FIX = null;
    }

    if (previous) lines.push.apply(lines, diffs || diffLines(previous, current));
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
    const states = recentStates();
    const prevEntry = states.length > 1 ? states[1] : null;
    const previous = prevEntry ? prevEntry.stat : null;
    const diffs = previous ? diffLines(previous, current) : [];
    const projection = toYaml(project(current));
    const log = CFG.log && previous ? buildLog(current, previous, diffs) : '';
    return {
      projection,
      log,
      raw: JSON.stringify(current),
      current,
      previous,
      diag: {
        curId: states.length ? states[0].id : -1,
        prevId: prevEntry ? prevEntry.id : -1,
        prevTime: previous && previous.世界 ? previous.世界.当前时间 : null,
        curTime: current && current.世界 ? current.世界.当前时间 : null,
        diffCount: diffs.length,
        prevBrief: brief(previous),
        curBrief: brief(current),
      },
    };
  }

  function rewriteRequest(payload) {
    const messages = payload && Array.isArray(payload.messages) ? payload.messages : null;
    if (!messages || !messages.length) return;

    presenceTurn += 1;
    const view = buildView();
    if (!view) return;

    for (const m of messages) {
      if (m && typeof m.content === 'string' && m.content.indexOf(LOG_OPEN) >= 0) {
        m.content = stripOldLogs(m.content);
      }
    }

    let hit = false;
    for (const m of messages) {
      if (!m || typeof m.content !== 'string') continue;
      if (!STATUS_RE.test(m.content)) continue;
      m.content = m.content.replace(
        STATUS_RE,
        '<status_current_variables>\n' + view.projection + '\n</status_current_variables>' +
        (view.log ? '\n' + view.log : '')
      );
      hit = true;
      break;
    }

    if (!hit) {
      const block = '<status_current_variables>\n' + view.projection + '\n</status_current_variables>' +
        (view.log ? '\n' + view.log : '');
      messages.splice(Math.max(0, messages.length - 1), 0, { role: 'system', content: block });
    }

    if (CFG.debug) {
      console.info(TAG, '投影 ' + view.projection.length + ' 字（原始 ' + view.raw.length + ' 字，省 ' +
        (view.raw.length - view.projection.length) + ' 字），日志 ' + view.log.length + ' 字');
    }
    window.__DAOYUAN_EXPR_LAST = view;
    const joined = messages.map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n');
    // 主模型请求由 ST 自己拼，不带 <past_observe>；额外模型请求一定带
    const isExtra = joined.indexOf('<past_observe>') >= 0 || joined.indexOf('<additional_information>') >= 0;
    const hasYaml = /<status_current_variables>[\s\S]{0,80}世界:/.test(joined);
    const hasJson = /"stat_data"|"当前时间":/.test(joined);
    const snapshot = {
      at: new Date().toLocaleTimeString(),
      kind: isExtra ? '额外模型' : '主模型',
      mode: hasYaml ? '投影(YAML)' : hasJson ? '原始(JSON)' : '未找到状态块',
      total: messages.length,
      chars: messages.reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length : 0), 0),
      messages: messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? (m.content.length > 60000 ? m.content.slice(0, 60000) + '…' : m.content) : JSON.stringify(m.content),
      })),
    };
    window.__DAOYUAN_EXPR_REQS = (window.__DAOYUAN_EXPR_REQS || []).concat([snapshot]).slice(-4);
    renderPanel();
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
        console.warn(TAG, '时间越界已回滚：' + JSON.stringify(cur) + ' → ' + prevRaw);
      }
    } catch (e) {
      console.error(TAG, '时间守卫失败', e);
    }
  }

  // ───────────────────────── 调试面板 ─────────────────────────

  const PANEL_ID = 'dao-yuan-expr-panel';

  function panelDoc() {
    try {
      if (window.parent && window.parent !== window && window.parent.document && window.parent.document.body) {
        return window.parent.document;
      }
    } catch (e) { /* 跨域：退回自身文档 */ }
    return document;
  }

  function presentNames() {
    const names = [];
    presenceSeen.forEach((turn, name) => {
      if (presenceTurn - turn <= CFG.presenceHold) names.push(name);
    });
    return names;
  }

  function overviewText() {
    const view = window.__DAOYUAN_EXPR_LAST;
    const reqs = window.__DAOYUAN_EXPR_REQS || [];
    const req = reqs.length ? reqs[reqs.length - 1] : null;
    const out = window.__DAOYUAN_EXPR_OUT;
    const curTime = view && view.current && view.current.世界 && view.current.世界.当前时间;
    const parsed = parseTime(curTime);
    const lines = [];
    lines.push(TAG + ' v' + VERSION);
    lines.push('状态：原始 ' + (view ? view.raw.length : 0) + ' 字 → 投影 ' + (view ? view.projection.length : 0) +
      ' 字（省 ' + (view ? view.raw.length - view.projection.length : 0) + '），日志 ' + (view ? view.log.length : 0) + ' 字');
    lines.push('在场：' + (presentNames().join('、') || '(无)'));
    lines.push('时间：' + JSON.stringify(curTime) + ' → ' + (parsed.ok ? '解析成功（' + parsed.year + '-' + parsed.month + '-' + parsed.day + ' ' + parsed.hour + ':' + parsed.minute + '）' : '解析失败：' + parsed.error));
    const diag = view && view.diag;
    if (diag) {
      lines.push('对比：# ' + diag.prevId + ' → # ' + diag.curId + '，净变化 ' + diag.diffCount + ' 组' + (diag.diffCount ? '' : '（该轮状态无差异）'));
      lines.push('上一楼：' + (diag.prevBrief || '(无)'));
      lines.push('当前：  ' + (diag.curBrief || '(无)'));
    }
    const reqs2 = window.__DAOYUAN_EXPR_REQS || [];
    if (reqs2.length) {
      lines.push('最近请求：');
      reqs2.forEach((r) => { lines.push('  · ' + r.at + ' ' + r.kind + ' / ' + r.mode + ' / ' + r.total + ' 条 / ' + r.chars + ' 字'); });
    }
    lines.push('请求：' + (req ? req.total + ' 条消息 / ' + req.chars + ' 字（' + req.at + '）' : '(无)'));
    lines.push('输出：' + (out ? out.at + '，第 ' + out.id + ' 楼，' + out.text.length + ' 字' : '(无)'));
    return lines.join('\n');
  }

  function buildInjection() {
    const view = window.__DAOYUAN_EXPR_LAST;
    if (!view) return '';
    return '<status_current_variables>\n' + view.projection + '\n</status_current_variables>' +
      (view.log ? '\n' + view.log : '');
  }

  function buildRequest() {
    const list = window.__DAOYUAN_EXPR_REQS || [];
    if (!list.length) return '';
    return list.map((req) => {
      const head = '#### ' + req.kind + '请求 · ' + req.at + ' · ' + req.total + ' 条 / ' + req.chars + ' 字';
      return head + '\n\n' + req.messages.map((m) => '[' + m.role + '] ' + m.content).join('\n\n————————————\n\n');
    }).join('\n\n════════════════════\n\n');
  }

  function buildOutput() {
    const out = window.__DAOYUAN_EXPR_OUT;
    return out ? out.text : '';
  }

  function buildDump() {
    return [
      '### 概览\n' + overviewText(),
      '### 注入给模型的变量块\n' + (buildInjection() || '(空)'),
      '### 请求体\n' + (buildRequest() || '(空)'),
      '### 输出体\n' + (buildOutput() || '(空)'),
    ].join('\n\n');
  }

  function copyText(text) {
    if (!text) return;
    const done = (msg) => {
      if (window.__DAOYUAN_EXPR_STATUS) window.__DAOYUAN_EXPR_STATUS.textContent = msg;
      console.info(TAG, msg);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        done('已复制 ' + text.length + ' 字');
        return;
      }
    } catch (e) { /* 走兜底 */ }
    try {
      const doc = panelDoc();
      const ta = doc.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
      doc.body.appendChild(ta);
      ta.select();
      doc.execCommand('copy');
      doc.body.removeChild(ta);
      done('已复制 ' + text.length + ' 字');
    } catch (e) {
      console.error(TAG, '复制失败', e);
    }
  }

  function downloadText(name, text) {
    const doc = panelDoc();
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url;
      a.download = name;
      a.style.cssText = 'display:none;';
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      if (window.__DAOYUAN_EXPR_STATUS) window.__DAOYUAN_EXPR_STATUS.textContent = '已导出 ' + name;
      return true;
    } catch (e) {
      console.warn(TAG, '下载失败，改用文本框', e);
      showTextModal(name, text);
      return false;
    }
  }

  function showTextModal(name, text) {
    const doc = panelDoc();
    const old = doc.getElementById('dao-yuan-expr-modal');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    const mask = doc.createElement('div');
    mask.id = 'dao-yuan-expr-modal';
    mask.style.cssText = 'position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.66);display:flex;align-items:center;justify-content:center;';

    const box = doc.createElement('div');
    box.style.cssText = 'width:min(900px,92vw);height:78vh;background:#141a21;border:1px solid #3a4757;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;';

    const bar = doc.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;align-items:center;color:#9fd0ff;font:12px Consolas,monospace;';

    const title = doc.createElement('span');
    title.textContent = name + ' · ' + text.length + ' 字（Ctrl+A 全选，Ctrl+C 复制）';
    title.style.cssText = 'flex:1;';

    const close = doc.createElement('button');
    close.textContent = '关闭';
    close.style.cssText = 'all:unset;cursor:pointer;padding:3px 10px;border-radius:4px;background:#22303f;color:#9fd0ff;border:1px solid #33455a;';
    close.addEventListener('click', () => mask.parentNode && mask.parentNode.removeChild(mask));

    const ta = doc.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'flex:1;width:100%;background:#0d1218;color:#c9d6e4;border:1px solid #263341;border-radius:6px;padding:8px;font:12px/1.5 Consolas,monospace;white-space:pre;';
    ta.addEventListener('click', () => ta.select());

    bar.appendChild(title);
    bar.appendChild(close);
    box.appendChild(bar);
    box.appendChild(ta);
    mask.appendChild(box);
    doc.body.appendChild(mask);
    ta.focus();
    ta.select();
  }

  function exportAll() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return downloadText('道渊EXPR-' + stamp + '.txt', buildDump());
  }

  function section(title, text, open) {
    const doc = panelDoc();
    const det = doc.createElement('details');
    det.open = !!open;
    const sum = doc.createElement('summary');
    sum.textContent = title + '（' + (text ? text.length : 0) + ' 字）';
    sum.style.cssText = 'cursor:pointer;color:#7fb7e6;padding:2px 0;';
    const pre = doc.createElement('pre');
    pre.textContent = text || '(空)';
    pre.style.cssText = 'white-space:pre-wrap;word-break:break-all;max-height:46vh;overflow:auto;background:#0d1218;border:1px solid #263341;border-radius:6px;padding:6px;margin:4px 0 0;color:#c9d6e4;';
    det.appendChild(sum);
    det.appendChild(pre);
    return det;
  }

  function renderPanel() {
    const host = window.__DAOYUAN_EXPR_PANEL;
    if (!host) return;
    const c = host.content;
    while (c.firstChild) c.removeChild(c.firstChild);
    c.appendChild(section('概览', overviewText(), true));
    c.appendChild(section('注入给模型的变量块', buildInjection(), false));
    c.appendChild(section('请求体（实际发出的消息）', buildRequest(), false));
    c.appendChild(section('输出体（最近一条 AI 回复）', buildOutput(), false));
  }

  function initPanel() {
    if (!CFG.debugPanel) return;
    const doc = panelDoc();
    if (!doc || !doc.body) return;
    const old = doc.getElementById(PANEL_ID);
    if (old && old.parentNode) old.parentNode.removeChild(old);

    const wrap = doc.createElement('div');
    wrap.id = PANEL_ID;
    wrap.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483000;font:12px/1.55 Consolas,Menlo,monospace;color:#d8e0ea;text-align:left;';

    const body = doc.createElement('div');
    body.style.cssText = 'display:none;width:min(780px,88vw);max-height:78vh;overflow:auto;background:#141a21;border:1px solid #3a4757;border-radius:8px;margin-bottom:6px;padding:8px 10px;box-shadow:0 6px 24px rgba(0,0,0,.5);';

    const tools = doc.createElement('div');
    tools.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;align-items:center;';

    const mkBtn = (label, fn) => {
      const b = doc.createElement('button');
      b.textContent = label;
      b.style.cssText = 'all:unset;cursor:pointer;padding:3px 8px;border-radius:4px;background:#22303f;color:#9fd0ff;border:1px solid #33455a;';
      b.addEventListener('click', fn);
      return b;
    };

    const status = doc.createElement('span');
    status.style.cssText = 'color:#6f8fa8;margin-left:4px;';
    window.__DAOYUAN_EXPR_STATUS = status;

    const content = doc.createElement('div');
    content.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    tools.appendChild(mkBtn('导出全部', () => exportAll()));
    tools.appendChild(mkBtn('导出请求', () => downloadText('道渊EXPR-请求.txt', buildRequest())));
    tools.appendChild(mkBtn('导出输出', () => downloadText('道渊EXPR-输出.txt', buildOutput())));
    tools.appendChild(mkBtn('复制全部', () => copyText(buildDump())));
    tools.appendChild(mkBtn('文本框', () => showTextModal('道渊EXPR', buildDump())));
    tools.appendChild(mkBtn('刷新', () => renderPanel()));
    tools.appendChild(status);

    body.appendChild(tools);
    body.appendChild(content);

    const btn = doc.createElement('button');
    btn.textContent = '道渊EXPR';
    btn.style.cssText = 'all:unset;cursor:pointer;padding:5px 10px;border-radius:6px;background:#1f2731;border:1px solid #3a4757;color:#9fd0ff;opacity:.85;';

    wrap.appendChild(body);
    wrap.appendChild(btn);
    doc.body.appendChild(wrap);

    btn.addEventListener('click', () => {
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      if (!open) renderPanel();
    });

    window.__DAOYUAN_EXPR_PANEL = { body, content };
    renderPanel();
  }

  // ───────────────────────── 挂载 ─────────────────────────

  (async function boot() {
    if (window.__DAOYUAN_EXPR_LOADED__) {
      console.warn(TAG, '已加载，跳过重复挂载');
      return;
    }
    window.__DAOYUAN_EXPR_LOADED__ = true;

    try {
      if (typeof waitGlobalInitialized === 'function') await waitGlobalInitialized('Mvu');
    } catch (e) {
      console.warn(TAG, '等待 Mvu 失败，仍继续挂载', e);
    }

    if (typeof eventOn !== 'function' || typeof tavern_events === 'undefined') {
      console.error(TAG, '缺少酒馆助手事件接口，脚本无法工作');
      return;
    }

    eventOn(tavern_events.CHAT_COMPLETION_SETTINGS_READY, (payload) => {
      try { rewriteRequest(payload); } catch (e) { console.error(TAG, '改写请求失败', e); }
    });

    eventOn(tavern_events.CHAT_CHANGED, () => {
      window.__DAOYUAN_EXPR_LAST = null;
      window.__DAOYUAN_EXPR_REQS = [];
      window.__DAOYUAN_EXPR_FIX = null;
      resetPresence();
    });

    // 抓最近一条 AI 回复（含 <UpdateVariable> 原文），给面板用
    try {
      if (tavern_events.MESSAGE_RECEIVED) {
        eventOn(tavern_events.MESSAGE_RECEIVED, (id) => {
          try {
            const chat = chatList();
            const msg = chat[id];
            if (!msg || msg.is_user) return;
            const text = String(msg.mes || '');
            const upd = (text.match(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/i) || [''])[0];
            window.__DAOYUAN_EXPR_OUT = {
              at: new Date().toLocaleTimeString(),
              id: id,
              text: text,
              patch: upd,
            };
            renderPanel();
          } catch (e) { /* 忽略 */ }
        });
      }
    } catch (e) {
      console.warn(TAG, '输出捕获失败', e);
    }

    try {
      const events = (typeof Mvu !== 'undefined' && Mvu.events) || {};
      const before = events.BEFORE_MESSAGE_UPDATE || 'mag_before_message_update';
      // 始终挂载，由 CFG.timeFix 决定是否真正生效（方便运行时开关）
      eventOn(before, (variables, messageId) => guardTime(variables, messageId));
    } catch (e) {
      console.warn(TAG, '时间守卫挂载失败（不影响投影）', e);
    }

    window.DaoYuanEXPR = {
      version: VERSION,
      cfg: CFG,
      set(patch) {
        Object.assign(CFG, patch || {});
        console.info(TAG, '配置已更新', CFG);
        return CFG;
      },
      who() {
        return presentNames();
      },
      panel(open) {
        const host = window.__DAOYUAN_EXPR_PANEL;
        if (!host) return null;
        host.body.style.display = open === false ? 'none' : 'block';
        renderPanel();
        return buildDump();
      },
      dump() {
        return buildDump();
      },
      exportAll() {
        return exportAll();
      },
      exportRequest() {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return downloadText('道渊EXPR-请求-' + stamp + '.txt', buildRequest());
      },
      preview() {
        const view = buildView();
        if (!view) return null;
        console.log(TAG, '投影：\n' + view.projection);
        console.log(TAG, '日志：\n' + (view.log || '(无)'));
        return view;
      },
      stats() {
        const view = buildView();
        if (!view) return null;
        return {
          raw: view.raw.length,
          projection: view.projection.length,
          log: (view.log || '').length,
          saved: view.raw.length - view.projection.length,
        };
      },
    };

    try {
      initPanel();
    } catch (e) {
      console.warn(TAG, '面板初始化失败', e);
      setTimeout(() => { try { initPanel(); } catch (e2) { /* 放弃 */ } }, 1500);
    }

    console.info(TAG, '已挂载 v' + VERSION, CFG);
  })();
})();
