// ═══════════════ 探图层测试 ═══════════════
// 手机端酒馆 JS-Slash-Runner 运行：
//   import 'https://testingcf.jsdelivr.net/gh/NLKASHEI/114514@master/探图层测试.js'
// 验证 position:fixed 元素在移动端的可见性和图层覆盖情况
(async () => {
  const p = window.parent;
  const vw = p.innerWidth;
  const vh = p.innerHeight;
  console.log('═══ 探图层测试 视口:' + vw + 'x' + vh + ' ═══');

  // 清理
  p.document.querySelectorAll('[id^=bp-probe-]').forEach(e => e.remove());

  // ── 创建4个探针圆（不同z-index，不同位置）──
  function probe(id, top, left, bg, z, label) {
    const el = p.document.createElement('div');
    el.id = 'bp-probe-' + id;
    el.textContent = label;
    el.style.cssText = [
      'position:fixed', 'top:' + top, 'left:' + left,
      'width:40px', 'height:40px', 'background:' + bg,
      'border:2px solid #fff', 'border-radius:50%',
      'z-index:' + z, 'box-shadow:0 0 14px ' + bg,
      'display:flex', 'align-items:center', 'justify-content:center',
      'color:#fff', 'font-size:10px', 'font-weight:bold',
    ].join(';');
    p.document.body.appendChild(el);
    return el;
  }

  probe('A', '10px', '10px',  '#e74c3c', '9999999', 'A');
  probe('B', '10px', '60px',  '#4ade80', '1000000', 'B');
  probe('C', '60px', '10px',  '#4a90e2', '1000',   'C');
  probe('D', '60px', '60px',  '#f0d060', '100',    'D');

  // 等渲染
  await new Promise(r => setTimeout(r, 300));

  // ── elementFromPoint 检测 ──
  const probes = ['A','B','C','D'].map(id => p.document.getElementById('bp-probe-' + id));
  let visible = 0, covered = 0;

  for (const el of probes) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const topEl = p.document.elementFromPoint(cx, cy);
    const hit = topEl === el || el.contains(topEl);
    if (hit) visible++; else covered++;
    console.log('  ' + (hit ? '✅' : '❌') + ' 探针' + el.textContent
      + ' z=' + p.getComputedStyle(el).zIndex
      + ' 命中:' + (topEl ? (topEl.tagName + (topEl.id ? '#' + topEl.id : '') + '.' + (topEl.className || '').toString().slice(0, 30)) : '(无)'));
  }

  // ── 扫描页面高z-index元素 ──
  console.log('─── 页面高z-index元素(>1000) ───');
  const highs = [];
  p.document.querySelectorAll('*').forEach(el => {
    const z = parseInt(p.getComputedStyle(el).zIndex);
    if (!isNaN(z) && z > 1000) {
      highs.push({z, tag: el.tagName, id: el.id || '', cls: (el.className || '').toString().slice(0, 40)});
    }
  });
  highs.sort((a, b) => b.z - a.z);
  highs.slice(0, 15).forEach(h => console.log('  z=' + h.z, h.tag, h.id, h.cls));
  if (highs.length === 0) console.log('  (无)');

  // ── 全屏覆盖检测 ──
  console.log('─── 全屏覆盖层检测 ──');
  const fullscreen = [];
  p.document.querySelectorAll('[style*="fixed"], [class*="overlay"], [class*="modal"], [class*="drawer"], [class*="backdrop"]').forEach(el => {
    const r = el.getBoundingClientRect();
    const style = p.getComputedStyle(el);
    if (r.width >= vw * 0.9 && r.height >= vh * 0.9
      && style.display !== 'none' && style.visibility !== 'hidden'
      && parseFloat(style.opacity) > 0) {
      fullscreen.push({
        tag: el.tagName, id: el.id, cls: (el.className || '').toString().slice(0, 50),
        z: style.zIndex, w: r.width.toFixed(0), h: r.height.toFixed(0)
      });
    }
  });
  if (fullscreen.length) {
    fullscreen.forEach(f => console.log('  ⚠️', f.tag, f.id || f.cls, 'z=' + f.z, f.w + 'x' + f.h));
  } else {
    console.log('  (未检测到全屏覆盖层)');
  }

  // ── 汇总 ──
  console.log('─── 汇总 ───');
  console.log('  可见: ' + visible + '/4  被遮挡: ' + covered + '/4');
  if (visible === 4) {
    console.log('  ✅ fixed元素正常渲染，原版脚本可能存在创建失败的问题');
  } else if (visible === 0) {
    console.log('  ❌ 全部被遮挡 — 存在全屏覆盖层或父页面body不可渲染');
  } else {
    console.log('  ⚠️ 部分被遮挡 — 提高z-index到9999999可解决');
  }
  console.log('  清理: parent.document.querySelectorAll("[id^=bp-probe-]").forEach(e=>e.remove())');
  console.log('═══ 测试完成 ═══');
})();
