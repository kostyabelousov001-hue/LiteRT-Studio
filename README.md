# LiteRT Studio / LiteRT WEB AI Interface

> ⚡ **Built with the assistance of [Gemini CLI](https://github.com/google-gemini/gemini-cli)** ⚡

LiteRT Studio is a high-performance, privacy-first local LLM inference environment powered by Google's LiteRT (formerly TensorFlow Lite) and WebGPU. It runs advanced AI models (like Gemma 2B) directly on your device's hardware, ensuring zero data leaves your machine while delivering blazing-fast token generation.

![LiteRT Studio](client/public/icons.svg)

## 🌟 Features

*   **100% Local Inference:** Runs entirely on your machine. No cloud, no API keys, total privacy.
*   **WebGPU Acceleration:** Leverages the full power of your dedicated or integrated GPU for ultra-low latency generation.
*   **Built-in Reasoning Engine:** Supports advanced models that output reasoning (e.g., `<think>` tags) with a beautifully formatted, collapsible UI.
*   **API Bridges (WIP/Experimental):** Architecture designed to support OpenAI and Ollama compatible endpoints for connecting external tools like Open WebUI.
*   **Modern UI/UX:** A sleek, responsive, Apple-inspired dark mode interface built with React, Vite, and Lucide icons.
*   **Multi-modal Ready:** Framework in place to handle image and text attachments.

## 🚀 Quick Start

### 1. Prerequisites
*   Node.js (v18+ recommended)
*   A WebGPU-compatible browser (Chrome/Edge 113+) or Electron environment.

### 2. Installation

Install dependencies for both the root API bridge and the Vite client:

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 3. Model Setup
Download your WebGPU-compatible `.task` models (e.g., `gemma-4-E2B-it-web.task`) and place them in the client's public directory:
`client/public/models/`

### 4. Running the Application

To start the beautiful React interface:

```bash
cd client
npm run dev
```
Then open `http://localhost:5173` in your WebGPU-enabled browser.

## 🏗️ Architecture

- **Frontend:** React, TypeScript, Vite.
- **Inference Engine:** `@mediapipe/tasks-genai` leveraging WebGPU for hardware acceleration.
- **Styling:** Custom Vanilla CSS tailored for a premium, native-feeling experience.
- **Markdown & Math:** Full support for Markdown formatting and LaTeX rendering via `react-markdown` and `rehype-katex`.

## 🤝 Contributing

Contributions are welcome! If you want to improve the API bridges, optimize WebGPU pipelines, or enhance the UI, feel free to open a Pull Request.

## 📝 License

ISC License. See `package.json` for details.
