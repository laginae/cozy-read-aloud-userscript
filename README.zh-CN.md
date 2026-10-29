# Cozy 朗读：网页与 PDF

[English](README.md) | 简体中文

在浏览器中听网页文章、选中文字和本地 PDF，不需要安装 Obsidian。默认使用本机语音，也可选择 **OpenRouter** 或 **小米 MiMo** API 音色。

## 安装与开始

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)，按扩展提示开启“允许用户脚本”。
2. 从 [GitHub 最新发布](https://github.com/laginae/cozy-read-aloud-userscript/releases/latest) 下载 `cozy-read-aloud.user.js`，在 Tampermonkey 管理面板的“实用工具”中导入并确认安装。
3. 刷新普通网页，点击右下角扬声器，载入正文或选区，再点击播放。
4. 更换音色时打开播放栏的“语音设置”。在线 API 需要自己的服务方密钥和单独授权，不会读取 Obsidian 插件中的密钥。

也可下载发布包，在解压后的 `demo.html` 中先试用公开示例。预览页自动加载脚本，不需要安装油猴。脚本没有自动更新地址，更新时请从 Releases 重新导入。仅在本地网页使用油猴注入时才需要“允许访问文件网址”，普通 HTTPS 网页不需要此权限。

## 日常操作

- **网页正文**：提取当前已加载的文章。正文识别不准确时，请先在原网页选中文字，再打开面板。
- **选区与继续**：只读选中文字，或从选区起点读到后文；面板内也可以重新选择范围。
- **播放控制**：暂停/继续、停止、上一段/下一段、进度跳转、倍速、大纲、段落高亮及自动跟随。
- **学术模式**：过滤复杂公式，保留适合朗读的短变量。复杂排版仍可能识别有误，不是逐词精确同步。

动态网页只读取点击时已加载的内容，不会展开聊天、抓取下一页、越过登录权限或读取跨域 iframe。

**GitHub 等受限网页：** 某些网站的内容安全策略会阻止隔离面板启动。0.2.1 会在等待约 6 秒后切换为本机语音兼容控制栏，支持正文、选区、从选区继续、暂停、停止、跳转和倍速；部分策略可立即识别。无需关闭网站安全保护或扩大扩展权限。

兼容控制栏属于宿主网页，因此只使用浏览器标记为本机的音色，**不提供 API 密钥输入、联网音色或 PDF 文件导入**。需要这些功能时，使用发布包的本地 `demo.html`；[Cozy 网页版](https://laginae.github.io/cozy-read-aloud-web/) 也可独立打开，但音色选项与本脚本分别维护。兼容控制栏的“独立阅读页”链接只打开网页，不会自动传送当前正文。

## PDF 怎么读

浏览器内置 PDF 查看器属于受保护界面，通常不能直接注入油猴按钮。请先将 PDF 保存到本地，再在可信普通网页的 Cozy 面板中点击 **打开 PDF**，或在本地预览页中导入。

PDF 显示原始页面和可选择的文字层，支持全文、只读选区、从选区继续、缩放、大纲及高亮。PDF.js、字体和字符映射随脚本附带，解析时无需下载 CDN 代码。原始 PDF 文件不会上传，也不会回传宿主页面；**启用在线音色后，选定朗读范围中实际合成的文字会发送给相应服务方**。

支持上限：30 MiB、120 页、100 万个提取字符。大文件请先拆分；扫描件需要先做 OCR，密码保护文件需先合法解锁。本脚本暂不包含 OCR 和音频导出，可使用 Cozy 网页版的相应功能。

## 三种语音方式

### 浏览器 / 系统语音（默认）

无需密钥。默认只列出浏览器标记为 `localService=true` 的音色；可用音色取决于系统和浏览器，不能保证 Windows 讲述人 Natural / Natural HD 音色可用。语音列表可能延迟出现。

只有主动勾选“允许浏览器联网音色”后才允许选择远程音色；这些音色可能将文字发送给浏览器的语音提供方，不受 OpenRouter 的路由设置约束。

### OpenRouter（可选）

选择引擎，填写 OpenRouter 密钥，再选择模型和音色 ID。内置 ElevenLabs Multilingual v2 / Flash v2.5 预设，默认音色 `sarah`；也可填写支持语音合成的 OpenRouter 模型 ID 和匹配的音色 ID。自定义模型不代表已逐一验证兼容。

确认在线授权后才会合成。每次请求均设置 `provider.zdr=true` 和 `data_collection=deny`，没有合适路由时停止，**不会静默放宽条件或切换服务**。这是路由要求，不是绝对“不留存”的承诺；安全筛查、法律义务等例外以 [OpenRouter ZDR 说明](https://openrouter.ai/docs/guides/features/zdr) 和实际提供方政策为准。

### 小米 MiMo（可选）

填写独立的 MiMo 密钥，选择音色，再确认 MiMo 在线授权。使用官方 `mimo-v2.5-tts` 接口，中文音色为 **白桦、苏打、冰糖、茉莉**，英文音色为 **Mia、Chloe、Milo、Dean**。详情见 [官方语音合成说明](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/audio/speech-synthesis)。

MiMo 不继承 OpenRouter 的 ZDR 设置，**本脚本不承诺 MiMo 提供 ZDR**。费用和数据处理以 [小米 MiMo 隐私政策](https://privacy.mi.com/XiaomiMiMoPlatform/zh_CN/) 及账户服务条款为准。若必须使用 ZDR 路由，请选择相应的 OpenRouter 模式，而不是 MiMo。

## 费用、缓存与隐私

- API 默认关闭。仅发送实际朗读的分段文字，不发送文件、网页地址或标题；MiMo 请求还带固定的通用语音指令。切换引擎、更换配置或载入新文档需重新确认授权。
- API 单次朗读范围最多 20,000 字符，按需逐段请求，不做提前合成、自动重试或跨提供方回退。OpenRouter 单段最多 500 字符，MiMo 按约 200 字符组织；切分尽量使用句子边界。
- 暂停/继续复用当前音频；最近音频缓存在当前面板内存中，最多 8 段、16 MiB。停止或跳转会取消未完成请求，**已经提交的请求仍可能计费**。
- 密钥仅在隔离面板的内存中使用，不写入脚本、宿主网页 DOM、localStorage、油猴存储或 GitHub。关闭面板、刷新或关闭页面后清除；“清除密钥与音频缓存”会清除两个 API 的密钥及缓存。
- 无遥测，不保存正文或朗读历史；错误提示不回显服务方原始响应，避免泄露正文或凭据。HTTP 400 不等同于额度不足，402 才按服务返回的支付问题提示。
- 隔离面板不具有宿主网页的同源访问权限，API 请求不带网页 Cookie 或 Referer；没有 `GM_xmlhttpRequest` 权限或通用跨域代理。仍只应在可信网页输入密钥和导入私人文件：恶意网页可能伪造界面，隔离不是对所有扩展、设备或恶意页面的绝对保证。

## 验证范围

0.2.1 已通过 19 项单元测试、公开网页/PDF 浏览器测试和两个 API 的模拟音频流程。另有严格内容安全策略及 Trusted Types 场景测试，验证兼容控制栏不会出现密钥/文件输入或网络请求。已在独立 Chromium 配置中安装实际 Tampermonkey 5.5.1，验证普通页面、MiMo 选项和本仓库 GitHub 页面上的兼容控制栏。

API 测试使用公开短文、占位密钥和模拟响应，**未调用付费账号，也未验证各音色的真实音质**。手机、Firefox/Safari、锁屏和长期后台播放仍需设备测试；窄窗口检查不能替代手机验收。测试详情见 [TESTING.md](TESTING.md)。

## 开发

需要 Node.js 24。运行 `npm ci --ignore-scripts`、`npm test`、`npm run build`。`npm start` 只监听本机 `127.0.0.1:5199`。`npm run test:browser` 和 `npm run test:api-browser` 只使用公开示例与模拟音频。

共享算法来自公开 Cozy 仓库，提交及哈希见 `vendor/SOURCES.json`，构建时逐项核验。发布资产附第三方许可、SHA256 和 GitHub 构建来源证明。桌面和移动 Obsidian 插件不会被此脚本修改。

问题请到 [GitHub Issues](https://github.com/laginae/cozy-read-aloud-userscript/issues) 反馈，提供浏览器、Tampermonkey 版本、操作步骤和已脱敏截图。请勿提交密钥、私人正文或未经授权的 PDF。
