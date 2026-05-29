# gram-prog // Premium AI Writing Assistant

`gram-prog` is a premium, distraction-free writing environment and AI-powered grammar assistant. Inspired by **Notion** and **iA Writer's** minimal paper aesthetic, it provides an elegant workspace tailored for writers who demand absolute precision, focus, and fluidity.

👉 **[简体中文](README_zh.md)**

Powered by the **Google Gemini API** (using the latest `gemini-flash-lite-latest` and `gemini-3.5-flash` models), it offers character-accurate, context-aware grammar checking and advanced tone-shifting rewrite engines in real-time.

---

## ✨ Primary Features

### 1. Distraction-Free Paper Canvas
*   **Literary Typography**: Features **Lora** (a premium literary serif reading font) with spacious line-heights ($1.8$) on a warm cream paper background (`#FAF9F6`) to minimize eye strain.
*   **Zero-Latency Highlighting**: Leverages a customized **scroll-synchronized layered editor engine**. Underlines are rendered exactly underneath the text with **zero caret disruption or typing latency** (unlike standard, finicky React contenteditable implementations).

### 2. Context-Aware Suggestion Sidebar
*   Color-coded highlights map directly to specific issue categories:
    *   🔴 **Spelling**: Red dotted underlines
    *   🔵 **Grammar**: Blue dotted underlines
    *   🟡 **Clarity / Style**: Yellow dotted underlines
    *   🟣 **Tone**: Purple dotted underlines
*   Interactive cards reveal the exact diff, a concise explanation of *why* the change is recommended, and buttons to **Accept** or **Dismiss**.
*   Accepting a suggestion instantly replaces the text and **automatically recalibrates** remaining highlights' 0-indexed positions mathematically.

### 3. Refactored 3-Step "Accept All" Rewrite
Instead of raw, mechanical string search-and-replace (which destroys sentence structure and vocabulary flow), the **Accept All** button triggers a sophisticated three-step pipeline:
1.  **Auditing**: Collects and compiles all spelling & grammatical issues currently present in the editor.
2.  **Minimalist Correction**: Sends the text to a dedicated backend endpoint using **Gemini Flash Lite** at **$0.0$ Temperature** (zero creativity). It fixes all errors while **strictly preserving** your original tone, style, and content without any arbitrary additions or deletions.
3.  **Validation & Display**: Automatically runs a secondary check on the corrected output to verify it is $100\%$ pristine, updates the UI, and **automatically disables Auto-check** so you can review your polished copy in absolute peace.

### 4. AI Tone Rewriter & Polisher
*   Select any text or rewrite your entire document using 6 custom presets: **Professional, Casual, Confident, Academic, Friendly, or Concise**.
*   Presents a side-by-side original vs. rewritten preview card along with an **AI Change Log** explaining the linguistic shifts made by the LLM.

### 5. Writing Insights Panel
Sits elegantly at the bottom center of the editor, tracking live writing analytics:
*   **Metrics**: Real-time Word count, Character count, and estimated Reading duration.
*   **Readability**: Computes Flesch Reading Ease accessibility bands (e.g. *Easy*, *Conversational*, *Academic*).
*   **Overall Tone**: Analyzes the emotional resonance of your text dynamically.

### 6. Dynamic Model Auto-Discovery
*   The header features a premium **Model Selector** dropdown.
*   On launch, the backend securely queries the Google Generative Language API dynamically to list all active text generation models available under your Google Cloud project (e.g. Gemini 3.5, 2.5, 2.0). 
*   It automatically populates the dropdown and **pre-selects the fastest available version** (e.g. `gemini-flash-lite-latest`), while providing robust, elegant fallbacks if the key is not yet set.

---

## 🛠️ Technology Stack

*   **Monorepo Architecture**: Clean separation between server and client with zero overlapping build-dependencies.
*   **Backend**: Node.js, Express, `dotenv`, `cors`, `@google/generative-ai` v0.24.1 (leveraging advanced `SchemaType` structured output generation configurations).
*   **Frontend**: React (Vite + TS), Vanilla CSS (strictly tailored for premium typography and warm paper visuals), scroll-sync handlers, and inline SVGs.

---

## 🚀 Getting Started

### 1. Prerequisites
Make sure you have **Node.js v20.19+ or v22.12+** installed on your system.

### 2. Installation
Clone the repository and run the monorepo installer from the root directory:
```bash
git clone https://github.com/allanchen2019/gram-prog.git
cd gram-prog
npm run install:all
```

### 3. API Key Configuration
1. Create a `.env` file in the `backend/` directory (you can copy `backend/.env.example` as a template):
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Open `backend/.env` and paste your Google Gemini API Key:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```

### 4. Run the Workspace
Launch both the Express backend API server (port 4000) and the Vite client (port 5173) concurrently with a single command:
```bash
npm run dev
```

Open your browser and navigate to 👉 **[http://localhost:5173](http://localhost:5173)** to start writing!
