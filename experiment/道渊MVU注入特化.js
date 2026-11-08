// ═══════════════════════════════════════════════════════════════
// 道渊 MVU 注入特化 · experiment 0.1.0
// ---------------------------------------------------------------
// 目标：不动世界书、不动 MVU 源码、不动 ZOD，只在"请求组装"这一步
//       把注入给模型的状态换掉，并附一段"上轮净变化 + 时间校验"日志。
//
// 它替换什么：
//   1) 任何消息里 <status_current_variables>...</status_current_variables>
//      内部的内容 → 换成裁剪后的"投影"（YAML）
//   2) 在同一位置追加 <mvu变量上一轮次修改日志>（时间校验 + 净变化）
//
// 它不替换什么：
//   - stat_data 本身不动，状态栏/前端读到的还是完整数据
//   - MVU 的解析、应用、ZOD 校验全部照旧
//   - 世界书一条不改（变量列表条目即使关掉，也会走"兜底注入"）
//
// 回滚：禁用本脚本即可，行为立刻回到原样。
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const VERSION = '0.1.0-experiment';
  const TAG = '[道渊EXPR]';

  const CFG = {
    maxText: 28,      // 长文本保留字数
    yujianKeep: 3,    // 玉简每个好友保留最近几条
    log: true,        // 是否追加变更日志
    logMax: 24,       // 单组最多展示多少条差异
    debug: true,
  };

  const STATUS_RE = /<status_current_variables>[\s\S]*?<\/status_current_variables>/;
  const LOG_OPEN = '<mvu变量上一轮次修改日志>';
  const LOG_CLOSE = '</mvu变量上一轮次修改日志>';

  const KEEP_FULL = new Set(['当前时间', '姓名', '性别', '境界', '宗门', '所在界', '灵根']);

  // 这些字段只在状态栏/前端出现，不必每回合塞进提示词
  const DROP_FIELDS = new Set(['仙姿', '群芳谱', '引言']);

  // 字段级截断长度（未列出的走 CFG.maxText）
  const FIELD_LIMIT = {
    外观: 24, 容貌外观: 24, 心声: 24, 描述: 24, 背景: 16, 性格: 10,
    当前地点: 20, 神念: 16, 衣着: 18, 容貌: 18, 身形: 14, 目标: 20,
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
    // 只在必要时加引号，能省一点 token
    const needsQuote = !s || /^[\-?:,\[\]{}#&*!|>'"%@`]/.test(s) || /[:#]\s/.test(s) || /\s$/.test(s) || /[\n\r]/.test(s);
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

    return {
      ok: true, era: era,
      year: y, month: mo, day: d, hour: h, minute: mi,
      ms: Date.UTC(y, mo - 1, d, h, mi),
      raw: s,
    };
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
    if (Array.isArray(value)) {
      return value.map((v) => projectValue('', v)).filter((v) => v !== undefined);
    }
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

  function project(stat) {
    const out = {};
    for (const key of Object.keys(stat || {})) {
      if (key === '玉简') {
        const friends = {};
        for (const name of Object.keys(stat.玉简 || {})) {
          const f = deepClone(stat.玉简[name] || {});
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
      out[key] = projectValue(key, stat[key]);
    }
    return out;
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

  function latestState() {
    try {
      if (typeof Mvu !== 'undefined' && Mvu.getMvuData) {
        const data = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
        if (data && isObj(data.stat_data)) return data.stat_data;
      }
    } catch (e) { /* 走兜底 */ }
    try {
      const vars = typeof getVariables === 'function'
        ? getVariables({ type: 'message', message_id: 'latest' })
        : null;
      if (vars && isObj(vars.stat_data)) return vars.stat_data;
      if (vars) {
        for (const k of Object.keys(vars)) {
          if (isObj(vars[k]) && isObj(vars[k].stat_data)) return vars[k].stat_data;
        }
      }
    } catch (e) { /* 走兜底 */ }
    const chat = (typeof SillyTavern !== 'undefined' && SillyTavern.chat) || [];
    for (let i = chat.length - 1; i >= 0; i--) {
      const st = statOfMessage(chat[i]);
      if (st) return st;
    }
    return null;
  }

  function recentStates() {
    const chat = (typeof SillyTavern !== 'undefined' && SillyTavern.chat) || [];
    const list = [];
    for (let i = chat.length - 1; i >= 0 && list.length < 2; i--) {
      const msg = chat[i];
      if (msg.is_user || msg.is_system) continue;
      const st = statOfMessage(msg);
      if (st) list.push(st);
    }
    return list;
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
          if (!(k in b)) {
            bucket(group).others.push('移除「' + k + '」');
          } else if (!(k in a)) {
            bucket(group).others.push('新增「' + k + '」');
          } else {
            walk(a[k], b[k], path.concat(k));
          }
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

  function buildLog(current, previous) {
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
      if (delta > 0) {
        lines.push('时间：推进' + humanGap(delta) + '。');
      } else if (delta < 0) {
        lines.push('⚠ /世界/当前时间 回退：' + prevP.raw + ' → ' + curP.raw + '（-' + humanGap(delta) + '）。');
        lines.push('下次更新必须把时间修正为不早于「' + prevP.raw + '」，并按剧情补足应经过的时长。');
      } else if (String(curTime) !== String(prevTime)) {
        lines.push('时间：写法变了，时点未变（' + curP.raw + '）。');
      } else {
        lines.push('时间：未变。');
      }
    }

    if (previous) lines.push.apply(lines, diffLines(previous, current));

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
    const previous = states.length > 1 ? states[1] : null;
    const projection = toYaml(project(current));
    const log = CFG.log && previous ? buildLog(current, previous) : '';
    return { projection, log, raw: JSON.stringify(current), current, previous };
  }

  function rewriteRequest(payload) {
    const messages = payload && Array.isArray(payload.messages) ? payload.messages : null;
    if (!messages || !messages.length) return;

    const view = buildView();
    if (!view) return;

    // 1) 清掉历史里遗留的日志块
    for (const m of messages) {
      if (m && typeof m.content === 'string' && m.content.indexOf(LOG_OPEN) >= 0) {
        m.content = stripOldLogs(m.content);
      }
    }

    // 2) 替换状态块
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

    // 3) 兜底：找不到状态块就插一条 system 消息
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

    eventOn(tavern_events.CHAT_CHANGED, () => { window.__DAOYUAN_EXPR_LAST = null; });

    window.DaoYuanEXPR = {
      version: VERSION,
      cfg: CFG,
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

    console.info(TAG, '已挂载 v' + VERSION, CFG);
  })();
})();
