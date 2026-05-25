// ═══════════════ 悬浮窗诊断 ═══════════════
// 在手机端酒馆 JS-Slash-Runner 运行此脚本
(async () => {
  const p = window.parent;
  const bubble = p.document.getElementById('bp-switch-bubble');
  const panel = p.document.getElementById('bp-switch-panel');

  console.log('══════════ 悬浮窗诊断 ═══════════');

  // 1. DOM 存在性
  console.log('1. DOM存在性');
  console.log('  bubble:', bubble ? '存在' : '❌ 不存在');
  console.log('  panel:', panel ? '存在' : '❌ 不存在');
  if (!bubble) {
    console.log('❌❌❌ bubble元素完全不存在于父页面DOM中！');
    console.log('  父页面body子元素数:', p.document.body.children.length);
    return;
  }

  // 2. 计算样式
  const bs = p.getComputedStyle(bubble);
  console.log('2. 计算样式');
  console.log('  display:', bs.display);
  console.log('  visibility:', bs.visibility);
  console.log('  opacity:', bs.opacity);
  console.log('  position:', bs.position);
  console.log('  z-index:', bs.zIndex);
  console.log('  width/height:', bs.width, 'x', bs.height);
  console.log('  top/left:', bs.top, '/', bs.left);
  console.log('  background:', bs.background);
  console.log('  pointer-events:', bs.pointerEvents);

  // 3. 关键检查
  const rect = bubble.getBoundingClientRect();
  console.log('3. 位置信息');
  console.log('  rect:', JSON.stringify({top: rect.top, left: rect.left, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right}));

  if (rect.width === 0 || rect.height === 0) {
    console.log('❌ 元素尺寸为0！');
  }
  if (bs.display === 'none') {
    console.log('❌ display:none！');
  }
  if (bs.visibility === 'hidden') {
    console.log('❌ visibility:hidden！');
  }
  if (parseFloat(bs.opacity) === 0) {
    console.log('❌ opacity:0！');
  }

  // 3b. 检查是否在视口外
  const vw = p.innerWidth;
  const vh = p.innerHeight;
  console.log('  视口:', vw + 'x' + vh);
  if (rect.right < 0 || rect.left > vw || rect.bottom < 0 || rect.top > vh) {
    console.log('❌ 元素在视口之外！');
  }

  // 4. 图片加载
  const img = bubble.querySelector('img');
  console.log('4. 图片状态');
  if (img) {
    console.log('  src:', img.src);
    console.log('  complete:', img.complete);
    console.log('  naturalWidth/Height:', img.naturalWidth, 'x', img.naturalHeight);
    if (!img.complete) {
      console.log('⚠️ 图片尚未加载完成');
    } else if (img.naturalWidth === 0) {
      console.log('❌ 图片加载失败（naturalWidth=0）');
    }
  } else {
    console.log('❌ 没有img元素');
  }

  // 5. 图层冲突检测 — 查找覆盖bubble的元素
  console.log('5. 图层冲突检测');
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const topEl = p.document.elementFromPoint(cx, cy);
  console.log('  bubble中心点(' + cx + ',' + cy + ')最上层元素:');
  if (topEl) {
    console.log('    tagName:', topEl.tagName);
    console.log('    id:', topEl.id || '(无)');
    console.log('    className:', (topEl.className || '(无)').toString().slice(0, 100));
    const topZ = p.getComputedStyle(topEl).zIndex;
    console.log('    z-index:', topZ);
    if (topEl === bubble || bubble.contains(topEl)) {
      console.log('  ✅ bubble在最上层');
    } else {
      console.log('  ❌ bubble被其他元素覆盖！覆盖者是:', topEl.tagName, topEl.id || topEl.className);
      // 往上查z-index
      let el = topEl;
      let chain = [];
      while (el && el !== p.document.body) {
        const z = p.getComputedStyle(el).zIndex;
        const pos = p.getComputedStyle(el).position;
        if (z !== 'auto' || pos === 'fixed' || pos === 'absolute') {
          chain.push(el.tagName + (el.id ? '#' + el.id : '') + ' pos=' + pos + ' z=' + z);
        }
        el = el.parentElement;
      }
      console.log('  覆盖元素层级链 (有定位/层叠的):');
      chain.forEach(c => console.log('    ' + c));
    }
  } else {
    console.log('    (无 — 可能超出viewport)');
  }

  // 6. 检查ST自己的fixed元素是否用了超高z-index
  console.log('6. ST fixed元素z-index扫描');
  const allFixed = p.document.querySelectorAll('[style*="z-index"], .fixed, [class*="bar"], [class*="menu"], [class*="overlay"]');
  let highZ = [];
  allFixed.forEach(el => {
    const z = parseInt(p.getComputedStyle(el).zIndex);
    if (!isNaN(z) && z > 100) {
      highZ.push({z, tag: el.tagName, id: el.id, cls: (el.className || '').toString().slice(0, 50)});
    }
  });
  highZ.sort((a, b) => b.z - a.z);
  console.log('  高z-index元素 (前10):');
  highZ.slice(0, 10).forEach(h => console.log('    z=' + h.z, h.tag, h.id || h.cls));

  // 7. counter-test: 创建一个测试元素看看
  console.log('7. 测试: 创建一个同层级fixed元素');
  const testEl = p.document.createElement('div');
  testEl.textContent = 'TEST';
  testEl.style.cssText = 'position:fixed;top:10px;left:10px;z-index:9999999;width:60px;height:60px;background:red;border-radius:50%;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;';
  p.document.body.appendChild(testEl);
  console.log('  红色测试圆已放到左上角，能看到吗？');
  setTimeout(() => testEl.remove(), 5000);

  console.log('══════════ 诊断完成 ═══════════');
  console.log('  (红色测试圆5秒后自动消失)');
})();
