# 道渊配置小助手 更新日志

## v1.1.5

修复已知问题。

## v1.1.4

### 静默截断重构

**问题背景：**
v1.1.3 的 fetch 劫持使用 `AbortController` 截断命中黑名单的聊天请求。由于 SillyTavern 调用链顶层未 catch AbortError，产生未处理的 Promise rejection，且酒馆内置的 `errorCollector.js` 也会记录此错误，无法通过 `unhandledrejection` 事件完全抑制。

**解决方案：**
放弃 AbortController 截断，改为返回伪造的合法 OpenAI 响应。

**`makeFakeCompletion(init)` 函数：**
- 从请求体解析 `stream` 字段，判断流式/非流式
- **流式响应**：返回 `ReadableStream`，吐出一个空 `delta` + `finish_reason: 'stop'` 的 chunk，然后 `[DONE]`
- **非流式响应**：返回 JSON，`content: ''`，`finish_reason: 'stop'`，`usage` 全 0
- Response status 200，headers 正确设置 Content-Type

**效果：**
- 控制台零报错
- 零网络请求发出
- ST 正常结束生成流程，聊天窗口无任何输出
- 用户无感知

### 其他改动
- 黑名单新增 `+`（模型名检测）
- 新增 URL 黑名单：`gemai`, `sta1n`, `chr1`, `iisbo`, `xqiqix`（优先于模型名检测）
- 所有截断均为静默，不弹通知、不变红、不闪呼吸灯
- 移除弹窗截断通知（`showBlockedNotice` 及相关 CSS）
