// 检测"提示词模板"插件状态 v2
(async () => {
  console.log('=== 提示词模板检测 v2 ===');
  const ext = SillyTavern?.extensionSettings;

  // 1. EjsTemplate
  if (ext?.EjsTemplate) {
    console.log('[EjsTemplate]:', JSON.stringify(ext.EjsTemplate, null, 2));
    console.log('EjsTemplate 键:', Object.keys(ext.EjsTemplate));
  } else {
    console.log('EjsTemplate 不存在');
  }

  // 2. 检查 提示词模板 是否作为独立扩展
  const st = window.parent?.SillyTavern;
  if (st?.getContext) {
    const ctx = st.getContext();
    console.log('getContext() 键:', Object.keys(ctx));
  }

  // 3. 检查 TavernHelper 的提示词相关方法
  const TH = window.parent?.TavernHelper;
  if (TH) {
    console.log('TavernHelper 方法 (含prompt):', Object.keys(TH).filter(k => /prompt|template|inject/i.test(k)));
  }

  // 4. 检查 power_user
  console.log('power_user:', JSON.stringify(ext?.power_user || '不存在', null, 2));

  console.log('=== 检测完毕 ===');
})();
