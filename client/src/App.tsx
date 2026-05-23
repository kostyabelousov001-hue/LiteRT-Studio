import React, { useState, useEffect, useRef, memo } from 'react';
import { LiteRTManager } from './lib/litert';
import { saveChats, loadChats } from './lib/storage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { 
  ArrowUp, Sidebar as SidebarIcon, Trash2, Plus, Zap, Cpu, Info, 
  RefreshCw, X, ChevronDown, ChevronRight,
  Paperclip, FileText, Brain, Copy, ChevronLeft
} from 'lucide-react';
import './App.css';

const rt = LiteRTManager.getInstance();

// --- COMPONENTS ---

const ReasoningBlock = memo(({ content, isThinking, finalTime }: { content: string, isThinking: boolean, finalTime?: number }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => { if (isThinking) setIsOpen(true); }, [isThinking]);

  useEffect(() => {
    if (isThinking) {
      if (!timerRef.current) timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isThinking]);

  if (!content && !isThinking) return null;
  const displayTime = isThinking ? seconds : (finalTime || seconds);

  return (
    <div className="reasoning-container hardware-accel">
      <div className="reasoning-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="reasoning-label">Reasoning</span>
        <span className="reasoning-timer">{displayTime} secs</span>
        {isOpen ? <ChevronDown size={16} color="#8E8E93" /> : <ChevronRight size={16} color="#8E8E93" />}
      </div>
      {isOpen && (
        <div className="reasoning-content">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
});

const MessageItem = memo(({ msg, isLast, onRegenerate, onSwitchVersion }: { msg: any, isLast: boolean, onRegenerate: any, onSwitchVersion: any }) => {
  const isAssistant = msg.role === 'assistant';
  const versions = msg.versions || [];
  const currentIdx = msg.currentVersion || 0;
  
  const current = isAssistant 
    ? (versions[currentIdx] || { content: '', reasoning: '', reasonTime: 0, isThinking: false })
    : { content: msg.content, reasoning: '', reasonTime: 0, isThinking: false };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(current.content);
  };

  return (
    <div className={`message ${msg.role} hardware-accel`}>
      {current.reasoning && (
        <ReasoningBlock content={current.reasoning} isThinking={msg.isStreaming && current.isThinking} finalTime={current.reasonTime} />
      )}
      {(current.content || (msg.isStreaming && !current.isThinking)) && (
        <div className="bubble-wrapper">
          <div className="bubble">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {msg.displayContent || current.content}
            </ReactMarkdown>
            {msg.isStreaming && !current.isThinking && <span className="cursor" />}
          </div>
          
          {isAssistant && !msg.isStreaming && isLast && (
            <div className="message-controls">
              <button className="control-btn" onClick={copyToClipboard} data-tooltip="Copy Markdown">
                <Copy size={14} />
              </button>
              
              {!current.reasoning && (
                <button className="control-btn" style={{ color: '#0A84FF' }} onClick={() => onRegenerate(msg.id, true)} data-tooltip="Answer with thoughts">
                  <Brain size={14} />
                </button>
              )}

              <button className="control-btn" onClick={() => onRegenerate(msg.id, false)} data-tooltip="Regenerate">
                <RefreshCw size={14} />
              </button>

              {versions.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                   <button className="control-btn" disabled={currentIdx === 0} onClick={() => onSwitchVersion(msg.id, currentIdx - 1)}>
                      <ChevronLeft size={14} />
                   </button>
                   <span className="version-counter">{currentIdx + 1}/{versions.length}</span>
                   <button className="control-btn" disabled={currentIdx === versions.length - 1} onClick={() => onSwitchVersion(msg.id, currentIdx + 1)}>
                      <ChevronRight size={14} />
                   </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const ChatInput = memo(({ onSend, isGenerating, disabled, attachedFiles, setAttachedFiles, enableThinking, setEnableThinking }: any) => {
  const [val, setVal] = useState('');
  const handleSend = () => { if (val.trim() || attachedFiles.length > 0) { onSend(val); setVal(''); } };
  
  const handleFile = (e: any) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file: any) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => setAttachedFiles((prev: any) => [...prev, { name: file.name, type: 'image', url: ev.target?.result }]);
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => setAttachedFiles((prev: any) => [...prev, { name: file.name, type: 'text', content: ev.target?.result }]);
        reader.readAsText(file);
      }
    });
    e.target.value = '';
  };

  return (
    <div className="input-wrapper">
      <div className="input-box-container">
        <div className={`input-box ${isGenerating ? 'generating-glow' : ''}`}>
          <div 
              className={`reasoning-toggle ${enableThinking ? 'on' : 'off'}`}
              onClick={() => setEnableThinking(!enableThinking)}
          >
            <div className="brain-icon-wrapper">
              <Brain size={18} />
              <div className="strike-line" />
            </div>
            <span>Reasoning</span>
          </div>

          <label className="icon-btn-aligned">
             <Paperclip size={20} /><input type="file" multiple style={{ display: 'none' }} onChange={handleFile} />
          </label>
          
          <textarea rows={1} placeholder="Message" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
          
          <button className="apple-btn" disabled={(!val.trim() && attachedFiles.length === 0) || isGenerating || disabled} onClick={handleSend}>
            {isGenerating ? <RefreshCw size={18} className="spin" /> : <ArrowUp size={22} strokeWidth={3} />}
          </button>
        </div>
        {attachedFiles.length > 0 && (
          <div className="attached-files-row">
            {attachedFiles.map((f: any, i: number) => (
              <div key={i} className="file-chip">
                {f.type === 'image' ? (
                  <img src={f.url} alt={f.name} style={{ width: 16, height: 16, objectFit: 'cover', borderRadius: 2, marginRight: 4 }} />
                ) : (
                  <FileText size={12} />
                )}
                {f.name}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => setAttachedFiles((prev: any) => prev.filter((_: any, idx: number) => idx !== i))} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default function App() {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (!isLocal) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <Zap size={64} color="#0A84FF" fill="#0A84FF" style={{ marginBottom: '20px' }} />
          <h1 style={{ fontSize: '3rem', fontWeight: 950 }}>Soon...</h1>
        </div>
      </div>
    );
  }

  const [sessions, setSessions] = useState<any[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const [modelStatus, setModelStatus] = useState('idle');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 900);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState({ tps: 0 });
  const [enableThinking, setEnableThinking] = useState(false);
  const [apiActive, setApiActive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const toggleAPI = () => {
    if (apiActive) {
      wsRef.current?.close();
      setApiActive(false);
    } else {
      const ws = new WebSocket(`ws://${window.location.hostname}:3001/ws-api`);
      ws.onopen = () => {
        console.log('[API] Connected to backend');
        setApiActive(true);
      };
      ws.onmessage = async (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'request') {
          const { id, payload } = data;
          const { messages: apiMsgs, stream, temperature, max_tokens } = payload;
          
          let prompt = "";
          for (const m of apiMsgs) {
            let content = "";
            if (typeof m.content === 'string') {
              content = m.content;
            } else if (Array.isArray(m.content)) {
              content = m.content.map((part: any) => part.text || "").join("");
            }

            if (m.role === 'system') prompt += `<|turn>system\n${enableThinking ? '<|think|> ' : ''}${content}<turn|>\n`;
            else if (m.role === 'user') prompt += `<|turn>user\n${content}<turn|>\n`;
            else prompt += `<|turn>model\n${content}<turn|>\n`;
          }
          prompt += `<|turn>model\n`;

          let fullApiAcc = "";
          await rt.generate(prompt, (text, done) => {
            fullApiAcc = text; // text is already the full string so far
            
            // Standardize reasoning output: translate LiteRT tags to <think> tags for API clients
            let standardizedText = fullApiAcc;
            if (fullApiAcc.includes('<|channel>thought')) {
                const parts = fullApiAcc.split('<|channel>thought');
                if (parts[1]) {
                    if (parts[1].includes('<channel|>')) {
                        const sub = parts[1].split('<channel|>');
                        standardizedText = `<think>\n${sub[0].trim()}\n</think>\n\n${sub.slice(1).join('<channel|>').trim()}`;
                    } else {
                        standardizedText = `<think>\n${parts[1].trim()}`; // Still thinking
                    }
                }
            }

            ws.send(JSON.stringify({ type: 'response', id, text: standardizedText, done }));
          }, temperature);
        }
      };
      ws.onclose = () => setApiActive(false);
      wsRef.current = ws;
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabled = useRef(true);

  useEffect(() => {
    loadChats().then(loaded => {
      if (loaded.length > 0) { setSessions(loaded); setCurrentId(loaded[0].id); } 
      else createNewSession();
    });
  }, []);

  useEffect(() => {
    const s = sessions.find(x => x.id === currentId);
    setMessages(s ? s.messages : []);
  }, [currentId, sessions]);

  useEffect(() => {
    if (!isGenerating) return;
    let rafId: number;
    const smoothScroll = () => {
      if (isAutoScrollEnabled.current && containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
      rafId = requestAnimationFrame(smoothScroll);
    };
    rafId = requestAnimationFrame(smoothScroll);
    return () => cancelAnimationFrame(rafId);
  }, [isGenerating]);

  const handleScroll = (e: any) => {
    const el = e.currentTarget;
    isAutoScrollEnabled.current = el.scrollHeight - el.scrollTop <= el.clientHeight + 100;
  };

  const createNewSession = () => {
    const s = { id: Date.now().toString(), title: 'New Chat', messages: [] };
    const next = [s, ...sessions];
    setSessions(next); setCurrentId(s.id); saveChats(next);
    if (window.innerWidth <= 900) setSidebarOpen(false);
  };

  const deleteSession = (id: string, e: any) => {
    e.stopPropagation();
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered); saveChats(filtered);
    if (currentId === id) setCurrentId(filtered[0]?.id || null);
  };

  const handleLoad = async () => {
    if (rt.isLoaded() || modelStatus === 'loading') return;
    setModelStatus('loading');
    try {
      await rt.loadModel('/models/gemma-4-E2B-it-web.task', { useWebGPU: true, maxTokens: 16384 });
      setModelStatus('ready');
    } catch (e) { setModelStatus('error'); }
  };

  const [systemPrompt] = useState('You are a helpful AI assistant. Always think step-by-step before answering.');

  const runInference = async (prompt: string | any[], messageId: string, seed?: number) => {
    setIsGenerating(true);
    isAutoScrollEnabled.current = true;
    const start = Date.now();
    // fullAcc is NOT used with += because partial is already accumulated
    let fullAcc = "";

    await rt.generate(prompt, (partial, done) => {
      fullAcc = partial; // partial is the FULL string so far
      let thought = "", answer = fullAcc, isThinkingNow = true;
      if (fullAcc.includes('<|channel>thought')) {
          const parts = fullAcc.split('<|channel>thought');
          if (parts[1]) {
              if (parts[1].includes('<channel|>')) {
                  const sub = parts[1].split('<channel|>');
                  thought = sub[0].trim(); answer = sub.slice(1).join('<channel|>').trim(); isThinkingNow = false;
              } else { thought = parts[1].trim(); answer = ""; }
          }
      } else isThinkingNow = false;

      setMessages(prev => {
        const next = [...prev];
        const msg = next.find(m => m.id === messageId);
        if (msg) {
          const ver = msg.versions[msg.currentVersion];
          ver.content = answer; ver.reasoning = thought; ver.isThinking = isThinkingNow;
          msg.isStreaming = !done;
        }
        return next;
      });

      if (done) {
        setIsGenerating(false);
        const dur = Math.max((Date.now() - start) / 1000, 0.1);
        setStats({ tps: Math.round((fullAcc.length / 4) / dur) });
        setSessions(prev => {
          const updated = prev.map(s => {
             if (s.id === currentId) {
                const msg = s.messages.find((m:any) => m.id === messageId);
                if (msg) {
                   const ver = msg.versions[msg.currentVersion];
                   ver.content = answer; ver.reasoning = thought; ver.reasonTime = Math.round(dur);
                   msg.isStreaming = false;
                }
             }
             return s;
          });
          saveChats(updated); return updated;
        });
      }
    }, seed);
  };

  const onSend = async (text: string) => {
    if (modelStatus !== 'ready' || isGenerating) return;
    
    const userMsg = { id: `u_${Date.now()}`, role: 'user', content: text, displayContent: text };
    const aiMsg = { 
        id: `a_${Date.now()}`, 
        role: 'assistant', 
        isStreaming: true, 
        currentVersion: 0, 
        versions: [{ content: '', reasoning: '', isThinking: enableThinking }] 
    };
    
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setSessions(prev => prev.map(s => s.id === currentId ? { 
        ...s, 
        messages: [...s.messages, userMsg, aiMsg] 
    } : s));

    let promptParts: any[] = [];
    let promptString = `<|turn>system\n${enableThinking ? '<|think|> ' : ''}${systemPrompt}${enableThinking ? '' : ' Answer directly.'}<turn|>\n`;
    const context = (sessions.find(s => s.id === currentId)?.messages || []).slice(-8);
    for (const m of context) {
       if (m.role === 'user') promptString += `<|turn>user\n${m.content}<turn|>\n`;
       else {
          const v = m.versions[m.currentVersion];
          if (v) promptString += `<|turn>model\n${v.content}<turn|>\n`;
       }
    }
    
    promptString += `<|turn>user\n`;

    const imageFiles = attachedFiles.filter(f => f.type === 'image');
    const textFiles = attachedFiles.filter(f => f.type === 'text');
    
    if (textFiles.length > 0) {
        promptString += "Attached files:\n";
        for (const f of textFiles) {
            promptString += `--- ${f.name} ---\n${f.content}\n\n`;
        }
    }
    
    promptString += text;

    if (imageFiles.length > 0) {
        promptParts.push(promptString);
        for (const f of imageFiles) {
            const img = new Image();
            img.src = f.url;
            await img.decode();
            promptParts.push({ imageSource: img });
        }
        promptParts.push(`<turn|>\n<|turn>model\n`);
    } else {
        promptString += `<turn|>\n<|turn>model\n`;
        promptParts.push(promptString);
    }

    setAttachedFiles([]);
    await runInference(promptParts.length === 1 && typeof promptParts[0] === 'string' ? promptParts[0] : promptParts, aiMsg.id, 42);
  };

  const onRegenerate = async (messageId: string, forceThinking: boolean) => {
    if (isGenerating) return;
    
    let userMsgContent = "";
    const msgIdx = messages.findIndex(m => m.id === messageId);
    if (msgIdx <= 0) return;
    const userMsg = messages[msgIdx - 1];
    userMsgContent = userMsg.content;

    const newVersion = { content: '', reasoning: '', isThinking: forceThinking };
    
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === currentId) {
          const nextMsgs = s.messages.map((m: any) => {
            if (m.id === messageId) {
              const updatedVersions = [...m.versions, newVersion];
              return { 
                ...m, 
                versions: updatedVersions, 
                currentVersion: updatedVersions.length - 1,
                isStreaming: true 
              };
            }
            return m;
          });
          return { ...s, messages: nextMsgs };
        }
        return s;
      });
      saveChats(updated);
      return updated;
    });

    let prompt = `<|turn>system\n${forceThinking ? '<|think|> ' : ''}${systemPrompt}${forceThinking ? '' : ' Answer directly.'}<turn|>\n`;
    const context = messages.slice(0, msgIdx - 1).slice(-6);
    for (const m of context) {
       if (m.role === 'user') prompt += `<|turn>user\n${m.content}<turn|>\n`;
       else {
          const v = m.versions[m.currentVersion];
          if (v) prompt += `<|turn>model\n${v.content}<turn|>\n`;
       }
    }
    prompt += `<|turn>user\n${userMsgContent}<turn|>\n<|turn>model\n`;
    await runInference(prompt, messageId, Math.floor(Math.random() * 1000000));
  };

  const onSwitchVersion = (messageId: string, newIdx: number) => {
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === currentId) {
          return {
            ...s,
            messages: s.messages.map((m: any) => m.id === messageId ? { ...m, currentVersion: newIdx } : m)
          };
        }
        return s;
      });
      saveChats(updated);
      return updated;
    });
  };

  return (
    <div className="app-container">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="zap-box"><Zap size={18} color="black" fill="black" /></div>
          <span className="logo-text">LiteRT Studio</span>
          <X size={20} onClick={() => setSidebarOpen(false)} className="mobile-only" style={{ marginLeft: 'auto', opacity: 0.5, cursor: 'pointer' }} />
        </div>
        <button onClick={createNewSession} className="new-chat-btn"><Plus size={18} /> New Chat</button>
        <div className="sessions-list">
          {sessions.map(s => (
            <div key={s.id} onClick={() => { setCurrentId(s.id); if(window.innerWidth <= 900) setSidebarOpen(false); }} className={`session-item ${s.id === currentId ? 'active' : ''}`}>
              <span className="session-title">{s.title}</span>
              <Trash2 size={14} className="delete-icon" onClick={(e) => deleteSession(s.id, e)} />
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="footer-row"><span>Hardware</span> <span>{rt.gpuInfo}</span></div>
          <div className="footer-row"><span>Inference</span> <span style={{ color: 'var(--apple-accent)' }}>{stats.tps} t/s</span></div>
          <button 
            onClick={toggleAPI} 
            className={`api-launch-btn ${apiActive ? 'active' : ''}`}
            disabled={modelStatus !== 'ready'}
          >
            {apiActive ? <Zap size={14} fill="currentColor" /> : <Plus size={14} />}
            {apiActive ? 'API Active' : 'Launch API'}
          </button>
        </div>
      </aside>

      <main className="main-chat" onClick={() => { if(window.innerWidth <= 900 && sidebarOpen) setSidebarOpen(false); }}>
        <header className="chat-header">
          {!sidebarOpen && <SidebarIcon size={22} onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }} style={{ cursor: 'pointer', color: '#8E8E93' }} />}
          <div className="ios-badge">{modelStatus === 'ready' ? 'WebGPU ⚡' : modelStatus.toUpperCase()}</div>
        </header>

        <div className="messages-container" ref={containerRef} onScroll={handleScroll}>
          {modelStatus === 'idle' && (
            <div className="full-overlay-loader">
              <Zap size={64} color="var(--apple-accent)" fill="var(--apple-accent)" style={{ marginBottom: '24px' }} />
              <h2>Local Node</h2>
              <p style={{ color: '#8E8E93', marginBottom: '32px' }}>Private & Fast WebGPU Intelligence.</p>
              <button onClick={handleLoad} className="apple-btn-large">Initialize Engine</button>
            </div>
          )}
          {modelStatus === 'ready' && messages.length === 0 && (
            <div className="model-loaded-hint">Model loaded</div>
          )}
          {messages.map((msg, idx) => {
            const isLastAssistant = msg.role === 'assistant' && 
              idx === messages.map(m => m.role).lastIndexOf('assistant');
            return (
              <MessageItem 
                key={msg.id} 
                msg={msg} 
                isLast={isLastAssistant}
                onRegenerate={onRegenerate} 
                onSwitchVersion={onSwitchVersion} 
              />
            );
          })}
        </div>

        <div className="input-wrapper">
          <ChatInput 
            onSend={onSend} 
            isGenerating={isGenerating} 
            disabled={modelStatus !== 'ready'} 
            attachedFiles={attachedFiles} 
            setAttachedFiles={setAttachedFiles}
            enableThinking={enableThinking}
            setEnableThinking={setEnableThinking}
          />
        </div>
      </main>
    </div>
  );
}
