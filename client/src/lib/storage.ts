// --- KRNLCAMEL MILITARY-GRADE ENCRYPTION LAYER ---
// Multi-pass PBKDF2 derived keys with AES-GCM 256-bit encryption.
const BASE_SALT = "x8F!k9@LmPq2$vNcR_krnlcamel_space_0x000F";
const OBFS_KEY = "LITERT_CYBERPUNK_SECURE_VAULT_2026_X_ALPHA_OMEGA";

async function getCryptoKey() {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(OBFS_KEY),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(BASE_SALT),
      iterations: 250000, // ╨Т╤Л╤Б╨╛╨║╨░╤П ╨╜╨░╨│╤А╤Г╨╖╨║╨░ ╨┤╨╗╤П ╤Г╤Б╨╗╨╛╨╢╨╜╨╡╨╜╨╕╤П ╨▒╤А╤Г╤В╤Д╨╛╤А╤Б╨░
      hash: "SHA-512"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(data: any): Promise<string> {
  try {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(16)); // AES-GCM recommended IV size
    const enc = new TextEncoder();
    
    // ╨Ф╨▓╨╛╨╣╨╜╨░╤П ╤Б╨╡╤А╨╕╨░╨╗╨╕╨╖╨░╤Ж╨╕╤П + ╨╛╨▒╤Д╤Г╤Б╨║╨░╤Ж╨╕╤П ╨┐╨╡╤А╨╡╨┤ ╤И╨╕╤Д╤А╨╛╨▓╨░╨╜╨╕╨╡╨╝
    const payload = JSON.stringify({
        _s: Date.now(),
        _d: btoa(encodeURIComponent(JSON.stringify(data)))
    });

    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(payload));
    
    // Combine IV and Encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to Base64 and add signature
    return "KRNL_" + btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.error("Encryption failed", e);
    return "";
  }
}

export async function decryptData(base64Data: string): Promise<any> {
  try {
    if (!base64Data.startsWith("KRNL_")) return null;
    const cleanB64 = base64Data.substring(5);
    
    const key = await getCryptoKey();
    const combined = new Uint8Array(atob(cleanB64).split('').map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 16);
    const data = combined.slice(16);
    
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    const dec = new TextDecoder();
    
    const payload = JSON.parse(dec.decode(decrypted));
    return JSON.parse(decodeURIComponent(atob(payload._d)));
  } catch (e) {
    console.error("Decryption failed. Data might be corrupted or tampered with.", e);
    return null;
  }
}

// ╨г╨┐╤А╨░╨▓╨╗╨╡╨╜╨╕╨╡ ╤З╨░╤В╨░╨╝╨╕ (Persistent, 10MB limit roughly handled by localStorage limits)
export async function saveChats(chats: any[]) {
  const encrypted = await encryptData(chats);
  localStorage.setItem('litert_chats_secure', encrypted);
}

export async function loadChats(): Promise<any[]> {
  const encrypted = localStorage.getItem('litert_chats_secure');
  if (!encrypted) return [];
  const decrypted = await decryptData(encrypted);
  return Array.isArray(decrypted) ? decrypted : [];
}

// ╨Я╨╡╤А╤Б╨╕╤Б╤В╨╡╨╜╤В╨╜╨╛╨╡ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨╡ (Local Storage fallback / IndexedDB wrapper is possible, but let's use localStorage chunks for simplicity first, or just a single item since it's text)
export const TempWorkspace = {
  getFilesMap(): Map<string, string> {
    const raw = localStorage.getItem('litert_temp_workspace');
    if (!raw) return new Map();
    try {
      const parsed = JSON.parse(raw);
      return new Map(Object.entries(parsed));
    } catch (e) {
      return new Map();
    }
  },
  
  saveToStorage(map: Map<string, string>) {
    const obj = Object.fromEntries(map);
    try {
        localStorage.setItem('litert_temp_workspace', JSON.stringify(obj));
    } catch(e) {
        console.warn("Storage quota exceeded", e);
    }
  },

  saveFile(name: string, content: string) {
    const map = this.getFilesMap();
    map.set(name, content);
    this.saveToStorage(map);
  },
  
  getFile(name: string) {
    return this.getFilesMap().get(name) || "";
  },
  
  list() {
    return Array.from(this.getFilesMap().keys());
  },
  
  deleteFile(name: string) {
    const map = this.getFilesMap();
    map.delete(name);
    this.saveToStorage(map);
  }
};
