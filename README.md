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
- 支持置顶开关，切换后立即生效

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

**架构要点**

- 主窗口与小组件是**两个独立 WebView 窗口**，共享同一份 Zustand 状态；
- 状态变更通过 Tauri 事件广播到其他窗口，实现秒级双向同步；
- 计时引擎只在主窗口运行，避免多窗口重复触发「专注结束」；
- 剩余时间由 `endAt` 时间戳推导，两个窗口显示永远一致。

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

- `nsis/FocusDay_0.1.0_x64-setup.exe`
- `msi/FocusDay_0.1.0_x64_en-US.msi`

也可以直接打 tag，让 GitHub Actions 自动完成 Windows 构建与 Release 发布：

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 📁 项目结构

```
focusday/
├─ src/                       # 前端（React）
│  ├─ components/             # 界面组件（番茄钟 / 待办 / 倒数日 / 小组件…）
│  ├─ store/                  # Zustand 状态、持久化与跨窗口同步
│  ├─ lib/                    # 日期、计时、主题、通知、窗口等工具
│  ├─ hooks/
│  ├─ App.tsx                 # 主窗口布局
│  └─ main.tsx                # 入口：按 hash 区分主窗口 / 小组件
├─ src-tauri/                 # 桌面外壳（Rust）
│  ├─ src/lib.rs              # 小组件窗口的创建、显示与置顶命令
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

在「设置 → 数据」中可一键重置全部数据。

## 📄 License

[MIT](LICENSE) © 2026 shaoyihang2021
