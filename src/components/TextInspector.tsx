import React, { useState } from 'react';
import {
  Type,
  Sliders,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  Palette,
  Sparkles,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Check,
  Languages,
  Wand2,
  Minimize2,
  Settings
} from 'lucide-react';
import { TextEdit } from '../types';

interface TextInspectorProps {
  selectedElem: TextEdit;
  onSaveTextEdit: (edit: TextEdit) => void;
  onDeleteTextEdit: (id: string | string[]) => void;
  apiKey?: string;
}

export default function TextInspector({
  selectedElem,
  onSaveTextEdit,
  onDeleteTextEdit,
  apiKey
}: TextInspectorProps) {
  // Collapsible sections state
  const [advancedCollapsed, setAdvancedCollapsed] = useState(true);

  // AI-Specific states
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const getColorHex = (cValue: string) => {
    const map: Record<string, string> = {
      yellow: '#eab308',
      emerald: '#10b981',
      blue: '#3b82f6',
      red: '#ef4444',
      purple: '#a855f7',
      black: '#1e293b',
      white: '#ffffff',
    };
    return map[cValue] || cValue || '#1e293b';
  };

  // Safe wrapper to update styles
  const updateStyle = (props: Partial<TextEdit>) => {
    onSaveTextEdit({
      ...selectedElem,
      ...props,
    });
  };

  // Duplicate current text element
  const handleDuplicate = () => {
    const newId = `edit-clone-${Date.now()}`;
    const duplicated: TextEdit = {
      ...selectedElem,
      id: newId,
      x: selectedElem.x + 15,
      y: selectedElem.y + 15,
      isNew: true,
    };
    onSaveTextEdit(duplicated);
  };

  // Real AI text operations using direct Gemini stream/fetch API
  const handleAiAction = async (actionType: 'polish' | 'translate' | 'rewrite' | 'custom', optionValue?: string) => {
    if (!apiKey) {
      setAiError('请在顶部配置 Gemini API Key 会话密钥');
      return;
    }
    setAiError(null);
    setIsAiProcessing(true);

    try {
      let prompt = '';
      if (actionType === 'polish') {
        prompt = `对以下段落进行专业的语病纠正、通顺度润色、并提升其可读性。保持原意，使其更加精练优雅：\n\n「 ${selectedElem.text} 」`;
      } else if (actionType === 'translate') {
        const destLang = optionValue || 'English';
        prompt = `将以下文字准确翻译为【${destLang}】。要求行文自然地道，保持原意。切勿返回任何旁白、对白、引号或 markdown，直接输出翻译结果：\n\n「 ${selectedElem.text} 」`;
      } else if (actionType === 'rewrite') {
        const tone = optionValue || '商务正式';
        prompt = `对以下段落进行语气转换或重构。现在的预期语气是【${tone}】。请相应改写：\n\n「 ${selectedElem.text} 」`;
      } else if (actionType === 'custom') {
        if (!aiCustomPrompt.trim()) return;
        prompt = `根据用户指令对以下文本做高品质精修 and 适配改写：\n用户指令：${aiCustomPrompt}\n待加工文本：\n「 ${selectedElem.text} 」`;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API 响应异常 (${response.status})`);
      }

      const resJson = await response.json();
      const nextStr = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      if (nextStr) {
        // Apply instantly for real-time live preview
        updateStyle({ text: nextStr });
        if (actionType === 'custom') setAiCustomPrompt('');
      } else {
        throw new Error('未获得有效的 AI 改写序列结果');
      }
    } catch (err: any) {
      setAiError(err.message || 'AI 改写故障，请稍后再试');
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto scrollbar-thin pb-8 text-zinc-300">
      
      {/* 1. Header showing 'Edit Text' Task Mode */}
      <div className="flex flex-col px-4 py-3.5 bg-[#0d0d12] border-b border-[#23232b] select-none">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">当前任务</span>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5 text-white font-black text-sm">
            <Type className="h-4 w-4 text-indigo-400 font-bold" />
            <span>【编辑文本】</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold text-indigo-400 bg-indigo-950/40 border border-indigo-900/30">
            文本对象 #{selectedElem.id.includes('-') ? selectedElem.id.split('-').pop()?.substring(0, 4) : selectedElem.id.substring(0, 5)}
          </span>
        </div>
      </div>

      <div className="p-3.5 flex flex-col gap-3.5">
        
        {/* GROUP 1: TEXT CONTENT (文本内容) */}
        <div className="border border-zinc-900 rounded-xl bg-[#0c0c0f] p-3 flex flex-col gap-2">
          <span className="text-[10.5px] font-black text-zinc-300 flex items-center gap-1.5 select-none">
            <Type className="h-3.5 w-3.5 text-indigo-400" />
            文本内容
          </span>
          <textarea
            value={selectedElem.text || ''}
            onChange={(e) => updateStyle({ text: e.target.value })}
            rows={4}
            className="w-full bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-xs text-white rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-zinc-800 leading-relaxed font-sans"
            placeholder="输入您想呈现在 PDF 上的文字内容..."
          />
        </div>

        {/* GROUP 2: STYLING & TYPOGRAPHY (文字样式与排版) */}
        <div className="border border-zinc-900 rounded-xl bg-[#0c0c0f] p-3 flex flex-col gap-3.5">
          <span className="text-[10.5px] font-black text-zinc-300 flex items-center gap-1.5 select-none">
            <Sliders className="h-3.5 w-3.5 text-indigo-400" />
            文字样式设置
          </span>

          {/* Font Family Selection row */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9.5px] font-bold text-zinc-500 uppercase tracking-wide select-none">字体选择</label>
            <select
              value={selectedElem.fontFamily || ''}
              onChange={(e) => updateStyle({ fontFamily: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus:border-indigo-500/50 text-xs text-zinc-200 rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none select-none font-bold"
            >
              <option value="">默认原件字体 (嵌入)</option>
              <option value="system-ui, -apple-system, sans-serif">📂 系统黑体 (Sans)</option>
              <option value="Georgia, Cambria, 'Times New Roman', serif">📰 雅致宋体 (Serif)</option>
              <option value="'JetBrains Mono', 'Fira Code', monospace">💻 专业等宽 (Mono)</option>
              <option value="'KaiTi', 'Kaiti SC', 'STKaiti', cursive">✏️ 得体楷体 (KaiTi)</option>
            </select>
          </div>

          {/* Size & Formatting buttons */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9.5px] font-bold text-zinc-500 uppercase tracking-wide select-none">文字字号</label>
              <div className="flex items-center bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus-within:border-indigo-500/50 rounded-lg h-8 px-1">
                <button
                  type="button"
                  onClick={() => updateStyle({ fontSize: Math.max(5, (selectedElem.fontSize || 12) - 1) })}
                  className="w-5 h-5 rounded hover:bg-zinc-800 text-white font-mono font-bold text-xs flex items-center justify-center cursor-pointer select-none"
                >
                  -
                </button>
                <input
                  type="number"
                  value={selectedElem.fontSize || 12}
                  onChange={(e) => updateStyle({ fontSize: Math.max(4, Number(e.target.value)) })}
                  className="w-full min-w-0 bg-transparent text-center text-xs text-white font-bold font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => updateStyle({ fontSize: Math.min(128, (selectedElem.fontSize || 12) + 1) })}
                  className="w-5 h-5 rounded hover:bg-zinc-800 text-white font-mono font-bold text-xs flex items-center justify-center cursor-pointer select-none"
                >
                  +
                </button>
              </div>
            </div>

            {/* Font Style Shortcuts */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9.5px] font-bold text-zinc-500 uppercase tracking-wide select-none font-sans">快速排版</label>
              <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-900 h-8">
                <button
                  type="button"
                  onClick={() => updateStyle({ isBold: !selectedElem.isBold })}
                  className={`flex-1 h-6 rounded flex items-center justify-center transition cursor-pointer ${
                    selectedElem.isBold ? 'bg-indigo-600 text-white font-black shadow-sm' : 'text-zinc-550 hover:text-white'
                  }`}
                  title="加粗"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateStyle({ isItalic: !selectedElem.isItalic })}
                  className={`flex-1 h-6 rounded flex items-center justify-center transition cursor-pointer ${
                    selectedElem.isItalic ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-550 hover:text-white'
                  }`}
                  title="斜体"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateStyle({ isUnderline: !selectedElem.isUnderline })}
                  className={`flex-1 h-6 rounded flex items-center justify-center transition cursor-pointer ${
                    selectedElem.isUnderline ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-550 hover:text-white'
                  }`}
                  title="下划线"
                >
                  <Underline className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Letter Spacing & Alignment row */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Letter spacing */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9.5px] font-bold text-zinc-500 uppercase tracking-wide select-none">字间距</label>
              <select
                value={selectedElem.letterSpacing || 'normal'}
                onChange={(e) => updateStyle({ letterSpacing: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-900 text-xs text-zinc-300 rounded-lg px-1.5 py-1 cursor-pointer h-8 focus:outline-none font-bold"
              >
                <option value="normal">正常字距</option>
                <option value="-0.5px">紧凑 (-0.5px)</option>
                <option value="1.5px">稍微宽松 (+1.5px)</option>
                <option value="3px">宽阔间距 (+3.0px)</option>
              </select>
            </div>

            {/* Align */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9.5px] font-bold text-zinc-500 uppercase tracking-wide select-none">主干对齐</label>
              <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-900 h-8">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => updateStyle({ align: align })}
                    className={`flex-1 h-6 rounded flex items-center justify-center transition cursor-pointer ${
                      (selectedElem.align || 'left') === align ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-550 hover:text-white'
                    }`}
                    title={`${align === 'left' ? '左对齐' : align === 'center' ? '横向居中' : '右对齐'}`}
                  >
                    {align === 'left' && <AlignLeft className="h-3.5 w-3.5" />}
                    {align === 'center' && <AlignCenter className="h-3.5 w-3.5" />}
                    {align === 'right' && <AlignRight className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* GROUP 3: VISUAL COLOR FIELDS (前景色与底色遮罩) */}
        <div className="border border-zinc-900 rounded-xl bg-[#0c0c0f] p-3 flex flex-col gap-3">
          <span className="text-[10.5px] font-black text-zinc-300 flex items-center gap-1.5 select-none">
            <Palette className="h-3.5 w-3.5 text-indigo-400" />
            颜色外观
          </span>

          {/* Text Color Selection Grid */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9.5px] font-bold text-zinc-500 select-none">文字颜色</span>
            <div className="flex flex-wrap items-center gap-2">
              {['black', 'white', 'red', 'blue', 'emerald', 'purple', 'yellow'].map((col) => {
                const isSelected = selectedElem.color === col;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => updateStyle({ color: col })}
                    className={`w-6 h-6 rounded-full border transition hover:scale-110 flex items-center justify-center cursor-pointer ${
                      isSelected ? 'border-indigo-500 scale-105 shadow-[0_0_6px_rgba(99,102,241,0.4)]' : 'border-zinc-850 hover:border-zinc-650'
                    }`}
                    style={{ backgroundColor: getColorHex(col) }}
                    title={`文字色: ${col}`}
                  >
                    {isSelected && (
                      <Check className={`h-3 w-3 ${col === 'white' || col === 'yellow' ? 'text-black' : 'text-white'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Background Color Selection Grid */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9.5px] font-bold text-zinc-500 select-none">背景突出遮罩 (高亮底色)</span>
            <div className="flex flex-wrap items-center gap-2">
              {['transparent', 'yellow', 'emerald', 'blue', 'red', 'purple', 'black', 'white'].map((col) => {
                const isSelected = (selectedElem.bgColor || 'transparent') === col;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => updateStyle({ bgColor: col })}
                    className={`w-6 h-6 rounded-full border transition hover:scale-110 flex items-center justify-center cursor-pointer ${
                      col === 'transparent' ? 'border-dashed border-zinc-650 bg-transparent' : ''
                    } ${
                      isSelected ? 'border-indigo-500 scale-105 shadow-[0_0_6px_rgba(99,102,241,0.4)]' : 'border-zinc-850 hover:border-zinc-650'
                    }`}
                    style={{ backgroundColor: col === 'transparent' ? 'transparent' : getColorHex(col) }}
                    title={`背景遮罩: ${col}`}
                  >
                    {col === 'transparent' ? (
                      <span className="text-[8px] text-zinc-500">×</span>
                    ) : (
                      isSelected && (
                        <Check className={`h-3 w-3 ${col === 'white' || col === 'yellow' || col === 'transparent' ? 'text-black' : 'text-white'}`} />
                      )
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* GROUP 4: AI COPILOT SMART FEATURES (AI 增强 / AI改写) */}
        <div className="border border-indigo-950/40 rounded-xl bg-[#0d0d14]/70 p-3 flex flex-col gap-2.5 shadow-sm">
          <span className="text-[10.5px] font-black text-indigo-300 flex items-center gap-1.5 select-none">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
            AI 智能改写辅助
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={isAiProcessing}
              type="button"
              onClick={() => handleAiAction('polish')}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-900 hover:border-indigo-900/40 bg-zinc-950 text-zinc-300 text-[10px] font-bold text-left hover:text-indigo-400 transition cursor-pointer flex items-center gap-1.5"
              title="一键提高行文连贯性"
            >
              <Wand2 className="h-3 w-3 text-indigo-400 shrink-0" />
              <span>智能通顺润色</span>
            </button>
            <button
              disabled={isAiProcessing}
              type="button"
              onClick={() => handleAiAction('rewrite', '专业商务陈述')}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-900 hover:border-indigo-900/40 bg-zinc-950 text-zinc-300 text-[10px] font-bold text-left hover:text-indigo-400 transition cursor-pointer flex items-center gap-1.5"
              title="转为严谨商务言辞"
            >
              <Wand2 className="h-3 w-3 text-indigo-400 shrink-0" />
              <span>官方商务改写</span>
            </button>
            <button
              disabled={isAiProcessing}
              type="button"
              onClick={() => handleAiAction('translate', '英文')}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-900 hover:border-blue-900/40 bg-zinc-950 text-zinc-300 text-[10px] font-bold text-left hover:text-blue-400 transition cursor-pointer flex items-center gap-1.5"
              title="翻译到地道通用英文"
            >
              <Languages className="h-3 w-3 text-blue-400 shrink-0" />
              <span>一键翻译英文</span>
            </button>
            <button
              disabled={isAiProcessing}
              type="button"
              onClick={() => handleAiAction('translate', '中文')}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-900 hover:border-blue-900/40 bg-zinc-950 text-zinc-300 text-[10px] font-bold text-left hover:text-blue-400 transition cursor-pointer flex items-center gap-1.5"
              title="转换为本土中文"
            >
              <Languages className="h-3 w-3 text-blue-400 shrink-0" />
              <span>自动汉化处理</span>
            </button>
          </div>

          {/* Custom Instruction Box */}
          <div className="flex gap-1.5 mt-0.5">
            <input
              type="text"
              disabled={isAiProcessing}
              value={aiCustomPrompt}
              onChange={(e) => setAiCustomPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAiAction('custom');
                }
              }}
              placeholder="自定义润色指令: 如字数缩短50%、转为日文..."
              className="flex-1 bg-zinc-950 border border-zinc-900 hover:border-zinc-850 text-xs text-white rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-zinc-800"
            />
            <button
              disabled={isAiProcessing || !aiCustomPrompt.trim()}
              type="button"
              onClick={() => handleAiAction('custom')}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition shrink-0 ${
                aiCustomPrompt.trim() && !isAiProcessing
                  ? 'bg-indigo-650 hover:bg-indigo-500 text-white cursor-pointer'
                  : 'bg-zinc-900 border border-zinc-850 text-zinc-600 cursor-not-allowed'
              }`}
            >
              执行
            </button>
          </div>

          {/* AI Loader Indicators */}
          {isAiProcessing && (
            <div className="p-2 border border-indigo-900/50 bg-[#0d0d16] text-[10px] text-indigo-400 font-extrabold flex items-center gap-2 rounded-lg animate-pulse select-none">
              <div className="flex gap-0.5 shrink-0">
                <div className="w-1 h-3 bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-3 bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-3 bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>Gemini 专家正在为您精密重构...</span>
            </div>
          )}

          {/* Error message */}
          {aiError && (
            <div className="text-[9.5px] p-2 bg-red-950/20 border border-red-900/40 text-red-400 rounded-lg whitespace-pre-wrap leading-normal font-medium">
              <strong>改写故障: </strong> {aiError}
            </div>
          )}
        </div>

        {/* GROUP 5: ADVANCED COLLAPSIBLE PANEL (坐标、旋转、透明度与图层复制删除) */}
        <div className="border border-zinc-900 rounded-xl bg-[#0c0c0f] overflow-hidden">
          <button
            type="button"
            onClick={() => setAdvancedCollapsed(!advancedCollapsed)}
            className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-black text-zinc-400 hover:bg-zinc-900/40 transition select-none"
          >
            <span className="flex items-center gap-2">
              <Settings className="h-3.5 w-3.5 text-zinc-500" />
              <span>高级排版与图层设置</span>
            </span>
            {advancedCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />}
          </button>

          {!advancedCollapsed && (
            <div className="p-3 border-t border-zinc-900/60 bg-[#07070a]/50 flex flex-col gap-3">
              <span className="text-[9px] text-zinc-500 leading-normal mb-1">
                * 包含了元素级坐标指标、微调层、旋转角度和透明度滑块设置。
              </span>

              {/* Coordinates block */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                {/* X */}
                <div className="flex items-center bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus-within:border-indigo-500/50 rounded-lg px-2 py-1 transition">
                  <span className="text-[9.5px] font-black text-zinc-500 w-5">X</span>
                  <input
                    type="number"
                    value={Math.round(selectedElem.x ?? 0)}
                    onChange={(e) => updateStyle({ x: Number(e.target.value) })}
                    className="w-full bg-transparent text-xs text-white focus:outline-none text-right font-mono font-bold"
                    title="X 轴位置"
                  />
                  <span className="text-[9.5px] text-zinc-650 ml-0.5">px</span>
                </div>
                {/* Y */}
                <div className="flex items-center bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus-within:border-indigo-500/50 rounded-lg px-2 py-1 transition">
                  <span className="text-[9.5px] font-black text-zinc-500 w-5">Y</span>
                  <input
                    type="number"
                    value={Math.round(selectedElem.y ?? 0)}
                    onChange={(e) => updateStyle({ y: Number(e.target.value) })}
                    className="w-full bg-transparent text-xs text-white focus:outline-none text-right font-mono font-bold"
                    title="Y 轴位置"
                  />
                  <span className="text-[9.5px] text-zinc-650 ml-0.5">px</span>
                </div>
                {/* Width */}
                <div className="flex items-center bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus-within:border-indigo-500/50 rounded-lg px-2 py-1 transition">
                  <span className="text-[9.5px] font-black text-zinc-500 w-5">W</span>
                  <input
                    type="number"
                    value={Math.round(selectedElem.width || 0)}
                    onChange={(e) => updateStyle({ width: Number(e.target.value) })}
                    className="w-full bg-transparent text-xs text-white focus:outline-none text-right font-mono font-bold"
                    title="容器宽度"
                  />
                  <span className="text-[9.5px] text-zinc-650 ml-0.5">px</span>
                </div>
                {/* Height */}
                <div className="flex items-center bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus-within:border-indigo-500/50 rounded-lg px-2 py-1 transition">
                  <span className="text-[9.5px] font-black text-zinc-500 w-5">H</span>
                  <input
                    type="number"
                    value={Math.round(selectedElem.height || 0)}
                    onChange={(e) => updateStyle({ height: Number(e.target.value) })}
                    className="w-full bg-transparent text-xs text-white focus:outline-none text-right font-mono font-bold"
                    title="容器高度"
                  />
                  <span className="text-[9.5px] text-zinc-650 ml-0.5">px</span>
                </div>
                {/* Rotation */}
                <div className="flex items-center bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus-within:border-indigo-500/50 rounded-lg px-2 py-1 transition">
                  <span className="text-[9.5px] font-black text-zinc-500 w-7">旋转</span>
                  <input
                    type="number"
                    value={selectedElem.rotation || 0}
                    onChange={(e) => updateStyle({ rotation: Number(e.target.value) })}
                    className="w-full bg-transparent text-xs text-white focus:outline-none text-right font-mono font-bold"
                    title="绝对旋转度"
                  />
                  <span className="text-[9px] text-zinc-500 ml-0.5">°</span>
                </div>
                {/* Opacity */}
                <div className="flex items-center bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus-within:border-indigo-500/50 rounded-lg px-2 py-1 transition">
                  <span className="text-[9.5px] font-black text-zinc-500 w-7">不透明</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={Math.round((selectedElem.opacity !== undefined ? selectedElem.opacity : 1) * 100)}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value)));
                      updateStyle({ opacity: val / 100 });
                    }}
                    className="w-full bg-transparent text-xs text-white focus:outline-none text-right font-mono font-bold"
                    title="透明层"
                  />
                  <span className="text-[9px] text-zinc-500 ml-0.5">%</span>
                </div>
              </div>

              {/* Slider for Opacity */}
              <div className="flex flex-col gap-1 mt-1">
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={selectedElem.opacity !== undefined ? selectedElem.opacity : 1}
                  onChange={(e) => updateStyle({ opacity: Number(e.target.value) })}
                  className="w-full accent-indigo-500 bg-zinc-950 rounded-lg cursor-pointer h-1 border-none focus:outline-none"
                  title="调节不透明度"
                />
              </div>

              {/* Element actions duplicated inside advanced settings too */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleDuplicate}
                  className="px-2.5 py-1.5 border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-zinc-300 rounded-lg hover:text-white hover:bg-zinc-900 transition flex items-center justify-center gap-1 text-[10px] font-bold cursor-pointer select-none"
                >
                  <Copy className="h-3 w-3 text-zinc-500" />
                  <span>克隆复制元素</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteTextEdit(selectedElem.id)}
                  className="px-2.5 py-1.5 border border-red-950/40 hover:bg-red-950/10 text-red-400 hover:text-red-300 transition flex items-center justify-center gap-1 text-[10px] font-bold cursor-pointer select-none"
                >
                  <Trash2 className="h-3 w-3 text-red-500/70" />
                  <span>彻底移出删除</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom layer action shortcuts (Always accessible duplicate & delete buttons so the user has visual access without folding Advanced settings) */}
        {advancedCollapsed && (
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={handleDuplicate}
              className="flex-1 py-1.5 border border-zinc-850 hover:border-zinc-750 bg-zinc-950 text-zinc-400 hover:text-zinc-200 text-[10.5px] font-bold rounded-lg transition flex items-center justify-center gap-1 text-center select-none"
              title="快速复制此文本图元"
            >
              <Copy className="h-3 w-3" />
              <span>克隆副本</span>
            </button>
            <button
              type="button"
              onClick={() => onDeleteTextEdit(selectedElem.id)}
              className="flex-1 py-1.5 border border-red-950/20 bg-red-950/5 hover:bg-red-950/10 text-red-400/80 hover:text-red-400 text-[10.5px] font-bold rounded-lg transition flex items-center justify-center gap-1 text-center select-none"
              title="一键移除文字元素"
            >
              <Trash2 className="h-3 w-3" />
              <span>删除本段</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
