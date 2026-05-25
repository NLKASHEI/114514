// ═══════════════ MVU破限方案探路 ═══════════════
// 酒馆 JS-Slash-Runner 运行，探测所有可用破限预设
(async () => {
  const p = window.parent;
  console.log('═══ 破限方案探路 ═══');

  // ── 1. SillyTavern.getContext() 完整键 ──
  console.log('1. getContext() 键名:');
  const ctx = SillyTavern.getContext();
  const ctxKeys = Object.keys(ctx).sort();
  console.log('  ' + ctxKeys.join(', '));

  // 找含 preset/jailbreak/prompt 的键
  const relatedKeys = ctxKeys.filter(k => /preset|jailbreak|prompt|instruct|system/i.test(k));
  console.log('  相关键:', relatedKeys.length ? relatedKeys : '(无)');

  // ── 2. extensionSettings 中跟 preset 相关的键 ──
  console.log('2. extensionSettings 中 preset/jailbreak 相关:');
  const es = SillyTavern.extensionSettings;
  const esKeys = Object.keys(es);
  const presetKeys = esKeys.filter(k => /preset|jailbreak|prompt/i.test(k));
  for (const k of presetKeys) {
    const v = es[k];
    if (v && typeof v === 'object') {
      console.log('  ' + k + ': ' + JSON.stringify(v).slice(0, 300));
    } else {
      console.log('  ' + k + ': ' + JSON.stringify(v));
    }
  }

  // ── 3. chatCompletionSettings / oai_settings ──
  console.log('3. chatCompletionSettings:');
  const cs = SillyTavern.chatCompletionSettings || {};
  const csKeys = Object.keys(cs);
  console.log('  键数:', csKeys.length);
  const csPreset = csKeys.filter(k => /preset|jailbreak|prompt|instruct/i.test(k));
  for (const k of csPreset) console.log('  ' + k + ': ' + JSON.stringify(cs[k]).slice(0, 200));

  // ── 4. parent.SillyTavern 的额外属性 ──
  console.log('4. parent.SillyTavern:');
  const pst = p.SillyTavern;
  if (pst) {
    const pstKeys = Object.keys(pst);
    console.log('  键:', pstKeys);
    for (const k of pstKeys) {
      if (k === 'getContext' || k === 'libs') continue;
      try {
        const v = typeof pst[k] === 'function' ? '[function]' : JSON.stringify(pst[k]).slice(0, 200);
        console.log('  ' + k + ': ' + v);
      } catch(e) { console.log('  ' + k + ': [无法序列化]'); }
    }
  }

  // ── 5. 父页面上挂载的预设/prompt相关全局对象 ──
  console.log('5. 父页面全局对象 (含 preset/jailbreak/prompt):');
  const globals = [];
  for (const k of Object.getOwnPropertyNames(p)) {
    if (/preset|jailbreak|prompt|instruct|powerUser|power_user/i.test(k)) {
      try {
        globals.push(k + ': ' + typeof p[k] + ' = ' + JSON.stringify(p[k]).slice(0, 150));
      } catch(e) { globals.push(k + ': ' + typeof p[k]); }
    }
  }
  if (globals.length) globals.forEach(g => console.log('  ' + g));
  else console.log('  (无)');

  // ── 6. 用 TavernHelper 探 ──
  console.log('6. TavernHelper 探索:');
  const TH = window.TavernHelper;
  if (TH) {
    const thKeys = Object.keys(TH).filter(k => /preset|jailbreak|prompt/i.test(k));
    console.log('  相关键:', thKeys.length ? thKeys : '(无)');
    // 列出所有 TH 键
    console.log('  TH全部键 (' + Object.keys(TH).length + '): ' + Object.keys(TH).join(', '));
  }

  // ── 7. 尝试直接读父页面的 power_user 或预设系统 ──
  console.log('7. 父页面预设系统:');
  try {
    const script = p.document.createElement('script');
    script.textContent = `
      (function() {
        var results = {};
        // power_user
        if (typeof power_user !== 'undefined') {
          results.power_user_keys = Object.keys(power_user);
          var pu = power_user;
          for (var k in pu) {
            if (/preset|jailbreak|prompt/i.test(k)) {
              results['pu_' + k] = typeof pu[k] === 'string' ? pu[k].slice(0,200) : JSON.stringify(pu[k]).slice(0,200);
            }
          }
        }
        // presets
        if (typeof presets !== 'undefined') results.presets_type = typeof presets;
        if (typeof PresetManager !== 'undefined') results.has_PresetManager = true;
        // jailbreak 相关的全局
        for (var g in window) {
          try {
            if (/jailbreak|preset.*list|prompt.*list/i.test(g) && typeof window[g] !== 'function') {
              results['global_' + g] = typeof window[g];
            }
          } catch(e) {}
        }
        document.dispatchEvent(new CustomEvent('bp-probe-result', { detail: results }));
      })();
    `;
    const result = await new Promise((resolve) => {
      const handler = (e) => {
        p.document.removeEventListener('bp-probe-result', handler);
        resolve(e.detail);
      };
      p.document.addEventListener('bp-probe-result', handler);
      p.document.body.appendChild(script);
      script.remove();
    });
    console.log('  父页面探测结果:');
    for (const [k, v] of Object.entries(result)) {
      console.log('    ' + k + ': ' + v);
    }
  } catch(e) {
    console.log('  注入失败:', e.message);
  }

  // ── 8. mvu_settings 中破限相关配置详情 ──
  console.log('8. mvu_settings 破限相关:');
  const mvu = SillyTavern.extensionSettings.mvu_settings;
  if (mvu && mvu.额外模型解析配置) {
    console.log('  额外模型解析配置: ' + JSON.stringify(mvu.额外模型解析配置, null, 2).slice(0, 500));
  } else {
    console.log('  (无额外模型解析配置)');
  }

  // ── 9. 检查 ST 预设系统 (SillyTavern 可能暴露的 API) ──
  console.log('9. SillyTavern 预设相关方法:');
  try {
    // 尝试常见的预设相关调用路径
    const paths = [
      'SillyTavern.getPresets',
      'SillyTavern.getJailbreaks',
      'SillyTavern.presets',
      'SillyTavern.jailbreakPresets',
      'SillyTavern.extensionSettings.presets',
      'SillyTavern.extensionSettings.jailbreak',
    ];
    for (const path of paths) {
      try {
        const val = eval(path);
        if (val !== undefined) {
          console.log('  ✅ ' + path + ': ' + (typeof val === 'object' ? JSON.stringify(val).slice(0, 200) : val));
        }
      } catch(_) {}
    }
  } catch(e) {}

  console.log('═══ 探路完成 ═══');
})();
