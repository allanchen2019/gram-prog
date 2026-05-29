# gram-prog // 极简 AI 英文写作助手

`gram-prog` 是一款专为追求极致专注、精准与流畅写作的创作者打造的极简无干扰英文写作环境与 AI 语法纠错助手。项目视觉上深度吸取了 **Notion** 与 **iA Writer** 的极简温暖纸张美学。

项目基于 **Google Gemini API**（默认搭载最新的 `gemini-flash-lite-latest` 与 `gemini-3.5-flash` 旗舰大模型），为您提供字符级精准的上下文语法纠错、多维度写作统计洞察以及多预设的 AI 语气改写润色引擎。

👉 **[English Version](README.md)**

---

## ✨ 核心特色功能

### 1. 沉浸式纸张画布 (Distraction-Free Paper Canvas)
*   **文人排版系统**：采用极其优美的衬线字体 **Lora**，配备舒适的行高（$1.8$），底色选用温暖柔和的 Alabaster 象牙白纸张色（`#FAF9F6`），最大程度降低长时间写作的眼部疲劳。
*   **零延迟高亮渲染**：自主研发了**滚动同步双层画布渲染引擎**。所有的波浪下划线均极其精确地渲染在底层，输入体验保持 **$100\%$ 零卡顿、无光标跳动**（彻底规避了 React 传统 ContentEditable 的光标定位缺陷）。

### 2. 上下文智能纠错侧边栏 (Context-Aware Suggestion Sidebar)
*   波浪下划线与纠错维度精准对应：
    *   🔴 **拼写错误 (Spelling)**：红色虚线下划线
    *   🔵 **语法偏差 (Grammar)**：蓝色虚线下划线
    *   🟡 **清晰度与风格 (Clarity / Style)**：黄色虚线下划线
    *   🟣 **语气协调 (Tone)**：紫色虚线下划线
*   交互式卡片直观对比修改前后的 Diff，提供简明扼要的“教学式”修改原因解释，并支持**一键接受 (Accept)** 或**忽略 (Dismiss)**。
*   采纳某条建议后，文本会自动替换，且**剩余所有高亮标记的 0-indexed 起止字符坐标会自动进行数学差值计算并瞬间同步平移**。

### 3. 重构的三步式“一键全兑” (3-Step "Accept All" Rewrite)
不同于市面上粗暴的物理字符串搜索替换（这会严重割裂英语的句式流和词汇衔接），我们的 **Accept All** 按钮内置了极为严谨的 AI 重写流水线：
1.  **自动审计**：瞬时提取并汇总当前画布中存在的所有语法和拼写硬伤。
2.  **极简无痕修复**：将文本发送至专用后端，调动 **Gemini Flash Lite** 在 **$0.0$ 极低温度**（零创造力）下进行极简化纠错。大模型在**严格保持您的原始语气、句式和核心信息**的前提下，以最少的修改程度完成语法重塑，绝无任何生硬的加字或删减。
3.  **二次复检呈递**：修改完成后，系统会自动在后台对纠错文本重新发起一次自检以确保 $100\%$ 完美，随后呈递到 UI 中，并**自动关闭 Auto-check（自动检查）**，让您可以极度安心地审阅润色后的内容。

### 4. AI 语气重写器 (AI Tone Rewriter)
*   选定全文，即可使用 6 种预设语气进行智能重塑：**Professional (专业), Casual (口语), Confident (自信), Academic (学术), Friendly (友好), Concise (精简)**。
*   提供直观的左右双栏对比，并附带 **AI 修改日志**，阐述大模型进行句式和词汇调整的语言学考量。

### 5. 写作洞察胶囊 (Writing Insights Panel)
优雅地悬浮在编辑器底部正中，实时更新：
*   **基础指标**：字数（Word count）、字符数（Character count）及预估阅读时间。
*   **易读性指数**：实时计算 Flesch Reading Ease 易读性分数并映射至对应等级（如：*Easy 易读*、*Conversational 适合交流*、*Academic 学术难度*）。
*   **主导语气**：动态评估整篇文章的情感主导基调。

### 6. 动态模型自动发现 (Dynamic Model Auto-Discovery)
*   顶部 Header 包含精致的 **Model Selector（模型选择下拉菜单）**。
*   在服务启动时，后端会直接通过 REST 协议查询 Google 官方 API，动态拉取您当前 API 密钥下**所有可用的文本大模型**（如 Gemini 3.5, 2.5, 2.0），并自动填充至下拉菜单中，**默认优先锁定并激活最新高速的 `gemini-flash-lite-latest`**。

---

## 🛠️ 技术栈

*   **Monorepo 架构**：前后端完全分离，根目录统一调度，无任何交叉依赖。
*   **后端 (Backend)**：Node.js, Express, `dotenv`, `cors`, `@google/generative-ai` v0.24.1（支持 SchemaType 强约束结构化输出）。
*   **前端 (Frontend)**：React (Vite + TS), Vanilla CSS（暖纸视觉系统设计）、高精度滚动同步滚动器、轻量级内联 SVG 资产。

---

## 🚀 快速上手

### 1. 环境依赖
确保您的系统安装了 **Node.js v20.19+ 或 v22.12+**。

### 2. 安装与构建
克隆仓库并在项目根目录下运行一键安装脚本：
```bash
git clone https://github.com/allanchen2019/gram-prog.git
cd gram-prog
npm run install:all
```

### 3. API 密钥配置
1. 在 `backend/` 目录下创建一个 `.env` 环境变量配置文件（可直接复制 `.env.example`）：
   ```bash
   cp backend/.env.example backend/.env
   ```
2. 编辑 `backend/.env`，填入您的 Google Gemini API Key：
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```

### 4. 运行开发工作区
在根目录下运行以下单条命令，即可同时启动 Express API 服务（端口 4000）和 Vite 客户端（端口 5173）：
```bash
npm run dev
```

打开您的浏览器，访问 👉 **[http://localhost:5173](http://localhost:5173)** 开始写作！
