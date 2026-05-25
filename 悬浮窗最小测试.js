// ═══════════════ 悬浮窗最小化测试 ═══════════════
// 在手机端酒馆 JS-Slash-Runner 运行此脚本
// 创建3个测试圆圈，验证position:fixed在移动端的表现
(() => {
  const p = window.parent;

  // 清理旧元素
  ['bp-test-1', 'bp-test-2', 'bp-test-3'].forEach(id => {
    const old = p.document.getElementById(id);
    if (old) old.remove();
  });

  function makeCircle(id, top, left, bg, z) {
    const el = p.document.createElement('div');
    el.id = id;
    el.style.cssText = [
      'position:fixed',
      'top:' + top,
      'left:' + left,
      'width:44px', 'height:44px',
      'background:' + bg,
      'border:2px solid white',
      'border-radius:50%',
      'z-index:' + z,
      'box-shadow:0 0 12px ' + bg,
    ].join(';');
    p.document.body.appendChild(el);
    return el;
  }

  // 3个测试圆：不同z-index，放在不同位置
  makeCircle('bp-test-1', '10px',  '10px',   'red',    '9999999');
  makeCircle('bp-test-2', '10px',  '64px',   'lime',   '1000');
  makeCircle('bp-test-3', '64px',  '10px',   'cyan',   '100');

  console.log('✅ 已创建3个测试圆（左上角），能看到几个？');
  console.log('  bp-test-1: red   z=9999999 (10,10)');
  console.log('  bp-test-2: lime  z=1000    (10,64)');
  console.log('  bp-test-3: cyan  z=100     (64,10)');
  console.log('  如果全部看不到 → 检查是否有全屏覆盖层');
  console.log('  如果只有z低的看不到 → 图层问题');
  console.log('  如果能看到 → 说明原版脚本创建失败');
  console.log('');
  console.log('  运行清理: document.querySelectorAll("[id^=bp-test-]").forEach(e=>e.remove())');
})();
