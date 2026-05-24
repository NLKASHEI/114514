// ═══════════════ 道渊配置小助手 ═══════════════
// 酒馆助手中粘贴以下一行即可：
//   import 'https://testingcf.jsdelivr.net/gh/NLKASHEI/114514@v1.0.2/道渊配置小助手.min.js'
// ═══════════════════════════════════════════════════════════

const DAOYUAN_VERSION = '1.0.2';
const p = window.parent || window;

// 清理旧实例
const oldPanel = p.document.getElementById('bp-switch-panel');
const oldBubble = p.document.getElementById('bp-switch-bubble');
if (oldPanel) oldPanel.remove();
if (oldBubble) oldBubble.remove();

// ═══════════════ 核心：在父页面上下文执行代码 ═══════════════
// iframe 中的异步 API（getWorldbook/updateWorldbookWith）调用会因
// 请求上下文问题失败。解决办法：往父页面注入 <script> 标签，
// 在父页面原生上下文中执行操作，结果通过 CustomEvent 回传。
function runInParent(fnString) {
  return new Promise((resolve, reject) => {
    const token = 'bp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const handler = (e) => {
      if (!e.detail || e.detail.token !== token) return;
      p.document.removeEventListener('bp-result', handler);
      if (e.detail.error) reject(new Error(e.detail.error));
      else resolve(e.detail.result);
    };
    p.document.addEventListener('bp-result', handler);

    const script = p.document.createElement('script');
    script.textContent = `
(async () => {
  try {
    var _result = await (${fnString});
    document.dispatchEvent(new CustomEvent('bp-result', { detail: { token: '${token}', result: _result } }));
  } catch(_e) {
    document.dispatchEvent(new CustomEvent('bp-result', { detail: { token: '${token}', error: _e.message || String(_e) } }));
  }
})();
`;
    p.document.body.appendChild(script);
    script.remove();
  });
}

// ═══════════════ API 封装（均在父页面上下文执行） ═══════════════
async function api_getWorldbookNames() {
  return runInParent('TavernHelper.getWorldbookNames()');
}

async function api_getCharWorldbooks() {
  return runInParent('TavernHelper.getCharWorldbookNames("current")');
}

async function api_getWorldbook(name) {
  return runInParent(`TavernHelper.getWorldbook(${JSON.stringify(name)})`);
}

// 直接在父页面：获取条目 → 修改 → replaceWorldbook 保存 → 返回刷新后的条目
async function api_replaceWorldbook(name, entriesModifier) {
  return runInParent(
    `(async () => {` +
    `  var _entries = await TavernHelper.getWorldbook(${JSON.stringify(name)});` +
    `  (${entriesModifier})(_entries);` +
    `  await TavernHelper.replaceWorldbook(${JSON.stringify(name)}, _entries);` +
    `  return await TavernHelper.getWorldbook(${JSON.stringify(name)});` +
    `})()`
  );
}

// 更新 MVU 后端 stat_data.主角.所在界
// message_id: -1 = 最新楼层，Mvu 全局在 iframe 中直接可用
async function api_setMvuBirthplace(birthplace) {
  if (typeof Mvu === 'undefined') throw new Error('Mvu 不可用');

  const data = Mvu.getMvuData({ type: 'message', message_id: -1 }) || {};
  if (!data.stat_data) data.stat_data = {};
  if (!data.stat_data.主角) data.stat_data.主角 = {};
  data.stat_data.主角.所在界 = birthplace;

  await Mvu.replaceMvuData(data, { type: 'message', message_id: -1 });
  try { if (typeof eventEmit === 'function' && Mvu.events && Mvu.events.VARIABLE_UPDATE_ENDED) eventEmit(Mvu.events.VARIABLE_UPDATE_ENDED); } catch (e) {}
  return true;
}

// 正则操作（角色级别）
async function api_getTavernRegexes() {
  return runInParent('TavernHelper.getTavernRegexes({ type: "character" })');
}
async function api_updateTavernRegexes(modifier) {
  return runInParent(
    `TavernHelper.updateTavernRegexesWith(${modifier}, { type: "character" })`
  );
}

// 角色脚本树操作
async function api_getScriptTrees() {
  return runInParent('TavernHelper.getScriptTrees({ type: "character" })');
}
async function api_updateScriptTrees(modifier) {
  return runInParent(
    `TavernHelper.updateScriptTreesWith(${modifier}, { type: "character" })`
  );
}

// --- CSS（注入到父页面，道渊配色） ---
const CSS = p.document.createElement('style');
CSS.textContent = `
  .bp-switch-bubble,
  .bp-switch-bubble:hover,
  .bp-switch-bubble:focus,
  .bp-switch-bubble:focus-visible,
  .bp-switch-bubble:focus-within,
  .bp-switch-bubble:active {
    position: fixed !important; width: 40px; height: 40px;
    background: transparent !important; border: none !important; border-radius: 0 !important;
    z-index: 1000000; cursor: pointer; display: flex; align-items: center;
    justify-content: center; touch-action: none;
    font-family: 'Ma Shan Zheng', cursive !important; font-size: 28px;
    color: #4a90e2 !important;
    text-shadow: 0 0 8px #87cefa !important;
    box-shadow: none !important; outline: none !important;
    transition: left 0.3s cubic-bezier(0.18,0.89,0.32,1.28), color 0.2s, text-shadow 0.2s;
    user-select: none; -webkit-user-select: none;
    line-height: 1 !important; padding: 0 !important; margin: 0 !important;
    -webkit-tap-highlight-color: transparent !important;
    -webkit-appearance: none !important; appearance: none !important;
    text-decoration: none !important; pointer-events: auto;
  }
  .bp-switch-bubble:hover {
    color: #87cefa !important;
    text-shadow: 0 0 14px #87cefa !important;
  }
  .bp-switch-panel {
    position: fixed !important; z-index: 999998;
    background: rgba(10,15,25,0.97) !important;
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(28,61,94,0.5) !important;
    box-shadow: 0 12px 48px rgba(0,0,0,0.7), 0 0 30px rgba(74,144,226,0.06) !important;
    font-family: 'Noto Serif SC','Inter','Microsoft YaHei',serif !important;
    display: flex; flex-direction: column; border-radius: 10px !important;
    color: #d0e0f0 !important; font-size: 13px;
    overflow: hidden; width: 320px; max-width: 92vw; max-height: 62vh; box-sizing: border-box;
    padding: 0 !important; margin: 0 !important;
  }
  .bp-switch-panel::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, #D4AF37, #f0d060, #D4AF37, transparent) !important;
    opacity: 0.5; pointer-events: none;
  }
  .bp-switch-header {
    padding: 14px 16px 10px !important; display: flex; align-items: center;
    justify-content: space-between; cursor: move; user-select: none;
    touch-action: none; flex-shrink: 0;
    border-bottom: 1px solid rgba(28,61,94,0.3) !important;
    background: rgba(74,144,226,0.03) !important; margin: 0 !important;
  }
  .bp-switch-header-title {
    color: #87cefa !important; font-weight: 400; font-size: 18px;
    font-family: 'Ma Shan Zheng', cursive !important;
    letter-spacing: 2px; display: flex; align-items: center; gap: 8px;
    background: none !important; border: none !important;
  }
  .bp-switch-body { flex: 1; overflow-y: auto; padding: 14px 16px !important; }
  .bp-switch-body::-webkit-scrollbar { width: 4px; }
  .bp-switch-body::-webkit-scrollbar-track { background: transparent; }
  .bp-switch-body::-webkit-scrollbar-thumb { background: rgba(74,144,226,0.12); border-radius: 2px; }
  .bp-switch-section {
    background: rgba(74,144,226,0.03) !important; border: 1px solid rgba(28,61,94,0.25) !important;
    border-radius: 8px !important; padding: 14px !important; margin-bottom: 12px;
  }
  .bp-switch-section-title {
    font-size: 11px; color: #4a90e2 !important; font-weight: 600; letter-spacing: 1.2px;
    margin-bottom: 10px;
    display: flex; align-items: center; gap: 6px;
    background: none !important; border: none !important;
  }
  .bp-switch-section-title::after {
    content: ''; flex: 1; height: 1px;
    background: linear-gradient(90deg, rgba(74,144,226,0.2), transparent);
  }
  .bp-config-status {
    margin-bottom: 12px; padding: 10px 14px !important;
    border-radius: 8px !important; font-size: 13px; font-weight: 600;
    text-align: center; letter-spacing: 0.5px;
    background: rgba(74,222,128,0.06) !important;
    border: 1px solid rgba(74,222,128,0.25) !important;
    color: #4ade80 !important;
  }
  .bp-config-status.warn {
    background: rgba(231,76,60,0.08) !important;
    border: 1px solid rgba(231,76,60,0.35) !important;
    color: #e74c3c !important;
    animation: bp-pulse-warn 2s ease-in-out infinite;
  }
  @keyframes bp-pulse-warn {
    0%, 100% { border-color: rgba(231,76,60,0.35) !important; }
    50% { border-color: rgba(231,76,60,0.7) !important; }
  }
  .bp-switch select {
    width: 100%; max-width: 100%; box-sizing: border-box;
    padding: 9px 32px 9px 12px; border-radius: 6px; font-size: 13px;
    font-family: inherit; background: #101520 !important;
    border: 1px solid #2a3a50 !important; color: #d0e0f0 !important; cursor: pointer;
    -webkit-appearance: none; appearance: none; transition: border-color 0.2s;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23D4AF37' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    box-shadow: none !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .bp-switch select:hover { border-color: #4a90e2 !important; }
  .bp-switch select:focus { border-color: #D4AF37 !important; outline: none; box-shadow: 0 0 0 2px rgba(212,175,55,0.1) !important; }
  .bp-switch select option { background: #101520 !important; color: #d0e0f0 !important; }
  .bp-switch-btn {
    padding: 7px 14px !important; border-radius: 6px !important; cursor: pointer;
    border: 1px solid #2a3a50 !important; background: rgba(74,144,226,0.06) !important;
    color: #87cefa !important; font-size: 12px; font-weight: 500; font-family: inherit !important;
    transition: all 0.2s; letter-spacing: 0.3px;
    text-shadow: none !important; box-shadow: none !important;
    line-height: 1.4 !important; min-height: auto !important;
  }
  .bp-switch-btn:hover {
    background: rgba(74,144,226,0.15) !important; border-color: #4a90e2 !important; color: #fff !important;
  }
  .bp-switch-btn.primary {
    width: 100% !important; display: block !important;
    background: linear-gradient(160deg, #D4AF37, #b8941f) !important;
    border: 1px solid #D4AF37 !important; color: #080c14 !important;
    margin-top: 6px; padding: 10px !important; font-size: 13px; font-weight: 700 !important;
    letter-spacing: 0.5px; text-shadow: none !important;
    box-shadow: 0 2px 10px rgba(212,175,55,0.15) !important;
    line-height: 1.4 !important; min-height: auto !important;
    text-align: center !important;
  }
  .bp-switch-btn.primary:hover {
    background: linear-gradient(160deg, #e0bc50, #c9a52a) !important;
    border-color: #f0d060 !important; box-shadow: 0 4px 16px rgba(212,175,55,0.3) !important;
    color: #080c14 !important;
  }
  .bp-switch-btn.primary:disabled {
    opacity: 0.35; cursor: not-allowed; filter: grayscale(30%);
  }
  .bp-switch-btn.xs {
    padding: 4px 10px !important; font-size: 11px; width: auto; border-radius: 5px !important;
    background: transparent !important; border-color: rgba(28,61,94,0.3) !important;
    color: #4a90e2 !important; font-weight: 500 !important;
    display: inline-block !important; box-shadow: none !important;
  }
  .bp-switch-btn.xs:hover {
    border-color: #4a90e2 !important; color: #87cefa !important;
    background: rgba(74,144,226,0.08) !important;
  }
  .bp-switch-birth-btns {
    display: flex; gap: 10px; margin-bottom: 10px;
  }
  .bp-switch-birth-btn {
    flex: 1; padding: 10px 0 !important; border-radius: 6px !important; cursor: pointer;
    border: 1px solid #2a3a50 !important;
    background: #101520 !important; color: #d0e0f0 !important;
    font-size: 13px; font-weight: 500; font-family: inherit !important;
    transition: all 0.25s; text-align: center !important;
    letter-spacing: 0.5px;
    text-shadow: none !important; box-shadow: none !important;
    line-height: 1.4 !important;
  }
  .bp-switch-birth-btn:hover {
    background: rgba(74,144,226,0.12) !important; border-color: #4a90e2 !important;
    color: #fff !important;
  }
  .bp-switch-birth-btn.active {
    background: #4a90e2 !important; border-color: #87cefa !important;
    color: #fff !important;
    box-shadow: 0 0 12px rgba(74,144,226,0.4) !important;
  }
  .bp-switch-panel .bp-status-inline {
    display: flex; align-items: center; gap: 8px; font-size: 12px;
  }
  .bp-switch-panel .status-dot {
    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  }
  .bp-switch-panel .status-dot.on {
    background: #4ade80;
    box-shadow: 0 0 10px #4ade80, 0 0 20px rgba(74,222,128,0.4);
  }
  .bp-switch-panel .status-dot.off {
    background: #e74c3c;
    box-shadow: 0 0 10px #e74c3c, 0 0 20px rgba(231,76,60,0.4);
  }
  .bp-switch-panel .status-dot.missing { background: #3a4a5a; box-shadow: none; }
  .bp-switch-panel .status-label { color: #8fa4bc !important; }
  .bp-switch .toast {
    position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
    background: rgba(10,15,25,0.97) !important; border: 1px solid rgba(212,175,55,0.35) !important;
    border-radius: 8px !important; padding: 10px 24px !important; color: #D4AF37 !important;
    font-size: 13px; font-weight: 600; z-index: 1000002;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 10px rgba(212,175,55,0.06) !important;
    animation: bp-toast-in 0.3s ease, bp-toast-out 0.3s ease 2.2s forwards;
    letter-spacing: 0.3px; font-family: 'Noto Serif SC','Inter','Microsoft YaHei',serif !important;
    margin: 0 !important;
  }
  @keyframes bp-toast-in { from { opacity: 0; transform: translateX(-50%) translateY(-12px); } }
  @keyframes bp-toast-out { to { opacity: 0; transform: translateX(-50%) translateY(-12px); } }
  @media (max-width: 768px) {
    .bp-switch-panel { width: clamp(260px, 88vw, 340px) !important; font-size: 12px; }
    .bp-switch-bubble { width: 36px; height: 36px; font-size: 24px; }
    .bp-switch-header { padding: 10px 12px 8px !important; }
    .bp-switch-header-title { font-size: 16px; letter-spacing: 1px; }
    .bp-switch-body { padding: 10px 10px !important; }
    .bp-switch-section { padding: 10px !important; margin-bottom: 8px; }
    .bp-switch-section-title { font-size: 10px; margin-bottom: 8px; }
    .bp-switch-birth-btn { padding: 8px 0 !important; font-size: 12px; }
    .bp-switch-birth-btns { gap: 8px; }
    .bp-switch-btn.xs { padding: 3px 8px !important; font-size: 10px; }
    .bp-switch-panel .bp-status-inline { font-size: 11px; gap: 6px; }
    .bp-switch-panel .status-dot { width: 8px; height: 8px; }
    .bp-switch-panel select { padding: 7px 28px 7px 10px; font-size: 12px; }
    .bp-config-status { padding: 8px 10px !important; font-size: 12px; margin-bottom: 8px; }
  }
`;
p.document.head.appendChild(CSS);

// 追加 MVU 配置表单 CSS
const MVU_CSS = p.document.createElement('style');
MVU_CSS.textContent = `
  .bp-mvu-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
  .bp-mvu-row.col { flex-direction: column; align-items: stretch; gap: 2px; }
  .bp-mvu-label { font-size: 13px; color: #8fa4bc; white-space: nowrap; flex-shrink: 0; min-width: 56px; letter-spacing: 0.3px; }
  .bp-mvu-label.wide { min-width: 64px; }
  .bp-mvu-input { flex: 1; padding: 5px 9px; border-radius: 5px; font-size: 13px; font-family: inherit; background: #101520 !important; border: 1px solid #2a3a50 !important; color: #d0e0f0 !important; transition: border-color 0.2s; min-width: 0; box-shadow: none !important; outline: none !important; }
  .bp-mvu-input:focus { border-color: #4a90e2 !important; }
  .bp-mvu-input.num { width: 58px; flex: 0 0 auto; text-align: center; padding: 5px 2px; }
  .bp-mvu-select { flex: 1; padding: 5px 26px 5px 9px; border-radius: 5px; font-size: 13px; font-family: inherit; background: #101520 !important; border: 1px solid #2a3a50 !important; color: #d0e0f0 !important; cursor: pointer; -webkit-appearance: none; appearance: none; transition: border-color 0.2s; min-width: 0; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23D4AF37' d='M5 7L1 3h8z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 7px center; box-shadow: none !important; outline: none !important; }
  .bp-mvu-select:focus { border-color: #4a90e2 !important; }
  .bp-mvu-check-row { display: flex; align-items: center; gap: 4px; margin-bottom: 1px; font-size: 13px; color: #b0c8e0; cursor: pointer; line-height: 1.4; }
  .bp-mvu-check-row input[type="checkbox"] { display: none !important; }
  .bp-mvu-check-box { width: 14px; height: 14px; flex-shrink: 0; border: 1.5px solid #3a4a60; border-radius: 3px; background: #101520; transition: all 0.15s; display: inline-block; box-sizing: border-box; }
  .bp-mvu-check-row input:checked ~ .bp-mvu-check-box { background: #4a90e2; border-color: #4a90e2; }
  .bp-mvu-check-row:hover .bp-mvu-check-box { border-color: #4a90e2; }
  .bp-mvu-hint { font-size: 10px; color: #52504a; line-height: 1.4; margin-top: 1px; }
  .bp-mvu-subtitle { font-size: 10px; color: #D4AF37; letter-spacing: 0.8px; margin: 5px 0 2px; padding-top: 4px; border-top: 1px solid rgba(28,61,94,0.2); }
  .bp-mvu-collapse-header { display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 11px; color: #4a90e2; padding: 3px 0; user-select: none; }
  .bp-mvu-collapse-header:hover { color: #87cefa; }
  .bp-mvu-collapse-arrow { display: inline-block; font-size: 8px; transition: transform 0.2s; }
  .bp-mvu-collapse-arrow.open { transform: rotate(90deg); }
  .bp-mvu-collapse-body { padding-left: 4px; }
  .bp-mvu-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 6px; }
  #bp-mvu-section { padding: 10px 12px !important; }
  #bp-mvu-section .bp-mvu-subtitle:first-of-type { margin-top: 2px; }
  #bp-mvu-section::-webkit-scrollbar { width: 3px; }
  #bp-mvu-section::-webkit-scrollbar-thumb { background: rgba(74,144,226,0.15); border-radius: 2px; }
  #bp-confirm-dialog { overflow: hidden !important; }
  #bp-confirm-body { overflow: hidden; }
  #bp-confirm-body .bp-mvu-select { max-width: 100%; width: 0; }
  #bp-confirm-body .bp-mvu-input { max-width: 100%; }
  #bp-confirm-body .bp-mvu-row { overflow: hidden; }
`;
p.document.head.appendChild(MVU_CSS);

// --- HTML（注入到父页面） ---
p.document.body.insertAdjacentHTML('beforeend', `
  <div id="bp-switch-bubble" class="bp-switch-bubble" style="top: 40vh; left: 60px;" title="出生地开关">道</div>
  <div id="bp-switch-panel" class="bp-switch-panel" style="display:none; left: 110px; top: 35vh;">
    <div class="bp-switch-header" id="bp-switch-drag">
      <span class="bp-switch-header-title">道渊配置小助手</span>
      <button class="bp-switch-btn xs" id="bp-switch-refresh" title="刷新">刷新</button>
    </div>
    <div class="bp-switch-body">
      <div class="bp-config-status" id="bp-config-status">配置运行正常</div>
      <div id="bp-backend-code" style="text-align:center;margin-bottom:10px;font-size:10px;color:#52504a;line-height:1.6;word-break:break-all;"></div>
      <div class="bp-switch-section">
        <div class="bp-switch-section-title">世界书</div>
        <select id="bp-wb-select"><option value="">-- 加载中... --</option></select>
        <div id="bp-wb-count" style="font-size:11px;color:#8fa4bc;margin-top:6px;text-align:center;line-height:1.6;"></div>
      </div>
      <div class="bp-switch-section">
        <div class="bp-switch-section-title">切换出生地</div>
        <div class="bp-switch-birth-btns">
          <button class="bp-switch-birth-btn" data-birthplace="玄天界">玄天界</button>
          <button class="bp-switch-birth-btn" data-birthplace="仙界">仙界</button>
        </div>
        <div id="bp-status-list" style="display:flex;justify-content:center;gap:28px;margin-top:6px;"></div>
      </div>
      <div class="bp-switch-section">
        <div class="bp-switch-section-title">状态栏模式</div>
        <div class="bp-switch-birth-btns" id="bp-mode-btns">
          <button class="bp-switch-birth-btn" data-mode="mvu">MVU</button>
          <button class="bp-switch-birth-btn" data-mode="xml">XML</button>
        </div>
        <div id="bp-mode-status" style="font-size:11px;color:#8fa4bc;margin-top:8px;text-align:center;line-height:1.6;"></div>
      </div>
      <div class="bp-switch-section" id="bp-mvu-section">
        <div class="bp-switch-section-title">MVU插件配置</div>
        <button class="bp-switch-btn primary" id="bp-mvu-optimize" style="margin-bottom:8px;">一键最优配置</button>
        <!-- 手动配置手风琴 -->
        <div class="bp-mvu-collapse-header" id="bp-mvu-manual-toggle" style="font-size:13px;justify-content:center;">
          <span class="bp-mvu-collapse-arrow" id="bp-mvu-manual-arrow">▶</span><span>手动配置</span>
        </div>
        <div class="bp-mvu-collapse-body" id="bp-mvu-manual-panel" style="display:none;">
        <!-- 更新方式 -->
        <div class="bp-mvu-row">
          <label class="bp-mvu-label">更新方式</label>
          <select class="bp-mvu-select" id="bp-mvu-update-mode">
            <option value="随AI输出">随AI输出</option>
            <option value="额外模型解析">额外模型解析</option>
          </select>
        </div>
        <div class="bp-mvu-row">
          <label class="bp-mvu-label">模型来源</label>
          <select class="bp-mvu-select" id="bp-mvu-model-source">
            <option value="与插头相同">与插头相同</option>
            <option value="自定义">自定义</option>
          </select>
        </div>
        <!-- API & 模型（自定义时可见） -->
        <div id="bp-mvu-custom-api">
        <div class="bp-mvu-subtitle" style="margin-top:8px;">模型连接</div>
        <div class="bp-mvu-row">
          <label class="bp-mvu-label wide">API地址</label>
          <input class="bp-mvu-input" id="bp-mvu-api-url" placeholder="https://...">
          <button class="bp-switch-btn xs" id="bp-mvu-fetch-models" style="flex-shrink:0;">获取模型</button>
        </div>
        <div class="bp-mvu-row">
          <label class="bp-mvu-label wide">API密钥</label>
          <input class="bp-mvu-input" id="bp-mvu-api-key" type="password" placeholder="sk-...">
        </div>
        <div class="bp-mvu-row">
          <label class="bp-mvu-label wide">模型名称</label>
          <select class="bp-mvu-select" id="bp-mvu-model-name">
            <option value="">-- 请先获取模型 --</option>
          </select>
        </div>
        </div><!-- end bp-mvu-custom-api -->
        <!-- 额外模型解析面板 -->
        <div id="bp-mvu-extra-panel" style="display:none;">
          <div class="bp-mvu-subtitle">额外模型解析</div>
          <div class="bp-mvu-row">
            <label class="bp-mvu-label">破限方案</label>
            <select class="bp-mvu-select" id="bp-mvu-jailbreak">
              <option value="使用内置破限">使用内置破限</option>
              <option value="其他预设破限">其他预设破限</option>
            </select>
          </div>
          <div class="bp-mvu-row" id="bp-mvu-preset-name-row" style="display:none;">
            <label class="bp-mvu-label">预设名称</label>
            <input class="bp-mvu-input" id="bp-mvu-preset-name" placeholder="预设破限名称">
          </div>
          <div class="bp-mvu-row">
            <label class="bp-mvu-label">应答格式</label>
            <select class="bp-mvu-select" id="bp-mvu-response-format">
              <option value="聊天消息">聊天消息</option>
              <option value="JSON格式">JSON格式</option>
              <option value="纯文本">纯文本</option>
            </select>
          </div>
          <div class="bp-mvu-row">
            <label class="bp-mvu-label">请求方式</label>
            <select class="bp-mvu-select" id="bp-mvu-request-mode">
              <option value="依次请求，失败后重试">依次请求，失败后重试</option>
              <option value="仅请求一次">仅请求一次</option>
              <option value="并发请求">并发请求</option>
            </select>
          </div>
          <div class="bp-mvu-row">
            <label class="bp-mvu-label">请求次数</label>
            <input class="bp-mvu-input num" id="bp-mvu-request-count" type="number" min="1" max="10">
          </div>
          <label class="bp-mvu-check-row">
            <input type="checkbox" id="bp-mvu-auto-request"><span class="bp-mvu-check-box"></span><span>启用自动请求</span>
          </label>
          <div class="bp-mvu-hint">建议选择 gemini 2.5p / 3.1p / 3.5f 等模型</div>
          <!-- 高级参数 -->
          <div class="bp-mvu-collapse-header" id="bp-mvu-adv-toggle">
            <span class="bp-mvu-collapse-arrow" id="bp-mvu-adv-arrow">▶</span><span>高级参数</span>
          </div>
          <div class="bp-mvu-collapse-body" id="bp-mvu-adv-panel" style="display:none;">
            <div class="bp-mvu-grid-2">
              <div class="bp-mvu-row col" style="gap:1px;">
                <label class="bp-mvu-label">最大回复token</label>
                <input class="bp-mvu-input num" id="bp-mvu-max-tokens" type="number" min="1" max="1048576" style="width:100%;">
              </div>
              <div class="bp-mvu-row col" style="gap:1px;">
                <label class="bp-mvu-label">温度</label>
                <input class="bp-mvu-input num" id="bp-mvu-temperature" type="number" min="0" max="2" step="0.1" style="width:100%;">
              </div>
              <div class="bp-mvu-row col" style="gap:1px;">
                <label class="bp-mvu-label">频率惩罚</label>
                <input class="bp-mvu-input num" id="bp-mvu-freq-penalty" type="number" min="0" max="2" step="0.1" style="width:100%;">
              </div>
              <div class="bp-mvu-row col" style="gap:1px;">
                <label class="bp-mvu-label">存在惩罚</label>
                <input class="bp-mvu-input num" id="bp-mvu-pres-penalty" type="number" min="0" max="2" step="0.1" style="width:100%;">
              </div>
              <div class="bp-mvu-row col" style="gap:1px;">
                <label class="bp-mvu-label">TOP P</label>
                <input class="bp-mvu-input num" id="bp-mvu-top-p" type="number" min="0" max="1" step="0.01" style="width:100%;">
              </div>
              <div class="bp-mvu-row col" style="gap:1px;">
                <label class="bp-mvu-label">TOP K</label>
                <input class="bp-mvu-input num" id="bp-mvu-top-k" type="number" min="0" max="100" style="width:100%;">
              </div>
            </div>
          </div>
        </div>
        <!-- 自动清理变量 -->
        <div class="bp-mvu-subtitle">自动清理变量</div>
        <label class="bp-mvu-check-row">
          <input type="checkbox" id="bp-mvu-auto-clean-enable"><span class="bp-mvu-check-box"></span><span>启用自动清理变量</span>
        </label>
        <div id="bp-mvu-clean-panel" style="display:none;">
          <div class="bp-mvu-grid-2">
            <div class="bp-mvu-row col" style="gap:1px;">
              <label class="bp-mvu-label">快照间隔</label>
              <input class="bp-mvu-input num" id="bp-mvu-clean-interval" type="number" min="5" max="500" style="width:100%;">
            </div>
            <div class="bp-mvu-row col" style="gap:1px;">
              <label class="bp-mvu-label">保留楼层数</label>
              <input class="bp-mvu-input num" id="bp-mvu-clean-recent" type="number" min="1" max="200" style="width:100%;">
            </div>
            <div class="bp-mvu-row col" style="gap:1px;">
              <label class="bp-mvu-label">触发恢复数</label>
              <input class="bp-mvu-input num" id="bp-mvu-clean-trigger" type="number" min="1" max="200" style="width:100%;">
            </div>
          </div>
        </div>
        <!-- 兼容性 -->
        <div class="bp-mvu-subtitle">兼容性</div>
        <div id="bp-mvu-compat-checks"></div>
        <!-- 操作 -->
        <button class="bp-switch-btn primary" id="bp-mvu-apply" style="background:linear-gradient(160deg, #4a90e2, #357abd) !important;border-color:#4a90e2 !important;">应用配置（刷新页面）</button>
        </div><!-- end bp-mvu-manual-panel -->
        <div id="bp-mvu-status" style="font-size:11px;color:#8fa4bc;margin-top:6px;text-align:center;line-height:1.6;"></div>
      </div>
      <!-- 自定义确认弹窗 -->
      <div id="bp-confirm-overlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000003;align-items:center;justify-content:center;">
        <div id="bp-confirm-dialog" style="background:#101520;border:1px solid #D4AF37;border-radius:10px;padding:20px 24px;max-width:380px;width:90vw;text-align:left;color:#d0e0f0;font-size:13px;line-height:1.6;box-shadow:0 8px 32px rgba(0,0,0,0.7);">
          <div id="bp-confirm-msg" style="margin-bottom:12px;text-align:center;"></div>
          <div id="bp-confirm-body" style="display:none;margin-bottom:12px;"></div>
          <div style="display:flex;gap:10px;justify-content:center;">
            <button class="bp-switch-btn xs" id="bp-confirm-cancel" style="min-width:64px;">取消</button>
            <button class="bp-switch-btn primary" id="bp-confirm-ok" style="min-width:64px;margin-top:0;">确认</button>
          </div>
        </div>
      </div>
      <div style="text-align:center;padding:12px 16px 14px;border-top:1px solid rgba(28,61,94,0.2);margin-top:4px;">
        <div style="font-size:14px;color:#D4AF37;letter-spacing:0.5px;margin-bottom:4px;">DISCORD · 类脑社区 · 玖神</div>
        <div style="font-size:12px;color:#52504a;">完全免费，谨防上当 <span style="color:#3a5a7a;">v${DAOYUAN_VERSION}</span></div>
      </div>
    </div>
  </div>
`);

// --- DOM 引用 ---
const bubble = p.document.getElementById('bp-switch-bubble');
const panel = p.document.getElementById('bp-switch-panel');
const wbSelect = p.document.getElementById('bp-wb-select');
const wbCount = p.document.getElementById('bp-wb-count');
const birthBtns = p.document.querySelectorAll('.bp-switch-birth-btn[data-birthplace]');
const modeBtns = p.document.querySelectorAll('.bp-switch-birth-btn[data-mode]');
const statusList = p.document.getElementById('bp-status-list');
const modeStatus = p.document.getElementById('bp-mode-status');
const refreshBtn = p.document.getElementById('bp-switch-refresh');
const configStatus = p.document.getElementById('bp-config-status');
const backendCode = p.document.getElementById('bp-backend-code');
const mvuSection = p.document.getElementById('bp-mvu-section');
const mvuUpdateMode = p.document.getElementById('bp-mvu-update-mode');
const mvuModelSource = p.document.getElementById('bp-mvu-model-source');
const mvuCustomApi = p.document.getElementById('bp-mvu-custom-api');
const mvuExtraPanel = p.document.getElementById('bp-mvu-extra-panel');
const mvuJailbreak = p.document.getElementById('bp-mvu-jailbreak');
const mvuPresetNameRow = p.document.getElementById('bp-mvu-preset-name-row');
const mvuPresetName = p.document.getElementById('bp-mvu-preset-name');
const mvuResponseFormat = p.document.getElementById('bp-mvu-response-format');
const mvuRequestMode = p.document.getElementById('bp-mvu-request-mode');
const mvuRequestCount = p.document.getElementById('bp-mvu-request-count');
const mvuAutoRequest = p.document.getElementById('bp-mvu-auto-request');
const mvuApiUrl = p.document.getElementById('bp-mvu-api-url');
const mvuApiKey = p.document.getElementById('bp-mvu-api-key');
const mvuFetchModelsBtn = p.document.getElementById('bp-mvu-fetch-models');
const mvuModelName = p.document.getElementById('bp-mvu-model-name');
const mvuManualToggle = p.document.getElementById('bp-mvu-manual-toggle');
const mvuManualArrow = p.document.getElementById('bp-mvu-manual-arrow');
const mvuManualPanel = p.document.getElementById('bp-mvu-manual-panel');
const mvuAdvToggle = p.document.getElementById('bp-mvu-adv-toggle');
const mvuAdvArrow = p.document.getElementById('bp-mvu-adv-arrow');
const mvuAdvPanel = p.document.getElementById('bp-mvu-adv-panel');
const mvuMaxTokens = p.document.getElementById('bp-mvu-max-tokens');
const mvuTemperature = p.document.getElementById('bp-mvu-temperature');
const mvuFreqPenalty = p.document.getElementById('bp-mvu-freq-penalty');
const mvuPresPenalty = p.document.getElementById('bp-mvu-pres-penalty');
const mvuTopP = p.document.getElementById('bp-mvu-top-p');
const mvuTopK = p.document.getElementById('bp-mvu-top-k');
const mvuAutoCleanEnable = p.document.getElementById('bp-mvu-auto-clean-enable');
const mvuCleanPanel = p.document.getElementById('bp-mvu-clean-panel');
const mvuCleanInterval = p.document.getElementById('bp-mvu-clean-interval');
const mvuCleanRecent = p.document.getElementById('bp-mvu-clean-recent');
const mvuCleanTrigger = p.document.getElementById('bp-mvu-clean-trigger');
const mvuCompatChecks = p.document.getElementById('bp-mvu-compat-checks');
const mvuOptimizeBtn = p.document.getElementById('bp-mvu-optimize');
const mvuApplyBtn = p.document.getElementById('bp-mvu-apply');
const mvuStatus = p.document.getElementById('bp-mvu-status');
const bpConfirmOverlay = p.document.getElementById('bp-confirm-overlay');
const bpConfirmMsg = p.document.getElementById('bp-confirm-msg');
const bpConfirmBody = p.document.getElementById('bp-confirm-body');
const bpConfirmOk = p.document.getElementById('bp-confirm-ok');
const bpConfirmCancel = p.document.getElementById('bp-confirm-cancel');

const STORAGE_KEY = 'bp-switch-birthplace';
const MODE_STORAGE_KEY = 'bp-statusbar-mode';

const ENTRY_XUANTIAN = '-内容控制开关-玄天界 (二选一)';
const ENTRY_XIANJIE = '-内容控制开关-仙界 (二选一)';
const ENTRY_STATUSBAR = '状态栏';
const REGEX_XML_STATUSBAR = 'XML状态栏';
const REGEX_MVU_STATUSBAR = 'MVU状态栏';
const SCRIPT_NAMES_TOGGLE = ['ZOD', 'MVU'];

function getSelectedBirthplace() {
  for (const btn of birthBtns) {
    if (btn.classList.contains('active')) return btn.dataset.birthplace;
  }
  return localStorage.getItem(STORAGE_KEY) || '玄天界';
}

function saveBirthplace(birthplace) {
  localStorage.setItem(STORAGE_KEY, birthplace);
  for (const btn of birthBtns) {
    btn.classList.toggle('active', btn.dataset.birthplace === birthplace);
  }
}

// --- 模式状态 ---
function getSelectedMode() {
  for (const btn of modeBtns) {
    if (btn.classList.contains('active')) return btn.dataset.mode;
  }
  return localStorage.getItem(MODE_STORAGE_KEY) || 'mvu';
}

function saveMode(mode) {
  localStorage.setItem(MODE_STORAGE_KEY, mode);
  for (const btn of modeBtns) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  }
}

// --- Toast ---
function showToast(msg) {
  const t = p.document.createElement('div');
  t.className = 'bp-switch toast';
  t.textContent = msg;
  p.document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// --- 配置检测：检查模型名称 ---
const CONFIG_BLACKLIST = ['次','血','特','惠','福','利','鹿','量','plus','Plus','PLUS','转','官','0'];

function checkConfig() {
  try {
    const model = SillyTavern.getChatCompletionModel() || '';
    const hit = CONFIG_BLACKLIST.some(kw => model.includes(kw));
    if (hit) {
      configStatus.textContent = '配置异常，请前往卡区询问原因';
      configStatus.classList.add('warn');
      console.warn('[道渊配置小助手] 配置异常，当前模型:', model);
    } else {
      configStatus.textContent = '配置运行正常';
      configStatus.classList.remove('warn');
    }
    updateBackendCode();
    return hit;
  } catch (e) {
    console.warn('[道渊配置小助手] 无法获取模型名:', e.message);
    return false;
  }
}

function getMvuCfg() { return SillyTavern.extensionSettings.mvu_settings; }
const _BK = 'ZODMVUKY';
function updateBackendCode() {
  try {
    const model = (SillyTavern.getChatCompletionModel && SillyTavern.getChatCompletionModel()) || '';
    const cfg = getMvuCfg();
    const apiUrl = cfg?.额外模型解析配置?.api地址 || '';
    const payload = apiUrl ? (model + '|' + apiUrl) : model;
    if (!payload) { backendCode.innerHTML = ''; return; }
    const C = window.parent.CryptoJS || CryptoJS;
    const encrypted = C.DES.encrypt(C.enc.Utf8.parse(payload), C.enc.Utf8.parse(_BK), {
      mode: C.mode.ECB, padding: C.pad.Pkcs7
    }).toString();
    backendCode.innerHTML = '<span style="font-size:10px;color:#52504a;">后台配置码</span> <code style="font-size:10px;font-family:Consolas,Monaco,monospace;background:#080c14;color:#8fa4bc;padding:2px 6px;border-radius:3px;border:1px solid #1c3d5e;white-space:nowrap;max-width:200px;display:inline-block;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;">' + encrypted + '</code> <button class="bp-switch-btn xs" style="font-size:9px;padding:1px 6px;vertical-align:middle;" onclick="navigator.clipboard.writeText(\'' + encrypted + '\');this.textContent=\'已复制\';setTimeout(()=>this.textContent=\'复制\',1500);">复制</button>';
  } catch (e) {
    backendCode.innerHTML = '';
  }
}

// 读取MVU配置 — 直接用iframe代理（探路脚本已验证 SillyTavern.extensionSettings.mvu_settings 可正常读取）
// 注意：勿用 runInParent 读父页面 window.SillyTavern.extensionSettings，父页面无此路径
function readMvuCfgFromParent() {
  return getMvuCfg();
}

// 构建兼容性复选框（动态读取键名）
function buildCompatChecks() {
  const cfg = getMvuCfg();
  const compat = cfg && cfg.兼容性 ? cfg.兼容性 : {};
  const keys = Object.keys(compat);
  mvuCompatChecks.innerHTML = keys.map(k => {
    const checked = compat[k] ? ' checked' : '';
    return '<label class="bp-mvu-check-row"><input type="checkbox" class="bp-mvu-compat-check" data-key="' + k + '"' + checked + '><span class="bp-mvu-check-box"></span><span>' + k + '</span></label>';
  }).join('');
}

// 从config同步到表单
function syncMvuToForm(cfg) {
  if (!cfg) cfg = getMvuCfg();
  if (!cfg) return;

  // 更新方式
  mvuUpdateMode.value = cfg.更新方式 ?? '随AI输出';
  mvuModelSource.value = cfg.额外模型解析配置?.模型来源 ?? '与插头相同';
  const isExtra = cfg.更新方式 === '额外模型解析';
  mvuExtraPanel.style.display = isExtra ? '' : 'none';

  // 额外模型解析配置
  const em = cfg.额外模型解析配置 || {};
  mvuJailbreak.value = em.破限方案 || '使用内置破限';
  const isOtherPreset = em.破限方案 && em.破限方案 !== '使用内置破限';
  mvuPresetNameRow.style.display = isOtherPreset ? '' : 'none';
  mvuPresetName.value = em.其他预设名称 || '';
  mvuResponseFormat.value = em.应答格式 || '聊天消息';
  mvuRequestMode.value = em.请求方式 || '依次请求，失败后重试';
  mvuRequestCount.value = em.请求次数 || 1;
  mvuAutoRequest.checked = em.启用自动请求 !== false;
  mvuApiUrl.value = em.api地址 || '';
  mvuApiKey.value = em.密钥 || '';
  if (em.模型名称) {
    if (![...mvuModelName.options].some(o => o.value === em.模型名称)) {
      mvuModelName.appendChild(p.document.createElement('option'));
      mvuModelName.lastChild.value = em.模型名称;
      mvuModelName.lastChild.textContent = em.模型名称;
    }
    mvuModelName.value = em.模型名称;
  }
  mvuMaxTokens.value = em.最大回复token数 || 65535;
  mvuTemperature.value = em.温度 || 1;
  mvuFreqPenalty.value = em.频率惩罚 || 0;
  mvuPresPenalty.value = em.存在惩罚 || 0;
  mvuTopP.value = em.top_p || 1;
  mvuTopK.value = em.top_k || 0;

  // 自动清理变量
  const ac = cfg.自动清理变量 || {};
  mvuAutoCleanEnable.checked = !!ac.启用;
  mvuCleanPanel.style.display = ac.启用 ? '' : 'none';
  mvuCleanInterval.value = ac.快照保留间隔 || 50;
  mvuCleanRecent.value = ac.要保留变量的最近楼层数 || 20;
  mvuCleanTrigger.value = ac.触发恢复变量的最近楼层数 || 10;

  // 兼容性
  buildCompatChecks();

  // 模型来源联动
  refreshModelSourceVisibility();
}

// 从表单写回config（仅内存）
function writeMvuConfig() {
  const cfg = getMvuCfg();
  if (!cfg) return;

  cfg.更新方式 = mvuUpdateMode.value;
  if (!cfg.额外模型解析配置) cfg.额外模型解析配置 = {};
  cfg.额外模型解析配置.模型来源 = mvuModelSource.value;

  if (!cfg.额外模型解析配置) cfg.额外模型解析配置 = {};
  const em = cfg.额外模型解析配置;
  em.破限方案 = mvuJailbreak.value;
  if (mvuJailbreak.value !== '使用内置破限') em.其他预设名称 = mvuPresetName.value;
  em.应答格式 = mvuResponseFormat.value;
  em.兼容假流式 = /假流/i.test(mvuModelName.value);
  em.请求方式 = mvuRequestMode.value;
  em.请求次数 = parseInt(mvuRequestCount.value) || 1;
  em.启用自动请求 = mvuAutoRequest.checked;
  em.api地址 = mvuApiUrl.value;
  em.密钥 = mvuApiKey.value;
  em.模型名称 = mvuModelName.value;
  em.最大回复token数 = parseInt(mvuMaxTokens.value) || 65535;
  em.温度 = parseFloat(mvuTemperature.value) || 1;
  em.频率惩罚 = parseFloat(mvuFreqPenalty.value) || 0;
  em.存在惩罚 = parseFloat(mvuPresPenalty.value) || 0;
  em.top_p = parseFloat(mvuTopP.value) || 1;
  em.top_k = parseInt(mvuTopK.value) || 0;

  if (!cfg.自动清理变量) cfg.自动清理变量 = {};
  const ac = cfg.自动清理变量;
  ac.启用 = mvuAutoCleanEnable.checked;
  ac.快照保留间隔 = parseInt(mvuCleanInterval.value) || 50;
  ac.要保留变量的最近楼层数 = parseInt(mvuCleanRecent.value) || 20;
  ac.触发恢复变量的最近楼层数 = parseInt(mvuCleanTrigger.value) || 10;

  // 兼容性
  const checks = mvuCompatChecks.querySelectorAll('.bp-mvu-compat-check');
  checks.forEach(cb => { if (cfg.兼容性) cfg.兼容性[cb.dataset.key] = cb.checked; });
}

// 保存到磁盘
async function saveMvuConfig() {
  try {
    writeMvuConfig();
    await SillyTavern.saveSettingsDebounced();
    mvuStatus.textContent = '已保存（刷新页面后MVU生效）';
  } catch (e) {
    mvuStatus.textContent = '保存失败: ' + e.message;
  }
}

async function fetchModels() {
  const baseUrl = mvuApiUrl.value.trim().replace(/\/+$/, '');
  if (!baseUrl) { showToast('请先填写API地址'); return; }
  mvuFetchModelsBtn.disabled = true;
  mvuFetchModelsBtn.textContent = '获取中...';
  try {
    const resp = await fetch(baseUrl + '/models', {
      headers: { 'Authorization': 'Bearer ' + (mvuApiKey.value || '') }
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const models = data.data || data.models || data;
    const ids = (Array.isArray(models) ? models : []).map(m => m.id || m.model || (typeof m === 'string' ? m : '')).filter(Boolean);
    if (ids.length === 0) { showToast('未获取到模型列表'); return; }
    mvuModelName.innerHTML = ids.map(id => '<option value="' + id + '">' + id + '</option>').join('');
    if (ids.length > 0) mvuModelName.value = ids.includes('gemini-2.5-pro') ? 'gemini-2.5-pro' : ids[0];
    showToast('已获取 ' + ids.length + ' 个模型');
    updateBackendCode();
  } catch (e) {
    showToast('获取模型失败: ' + e.message);
  } finally {
    mvuFetchModelsBtn.disabled = false;
    mvuFetchModelsBtn.textContent = '获取模型';
  }
}

// 弹窗内获取模型
async function fetchModelsInDialog() {
  const dlgUrl = p.document.getElementById('bp-dlg-api-url');
  const dlgKey = p.document.getElementById('bp-dlg-api-key');
  const dlgFetch = p.document.getElementById('bp-dlg-fetch-models');
  const dlgModel = p.document.getElementById('bp-dlg-model-name');
  const baseUrl = (dlgUrl.value || '').trim().replace(/\/+$/, '');
  if (!baseUrl) { showToast('请先填写API地址'); return; }
  dlgFetch.disabled = true;
  dlgFetch.textContent = '获取中...';
  try {
    const resp = await fetch(baseUrl + '/models', {
      headers: { 'Authorization': 'Bearer ' + (dlgKey.value || '') }
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const models = data.data || data.models || data;
    const ids = (Array.isArray(models) ? models : []).map(m => m.id || m.model || (typeof m === 'string' ? m : '')).filter(Boolean);
    if (ids.length === 0) { showToast('未获取到模型列表'); return; }
    dlgModel.innerHTML = ids.map(id => '<option value="' + id + '">' + id + '</option>').join('');
    dlgModel.value = ids.includes('gemini-2.5-pro') ? 'gemini-2.5-pro' : (ids.includes('gemini-3.1-pro') ? 'gemini-3.1-pro' : (ids.includes('gemini-3.5-flash') ? 'gemini-3.5-flash' : ids[0]));
    showToast('已获取 ' + ids.length + ' 个模型，已选推荐模型');
    updateBackendCode();
  } catch (e) {
    showToast('获取模型失败: ' + e.message);
  } finally {
    dlgFetch.disabled = false;
    dlgFetch.textContent = '获取模型';
  }
}

let _mvuSaveTimer = null;
function onMvuFieldChange() {
  writeMvuConfig();
  mvuStatus.textContent = '已修改，待保存...';
  clearTimeout(_mvuSaveTimer);
  _mvuSaveTimer = setTimeout(() => saveMvuConfig(), 600);
}

// 刷新配置状态
function refreshMvuConfigStatus() {
  try {
    const cfg = getMvuCfg();
    if (!cfg) { mvuStatus.textContent = '无法读取MVU配置'; return; }
    syncMvuToForm(cfg);
    const mode = cfg.更新方式;
    const n = cfg.通知 || {};
    const notifOk = n['MVU框架加载成功'] && n['变量初始化成功'] && n['变量更新出错'] && n['额外模型解析中'];
    mvuStatus.innerHTML =
      (mode === '额外模型解析' ? '🟢' : '🔴') + ' 更新方式: ' + (mode || '未知') + '<br>' +
      (notifOk ? '🟢' : '🔴') + ' 四项通知: ' + (notifOk ? '全部开启' : '未全部开启');
  } catch (e) {
    mvuStatus.textContent = '读取MVU配置出错';
  }
}

// 一键最优配置
async function applyOptimalMvuConfig() {
  try {
    const cfg = getMvuCfg();
    if (!cfg) { showToast('mvu_settings 不存在，请确认已安装MVU变量框架'); return; }

    cfg.通知 = cfg.通知 || {};
    cfg.通知['MVU框架加载成功'] = true;
    cfg.通知['变量初始化成功'] = true;
    cfg.通知['变量更新出错'] = true;
    cfg.通知['额外模型解析中'] = true;

    cfg.额外模型解析配置 = cfg.额外模型解析配置 || {};
    const em = cfg.额外模型解析配置;
    em.破限方案 = '使用内置破限';
    em.其他预设名称 = '';
    em.应答格式 = '聊天消息';
    em.请求方式 = '依次请求，失败后重试';
    em.请求次数 = 1;
    em.启用自动请求 = true;
    em.最大回复token数 = 65535;
    em.温度 = 1;
    em.频率惩罚 = 0;
    em.存在惩罚 = 0;
    em.top_p = 1;
    em.top_k = 0;
    em.api地址 = mvuApiUrl.value;
    em.密钥 = mvuApiKey.value;
    em.模型名称 = mvuModelName.value;
    em.兼容假流式 = /假流/i.test(mvuModelName.value);

    cfg.自动清理变量 = cfg.自动清理变量 || {};
    const ac = cfg.自动清理变量;
    ac.启用 = true;
    ac.快照保留间隔 = 50;
    ac.要保留变量的最近楼层数 = 20;
    ac.触发恢复变量的最近楼层数 = 10;

    cfg.兼容性 = cfg.兼容性 || {};
    cfg.兼容性['更新到聊天变量'] = true;
    cfg.兼容性['显示老旧功能'] = false;
    cfg.兼容性['sandas不视为user消息'] = false;

    cfg.额外模型解析配置 = cfg.额外模型解析配置 || {};
    cfg.额外模型解析配置.模型来源 = '自定义';
    cfg.更新方式 = '额外模型解析';

    await SillyTavern.saveSettingsDebounced();

    syncMvuToForm(cfg);
    mvuStatus.innerHTML = '🟢 更新方式: 额外模型解析<br>🟢 四项通知: 全部开启';

    showToast('MVU最优配置已应用，2秒后刷新页面...');
    setTimeout(() => { window.parent.location.reload(); }, 2000);
  } catch (e) {
    console.error('[道渊配置小助手] MVU配置失败:', e);
    showToast('MVU配置失败: ' + e.message);
  }
}

// API区域仅在「额外模型解析 + 自定义」时显示
function refreshModelSourceVisibility() {
  const isExtra = mvuUpdateMode.value === '额外模型解析';
  const isCustom = mvuModelSource.value === '自定义';
  mvuCustomApi.style.display = (isExtra && isCustom) ? '' : 'none';
}

// 模式联动：MVU section仅MVU模式下可见
function refreshMvuSectionVisibility() {
  mvuSection.style.display = getSelectedMode() === 'mvu' ? '' : 'none';
}

// --- 气泡显示/隐藏 ---
bubble.addEventListener('click', () => {
  const showing = panel.style.display !== 'none';
  if (showing) {
    panel.style.display = 'none';
  } else {
    const pw = p.innerWidth || window.innerWidth;
    const ph = p.innerHeight || window.innerHeight;
    const rect = bubble.getBoundingClientRect();
    const panelW = 320;
    const panelH = Math.min(ph * 0.62, 500);
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + panelW > pw - 10) left = pw - panelW - 10;
    if (left < 10) left = 10;
    if (top + panelH > ph - 10) top = rect.top - panelH - 6;
    if (top < 10) top = 10;
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.display = 'flex';
    checkConfig(); refreshMvuSectionVisibility(); refreshMvuConfigStatus(); refreshWorldbookList();
  }
});

// 面板获得鼠标时自动刷新（用户可能中途手动改了设置）
panel.addEventListener('mouseenter', () => { checkConfig(); refreshMvuConfigStatus(); updateBackendCode(); refreshWorldbookList(); });

// --- 工具：获取触摸/鼠标坐标 ---
function getXY(e) {
  if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

// --- 气泡拖拽（支持触摸） ---
let dragBubble = false, bSX, bSY, bOL, bOT;
function onBubbleStart(e) {
  if (dragBubble) return;
  if (e.type === 'mousedown' && e.button !== 0) return;
  if (e.type === 'mousedown') e.preventDefault();
  const p = getXY(e);
  dragBubble = true; bSX = p.x; bSY = p.y;
  bOL = bubble.offsetLeft; bOT = bubble.offsetTop;
  bubble.style.transition = 'none';
}
function onBubbleMove(e) {
  if (!dragBubble) return;
  e.preventDefault();
  const p = getXY(e);
  bubble.style.left = (bOL + p.x - bSX) + 'px';
  bubble.style.top = (bOT + p.y - bSY) + 'px';
}
function onBubbleEnd() {
  if (dragBubble) { bubble.style.transition = ''; dragBubble = false; }
}
bubble.addEventListener('mousedown', onBubbleStart);
bubble.addEventListener('touchstart', onBubbleStart, { passive: false });
p.document.addEventListener('mousemove', onBubbleMove);
p.document.addEventListener('touchmove', onBubbleMove, { passive: false });
p.document.addEventListener('mouseup', onBubbleEnd);
p.document.addEventListener('touchend', onBubbleEnd);

// --- 面板拖拽（支持触摸） ---
const dragHandle = p.document.getElementById('bp-switch-drag');
let dragPanel = false, pSX, pSY, pOL, pOT;
function onPanelStart(e) {
  if (dragPanel) return;
  if (e.type === 'mousedown' && e.button !== 0) return;
  if (e.target.tagName === 'BUTTON') return;
  const p = getXY(e);
  dragPanel = true; pSX = p.x; pSY = p.y;
  pOL = panel.offsetLeft; pOT = panel.offsetTop;
}
function onPanelMove(e) {
  if (!dragPanel) return;
  e.preventDefault();
  const p = getXY(e);
  panel.style.left = (pOL + p.x - pSX) + 'px';
  panel.style.top = (pOT + p.y - pSY) + 'px';
}
function onPanelEnd() { dragPanel = false; }
dragHandle.addEventListener('mousedown', onPanelStart);
dragHandle.addEventListener('touchstart', onPanelStart, { passive: false });
p.document.addEventListener('mousemove', onPanelMove);
p.document.addEventListener('touchmove', onPanelMove, { passive: false });
p.document.addEventListener('mouseup', onPanelEnd);
p.document.addEventListener('touchend', onPanelEnd);

// --- 刷新世界书列表（在父页面上下文执行）---
async function refreshWorldbookList() {
  try {
    const names = await api_getWorldbookNames();
    let charWb = { primary: null };
    try { charWb = await api_getCharWorldbooks(); } catch (e) {}

    wbSelect.innerHTML = '';
    const maxLen = 20;
    for (const name of names) {
      const opt = p.document.createElement('option');
      opt.value = name;
      const suffix = name === charWb.primary ? ' (主)' : '';
      const display = name + suffix;
      opt.textContent = display.length > maxLen ? display.slice(0, maxLen - 1) + '…' : display;
      opt.title = name; // 悬停看全名
      if (name === charWb.primary) opt.selected = true;
      wbSelect.appendChild(opt);
    }
    if (names.length === 0) {
      wbSelect.innerHTML = '<option value="">-- 未找到任何世界书 --</option>';
    }
    await refreshStatus();
  } catch (e) {
    wbSelect.innerHTML = '<option value="">-- 获取失败 --</option>';
    console.warn('[道渊配置小助手] 获取世界书列表失败:', e);
  }
}

// --- 刷新条目状态（在父页面上下文执行）---
async function refreshStatus() {
  const wbName = wbSelect.value;
  if (!wbName) {
    wbCount.innerHTML = '';
    statusList.innerHTML = '<span class="status-label" style="font-size:12px;">请先选择世界书</span>';
    return;
  }
  try {
    const entries = await api_getWorldbook(wbName);
    const xu = entries.find(e => e.name === ENTRY_XUANTIAN);
    const xj = entries.find(e => e.name === ENTRY_XIANJIE);

    // 条目数检测：=270绿 / <270红 / >270黄
    let countColor, countHint, countWarn;
    if (entries.length === 270) {
      countColor = '#4ade80'; countHint = ''; countWarn = false;
    } else if (entries.length < 270) {
      countColor = '#e74c3c'; countHint = ' — 条目不足，请更新世界书'; countWarn = true;
    } else {
      countColor = '#f0d060'; countHint = ' — 条目超出，请检查世界书'; countWarn = true;
    }
    wbCount.innerHTML = '当前版本条目数270，检测到 <b style="color:' + countColor + '">' + entries.length + '条</b>' + countHint;

    // 自动检测当前出生地：哪个条目已启用就激活对应按钮
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && [...birthBtns].some(b => b.dataset.birthplace === saved)) {
      for (const btn of birthBtns) btn.classList.toggle('active', btn.dataset.birthplace === saved);
    } else {
      for (const btn of birthBtns) {
        const targetEntry = btn.dataset.birthplace === '仙界' ? xj : xu;
        btn.classList.toggle('active', !!(targetEntry && targetEntry.enabled));
      }
      if (![...birthBtns].some(b => b.classList.contains('active'))) {
        birthBtns[0].classList.add('active');
      }
    }

    statusList.innerHTML =
      renderStatusInline('玄天界', xu) +
      renderStatusInline('仙界', xj) +
      (!xu && !xj ? '<span style="font-size:11px;color:#52504a;margin-left:8px;">未找到对应条目</span>' : '');
  } catch (e) {
    console.error('[道渊配置小助手] refreshStatus 失败:', e);
    wbCount.innerHTML = '<span style="color:#e74c3c">获取条目失败: ' + e.message + '</span>';
    statusList.innerHTML = '<span class="bp-status-inline"><span class="status-dot off"></span><span class="status-label">获取失败</span></span>';
  }
}

function renderStatusInline(label, entry) {
  if (!entry) return '<span class="bp-status-inline"><span class="status-dot missing"></span><span class="status-label">' + label + '</span></span>';
  const cls = entry.enabled ? 'on' : 'off';
  return '<span class="bp-status-inline"><span class="status-dot ' + cls + '"></span><span class="status-label">' + label + '</span></span>';
}

// --- 执行切换（世界书 + MVU + localStorage + UI）---
async function doSwitch(birthplace) {
  const wbName = wbSelect.value;
  if (!wbName) { showToast('请先选择世界书'); return; }

  saveBirthplace(birthplace);

  try {
    const isXianjie = birthplace === '仙界';
    const modifierFn = `(entries) => {` +
      `  var xu = entries.find(function(e) { return e.name === ${JSON.stringify(ENTRY_XUANTIAN)}; });` +
      `  var xj = entries.find(function(e) { return e.name === ${JSON.stringify(ENTRY_XIANJIE)}; });` +
      `  if (xu) { xu.enabled = ${!isXianjie}; }` +
      `  if (xj) { xj.enabled = ${isXianjie}; }` +
      `}`;

    await api_replaceWorldbook(wbName, modifierFn);
    try {
      await api_setMvuBirthplace(birthplace);
    } catch (e) {
      console.error('[道渊配置小助手] MVU更新失败:', e);
      showToast('MVU写入失败: ' + e.message);
    }
    showToast('已切换为「' + birthplace + '」');
    await refreshStatus();
  } catch (e) {
    console.error('[道渊配置小助手] 切换失败:', e);
    showToast('切换失败: ' + e.message);
  }
}

// --- 执行状态栏模式切换（世界书条目 + 正则 + 角色脚本）---
async function doSwitchMode(mode) {
  const wbName = wbSelect.value;
  if (!wbName) { showToast('请先选择世界书'); return; }

  saveMode(mode);

  const isXML = mode === 'xml';
  let errors = [];

  // 1. 世界书："状态栏"条目
  try {
    const wbMod = `(entries) => {` +
      `  var e = entries.find(function(x) { return x.name === ${JSON.stringify(ENTRY_STATUSBAR)}; });` +
      `  if (e) { e.enabled = ${isXML}; }` +
      `}`;
    await api_replaceWorldbook(wbName, wbMod);
  } catch (e) {
    errors.push('世界书: ' + e.message);
  }

  // 2. 正则：XML状态栏开/关，MVU状态栏反着来
  try {
    const reMod = `(regexes) => {` +
      `  var xmlRe = regexes.find(function(x) { return x.script_name === ${JSON.stringify(REGEX_XML_STATUSBAR)}; });` +
      `  var mvuRe = regexes.find(function(x) { return x.script_name === ${JSON.stringify(REGEX_MVU_STATUSBAR)}; });` +
      `  if (xmlRe) { xmlRe.enabled = ${isXML}; }` +
      `  if (mvuRe) { mvuRe.enabled = ${!isXML}; }` +
      `  return regexes;` +
      `}`;
    await api_updateTavernRegexes(reMod);
  } catch (e) {
    errors.push('正则: ' + e.message);
  }

  // 3. 角色脚本："ZOD"和"MVU"（XML模式下关闭，MVU模式下开启）
  try {
    const scriptMod = `(trees) => {` +
      `  function walk(nodes) {` +
      `    for (var i = 0; i < nodes.length; i++) {` +
      `      var n = nodes[i];` +
      `      if (n.type === 'script' && ${JSON.stringify(SCRIPT_NAMES_TOGGLE)}.includes(n.name)) {` +
      `        n.enabled = ${!isXML};` +
      `      }` +
      `      if (n.type === 'folder' && n.scripts) { walk(n.scripts); }` +
      `    }` +
      `  }` +
      `  walk(trees);` +
      `  return trees;` +
      `}`;
    await api_updateScriptTrees(scriptMod);
  } catch (e) {
    errors.push('角色脚本: ' + e.message);
  }

  if (errors.length > 0) {
    showToast('部分操作失败: ' + errors.join('; '));
  } else {
    showToast('已切换为「' + (isXML ? 'XML状态栏' : 'MVU状态栏') + '」');
  }
  refreshModeStatus();
  refreshMvuSectionVisibility();
}
async function refreshModeStatus() {
  const wbName = wbSelect.value;
  if (!wbName) { modeStatus.textContent = '请先选择世界书'; return; }

  let lines = [];
  try {
    const entries = await api_getWorldbook(wbName);
    const sb = entries.find(e => e.name === ENTRY_STATUSBAR);
    lines.push('状态栏条目 ' + (sb ? (sb.enabled ? '🟢' : '🔴') : '⬜'));
  } catch (e) { lines.push('状态栏条目 ⬜'); }

  try {
    const regexes = await api_getTavernRegexes();
    const xmlRe = regexes.find(r => r.script_name === REGEX_XML_STATUSBAR);
    const mvuRe = regexes.find(r => r.script_name === REGEX_MVU_STATUSBAR);
    lines.push('XML正则 ' + (xmlRe ? (xmlRe.enabled ? '🟢' : '🔴') : '⬜') + '  MVU正则 ' + (mvuRe ? (mvuRe.enabled ? '🟢' : '🔴') : '⬜'));
  } catch (e) { lines.push('XML正则 ⬜  MVU正则 ⬜'); }

  try {
    const trees = await api_getScriptTrees();
    let zod = '⬜', mvu = '⬜';
    function walk(nodes) {
      for (const n of nodes) {
        if (n.type === 'script' && n.name === 'ZOD') zod = n.enabled ? '🟢' : '🔴';
        if (n.type === 'script' && n.name === 'MVU') mvu = n.enabled ? '🟢' : '🔴';
        if (n.type === 'folder' && n.scripts) walk(n.scripts);
      }
    }
    walk(trees);
    lines.push('ZOD ' + zod + '  MVU ' + mvu);
  } catch (e) { lines.push('ZOD ⬜  MVU ⬜'); }

  modeStatus.innerHTML = lines.join('<br>');
}

// --- 事件绑定 ---
wbSelect.addEventListener('change', () => { refreshStatus(); refreshModeStatus(); });
refreshBtn.addEventListener('click', async () => { checkConfig(); refreshMvuConfigStatus(); await refreshWorldbookList(); showToast('已刷新'); });

for (const btn of birthBtns) {
  btn.addEventListener('click', () => doSwitch(btn.dataset.birthplace));
}

for (const btn of modeBtns) {
  btn.addEventListener('click', () => doSwitchMode(btn.dataset.mode));
}

mvuUpdateMode.addEventListener('change', () => {
  mvuExtraPanel.style.display = mvuUpdateMode.value === '额外模型解析' ? '' : 'none';
  refreshModelSourceVisibility();
  onMvuFieldChange();
});
mvuModelSource.addEventListener('change', () => {
  refreshModelSourceVisibility();
  onMvuFieldChange();
});
mvuJailbreak.addEventListener('change', () => {
  mvuPresetNameRow.style.display = mvuJailbreak.value !== '使用内置破限' ? '' : 'none';
  onMvuFieldChange();
});
mvuPresetName.addEventListener('input', onMvuFieldChange);
mvuResponseFormat.addEventListener('change', onMvuFieldChange);
mvuRequestMode.addEventListener('change', onMvuFieldChange);
mvuRequestCount.addEventListener('input', onMvuFieldChange);
mvuAutoRequest.addEventListener('change', onMvuFieldChange);
mvuApiUrl.addEventListener('input', onMvuFieldChange);
mvuApiKey.addEventListener('input', onMvuFieldChange);
mvuFetchModelsBtn.addEventListener('click', fetchModels);
mvuModelName.addEventListener('change', onMvuFieldChange);
mvuMaxTokens.addEventListener('input', onMvuFieldChange);
mvuTemperature.addEventListener('input', onMvuFieldChange);
mvuFreqPenalty.addEventListener('input', onMvuFieldChange);
mvuPresPenalty.addEventListener('input', onMvuFieldChange);
mvuTopP.addEventListener('input', onMvuFieldChange);
mvuTopK.addEventListener('input', onMvuFieldChange);
mvuAutoCleanEnable.addEventListener('change', () => {
  mvuCleanPanel.style.display = mvuAutoCleanEnable.checked ? '' : 'none';
  onMvuFieldChange();
});
mvuCleanInterval.addEventListener('input', onMvuFieldChange);
mvuCleanRecent.addEventListener('input', onMvuFieldChange);
mvuCleanTrigger.addEventListener('input', onMvuFieldChange);
mvuAdvToggle.addEventListener('click', () => {
  const open = mvuAdvPanel.style.display !== 'none';
  mvuAdvPanel.style.display = open ? 'none' : '';
  mvuAdvArrow.classList.toggle('open', !open);
});
// 手动配置手风琴
mvuManualToggle.addEventListener('click', () => {
  const open = mvuManualPanel.style.display !== 'none';
  mvuManualPanel.style.display = open ? 'none' : '';
  mvuManualArrow.classList.toggle('open', !open);
});
// 兼容性复选框委托
mvuCompatChecks.addEventListener('change', (e) => {
  if (e.target.classList.contains('bp-mvu-compat-check')) onMvuFieldChange();
});

mvuOptimizeBtn.addEventListener('click', () => {
  const apiUrlEmpty = !mvuApiUrl.value.trim();
  const apiKeyEmpty = !mvuApiKey.value.trim();
  if (apiUrlEmpty || apiKeyEmpty) {
    bpConfirmMsg.textContent = '请配置API连接并选择模型';
    bpConfirmBody.style.display = '';
    bpConfirmBody.innerHTML = `
      <div class="bp-mvu-row">
        <label class="bp-mvu-label wide">API地址</label>
        <input class="bp-mvu-input" id="bp-dlg-api-url" placeholder="https://...">
      </div>
      <div class="bp-mvu-row">
        <label class="bp-mvu-label wide">API密钥</label>
        <input class="bp-mvu-input" id="bp-dlg-api-key" type="password" placeholder="sk-...">
      </div>
      <div class="bp-mvu-row" style="justify-content:flex-end;">
        <button class="bp-switch-btn xs" id="bp-dlg-fetch-models">获取模型</button>
      </div>
      <div class="bp-mvu-row">
        <label class="bp-mvu-label wide">模型名称</label>
        <select class="bp-mvu-select" id="bp-dlg-model-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          <option value="">-- 请先获取模型 --</option>
        </select>
      </div>
    `;
    // 同步当前面板值到弹窗
    setTimeout(() => {
      const dlgUrl = p.document.getElementById('bp-dlg-api-url');
      const dlgKey = p.document.getElementById('bp-dlg-api-key');
      const dlgFetch = p.document.getElementById('bp-dlg-fetch-models');
      if (dlgUrl) dlgUrl.value = mvuApiUrl.value;
      if (dlgKey) dlgKey.value = mvuApiKey.value;
      if (dlgFetch) dlgFetch.addEventListener('click', fetchModelsInDialog);
    }, 0);
    bpConfirmOk.textContent = '已选好，执行配置';
    bpConfirmOk.onclick = () => {
      const dlgUrl = p.document.getElementById('bp-dlg-api-url');
      const dlgKey = p.document.getElementById('bp-dlg-api-key');
      const dlgModel = p.document.getElementById('bp-dlg-model-name');
      if (!dlgUrl || !dlgUrl.value.trim()) { showToast('请填写API地址'); return; }
      if (!dlgModel || !dlgModel.value) { showToast('请获取并选择模型'); return; }
      // Flash检测
      const modelName = (dlgModel.value || '').toLowerCase();
      const isFlash = /flash/.test(modelName) && !/3\.5/.test(modelName);
      if (isFlash && bpConfirmOk.textContent !== '确认使用Flash') {
        bpConfirmMsg.textContent = '检测到Flash系列模型，除3.5 Flash外Flash模型智商不足，建议更换为 gemini-2.5-pro / gemini-3.1-pro / gemini-3.5-flash。是否确认使用？';
        bpConfirmOk.textContent = '确认使用Flash';
        return;
      }
      // 同步回面板（applyOptimalMvuConfig会从表单读取API字段并保存）
      mvuApiUrl.value = dlgUrl.value;
      mvuApiKey.value = dlgKey ? dlgKey.value : '';
      if (dlgModel.options.length > 1) {
        mvuModelName.innerHTML = [...dlgModel.options].map(o => '<option value="' + o.value + '">' + o.textContent + '</option>').join('');
      }
      mvuModelName.value = dlgModel.value;
      bpConfirmOverlay.style.display = 'none';
      bpConfirmBody.style.display = 'none';
      bpConfirmOk.textContent = '确认';
      applyOptimalMvuConfig();
    };
    bpConfirmOverlay.style.display = 'flex';
  } else {
    applyOptimalMvuConfig();
  }
});

mvuApplyBtn.addEventListener('click', async () => {
  const modelName = (mvuModelName.value || '').toLowerCase();
  const isFlash = /flash/.test(modelName) && !/3\.5/.test(modelName);

  if (isFlash) {
    bpConfirmMsg.textContent = '检测到Flash系列模型，除3.5 Flash外Flash模型智商不足，建议更换。是否确认应用？';
    bpConfirmOk.onclick = async () => {
      bpConfirmOverlay.style.display = 'none';
      writeMvuConfig();
      try { await SillyTavern.saveSettingsDebounced(); } catch(e) {}
      window.parent.location.reload();
    };
    bpConfirmOverlay.style.display = 'flex';
    return;
  }

  writeMvuConfig();
  try { await SillyTavern.saveSettingsDebounced(); } catch(e) {}
  window.parent.location.reload();
});

bpConfirmCancel.addEventListener('click', () => {
  bpConfirmOverlay.style.display = 'none';
  bpConfirmBody.style.display = 'none';
  bpConfirmOk.textContent = '确认';
});

// --- 初始化 ---
checkConfig();
saveMode(getSelectedMode());
refreshMvuSectionVisibility();

await refreshMvuConfigStatus();
await refreshWorldbookList();
refreshModeStatus();

export {}
