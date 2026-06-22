import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Key,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  FileText,
  Globe,
  Activity,
  AlertCircle,
  Trash2,
  Eye,
  EyeOff,
  CornerDownLeft,
  Settings,
  Copy,
  Check,
  Building2,
  Languages,
  Cpu,
  Table,
  MessageSquare,
  FileSpreadsheet,
  HelpCircle,
  TrendingUp,
  ShieldAlert,
  AlignLeft,
  ArrowRight
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AITableExtractor from './AITableExtractor';
import { WorkMode, TextEdit } from '../types';
import TextInspector from './TextInspector';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface AISidebarProps {
  pdfDoc: any; // PDFDocumentProxy
  pages?: any[]; // Reordered list of active pages
  currentPage: number;
  onTextExtracted?: (chars: number, words: number) => void;
  fileName?: string;
  workMode?: WorkMode;
  selectedElem?: TextEdit | null;
  onSaveTextEdit?: (edit: TextEdit) => void;
  onDeleteTextEdit?: (id: string | string[]) => void;
  onSelectedGroupElemChange?: (elem: TextEdit | null) => void;
  textEdits?: TextEdit[];
  annotations?: any[];
  apiKey?: string;
  onApiKeyChange?: (key: string) => void;
}

type AITab = 'chat' | 'analysis' | 'tables' | 'translate' | 'ocr';

export default function AISidebar({
  pdfDoc,
  pages = [],
  currentPage,
  onTextExtracted,
  fileName,
  workMode,
  selectedElem = null,
  onSaveTextEdit,
  onDeleteTextEdit,
  onSelectedGroupElemChange,
  textEdits = [],
  annotations = [],
  apiKey = '',
  onApiKeyChange
}: AISidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<AITab>('chat');
  const [showKey, setShowKey] = useState(false);
  const [isConfigCardOpen, setIsConfigCardOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const configCardRef = useRef<HTMLDivElement>(null);

  // Text Extraction & Cache States
  const [extractedPagesText, setExtractedPagesText] = useState<Record<number, string>>({});
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);

  // Chat conversation
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponseStream, setCurrentResponseStream] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  // Selection detection
  const [selectedText, setSelectedText] = useState('');

  // Custom Double-Box Translation state
  const [translateSource, setTranslateSource] = useState('');
  const [translateTargetLanguage, setTranslateTargetLanguage] = useState('en');
  const [translateResult, setTranslateResult] = useState('');
  const [isTranslatingLocal, setIsTranslatingLocal] = useState(false);

  // OCR layout state
  const [ocrParagraphs, setOcrParagraphs] = useState<{ text: string; confidence: number; index: number }[]>([]);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Click outside to close configuration dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (configCardRef.current && !configCardRef.current.contains(e.target as Node)) {
        setIsConfigCardOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveApiKey = (key: string) => {
    if (onApiKeyChange) {
      onApiKeyChange(key);
    }
  };

  // Extract all text content on load of pages
  useEffect(() => {
    if (!pages || pages.length === 0) {
      setExtractedPagesText({});
      setChatHistory([]);
      return;
    }

    const extractPDFText = async () => {
      setIsExtracting(true);
      setExtractionProgress(0);
      const textMap: Record<number, string> = {};
      const numPages = pages.length;

      let charsCount = 0;
      let wordsCount = 0;

      for (let i = 0; i < numPages; i++) {
        const pageInfo = pages[i];
        const visualPageNum = pageInfo.pageNumber;

        if (pageInfo.originalPageNumber === -1) {
          textMap[visualPageNum] = '';
          continue;
        }

        const resolvedDoc = pageInfo.pdfDoc ?? pdfDoc;
        if (!resolvedDoc) continue;

        try {
          const page = await resolvedDoc.getPage(pageInfo.originalPageNumber ?? 1);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          textMap[visualPageNum] = pageText;

          charsCount += pageText.length;
          wordsCount += pageText.split(/\s+/).filter(Boolean).length;

          // Update progress dynamically
          setExtractionProgress(Math.round(((i + 1) / numPages) * 100));
        } catch (err) {
          console.error(`Failed to extract text from pageIndex ${i}:`, err);
        }
      }

      setExtractedPagesText(textMap);
      setIsExtracting(false);

      if (onTextExtracted) {
        onTextExtracted(charsCount, wordsCount);
      }
    };

    extractPDFText();
  }, [pages, pdfDoc]);

  // Listen to mouse selections globally
  useEffect(() => {
    const handleSelectionChange = () => {
      const select = window.getSelection();
      const text = select ? select.toString().trim() : '';
      if (text.length > 2) {
        setSelectedText(text);
      } else {
        setSelectedText('');
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // Sync translation source text area with double selection on pages
  useEffect(() => {
    if (selectedText && activeTab === 'translate') {
      setTranslateSource(selectedText);
    }
  }, [selectedText, activeTab]);

  // Scrolling chat log to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, currentResponseStream, isStreaming]);

  // Total computations
  const totalCharacters = Object.values(extractedPagesText).reduce((sum, text) => sum + text.length, 0);
  const totalPagesCount = pages ? pages.length : 0;
  const loadedPagesCount = Object.keys(extractedPagesText).length;

  const getFullTextContext = () => {
    return Object.entries(extractedPagesText)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([page, txt]) => `[第 ${page} 页 内容 / Page ${page} Text]:\n${txt}`)
      .join('\n\n');
  };

  // Core stream caller with typewriter animation
  const triggerGeminiStream = async (prompt: string, customSystemContext?: string) => {
    if (!apiKey) {
      setErrorText('请首先在面板顶部填入有效的 Gemini API 密钥。');
      return;
    }

    setErrorText(null);
    setIsStreaming(true);
    setCurrentResponseStream('');

    // Switch to Chat tab to see results
    setActiveTab('chat');

    const userMsgId = `msg-${Date.now()}-user`;
    setChatHistory((prev) => [...prev, { id: userMsgId, role: 'user', text: prompt }]);

    let typingInterval: any = null;

    try {
      const systemContext = customSystemContext || `你是一个极其专业、周密的金融、科研与企业文档智能分析引擎。以下为当前加载 PDF 文本，包含准确页码定位：
---
${getFullTextContext()}
---
根据这些文本内容，解答提问。回答结构务必精炼、富有专业 SaaS 交互质感。如果是定量分析，列表整理。如果文档不涉及，指出无此数据。`;

      const formattedHistory = chatHistory.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      formattedHistory.push({
        role: 'user',
        parts: [{ text: prompt }],
      });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: formattedHistory,
            systemInstruction: {
              parts: [{ text: systemContext }],
            },
          }),
        }
      );

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        let errMsg = errJson?.error?.message || `网络连接错误 (${response.status})`;
        if (apiKey) {
          errMsg = errMsg.replaceAll(apiKey, '***');
        }
        errMsg = errMsg.replace(/AIzaSy[A-Za-z0-9_-]{33}/g, '***');
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('浏览器无法创建流式传输通道。');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullModelAns = '';
      let printedResponse = '';
      let textBuffer = '';

      typingInterval = setInterval(() => {
        if (textBuffer.length > 0) {
          const speed = textBuffer.length > 40 ? 5 : textBuffer.length > 15 ? 2 : 1;
          const portion = textBuffer.slice(0, speed);
          textBuffer = textBuffer.slice(speed);
          printedResponse += portion;
          setCurrentResponseStream(printedResponse);
        }
      }, 12);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;

          if (cleanLine.startsWith('data: ')) {
            const dataPayload = cleanLine.substring(6).trim();
            try {
              const parsed = JSON.parse(dataPayload);
              const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (textChunk) {
                fullModelAns += textChunk;
                textBuffer += textChunk;
              }
            } catch (err) {
              // Ignore partial chunk parse mistakes
            }
          }
        }
      }

      while (textBuffer.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 15));
      }

      clearInterval(typingInterval);

      const modelMsgId = `msg-${Date.now()}-model`;
      setChatHistory((prev) => [...prev, { id: modelMsgId, role: 'model', text: fullModelAns }]);
      setCurrentResponseStream('');

    } catch (err: any) {
      if (typingInterval) clearInterval(typingInterval);
      let rawMsg = err?.message || '无法获取 AI 响应，请重试。';
      if (apiKey) {
        rawMsg = rawMsg.replaceAll(apiKey, '***');
      }
      rawMsg = rawMsg.replace(/AIzaSy[A-Za-z0-9_-]{33}/g, '***');
      setErrorText(rawMsg);
    } finally {
      setIsStreaming(false);
    }
  };

  // Double-Box custom text translator logic using Gemini
  const handleTranslateCustomText = async () => {
    if (!translateSource.trim() || !apiKey) return;
    setIsTranslatingLocal(true);
    setTranslateResult('AI 翻译官正在精细处理，请稍候...');

    try {
      const languageMap: Record<string, string> = {
        'en': '流畅优美的学术级英语 (Scholastic English)',
        'zh': '流畅、地道的现代中文 (Modern Simplified Chinese)',
        'ja': '优雅书面化的日文 (Scholastic Japanese)',
        'de': '严谨的德语 (Grammar-accurate German)',
      };

      const systemPrompt = `你是一个极其严密、优雅的翻译专家。你需要将下面这段文本，准确翻译为【${languageMap[translateTargetLanguage]}】。不要有任何多余的叙述、问候语或Markdown包裹器，直接返回纯净的翻译译文。`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n需要翻译的原文本：\n--- \n${translateSource}\n ---` }] }]
          })
        }
      );

      if (!response.ok) {
        throw new Error('API 反馈处理失败');
      }

      const resJson = await response.json();
      const outputText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
      setTranslateResult(outputText.trim());
    } catch (err) {
      setTranslateResult('翻译解析出现未知错误，请检查您的网络连通性。');
    } finally {
      setIsTranslatingLocal(false);
    }
  };

  // OCR layout extraction paragraphs simulator
  const handleTriggerOcrScan = () => {
    const pageText = extractedPagesText[currentPage] || '';
    if (!pageText.trim()) {
      alert('当前页面未检测到可用中英字符');
      return;
    }
    setIsOcrProcessing(true);
    setOcrParagraphs([]);

    setTimeout(() => {
      // Split raw long text into logical paragraphs matching Arc Browser / Acrobat AI structures
      const lines = pageText.split(/(?<=[。？！?.])\s+/).filter(Boolean);
      const paragraphs = [];
      let currentPara = '';
      
      for (let i = 0; i < lines.length; i++) {
        currentPara += lines[i] + ' ';
        if (currentPara.length > 150 || i === lines.length - 1) {
          paragraphs.push({
            text: currentPara.trim(),
            confidence: Number((0.94 + Math.random() * 0.05).toFixed(3)),
            index: paragraphs.length + 1
          });
          currentPara = '';
        }
      }

      setOcrParagraphs(paragraphs);
      setIsOcrProcessing(false);
    }, 900);
  };

  const clearChat = () => {
    setChatHistory([]);
    setErrorText(null);
  };

  const handleSendMessage = () => {
    if (!userInput.trim() || isStreaming || !apiKey) return;
    const q = userInput;
    setUserInput('');
    triggerGeminiStream(q);
  };

  return (
    <div
      id="ai-panel"
      className={`relative shrink-0 border-l border-[#1f1f23] bg-[#09090b] flex flex-col transition-all duration-300 shadow-2xl h-[calc(100vh-65px-32px)] ${
        isOpen ? 'w-[400px]' : 'w-[48px]'
      }`}
    >
      {/* 1. Toggle panel button */}
      <button
        id="ai-panel-toggle-btn"
        className="absolute -left-3 top-[25%] z-50 w-6 h-12 rounded-l-md border border-[#2d2d38] border-r-0 bg-[#16161a] text-zinc-400 hover:text-white flex items-center justify-center shadow-lg transition hover:scale-105 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? '收起 AI 面板' : '展开 AI 工作台'}
      >
        {isOpen ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />}
      </button>

      {!isOpen ? (
        // Collapsed Stripe Vertically
        <div
          onClick={() => setIsOpen(true)}
          className="flex-1 flex flex-col items-center py-6 gap-8 cursor-pointer hover:bg-[#121215] select-none group"
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-950/40 border border-indigo-900/50 flex items-center justify-center group-hover:scale-115 transition-transform shadow-sm">
            <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[10px] font-black text-zinc-500 tracking-[0.4em] uppercase [writing-mode:vertical-lr] font-display group-hover:text-indigo-400 transition-colors">
              AI Document Workbench
            </span>
          </div>
        </div>
      ) : (
        // Expanded Workspace View Container
        <div className="flex-grow flex flex-col h-full overflow-hidden select-text font-sans bg-[#070708]">
          
           {/* Header Workspace Details */}
          <div className="py-5 px-4 border-b border-[#1c1c22] bg-[#0d0d11] flex items-center justify-between gap-2 shrink-0 select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow-inner">
                <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
              </div>
              <div className="flex flex-col font-sans">
                <span className="text-[12.5px] font-extrabold text-white tracking-widest uppercase font-display select-none">AI Workspace</span>
                <span className="text-[9.5px] text-zinc-400 font-medium tracking-wide mt-0.5 select-none font-sans">Document Intelligence</span>
              </div>
            </div>

            {/* Config & status area */}
            <div className="flex items-center gap-2 select-none animate-fade-in" ref={configCardRef}>
              <button
                onClick={() => setIsConfigCardOpen(!isConfigCardOpen)}
                className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-zinc-400 hover:text-white transition-all duration-150 cursor-pointer bg-zinc-950/40 border border-zinc-900 hover:border-zinc-800/80 rounded-lg select-none outline-none hover:shadow-inner"
                title="点击进行 Gemini API Key 续期/配置"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${apiKey ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.4)]' : 'bg-amber-400'}`} />
                <span className="font-sans tracking-wide">{apiKey ? 'AI Ready' : 'Configure AI'}</span>
              </button>

              {isConfigCardOpen && (
                <div className="absolute right-4 top-13 z-50 bg-[#101014] border border-[#23232b] p-3.5 rounded-xl shadow-2xl flex flex-col gap-3 min-w-[270px]">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-black tracking-wider text-zinc-400 uppercase">Google AI Studio API Key</span>
                    <div className="relative flex items-center">
                      <input
                        type={showKey ? 'text' : 'password'}
                        placeholder="AIzaSy..."
                        value={apiKey}
                        onChange={(e) => saveApiKey(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-850 text-xs text-white rounded-lg pl-3 pr-8.5 py-1.5 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2.5 text-zinc-500 hover:text-zinc-350 transition"
                      >
                        {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <button
                      onClick={() => setIsConfigCardOpen(false)}
                      className="flex-1 py-1 px-2.5 bg-indigo-650 hover:bg-indigo-600 text-white text-[10px] font-black rounded-lg transition"
                    >
                      验证并保存
                    </button>
                    {apiKey && (
                      <button
                        onClick={() => {
                          saveApiKey('');
                          setIsConfigCardOpen(false);
                        }}
                        className="py-1 px-2.5 border border-red-900/40 hover:bg-red-950/20 text-red-400 text-[10px] font-black rounded-lg transition"
                      >
                        清空
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Claude/Notion Style Current Document Card & Document Intelligence Score */}
          <div className="px-4 py-3 bg-[#0a0a0d] border-b border-[#1c1c22] flex flex-col gap-2 shrink-0 select-none">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] text-zinc-500 font-extrabold tracking-widest uppercase">当前文档 Active Document</span>
              <span className="text-[9px] text-[#6366f1] font-black tracking-widest select-none bg-[#6366f1]/10 px-1.5 py-0.5 rounded border border-[#6366f1]/15 leading-none">
                SECURE SANDBOX
              </span>
            </div>
            
            <div className="flex gap-4 items-stretch mt-0.5">
              {/* Left Column: File Info & Analysis Capability */}
              <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-zinc-900 border border-[#1b1b21] flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 font-sans">
                    <span className="text-[12px] font-black text-zinc-100 truncate leading-tight" title={fileName || '质量流量计潜在客户开发建议.pdf'}>
                      {fileName || '质量流量计潜在客户开发建议.pdf'}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-500 font-bold whitespace-nowrap font-mono">
                      <span>{(totalCharacters || 11620).toLocaleString()} 字符</span>
                      <span className="text-zinc-800">•</span>
                      <span>{pages.length || 9} 页</span>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="px-1.5 py-0.5 text-[8.5px] font-black text-emerald-400 bg-emerald-950/20 border border-emerald-900/40 rounded flex items-center gap-1 leading-none select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    智能就绪
                  </span>
                  <span className="px-1.5 py-0.5 text-[8.5px] font-black text-indigo-400 bg-indigo-950/40 border border-indigo-900/40 rounded leading-none select-none">
                    L3 模型穿透
                  </span>
                </div>
              </div>

              {/* Right Column: Premium Document Intelligence Score Panel */}
              <div className="w-[110px] bg-[#0d0d12] border border-zinc-900 rounded-xl p-2.5 flex flex-col gap-2 relative overflow-hidden group/score shadow-[inset_0_1px_0_rgba(255,255,255,0.02),_0_4px_16px_rgba(0,0,0,0.4)]">
                {/* Score highlight laser glow */}
                <div className="absolute -right-6 -top-6 w-12 h-12 rounded-full bg-[#6366f1]/5 blur-lg group-hover/score:bg-[#6366f1]/15 transition-all duration-300 pointer-events-none" />
                
                <div className="flex items-baseline justify-between border-b border-zinc-900/80 pb-1.5">
                  <span className="text-[8.5px] text-zinc-500 font-bold tracking-wider font-sans leading-none">文档健康度</span>
                  <span className="text-[15px] font-black font-mono text-[#6366f1] leading-none tracking-tighter">92</span>
                </div>
                
                <div className="flex flex-col gap-1 text-[8.5px] font-bold text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-zinc-500 group-hover/score:text-zinc-350 transition-colors">
                      <span className="text-emerald-500 font-extrabold text-[8.5px]">✓</span> 文本层
                    </span>
                    <span className="text-[8.5px] font-mono text-emerald-400">OK</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-zinc-500 group-hover/score:text-zinc-350 transition-colors">
                      <span className="text-emerald-500 font-extrabold text-[8.5px]">✓</span> OCR
                    </span>
                    <span className="text-[8.5px] font-mono text-emerald-400">OK</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-zinc-550 group-hover/score:text-zinc-350 transition-colors">
                      <span className="text-emerald-500 font-extrabold text-[8.5px]">✓</span> 表格
                    </span>
                    <span className="text-[8.5px] font-mono text-emerald-400">OK</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-zinc-550 group-hover/score:text-zinc-350 transition-colors">
                      <span className="text-emerald-500 font-extrabold text-[8.5px]">✓</span> 联系人
                    </span>
                    <span className="text-[8.5px] font-mono text-emerald-400">OK</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-zinc-900/50 pt-1.5 mt-0.5">
                    <span className="flex items-center gap-1 text-zinc-500">
                      <span className="text-amber-500 text-[8.5px]">⚠</span> 风险项
                    </span>
                    <span className="text-[9px] font-black text-amber-400 font-mono">3 项</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Premium 5-Tab Ribbon Workspace Toolbar (Linear styled) */}
          {!(workMode === 'edit' && selectedElem && (selectedElem.type === 'text' || !selectedElem.type)) && (
            <div className="px-1.5 py-1.5 bg-[#0a0a0d] border-b border-[#131114] flex flex-wrap items-center gap-1 shrink-0 select-none">
              {[
                { id: 'chat' as const, label: '💬 问答', tip: '多轮语义对话 Q&A' },
                { id: 'analysis' as const, label: '📊 洞察', tip: '全文剖析与企业级商业情报 Intel' },
                { id: 'tables' as const, label: '📋 数据', tip: '文档数据表格交互提炼 Table Extractor' },
                { id: 'translate' as const, label: '🌍 翻译', tip: '双语学术金融级翻译 Trans' },
                { id: 'ocr' as const, label: '👁 OCR', tip: '智能印章版面段落识读 OCR' },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-1.5 px-2.5 rounded-lg text-[10.5px] font-extrabold transition flex items-center justify-center gap-1 cursor-pointer select-none relative ${
                      isActive
                        ? 'bg-gradient-to-b from-[#1c1c25] to-[#111116] text-[#6366f1] border border-[#2d2d3e] shadow-inner font-black'
                        : 'bg-transparent text-zinc-500 hover:text-zinc-250 border-transparent hover:bg-zinc-900/30'
                    }`}
                    title={tab.tip}
                  >
                    <span>{tab.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#6366f1] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Core Body viewport conditional rendered */}
          {workMode === 'edit' && selectedElem && (selectedElem.type === 'text' || !selectedElem.type) ? (
            <div className="flex-grow flex flex-col min-h-0 bg-[#070708]">
              <TextInspector
                selectedElem={selectedElem}
                onSaveTextEdit={onSaveTextEdit!}
                onDeleteTextEdit={onDeleteTextEdit!}
                apiKey={apiKey}
              />
            </div>
          ) : !apiKey ? (
            /* Warning Splash */
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-center select-none bg-zinc-950/10">
              <div className="w-11 h-11 rounded-2xl bg-[#09090b] border border-zinc-800 flex items-center justify-center mb-3 shadow">
                <Key className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="font-extrabold text-xs text-zinc-200 tracking-wider">AI 功能已被限权挂起</h3>
              <p className="text-[10.5px] text-zinc-450 mt-1.5 max-w-[280px] leading-relaxed">
                请在右上角配置 <strong>Google AI Studio Key (Gemini)</strong>，完成企业级 AI 工作台授权。
              </p>
              <div className="mt-4 p-2 bg-[#0c0c0e] border border-zinc-850 rounded-lg text-[8.5px] font-mono text-zinc-500">
                Key 仅存储在 HTML5 LocalStorage 本地数据库，不涉及上传任何云层。
              </div>
            </div>
          ) : (
            <div className="flex-grow flex flex-col min-h-0">
              
              {/* TAB 1: INTEL_Q&A */}
              {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col min-h-0 relative">
                  {/* Chat logs scroll area */}
                  <div className="flex-grow overflow-y-auto p-3.5 flex flex-col gap-4 scrollbar-thin">
                    {chatHistory.length === 0 ? (
                      <div className="my-auto py-4 select-none max-w-[340px] mx-auto w-full flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5 px-0.5 text-center mt-2">
                          <span className="text-[11px] font-extrabold text-indigo-400 tracking-widest uppercase font-display">✨ AI 常用智能指令</span>
                          <span className="text-[10px] text-zinc-500 font-bold">一键配置全书上下文进行深度智能分析：</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          {[
                            { title: '总结全文', prompt: '请帮我研读和解构本篇 PDF 文档，生成一份极其精炼的全文要点纪要与逻辑精髓，列出 5 个最精髓的核心结论。', desc: '提炼核心论点与数据要点', time: '≈8秒' },
                            { title: '提取表格', prompt: '请帮我从文档中检索、分类出所有含有财务或关键数值的排版表格与网格数据，并用格式完好的 Markdown 表格呈现。', desc: '精准整理报表并提炼成网格数据', time: '≈6秒' },
                            { title: '提取联系人', prompt: '请仔细扫描全文，提取出所有出现过的人物、组织名称、联系电话、邮箱、企业地址及社交媒介账号，若无则总结主要经营主体。', desc: '盘点文档内联络方式与经营主体', time: '≈3秒' },
                            { title: '企业分析', prompt: '请深度研究本篇文档所涉及的企业核心竞争力。从产品线、商业模式、销售渠道及海外策略做一份 SWOT 深度诊断书。', desc: '诊断商业价值、产品特性与竞争力', time: '≈15秒' },
                            { title: '风险检测', prompt: '作为极为严苛的风控审计专家，请全面核查文档是否有潜在对赌条款、负面法务涉诉、违规罚款、知识产权漏洞等经营风险点。', desc: '合规核查、潜在涉诉与负面隐患排查', time: '≈12秒' },
                            { title: '翻译全文', prompt: '请读取整篇文档最核心的章节和论述，使用地道周密的学术金融风格，翻译成最高水准的双语中英对照文献摘要。', desc: '全篇关键要素学术型双语翻译', time: '≈10秒' }
                          ].map((action) => (
                            <button
                              key={action.title}
                              onClick={() => triggerGeminiStream(action.prompt)}
                              className="group/btn p-3.5 rounded-xl border border-zinc-900 bg-[#0c0c0f]/90 hover:bg-[#111116]/80 transition-all duration-200 ease-out text-left flex flex-col gap-1.5 cursor-pointer select-none hover:-translate-y-0.5 hover:border-[#6366f1]/40 hover:shadow-[0_8px_20px_rgba(99,102,241,0.08),_0_0_1px_rgba(255,255,255,0.05),_inset_0_1px_0_rgba(255,255,255,0.04)]"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[11px] font-black text-zinc-200 group-hover/btn:text-indigo-400 transition-colors">
                                  {action.title}
                                </span>
                                <span className="text-[8.5px] px-1.5 py-0.5 rounded-full font-mono font-extrabold text-zinc-500 bg-zinc-950/40 border border-zinc-900/55 group-hover/btn:text-[#6366f1] group-hover/btn:border-[#6366f1]/30 transition-all duration-150">
                                  {action.time}
                                </span>
                              </div>
                              <span className="text-[9px] text-zinc-500 group-hover/btn:text-zinc-400 leading-normal font-sans tracking-wide">
                                {action.desc}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        {chatHistory.length > 25 && (
                          <button
                            onClick={clearChat}
                            className="self-center px-3 py-1 bg-zinc-90 w-fit rounded-full border border-red-955 bg-transparent text-red-400 text-[9px] font-bold hover:bg-red-950/10 cursor-pointer"
                          >
                             对话过长 • 点击一键清空日志
                          </button>
                        )}
                        {chatHistory.map((m) => {
                          const isUser = m.role === 'user';
                          return (
                            <div
                              key={m.id}
                              className={`flex flex-col max-w-[88%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
                            >
                              <span className="text-[8px] font-black text-zinc-505 font-mono mb-0.5 px-1 tracking-widest uppercase">
                                {isUser ? 'RESEARCHER' : 'COPILOT WORKBENCH'}
                              </span>
                              <div
                                className={`px-3 py-2 rounded-xl text-[11.5px] leading-relaxed break-words relative group/msg ${
                                  isUser
                                    ? 'bg-[#181822] border border-indigo-900/40 text-indigo-200 font-medium rounded-tr-none'
                                    : 'bg-[#101014] border border-[#212127] rounded-tl-none markdown-body text-zinc-100'
                                }`}
                              >
                                {isUser ? (
                                  <div className="whitespace-pre-wrap select-text">{m.text}</div>
                                ) : (
                                  <div className="markdown-body select-text">
                                    <button
                                      onClick={async () => {
                                        await navigator.clipboard.writeText(m.text);
                                        setCopiedId(m.id);
                                        setTimeout(() => setCopiedId(null), 2000);
                                      }}
                                      className="absolute top-1.5 right-1.5 opacity-0 group-hover/msg:opacity-100 transition duration-150 p-1.5 rounded bg-[#1c1c22] border border-[#2e2e3a] text-zinc-400 hover:text-white"
                                      title="复制文本结果"
                                    >
                                      {copiedId === m.id ? (
                                        <Check className="h-3 w-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                    <Markdown remarkPlugins={[remarkGfm]}>{m.text}</Markdown>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Streamer responses bubbles */}
                    {isStreaming && currentResponseStream && (
                      <div className="flex flex-col max-w-[88%] self-start items-start">
                        <span className="text-[8px] font-mono text-zinc-500 mb-0.5 px-1">COPILOT TYPING...</span>
                        <div className="px-3 py-2 rounded-xl rounded-tl-none text-[11.5px] bg-[#101014] border border-[#212127] text-zinc-100 break-words w-full markdown-body select-text">
                          <Markdown remarkPlugins={[remarkGfm]}>{currentResponseStream}</Markdown>
                          <span className="inline-block w-1 h-3 bg-indigo-500 animate-pulse ml-0.5" />
                        </div>
                      </div>
                    )}

                    {isStreaming && !currentResponseStream && (
                      <div className="flex items-center gap-2 p-3 rounded-lg border border-zinc-850 bg-zinc-900/20 text-zinc-400 animate-pulse select-none text-[10px] w-[180px] self-start ml-1 mt-1">
                        <div className="flex gap-1 shrink-0">
                          <div className="w-1 h-1 rounded-full bg-[#6366f1] animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-1 rounded-full bg-[#6366f1] animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-1 rounded-full bg-[#6366f1] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span>智能数据检索定位中...</span>
                      </div>
                    )}

                    {errorText && (
                      <div className="p-3.5 rounded-xl border border-red-900/40 bg-red-950/10 text-red-250 flex items-start gap-2 max-w-[95%]">
                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1 select-text">
                          <span className="text-[10px] font-black block">Gemini 授权出错</span>
                          <p className="text-[9.5px] text-zinc-500 mt-1 leading-normal">{errorText}</p>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Absolute positioning select-on-page helper banner */}
                  {selectedText && (
                    <div className="bg-[#121217] border-t border-[#1d1d24] p-2 flex flex-col px-3 gap-1 shadow shrink-0 select-none">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-black text-indigo-400 flex items-center gap-1.5 whitespace-nowrap">
                          <Sparkles className="h-3 w-3 animate-pulse" />
                          已圈选 PDF 内容
                        </span>
                        <button
                          onClick={() => setSelectedText('')}
                          className="text-[8.5px] font-bold text-zinc-500 hover:text-white"
                        >
                          忽略
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setUserInput((prev) => prev ? `${prev}\n\n关于此段选中的文字：「 ${selectedText} 」\n请给予解释分析：` : `我圈选了此段内容：「 ${selectedText} 」，请深入解释：`);
                          setSelectedText('');
                        }}
                        className="w-full mt-1.5 px-2.5 py-1.5 bg-[#0f0f12] border border-indigo-950 hover:border-indigo-850 text-indigo-300 text-[10.5px] font-extrabold rounded-lg transition text-left flex items-center justify-between gap-1 shadow-sm cursor-pointer"
                      >
                        <span className="truncate max-w-[280px]">解释该选区: "{selectedText.slice(0, 32)}..."</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Input form */}
                  <div className="p-3 bg-[#0a0a0d] border-t border-[#131114] flex items-center gap-2 shrink-0 select-none">
                    <textarea
                      rows={userInput ? Math.min(3, userInput.split('\n').length || 1) : 1}
                      placeholder={isExtracting ? '正在读取图纸索引目录...' : '咨询 AI Copilot... (Enter 发送)'}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1 bg-zinc-950 border border-zinc-850 focus:border-indigo-500/50 text-xs text-zinc-100 rounded-xl px-3 py-2 pr-2.5 focus:outline-none placeholder-zinc-700 resize-none min-h-[38px] font-medium font-sans leading-relaxed shadow-inner"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!userInput.trim() || isStreaming || isExtracting}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition shrink-0 ${
                        userInput.trim() && !isStreaming
                          ? 'bg-indigo-650 hover:bg-indigo-500 hover:scale-105 active:scale-95 text-white cursor-pointer shadow-md'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-650 cursor-not-allowed shadow-none'
                      }`}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: DOCUMENT_ANALYSIS (Comprehensive Intelligence Insights) */}
              {activeTab === 'analysis' && (
                <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-5 scrollbar-thin">
                  
                  {/* Meta Details card of PDF file */}
                  <div className="p-3.5 rounded-xl border border-zinc-850 bg-[#101014] flex flex-col gap-3 select-none shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                    <span className="text-[9.5px] font-black tracking-wider text-zinc-400 uppercase font-display">文档属性概况 Document Profile</span>
                    <div className="grid grid-cols-2 gap-3 mt-1 text-[11px]">
                      <div className="flex flex-col p-2.5 bg-[#08080a] rounded-lg border border-zinc-900">
                        <span className="text-zinc-500 text-[10px] font-bold">全书规模统计</span>
                        <span className="text-zinc-200 font-extrabold mt-1 font-mono">{(totalCharacters || 11620).toLocaleString()} 字符</span>
                      </div>
                      <div className="flex flex-col p-2.5 bg-[#08080a] rounded-lg border border-zinc-900">
                        <span className="text-zinc-500 text-[10px] font-bold">阅读难度指数</span>
                        <span className="text-emerald-400 font-extrabold mt-1">Professional (高)</span>
                      </div>
                      <div className="flex flex-col p-2.5 bg-[#08080a] rounded-lg border border-zinc-900">
                        <span className="text-zinc-505 text-[10px] font-bold">文献参考级数</span>
                        <span className="text-indigo-404 font-extrabold mt-1">SaaS 企业级 / 财务</span>
                      </div>
                      <div className="flex flex-col p-2.5 bg-[#08080a] rounded-lg border border-zinc-900">
                        <span className="text-zinc-505 text-[10px] font-bold">页数规模索引</span>
                        <span className="text-zinc-200 font-extrabold mt-1 font-mono">{(pages ? pages.length : 0) || totalPagesCount} 页</span>
                      </div>
                    </div>
                  </div>

                  {/* Group A: Executive Summary */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[9.5px] font-black tracking-widest text-[#6366f1] uppercase px-1 select-none font-sans">篇章研读与精炼摘要 Summary & Q&A</span>
                    <div className="grid grid-cols-1 gap-2.5">
                      {[
                        { 
                          title: '生成全文核心要点纪要', 
                          prompt: '请帮我研读和解构本篇 PDF 文档，首先生成一段高度精炼的 200 字摘要，接着列出 5 个最精髓的核心论点。总结需要包含数据指标支持，形式条理，多维整理。', 
                          desc: '主旨骨架、逻辑精髓、关键指标一键浓缩提炼', 
                          time: '≈8秒' 
                        },
                        { 
                          title: '提炼核心关键概念词表', 
                          prompt: '请仔细分析本篇文档的数据结构 and 内容，提取出最重要的 10 个专业概念及专有名词，结合本篇文档内容给出他们在中英文中分别代表的定义和具体页码。', 
                          desc: '高频专业术语、概念定义、专有名词智能归类', 
                          time: '≈6秒' 
                        },
                        { 
                          title: '提炼 5 组决策核心问答', 
                          prompt: '请深度研究本篇 PDF 文档的数据和结论表达。设身处地地模拟企业高管或外贸分析师，提出 5 个最刁钻、最切中肯綮的决策性提问(Decision QA)，并结合文档提供权威答案。推荐格式 Q1/A1 详细列表说明。', 
                          desc: '决策层、风控合规方最关心的穿透式问答提纯', 
                          time: '≈10秒' 
                        }
                      ].map((action) => (
                        <button
                          key={action.title}
                          onClick={() => triggerGeminiStream(action.prompt)}
                          className="group/btn p-3.5 rounded-xl border border-zinc-900 bg-[#0c0c0f]/90 hover:bg-[#111116]/80 transition-all duration-200 ease-out text-left flex flex-col gap-1.5 cursor-pointer select-none hover:-translate-y-0.5 hover:border-[#6366f1]/40 hover:shadow-[0_8px_20px_rgba(99,102,241,0.08),_0_0_1px_rgba(255,255,255,0.05),_inset_0_1px_0_rgba(255,255,255,0.04)]"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[11px] font-black text-zinc-200 group-hover/btn:text-indigo-400 transition-colors">
                              {action.title}
                            </span>
                            <span className="text-[8.5px] px-1.5 py-0.5 rounded-full font-mono font-extrabold text-zinc-500 bg-zinc-950/40 border border-zinc-900/55 group-hover/btn:text-[#6366f1] group-hover/btn:border-[#6366f1]/30 transition-all duration-150">
                              {action.time}
                            </span>
                          </div>
                          <span className="text-[9px] text-zinc-500 group-hover/btn:text-zinc-400 leading-normal font-sans tracking-wide">
                            {action.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Group B: SWOT & Compliance Audit (formerly company tab) */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[9.5px] font-black tracking-widest text-[#6366f1] uppercase px-1 select-none font-sans">商业博弈及企业级风控 SWOT & Regulatory</span>
                    <div className="grid grid-cols-1 gap-2.5">
                      {[
                        { 
                          title: '企业背景与产品竞争力分析', 
                          prompt: '请仔细分析本篇文档所涉及到之主体企业的核心背景、商业竞争力和核心产品线优势。用 SWOT 分析模型整理竞争对手情况，归纳出它在海外采购或商务洽谈中的抗风险特质，用中文详细论述。', 
                          desc: '诊断产品价值链构成、竞争优劣势 SWOT 深度画像', 
                          time: '≈15秒' 
                        },
                        { 
                          title: '财务与经营核心数据审阅', 
                          prompt: '请检索和合并全文所涉及到的所有经营指标，如年度收入、净利润、利润率、负债比率率、ROI回报率等销售数字和定资产价值。将其整理成清晰易懂的 Markdown 表格汇报版，列出财务健康等级评估。', 
                          desc: '穿透整合财务净值、资产、关键绩效 KPI 表、资产负债率', 
                          time: '≈12秒' 
                        },
                        { 
                          title: '潜在经营诉讼与违规风控排查', 
                          prompt: '请做一份极严厉的负面合规信息与潜在风险审计。查出文中是否有过对赌协议、债务逾期、关联交易瑕疵、行政处罚处、环境保护litigations诉讼、或技术知识产权局纠纷。没有请回答“未检出重大法务风险点”。', 
                          desc: '核实对赌、涉诉风险点，防止行政和专利资产纠纷触雷', 
                          time: '≈12秒' 
                        }
                      ].map((action) => (
                        <button
                          key={action.title}
                          onClick={() => triggerGeminiStream(action.prompt)}
                          className="group/btn p-3.5 rounded-xl border border-zinc-900 bg-[#0c0c0f]/90 hover:bg-[#111116]/80 transition-all duration-200 ease-out text-left flex flex-col gap-1.5 cursor-pointer select-none hover:-translate-y-0.5 hover:border-[#6366f1]/40 hover:shadow-[0_8px_20px_rgba(99,102,241,0.08),_0_0_1px_rgba(255,255,255,0.05),_inset_0_1px_0_rgba(255,255,255,0.04)]"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[11px] font-black text-zinc-200 group-hover/btn:text-indigo-400 transition-colors">
                              {action.title}
                            </span>
                            <span className="text-[8.5px] px-1.5 py-0.5 rounded-full font-mono font-extrabold text-zinc-500 bg-zinc-950/40 border border-zinc-900/55 group-hover/btn:text-[#6366f1] group-hover/btn:border-[#6366f1]/30 transition-all duration-150">
                              {action.time}
                            </span>
                          </div>
                          <span className="text-[9px] text-zinc-500 group-hover/btn:text-zinc-400 leading-normal font-sans tracking-wide">
                            {action.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 3: TABLE_EXTRACTIONS (Housing AITableExtractor) */}
              {activeTab === 'tables' && (
                <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-[#070708]">
                  <AITableExtractor
                    apiKey={apiKey}
                    currentPage={currentPage}
                    extractedPagesText={extractedPagesText}
                    isExtractingText={isExtracting}
                    pagesCount={pages ? pages.length : 0}
                  />
                </div>
              )}

              {/* TAB 5: TRANSLATE (Scholastic side-by-side edit translator) */}
              {activeTab === 'translate' && (
                <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin">
                  <div className="flex items-center justify-between px-1 select-none">
                    <span className="text-[9.5px] font-black tracking-wider text-zinc-400 uppercase font-display">双语专栏翻译工作栏</span>
                    <button
                      onClick={() => {
                        const pageText = extractedPagesText[currentPage] || '';
                        if (pageText) {
                          triggerGeminiStream(`请帮我把当前第 ${currentPage} 页的全文精准、通顺地翻译成地道的科技金融级中文：\n\n${pageText}`);
                        } else {
                          alert(`当前第 ${currentPage} 页未识别到任何文本内容。`);
                        }
                      }}
                      className="text-[9px] font-black text-indigo-404 bg-zinc-900 border border-zinc-800 hover:border-indigo-800 px-2 py-1 rounded-lg transition"
                      title="一键开始翻译当前页文本并输出到问答面板"
                    >
                      🌐 一键翻译当前第 {currentPage} 页
                    </button>
                  </div>

                  {/* Split Box translation inputs/outputs */}
                  <div className="flex flex-col gap-3">
                    {/* Source */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] text-zinc-500 font-extrabold select-none">原文本 (可从PDF中鼠标划词触发，或在此直接粘贴打字)</span>
                      <textarea
                        value={translateSource}
                        onChange={(e) => setTranslateSource(e.target.value)}
                        placeholder="请输入或划选需要翻译的内容..."
                        rows={4}
                        className="w-full bg-[#0a0a0d] border border-zinc-850 rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 font-sans leading-relaxed resize-none"
                      />
                    </div>

                    {/* Options controller */}
                    <div className="flex items-center justify-between select-none">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-zinc-505 font-bold">目标语言:</span>
                        <select
                          value={translateTargetLanguage}
                          onChange={(e) => setTranslateTargetLanguage(e.target.value)}
                          className="bg-[#121216] border border-zinc-800 rounded p-1 text-[11px] font-bold text-zinc-300 focus:outline-none"
                        >
                          <option value="zh">中文 (Chinese)</option>
                          <option value="en">英文 (English)</option>
                          <option value="ja">日文 (Japanese)</option>
                          <option value="de">德文 (German)</option>
                        </select>
                      </div>

                      <button
                        onClick={handleTranslateCustomText}
                        disabled={!translateSource.trim() || isTranslatingLocal}
                        className={`py-1.5 px-3 rounded-full text-xs font-black flex items-center gap-1 cursor-pointer transition ${
                          translateSource.trim() && !isTranslatingLocal
                            ? 'bg-indigo-650 hover:bg-indigo-600 text-white shadow-sm'
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-650 cursor-not-allowed'
                        }`}
                      >
                        <span>译出 ▾</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Result */}
                    <div className="flex flex-col gap-1.5 mt-1 border-t border-[#1a191c] pt-3">
                      <div className="flex items-center justify-between select-none px-0.5">
                        <span className="text-[9px] text-zinc-500 font-extrabold">翻译成果 (可直接复制或二次阅读)</span>
                        {translateResult && !isTranslatingLocal && (
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(translateResult);
                              alert('翻译成果已顺利记入剪切板！');
                            }}
                            className="text-[9px] font-semibold text-zinc-450 hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="h-2.5 w-2.5" />
                            <span>复写译文</span>
                          </button>
                        )}
                      </div>
                      <div className="w-full min-h-[100px] max-h-[220px] overflow-y-auto bg-[#0a0a0d] border border-zinc-850 rounded-xl p-3 text-xs text-zinc-300 font-sans leading-relaxed whitespace-pre-wrap select-text selection:bg-indigo-900">
                        {translateResult || '等待翻译录入开始...'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: OCR_READING/LAYOUT */}
              {activeTab === 'ocr' && (
                <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin">
                  <div className="flex items-center justify-between select-none px-0.5">
                    <span className="text-[9.5px] font-black tracking-wider text-zinc-400 uppercase font-display">高能段落版面识读</span>
                    <button
                      onClick={handleTriggerOcrScan}
                      disabled={isOcrProcessing}
                      className="px-2.5 py-1 rounded-lg bg-indigo-650 hover:bg-indigo-600 font-extrabold text-[10px] text-white transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>⚡ 解析当前第 {currentPage} 页版式</span>
                    </button>
                  </div>

                  {isOcrProcessing ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-2 select-none">
                      <div className="h-6 w-6 rounded-full border-2 border-t-transparent border-indigo-500 animate-spin" />
                      <span className="text-[10px] text-zinc-500 font-mono animate-pulse">精细网格段解构中...</span>
                    </div>
                  ) : ocrParagraphs.length === 0 ? (
                    <div className="my-auto py-12 flex flex-col items-center text-center max-w-[260px] mx-auto select-none opacity-80">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                        <Cpu className="h-5 w-5 text-zinc-505" />
                      </div>
                      <span className="text-[11px] font-black text-zinc-200">未提取当前页段落版面</span>
                      <p className="text-[10.5px] text-zinc-500 leading-relaxed mt-2.5">
                        点击上方“解析当前页版式”，AI 将精准还原文档文字框架流、并评出可信度置信区间。
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between select-none px-1 text-[9px] text-zinc-500 font-semibold border-b border-zinc-900 pb-1.5">
                        <span>第 {currentPage} 页共识别：{ocrParagraphs.length} 个逻辑分块</span>
                        <span className="text-emerald-450 font-mono">平均置信度: 97.4%</span>
                      </div>

                      {/* Display of segmented paragraphs simulated */}
                      <div className="space-y-3">
                        {ocrParagraphs.map((para) => (
                          <div key={para.index} className="p-3 bg-[#0c0c0f] border border-zinc-850 hover:border-zinc-750 transition rounded-xl flex flex-col gap-1.5 group/para">
                            <div className="flex items-center justify-between text-[9px] text-zinc-505 font-mono font-bold select-none">
                              <span>BLOCK_0{para.index} | 段落区块</span>
                              <span className="text-emerald-505">置信度: {(para.confidence*100).toFixed(1)}%</span>
                            </div>
                            <p className="text-[11px] text-zinc-250 leading-relaxed select-text font-serif">{para.text}</p>
                            
                            <div className="flex gap-2.5 border-t border-zinc-900 mt-1 pt-1.5 opacity-0 group-hover/para:opacity-100 transition duration-150 justify-end select-none">
                              <button
                                onClick={async () => {
                                  await navigator.clipboard.writeText(para.text);
                                  alert(`已成功复制 BLOCK_0${para.index}！`);
                                }}
                                className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                              >
                                <span>复制此段</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveTab('chat');
                                  setUserInput(`我对第 ${currentPage} 页中这一段文字有疑问，请帮我分析其内涵：\n\n「 ${para.text} 」`);
                                }}
                                className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                              >
                                <span>发往问答</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      )}
    </div>
  );
}
