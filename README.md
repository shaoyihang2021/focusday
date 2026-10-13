<div align="center">

# FocusDay 🍅

**番茄工作法 · 待办清单 · 倒数日**

一个现代、轻量、开箱即用的 Windows 桌面应用，支持桌面小组件与深浅色模式。

[![CI](https://github.com/shaoyihang2021/focusday/actions/workflows/ci.yml/badge.svg)](https://github.com/shaoyihang2021/focusday/actions/workflows/ci.yml)
[![Release](https://github.com/shaoyihang2021/focusday/actions/workflows/release.yml/badge.svg)](https://github.com/shaoyihang2021/focusday/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## ✨ 简介

FocusDay 把三件每天都会用到的小工具放进了一个界面里：**专注计时**、**待办清单**、**倒数日**。
它基于 [Tauri 2](https://v2.tauri.app/) 构建，安装包小、内存占用低，界面使用 Web 技术栈做到现代、细腻、支持深浅色。

## 🚀 功能特性

### 🍅 番茄钟
- 专注 / 短休息 / 长休息三种模式，时长可自由配置
- 环形进度可视化，支持暂停、重置、跳过
- 每完成 N 个番茄自动进入长休息（默认 4 个）
- 可把专注时间**关联到具体待办**，完成的番茄自动累加到任务上
- 结束时系统通知 + 提示音，可选自动开始下一段
- 统计「今日番茄数」与「今日专注时长」

### ✅ 待办清单
- 回车快速添加，支持番茄数预估（1–4+）与优先级（低 / 中 / 高）
- 进行中 / 全部 / 已完成 视图切换，一键清除已完成
- 每项显示 `已完成 / 预估` 番茄进度
- 一键将任务设为「当前专注任务」

### 🏷 任务标签与分组
- 可创建、删除彩色标签，删除时自动从所有任务上移除
- 添加任务时可勾选一个或多个标签
- 任务列表展示标签；点击任意标签即可按它筛选（支持多标签叠加）
- 内置 工作 / 学习 / 生活 三个初始标签

### 📊 数据统计
- 自动记录每天完成的专注时长（分钟）与番茄数
- 近 7 天专注时长柱状图，今日与峰值高亮
- 汇总今日 / 近 7 天 / 累计专注时长，以及**连续专注天数**
- 旧版本数据会自动迁移，升级后统计不缺失

### 📅 倒数日
- 添加任意值得期待的日子（项目上线、生日、旅行…）
- 自动计算还剩多少天 / 已过去多少天，显示星期
- 支持**每年重复**（生日、纪念日自动滚动到下一次）
- 自定义标记色、备注，支持置顶

### 🪟 桌面小组件
- 独立浮窗，无边框、圆角、可拖动
- 实时显示当前计时、模式、今日番茄数
- 展示置顶的倒数日与下一条待办
- 可直接在小组件上开始 / 暂停计时，一键打开主窗口
- **4 种皮肤**：玻璃（毛玻璃）/ 纯色 / 描边 / 幽灵（全透明）
- **尺寸（小 / 中 / 大）与不透明度可调**，调整后立即生效

### 🔊 白噪音
- 白噪音 / 粉红噪音 / 棕噪音三种，音量 0–100% 可调
- 计时开始自动播放，暂停或结束时自动淡出停止
- 用 Web Audio API 实时合成，**不打包任何音频文件**，安装包体积不受影响
- 起始与停止均带淡入淡出，避免爆音

### 🖥 系统托盘常驻
- 关闭主窗口时自动最小化到系统托盘，应用继续在后台运行
- 托盘右键菜单：显示主窗口 / 显示小组件 / 隐藏小组件 / 退出
- 左键单击托盘图标即可唤回主窗口
- **托盘 tooltip 实时显示剩余时间与今日番茄数**，鼠标悬停即可查看，无需打开主窗口
- 不需要常驻时，可在设置中关闭「关闭窗口时最小化到托盘」，此时关闭窗口会直接退出应用

### 🎨 多主题配色
- 内置 5 套强调色：番茄红 / 海洋蓝 / 紫罗兰 / 森林绿 / 琥珀黄
- 主色统一驱动按钮渐变、进度环、选中态、侧栏高亮等全部强调色元素
- 浅色与深色模式下分别调校了明度，保证对比度达标

### ⌨️ 全局快捷键
- 可在任意程序中一键显示 / 隐藏主窗口（默认关闭，需在设置中选择）
- 提供 4 组预设组合（Ctrl+Shift+F 等），避免与系统或其他软件冲突
- 快捷键被占用时自动回退并给出提示

### 📌 小组件锁定与位置记忆
- 小组件标题栏提供锁定 / 解锁按钮，锁定后无法拖动，避免误触
- 小组件位置自动记忆（按逻辑像素存储，兼容不同屏幕缩放），下次启动还原到原处

### 🚀 开机自启
- 一键把 FocusDay 加入 Windows 开机启动项（注册表 Run 项），随登录自动在后台拉起
- 开关状态会与系统实际状态核对，设置不生效时会提示

### 💾 数据备份
- 一键导出全部数据为 JSON 文件，随时导入恢复
- 备份内容包含待办、倒数日、番茄统计与全部设置

### 🎨 界面与外观
- 毛玻璃质感 + 柔和渐变背景，深浅色模式一键切换
- 支持「浅色 / 深色 / 跟随系统」三种模式，跟随系统时随系统实时变化
- 主题在启动前应用，无闪烁

## 🛠 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面外壳 | Tauri 2（Rust） |
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite |
| 样式 | Tailwind CSS v4 |
| 状态管理 | Zustand |
| 图标 | lucide-react |
| 数据持久化 | tauri-plugin-store（跨窗口同步） |
| 系统通知 | tauri-plugin-notification |
| 系统托盘 | Tauri 内置 tray-icon |
| 开机自启 | tauri-plugin-autostart |
| 全局快捷键 | tauri-plugin-global-shortcut |
| 文件对话框 | tauri-plugin-dialog |

**架构要点**

- 主窗口与小组件是**两个独立 WebView 窗口**，共享同一份 Zustand 状态；
- 状态变更通过 Tauri 事件广播到其他窗口，实现秒级双向同步；
- 计时引擎只在主窗口运行，避免多窗口重复触发「专注结束」；
- 剩余时间由 `endAt` 时间戳推导，两个窗口显示永远一致；
- 关闭主窗口的行为（托盘常驻 / 直接退出）由前端拦截 `close-requested` 实现，因此能随时跟随设置变化；
- 主题配色通过 `data-accent` 属性 + CSS 变量实现，只覆盖 5 个品牌色 token，不影响其余主题；
- 每日专注数据以 `focusByDay`（`YYYY-MM-DD` → 时长/番茄数）为唯一数据源，统计、托盘提示与各处「今日」计数都从它派生，避免多处计数不一致。

## 📦 下载安装

前往 [Releases](https://github.com/shaoyihang2021/focusday/releases) 下载最新版：

- `FocusDay_*_x64-setup.exe` —— NSIS 安装包（**推荐**，默认当前用户安装，无需管理员权限）
- `FocusDay_*_x64_en-US.msi` —— MSI 安装包

> 需要 Windows 10 1809+ / Windows 11，系统会自动安装 WebView2 运行时。

## 💻 本地开发

**前置要求**：Node.js 20+、Rust 1.77+、[Tauri 系统依赖](https://v2.tauri.app/start/prerequisites/)（Windows 需安装 WebView2 与 MSVC 构建工具）。

```bash
# 安装依赖
npm install

# 仅启动前端（浏览器中预览界面，无桌面能力）
npm run dev

# 启动完整桌面应用（热更新）
npm run app:dev
```

## 🏗 打包

```bash
npm run app:build
```

产物位于 `src-tauri/target/release/bundle/`：

- `nsis/FocusDay_0.4.0_x64-setup.exe`
- `msi/FocusDay_0.4.0_x64_en-US.msi`

也可以直接打 tag，让 GitHub Actions 自动完成 Windows 构建与 Release 发布：

```bash
git tag v0.4.0
git push origin v0.4.0
```

## 📁 项目结构

```
focusday/
├─ src/                       # 前端（React）
│  ├─ components/             # 界面组件（番茄钟 / 待办 / 倒数日 / 统计 / 小组件…）
│  ├─ store/                  # Zustand 状态、默认值/数据校验、持久化与跨窗口同步
│  ├─ lib/                    # 日期、计时、统计、主题、通知、白噪音、备份、窗口等工具
│  ├─ hooks/
│  ├─ App.tsx                 # 主窗口布局
│  └─ main.tsx                # 入口：按 hash 区分主窗口 / 小组件
├─ src-tauri/                 # 桌面外壳（Rust）
│  ├─ src/lib.rs              # 托盘、小组件窗口、尺寸、备份、开机自启、全局快捷键命令
│  ├─ src/main.rs
│  ├─ capabilities/           # 窗口与插件权限
│  ├─ icons/
│  └─ tauri.conf.json
├─ .github/workflows/         # CI 与 Windows 自动打包发布
├─ app-icon.svg               # 应用图标源文件
└─ package.json
```

## 💾 数据存储

所有数据保存在本地，不上传任何服务器：

```
%APPDATA%\com.shaoyihang.focusday\focusday.store.json
```

在「设置 → 数据」中可导出 / 导入备份，或一键重置全部数据。

## 📄 License

[MIT](LICENSE) © 2026 shaoyihang2021
