import React, { useState } from 'react';
import {
  X,
  Settings2,
  Trash2,
  FileText,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Info,
  Check,
  Layout,
  Plus
} from 'lucide-react';
import { PDFPageInfo, TextEdit } from '../types';

interface PDFHeaderFooterManagerProps {
  isOpen: boolean;
  onClose: () => void;
  totalPages: number;
  pages: PDFPageInfo[];
  textEdits: TextEdit[];
  onUpdateTextEdits: (edits: TextEdit[]) => void;
  fileName: string;
}

export default function PDFHeaderFooterManager({
  isOpen,
  onClose,
  totalPages,
  pages,
  textEdits,
  onUpdateTextEdits,
  fileName
}: PDFHeaderFooterManagerProps) {
  // Toggle switches
  const [enableHeader, setEnableHeader] = useState(false);
  const [enableFooter, setEnableFooter] = useState(true);

  // Template inputs
  const [headerText, setHeaderText] = useState('[文件名]');
  const [footerText, setFooterText] = useState('第 [页码] 页 / 共 [总页数] 页');

  // Alignment
  const [headerAlign, setHeaderAlign] = useState<'left' | 'center' | 'right'>('center');
  const [footerAlign, setFooterAlign] = useState<'left' | 'center' | 'right'>('center');

  // Margins & styling
  const [fontSize, setFontSize] = useState<number>(10);
  const [textColor, setTextColor] = useState<string>('black');
  const [headerMarginY, setHeaderMarginY] = useState<number>(36); // standard pt margin
  const [footerMarginY, setFooterMarginY] = useState<number>(36); // standard pt margin
  const [edgeMarginX, setEdgeMarginX] = useState<number>(45); // standard horizontal margin for left/right

  // Target page ranges selection
  const [pageSelection, setPageSelection] = useState<'all' | 'odd' | 'even' | 'range'>('all');
  const [customRangeString, setCustomRangeString] = useState('');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  // Success indicator states
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Colors mapping matching the toolbar
  const colors = [
    { id: 'black', name: '经典碳黑', hex: '#1e293b' },
    { id: 'blue', name: '科研宝蓝', hex: '#3b82f6' },
    { id: 'emerald', name: '极光暖绿', hex: '#10b981' },
    { id: 'red', name: '警告鲜红', hex: '#ef4444' },
    { id: 'purple', name: '科学紫色', hex: '#a855f7' },
  ];

  // Helper inside range selector
  const parseRange = (rangeStr: string, total: number): number[] => {
    const list: number[] = [];
    if (!rangeStr.trim()) return list;

    // Split by commas or Chinese commas
    const parts = rangeStr.replace(/，/g, ',').split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (/^\d+$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        if (num >= 1 && num <= total) {
          list.push(num);
        }
      } else if (/^\d+\s*-\s*\d+$/.test(trimmed)) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr.trim(), 10);
        const end = parseInt(endStr.trim(), 10);
        if (start > 0 && end <= total && start <= end) {
          for (let i = start; i <= end; i++) {
            list.push(i);
          }
        }
      }
    }
    return Array.from(new Set(list)).sort((a, b) => a - b);
  };

  const cleanFileName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'document';

  // Apply Macro replacements
  const formatMacroText = (template: string, pageNum: number, total: number) => {
    let result = template;
    // Handle Chinese tags
    result = result.replace(/\[页码\]/g, String(pageNum));
    result = result.replace(/\[总页数\]/g, String(total));
    result = result.replace(/\[文件名\]/g, cleanFileName);

    // Handle standard dual-brace curly tags
    result = result.replace(/\{\{page\}\}/g, String(pageNum));
    result = result.replace(/\{\{total\}\}/g, String(total));
    result = result.replace(/\{\{file\}\}/g, cleanFileName);

    return result;
  };

  // 1. One-click Batch Application
  const handleApplyBatch = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!enableHeader && !enableFooter) {
      setErrorMessage('请至少开启“应用页眉”或“应用页脚”之一。');
      return;
    }

    // Determine target page list
    let targetPages: number[] = [];
    if (pageSelection === 'all') {
      targetPages = Array.from({ length: totalPages }, (_, idx) => idx + 1);
    } else if (pageSelection === 'odd') {
      targetPages = Array.from({ length: totalPages }, (_, idx) => idx + 1).filter(p => p % 2 !== 0);
    } else if (pageSelection === 'even') {
      targetPages = Array.from({ length: totalPages }, (_, idx) => idx + 1).filter(p => p % 2 === 0);
    } else if (pageSelection === 'range') {
      targetPages = parseRange(customRangeString, totalPages);
      if (targetPages.length === 0) {
        setErrorMessage('请输入合法的自定义页面范围，例如: 1-3, 5, 8-10');
        return;
      }
    }

    // Filter out existing headers/footers of the selected types from the selected pages
    // So if header is enabled, we delete header on target pages; if footer, we delete footer.
    const finalEdits = textEdits.filter(edit => {
      const isTargetPage = targetPages.includes(edit.pageNumber);
      if (isTargetPage && edit.isHeaderFooter) {
        if (enableHeader && edit.headerFooterType === 'header') return false;
        if (enableFooter && edit.headerFooterType === 'footer') return false;
      }
      return true;
    });

    const newGeneratedEdits: TextEdit[] = [];

    for (const pageNum of targetPages) {
      const pageInfo = pages.find(p => p.pageNumber === pageNum);
      if (!pageInfo) continue;

      const pageWidth = pageInfo.width;
      const pageHeight = pageInfo.height;

      // Draw Header
      if (enableHeader && headerText.trim()) {
        const textToDraw = formatMacroText(headerText, pageNum, totalPages);
        // Estimate width in points: chars length * size * average horizontal width factor
        const estimatedWidth = textToDraw.length * fontSize * 0.55;

        let posX = edgeMarginX;
        if (headerAlign === 'center') {
          posX = (pageWidth - estimatedWidth) / 2;
        } else if (headerAlign === 'right') {
          posX = pageWidth - edgeMarginX - estimatedWidth;
        }

        const posY = pageHeight - headerMarginY;

        newGeneratedEdits.push({
          id: `header-batch-${pageNum}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          pageNumber: pageNum,
          type: 'text',
          text: textToDraw,
          originalText: '',
          x: posX,
          y: posY,
          width: estimatedWidth,
          height: fontSize * 1.2,
          fontSize: fontSize,
          color: textColor,
          isNew: true,
          isHeaderFooter: true,
          headerFooterType: 'header',
          align: headerAlign,
          isBold,
          isItalic
        });
      }

      // Draw Footer
      if (enableFooter && footerText.trim()) {
        const textToDraw = formatMacroText(footerText, pageNum, totalPages);
        const estimatedWidth = textToDraw.length * fontSize * 0.55;

        let posX = edgeMarginX;
        if (footerAlign === 'center') {
          posX = (pageWidth - estimatedWidth) / 2;
        } else if (footerAlign === 'right') {
          posX = pageWidth - edgeMarginX - estimatedWidth;
        }

        const posY = footerMarginY;

        newGeneratedEdits.push({
          id: `footer-batch-${pageNum}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          pageNumber: pageNum,
          type: 'text',
          text: textToDraw,
          originalText: '',
          x: posX,
          y: posY,
          width: estimatedWidth,
          height: fontSize * 1.2,
          fontSize: fontSize,
          color: textColor,
          isNew: true,
          isHeaderFooter: true,
          headerFooterType: 'footer',
          align: footerAlign,
          isBold,
          isItalic
        });
      }
    }

    onUpdateTextEdits([...finalEdits, ...newGeneratedEdits]);
    setSuccessMessage(`成功在 ${targetPages.length} 个页面上批量生成并应用了页眉页脚。可以直接通过右侧预览和“保存导出”预览最终PDF效果！`);
  };

  // 2. Delete All headers/footers globally
  const handleDeleteAll = (type: 'all' | 'header' | 'footer') => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const filtered = textEdits.filter(edit => {
      if (!edit.isHeaderFooter) return true;
      if (type === 'all') return false;
      if (type === 'header' && edit.headerFooterType === 'header') return false;
      if (type === 'footer' && edit.headerFooterType === 'footer') return false;
      return true;
    });

    onUpdateTextEdits(filtered);
    const label = type === 'all' ? '全部页眉页脚' : type === 'header' ? '批量页眉' : '批量页脚';
    setSuccessMessage(`已成功从全文中批量移除所有的 ${label}。`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 select-none animate-fadeIn">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Title Bar */}
        <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 text-blue-600 p-2 rounded-xl border border-blue-100 flex items-center justify-center">
              <Layout className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 font-sans tracking-tight">
                批量添加页眉页脚工具
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                支持全文、单双页或自定义页面范围的一键智能排版与生成
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 px-1.5 rounded-lg hover:bg-zinc-250 hover:text-zinc-800 text-zinc-400 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Inner Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Status logs block */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 animate-none">
              <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-[11px] font-bold leading-normal">{successMessage}</div>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 animate-none">
              <Info className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-[11px] font-bold leading-normal">{errorMessage}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Column Left: Header Setup */}
            <div className={`p-4 rounded-xl border transition ${enableHeader ? 'bg-blue-50/10 border-blue-200' : 'bg-zinc-50/50 border-zinc-200'}`}>
              <div className="flex items-center justify-between mb-3 border-b border-zinc-100 pb-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableHeader}
                    onChange={(e) => setEnableHeader(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-black text-zinc-850">1. 应用页眉 (Header)</span>
                </label>
                {enableHeader && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black">
                    已启用
                  </span>
                )}
              </div>

              <div className="space-y-3.5" style={{ pointerEvents: enableHeader ? 'auto' : 'none', opacity: enableHeader ? 1 : 0.4 }}>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-zinc-500 font-bold">页眉内容</span>
                    <span className="text-[9px] text-zinc-400">可用宏标签在下方说明</span>
                  </div>
                  <input
                    type="text"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-zinc-250 focus:border-blue-400 focus:outline-none rounded-lg text-zinc-800 font-medium"
                    placeholder="请输入页眉内容..."
                  />
                </div>

                <div>
                  <span className="text-[11px] text-zinc-500 font-bold block mb-1">页眉对齐方式</span>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'left', icon: AlignLeft, label: '靠左' },
                      { id: 'center', icon: AlignCenter, label: '居中' },
                      { id: 'right', icon: AlignRight, label: '靠右' }
                    ].map(alignItem => {
                      const Icon = alignItem.icon;
                      const isSelected = headerAlign === alignItem.id;
                      return (
                        <button
                          key={alignItem.id}
                          type="button"
                          onClick={() => setHeaderAlign(alignItem.id as any)}
                          className={`py-1 px-1.5 border text-[10px] rounded flex items-center justify-center gap-1 transition font-bold ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-650'
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          <span>{alignItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-zinc-500 font-bold mb-1">
                    <span>边缘安全距离 (页顶 MarginY)</span>
                    <span className="text-zinc-700 font-black">{headerMarginY} pt</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="100"
                    step="5"
                    value={headerMarginY}
                    onChange={(e) => setHeaderMarginY(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Column Right: Footer Setup */}
            <div className={`p-4 rounded-xl border transition ${enableFooter ? 'bg-blue-50/10 border-blue-200' : 'bg-zinc-50/50 border-zinc-200'}`}>
              <div className="flex items-center justify-between mb-3 border-b border-zinc-100 pb-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableFooter}
                    onChange={(e) => setEnableFooter(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-black text-zinc-850">2. 应用页脚 (Footer)</span>
                </label>
                {enableFooter && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black">
                    已启用
                  </span>
                )}
              </div>

              <div className="space-y-3.5" style={{ pointerEvents: enableFooter ? 'auto' : 'none', opacity: enableFooter ? 1 : 0.4 }}>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-zinc-500 font-bold">页脚内容</span>
                    <span className="text-[9px] text-zinc-400">支持灵活排布</span>
                  </div>
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-zinc-250 focus:border-blue-400 focus:outline-none rounded-lg text-zinc-800 font-medium"
                    placeholder="请输入页脚内容..."
                  />
                </div>

                <div>
                  <span className="text-[11px] text-zinc-500 font-bold block mb-1">页脚对齐方式</span>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'left', icon: AlignLeft, label: '靠左' },
                      { id: 'center', icon: AlignCenter, label: '居中' },
                      { id: 'right', icon: AlignRight, label: '靠右' }
                    ].map(alignItem => {
                      const Icon = alignItem.icon;
                      const isSelected = footerAlign === alignItem.id;
                      return (
                        <button
                          key={alignItem.id}
                          type="button"
                          onClick={() => setFooterAlign(alignItem.id as any)}
                          className={`py-1 px-1.5 border text-[10px] rounded flex items-center justify-center gap-1 transition font-bold ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-650'
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          <span>{alignItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-zinc-500 font-bold mb-1">
                    <span>边缘安全距离 (页底 MarginY)</span>
                    <span className="text-zinc-700 font-black">{footerMarginY} pt</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="100"
                    step="5"
                    value={footerMarginY}
                    onChange={(e) => setFooterMarginY(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Core styling options of elements */}
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-4">
            <span className="text-xs font-black text-zinc-800 block border-b border-zinc-200 pb-1.5">
              3. 个性化排版与样式偏好 (Styling & Geometry)
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Text Size opt */}
              <div>
                <span className="text-[11px] text-zinc-500 font-bold block mb-1">字体大小</span>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full bg-white border border-zinc-250 text-xs px-2 py-1.5 rounded-lg text-zinc-800 focus:outline-none focus:border-blue-400"
                >
                  {[8, 9, 10, 11, 12, 14, 16].map(sz => (
                    <option key={sz} value={sz}>{sz} pt</option>
                  ))}
                </select>
              </div>

              {/* Text Color palette */}
              <div>
                <span className="text-[11px] text-zinc-500 font-bold block mb-1">文本颜色</span>
                <select
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-full bg-white border border-zinc-250 text-xs px-2 py-1.5 rounded-lg text-zinc-800 focus:outline-none focus:border-blue-400"
                >
                  {colors.map(col => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>

              {/* Edge Margin X */}
              <div>
                <div className="flex justify-between text-[11px] text-zinc-500 font-bold mb-1">
                  <span>双翼进深 (两端边距)</span>
                </div>
                <input
                  type="number"
                  value={edgeMarginX}
                  onChange={(e) => setEdgeMarginX(Math.max(10, Math.min(200, Number(e.target.value) || 30)))}
                  className="w-full bg-white border border-zinc-250 text-xs px-2 py-1 rounded-lg text-zinc-800 focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Fonts Decorators */}
              <div>
                <span className="text-[11px] text-zinc-500 font-bold block mb-1">字体特效</span>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsBold(!isBold)}
                    className={`flex-1 py-1 px-2 border text-xs font-bold rounded-lg transition ${
                      isBold ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-zinc-250 hover:bg-zinc-100 text-zinc-650'
                    }`}
                  >
                    粗体
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsItalic(!isItalic)}
                    className={`flex-1 py-1 px-2 border text-xs font-bold rounded-lg transition ${
                      isItalic ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-zinc-250 hover:bg-zinc-100 text-zinc-650'
                    }`}
                  >
                    斜体
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Targets Range filter Setup */}
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 gap-3.5 space-y-3.5">
            <span className="text-xs font-black text-zinc-800 block border-b border-zinc-200 pb-1.5">
              4. 决定执行的目标页面范围 (Target Range Filters)
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'all', label: '所有页面' },
                { id: 'odd', label: '仅奇数页码' },
                { id: 'even', label: '仅偶数页码' },
                { id: 'range', label: '自定义页面范围' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPageSelection(opt.id as any)}
                  className={`py-2 px-1 rounded-lg border text-[11px] font-bold text-center transition cursor-pointer ${
                    pageSelection === opt.id
                      ? 'bg-blue-650 text-white border-blue-650 shadow-sm'
                      : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-650'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {pageSelection === 'range' && (
              <div className="pt-2 animate-none">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-zinc-500 font-bold">输入自定义页面 (总页数：{totalPages}页)</span>
                  <span className="text-[10px] text-zinc-400">例如: 1-3, 5, 7, 9-11</span>
                </div>
                <input
                  type="text"
                  value={customRangeString}
                  onChange={(e) => setCustomRangeString(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-zinc-250 focus:border-blue-400 focus:outline-none rounded-lg text-zinc-800 placeholder-zinc-400 font-medium"
                  placeholder="请输入具体页面序号，支持逗号与减号间隔..."
                />
              </div>
            )}
          </div>

          {/* Dynamic expressions usage tip bar */}
          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl flex gap-3 text-zinc-500 leading-normal">
            <Info className="h-4.5 w-4.5 text-zinc-400 shrink-0 mt-0.5" />
            <div className="text-[10.5px]">
              <span className="font-extrabold text-zinc-700 block mb-1">💡 快捷提示：宏变量占位符</span>
              在输入文本中可以直接使用以下占位符，排版引擎会自动转换为各页面的独立真实数据：
              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-3 gap-1 px-1 font-mono text-[9px] text-zinc-600">
                <div><span className="font-bold text-blue-600">[页码]</span> 或 <span className="font-bold text-blue-600">{"{{page}}"}</span> : 当前页码</div>
                <div><span className="font-bold text-blue-600">[总页数]</span> 或 <span className="font-bold text-blue-600">{"{{total}}"}</span> : PDF总页数</div>
                <div><span className="font-bold text-blue-600">[文件名]</span> 或 <span className="font-bold text-blue-600">{"{{file}}"}</span> : 本地文档标题</div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions buttons */}
        <div className="px-5 py-4 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          
          {/* Section: Purge Options */}
          <div className="flex gap-2">
            <button
              onClick={() => handleDeleteAll('header')}
              type="button"
              className="px-3 py-1.5 text-[10px] sm:text-xs font-bold text-red-650 bg-red-50 hover:bg-red-100 hover:scale-102 active:scale-98 transition rounded-full flex items-center gap-1 cursor-pointer border border-red-200"
              title="一键移除所有批注页眉"
            >
              <Trash2 className="h-3 w-3 shrink-0" />
              <span>清理页眉</span>
            </button>
            <button
              onClick={() => handleDeleteAll('footer')}
              type="button"
              className="px-3 py-1.5 text-[10px] sm:text-xs font-bold text-red-650 bg-red-50 hover:bg-red-100 hover:scale-102 active:scale-98 transition rounded-full flex items-center gap-1 cursor-pointer border border-red-200"
              title="一键移除所有批注页脚"
            >
              <Trash2 className="h-3 w-3 shrink-0" />
              <span>清理页脚</span>
            </button>
          </div>

          {/* Section: Main Trigger Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 border border-zinc-200 hover:bg-zinc-250 text-xs font-bold transition rounded-full cursor-pointer text-zinc-600"
            >
              取消
            </button>
            <button
              onClick={handleApplyBatch}
              type="button"
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-650 text-white hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] transition rounded-full text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>一键智能批量应用</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
