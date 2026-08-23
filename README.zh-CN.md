# OLEDCare

[English](README.md) · 中文

**一款 DeepSeek Harness 插件（#dsh-plugin），在长时间智能体会话中保护 OLED 屏幕。**

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI（`dsh web`）提供 OLED 烧屏防护。

OLED 屏幕的损耗发生在像素长时间点亮的位置——而长时间的智能体会话正是这样对待背景、细线边框和高亮文字的。OLEDCare 从三个方面应对：

- **小憩模式（Nap）** —— 纯黑（`#000`）全屏屏保，让所有背景像素完全熄灭。闲置数分钟后自动启用，也可通过会话头部的 **☾ Nap** 按钮手动开启。屏幕上有一个缓慢漂移的暗色时钟（避免时钟本身烧屏），实时显示智能体状态——*正在工作 / 等待你的输入 / 空闲*——任何鼠标或键盘输入都会唤醒屏幕。
- **纯黑背景** —— 深色主题的所有背景色令牌都变为 `#000000`；背景像素完全熄灭，而不是发出暗灰色的光。
- **更暗的静态边框** —— 细线分隔线整天停留在相同的像素上，因此其暗色值比原生配色更暗。
- **伽马感知调光** —— 白色文字和高亮强调色令牌按线性光亮度比例缩放，在降低总光输出的同时保持文字层级之间的感知对比度。
- **闲置/失焦阶梯** —— 正常亮度 → 闲置或窗口失焦时深度调光 → 小憩。三个档位，每个都可配置。
- **色相轮换** —— 强调色相在约 12 小时的周期内缓慢漂移，让静态的品牌色图标均匀磨损每个子像素。

## 环境要求

- DeepSeek Harness（`@deepseek-ai/dsh`），带 `web` 配置（`dsh web`）
- PATH 中可用的 pnpm（`dsh plugin` 会调用它）

## 安装

从 GitHub 安装：

```sh
dsh plugin --profile web add github:domparent/OLEDCare
```

从本地检出安装：

```sh
dsh plugin --profile web add /absolute/path/to/OledCare
```

然后重启 `dsh web` 并刷新浏览器标签页。在设置左侧导航中打开 **Settings → OLEDCare**。

安装时不会运行构建步骤：`client.js` 以 harness 浏览器模块格式原样发布，浏览器直接加载，因此从 GitHub 安装无需将 `prepare` 脚本加入白名单。

## 卸载

```sh
dsh plugin --profile web remove dsh-oled-care
```

之后重启 `dsh web`。

## 设置

三个预设：**Off（关闭）**；**Balanced（均衡，默认）**——纯黑背景、85% 文字亮度、闲置 10 分钟后小憩；**Maximum（最强）**——70% 文字亮度、闲置 3 分钟深度调光、闲置 5 分钟小憩。调整任何字段后会出现 Custom（自定义）状态：

| 字段 | 作用 |
| --- | --- |
| Pure black backgrounds（纯黑背景） | 所有界面背景变为 `#000`，背景像素完全熄灭 |
| Fainter static borders（更暗的静态边框） | 让细线边框比原生配色更暗 |
| Text/accent intensity（文字/强调色亮度） | 对白色文字和高亮强调色做线性光缩放 |
| Hue rotation（色相轮换） | 约 12 小时的强调色相周期，使子像素均匀磨损 |
| Deep-dim after idle（闲置后深度调光） | 无输入多少分钟后应用更深的亮度 |
| Deep-dim intensity（深度调光强度） | 闲置或失焦时使用的调光级别 |
| Deep-dim when unfocused（失焦时深度调光） | 窗口失去焦点时应用深度调光 |
| Auto nap after idle（闲置后自动小憩） | 无输入多少分钟后启用小憩屏幕 |

设置页面底部的诊断框会显示当前令牌层、解析后的 body 背景色、当前调光档位以及小憩/闲置状态。

设置保存在浏览器的 `localStorage` 中（键为 `dsh-oled-care:v1`），因此你的预设和自定义组合在 `dsh web` 重启后依然保留。在存储不可用的情况下（隐私窗口、存储被禁用），插件会退回到仅本次会话有效的内存设置。

## 工作原理

- 本包是一个 profile **bundle**（配置包）：`package.json` 中的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，后者插入一行插件记录。客户端模块系统会把该行的 `dsh.client` 声明扫描进浏览器插件名册，并在 `/plugins/dsh-oled-care/client.js` 提供 `client.js`。
- 所有视觉改动都通过客户端**主题服务**以一个可替换的令牌覆盖层实现——原生主题从不被修改，移除插件即可完全还原。
- UI 仅通过插槽（slot）系统组合：`shell.overlay`（小憩屏幕）、`conversation.session.header.actions`（小憩按钮）和 `settings.section`（设置页面）。

## 限制

- 浅色主题基本不做改动——OLED 防护针对的是深色 UI。
- 基于 dsh `0.1.0-rc.x` 开发。浏览器模块格式（`window.__ModuleLoader__.load`）是 harness 的内部契约；升级时请锁定 dsh 版本或查看发布说明。
- 无网络请求、无遥测、不访问会话内容。唯一触及的存储是 `localStorage`，且仅用于插件自身的设置。

## 许可证

MIT —— 见 [LICENSE](LICENSE)。
