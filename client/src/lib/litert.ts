import { LlmInference, FilesetResolver } from '@mediapipe/tasks-genai';

/**
 * Optimized model loader using OPFS (Origin Private File System)
 * This avoids re-downloading large models and provides fast local access.
 */
async function getModelUrlOPFS(modelPath: string, onProgress?: (msg: string) => void) {
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    
    // Always use the same host/port as the current window for relative model paths
    const sourceUrl = modelPath.startsWith('http') 
        ? modelPath 
        : `${window.location.origin}${modelPath}`;
    
    // For local non-https dev, still try to skip cache if preferred, 
    // but serving from public/ is fine too.
    if (isLocal && !modelPath.startsWith('http')) {
        // Just continue and let it cache or use the public URL
    }

    const root = await navigator.storage.getDirectory();
    const filename = modelPath.split('/').pop() || 'model.task';
    
    try {
        const fileHandle = await root.getFileHandle(filename);
        const file = await fileHandle.getFile();
        if (file.size > 10 * 1024 * 1024) { // Assume > 10MB is a valid model
            console.log(`[OPFS] Loading ${filename} from cache (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            if (onProgress) onProgress("Loading from local cache...");
            return URL.createObjectURL(file);
        }
    } catch (e) {
        // Not in cache, continue to download
    }

    console.log(`[OPFS] Downloading ${filename} to local cache...`);
    if (onProgress) onProgress("Downloading model to local cache... Please wait.");
    
    const response = await fetch(sourceUrl);
    if (!response.ok || !response.body) throw new Error(`Model download failed: ${response.status} ${response.statusText}`);
    
    const fileHandle = await root.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    
    await response.body.pipeTo(writable);
    
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
}

export class LiteRTManager {
  private llm: any = null;
  private isInitializing = false;
  public currentModelPath: string | null = null;
  public gpuInfo: string = "Detecting...";
  public onInitProgress?: (msg: string) => void;

  private constructor() {
    this.detectGPU();
  }

  static getInstance() {
    if (!(window as any).__LITERT_MGR__) {
      (window as any).__LITERT_MGR__ = new LiteRTManager();
    }
    return (window as any).__LITERT_MGR__ as LiteRTManager;
  }

  private async detectGPU() {
    try {
      if (!navigator.gpu) {
        this.gpuInfo = "WebGPU not supported (Using CPU)";
        return;
      }
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        // @ts-ignore
        const info = await adapter.requestAdapterInfo();
        this.gpuInfo = info.description || info.device || "Generic WebGPU";
      } else {
        this.gpuInfo = "WebGPU Adapter failed (Using CPU)";
      }
    } catch (e) {
      this.gpuInfo = "GPU Detection Error";
    }
  }

  isLoaded() {
    return !!this.llm;
  }

  async loadModel(modelPath: string, options: any = {}) {
    if (this.isInitializing) return;
    this.isInitializing = true;

    if (this.llm) {
        await this.llm.close?.();
        this.llm = null;
    }

    try {
      if (this.onInitProgress) this.onInitProgress("Initializing Engine...");
      
      const genaiFileset = await FilesetResolver.forGenAiTasks("/wasm");
      const fullPath = await getModelUrlOPFS(modelPath, this.onInitProgress);
      
      if (this.onInitProgress) this.onInitProgress("Warming up WebGPU...");
      
      this.llm = await LlmInference.createFromOptions(genaiFileset, {
        baseOptions: {
          modelAssetPath: fullPath,
          delegate: options.useWebGPU ? "GPU" : "CPU",
        },
        maxTokens: options.maxTokens || 16384,
        temperature: options.temperature ?? 0.7,
        topK: options.topK || 40,
        // @ts-ignore
        topP: options.topP || 0.9,
        // Enable response streaming at engine level for lower latency
        randomSeed: Math.floor(Math.random() * 1000)
      });
      
      this.currentModelPath = modelPath;
    } catch (e) {
      console.error("LiteRT Load Error:", e);
      throw e;
    } finally {
      this.isInitializing = false;
    }
  }

  async generate(inputs: string | any[], onPartialResults?: (text: string, done: boolean) => void, seed?: number) {
    if (!this.llm) throw new Error("Inference engine not ready");
    
    // @ts-ignore
    if (seed !== undefined && this.llm.setRandomSeed) {
       // @ts-ignore
       this.llm.setRandomSeed(seed);
    }

    return new Promise((resolve, reject) => {
      try {
        this.llm.generateResponse(inputs, (partialText: string, done: boolean) => {
          if (onPartialResults) onPartialResults(partialText, done);
          if (done) resolve(partialText);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async close() {
    if (this.llm) {
      await this.llm.close?.();
      this.llm = null;
    }
  }
}

