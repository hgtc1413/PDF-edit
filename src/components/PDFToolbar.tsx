import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Upload,
  FileText,
  Download,
  Type,
  MousePointer,
  Highlighter,
  Pencil,
  Square,
  Eraser,
  Trash2,
  Undo2,
  Redo2,
  Circle,
  Minus,
  ArrowRight,
  Image as ImageIcon,
  Grid as GridIcon,
  Hand,
  Sparkles,
  Link as LinkIcon,
  Crop,
  Hash,
  Scissors,
  Palette,
  Layout,
  PenTool,
  PenLine,
  Scan,
  Check,
  Award,
  BookOpen,
  FolderOpen,
  Settings,
  HelpCircle
} from 'lucide-react';
import { WorkMode, ToolType } from '../types';

interface PDFToolbarProps {
  fileName: string;
  currentPage: number;
  totalPages: number;
  zoomScale: number;
  workMode: WorkMode;
  onWorkModeChange: (mode: WorkMode) => void;
  onExportPDF: () => void;
  isExporting: boolean;
  onPageChange: (page: number) => void;
  onZoomChange: (scale: number) => void;
  onUploadNew: () => void;
  
  // Style configurations
  activeColor: string;
  onColorSelect: (color: string) => void;
  activeFontSize: number;
  onFontSizeSelect: (size: number) => void;

  // Markup control elements
  activeTool?: ToolType;
  onToolSelect?: (tool: ToolType) => void;
  activeThickness?: number;
  onThicknessChange?: (thickness: number) => void;
  onUndo?: () => void;
  onClearPage?: () => void;
  hasAnnotations?: boolean;

  // Page Operations
  onInsertBlankPage?: () => void;
  onMergePDF?: (file: File) => void;
  onExportCurrentPagePDF?: () => void;
  onExportPlainText?: () => void;
  onExportCurrentPagePNG?: () => void;
  onOpenHeaderFooter?: () => void;

  // Edit Mode Specific Props
  activeEditTool?: 'select' | 'line' | 'rect' | 'ellipse' | 'arrow' | 'stamp';
  onChangeEditTool?: (tool: 'select' | 'line' | 'rect' | 'ellipse' | 'arrow' | 'stamp') => void;
  onInsertImage?: (file: File) => void;
  onInsertTable?: (rows: number, cols: number) => void;
  onInsertStamp?: (text: string, color: string) => void;
  onEditUndo?: () => void;
  onEditRedo?: () => void;
  canEditUndo?: boolean;
  canEditRedo?: boolean;
  editHistoryIndex?: number;
}

type MenuTab = 'file' | 'annotate' | 'edit' | 'page' | 'export';

export default function PDFToolbar({
  fileName,
  currentPage,
  totalPages,
  zoomScale,
  workMode,
  onWorkModeChange,
  onExportPDF,
  isExporting,
  onPageChange,
  onZoomChange,
  onUploadNew,
  activeColor,
  onColorSelect,
  activeFontSize,
  onFontSizeSelect,
  activeTool,
  onToolSelect,
  activeThickness,
  onThicknessChange,
  onUndo,
  onClearPage,
  hasAnnotations,
  onInsertBlankPage,
  onMergePDF,
  onExportCurrentPagePDF,
  onExportPlainText,
  onExportCurrentPagePNG,
  onOpenHeaderFooter,

  // Edit Mode defaults
  activeEditTool = 'select',
  onChangeEditTool,
  onInsertImage,
  onInsertTable,
  onInsertStamp,
  onEditUndo,
  onEditRedo,
  canEditUndo = false,
  canEditRedo = false,
  editHistoryIndex = 0,
}: PDFToolbarProps) {
  const [activeTab, setActiveTab] = useState<MenuTab>('annotate');
  const [isStampDropdownOpen, setIsStampDropdownOpen] = useState(false);
  const [isEraserDropdownOpen, setIsEraserDropdownOpen] = useState(false);
  const [isShapesDropdownOpen, setIsShapesDropdownOpen] = useState(false);
  const [isBackgroundOpen, setIsBackgroundOpen] = useState(false);
  const [isWatermarkOpen, setIsWatermarkOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);

  const [rowInput, setRowInput] = useState(3);
  const [colInput, setColInput] = useState(3);
  const [isTablePopoverOpen, setIsTablePopoverOpen] = useState(false);

  const [activeHandMode, setActiveHandMode] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Watermark state
  const [wmText, setWmText] = useState('终审稿 · 商业秘密 ⚠️');
  const [wmOpacity, setWmOpacity] = useState(0.12);
  const [wmSize, setWmSize] = useState(24);

  // Force sync activeTab when parent changes workMode
  useEffect(() => {
    if (workMode === 'markup' && activeTab !== 'annotate') {
      setActiveTab('annotate');
    } else if (workMode === 'edit' && activeTab !== 'edit') {
      setActiveTab('edit');
    }
  }, [workMode]);

  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  const handleZoomIn = () => {
    if (zoomScale < 4.0) onZoomChange(Math.min(4.0, zoomScale + 0.25));
  };

  const handleZoomOut = () => {
    if (zoomScale > 0.5) onZoomChange(Math.max(0.5, zoomScale - 0.25));
  };

  const colors = [
    { id: 'black', hex: '#1e293b', name: '经典碳黑' },
    { id: 'red', hex: '#ef4444', name: '警告鲜红' },
    { id: 'blue', hex: '#3b82f6', name: '科研宝蓝' },
    { id: 'emerald', hex: '#10b981', name: '极光暖绿' },
    { id: 'purple', hex: '#a855f7', name: '科学雅紫' },
    { id: 'yellow', hex: '#eab308', name: '高亮金黄' },
  ];

  const getColorHex = (id: string) => {
    const found = colors.find(c => c.id === id);
    return found ? found.hex : '#1e293b';
  };

  const handleTabClick = (tab: MenuTab) => {
    setActiveTab(tab);
    if (tab === 'annotate') {
      onWorkModeChange('markup');
    } else if (tab === 'edit') {
      onWorkModeChange('edit');
    }
  };

  return (
    <div className="w-full shrink-0 flex flex-col border-b border-[#1f1f23] bg-[#0c0c0e] text-zinc-150 select-none shadow-md z-40 relative">
      
      {/* SECTION 1: Level-1 Figma-Style Top Tabs Rail */}
      <div className="h-14 border-b border-[#17171a] px-4 flex items-center justify-between bg-[#08080a]">
        
        {/* Left: Brand logo + 5 Core Level-1 Tab Controls */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-650 flex items-center justify-center border border-indigo-500/25">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <span className="text-[12px] font-black tracking-widest text-white uppercase font-display hidden sm:inline-block">
              AI Workspace
            </span>
          </div>

          <div className="h-4 w-[1px] bg-zinc-800" />

          {/* Menu items row */}
          <nav className="flex items-center gap-8 h-full">
            {[
              { id: 'file' as const, label: 'File', icon: FolderOpen },
              { id: 'annotate' as const, label: 'Annotate', icon: Pencil },
              { id: 'edit' as const, label: 'Edit', icon: PenTool },
              { id: 'page' as const, label: 'Pages', icon: Layout },
              { id: 'export' as const, label: 'Export', icon: Download },
            ].map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`py-1.5 px-1 text-xs font-semibold tracking-wide transition-all duration-150 flex items-center gap-1.5 cursor-pointer relative select-none ${
                    isActive
                      ? 'text-white font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 transition-colors ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-[19px] left-0 right-0 h-[2px] bg-[#6366f1] rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Active page counter and zoom factor sliders */}
        <div className="flex items-center gap-4 select-none">
          {/* Zoom tool configurations */}
          <div className="flex items-center bg-[#101014] border border-zinc-850 px-2.5 py-1 rounded-lg gap-2 text-xs font-mono font-bold select-none">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:bg-zinc-800 text-zinc-405 hover:text-white rounded transition cursor-pointer"
              title="缩小 (Zoom Out)"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-zinc-300 w-11 text-center scale-95">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 hover:bg-zinc-800 text-zinc-405 hover:text-white rounded transition cursor-pointer"
              title="放大 (Zoom In)"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onZoomChange(1.0)}
              className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded transition"
              title="重缩放至 100%"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-zinc-800" />

          {/* Quick Page Nav jumps */}
          <div className="flex items-center gap-1 bg-[#101014] border border-zinc-850/80 p-0.5 rounded-lg select-none">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none rounded transition cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-mono text-zinc-300 px-2 font-bold select-none">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none rounded transition cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Contextual Level-2 Secondary Toolbars Ribbon */}
      <div className="h-11 bg-[#0c0c0f]/80 backdrop-blur-md border-b border-[#141416]/40 px-4 flex items-center justify-between gap-6 overflow-x-auto overflow-y-hidden scrollbar-none">
        
        {/* TAB Context Option: FILE */}
        {activeTab === 'file' && (
          <div className="flex items-center gap-4 shrink-0 transition-opacity">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-mono">当前文件原件:</span>
              <span className="text-xs text-indigo-300 font-extrabold truncate max-w-[200px]" title={fileName}>
                {fileName}
              </span>
            </div>
            <div className="w-[1px] h-3.5 bg-zinc-800" />
            <button
              onClick={onUploadNew}
              className="flex items-center gap-1.5 py-1 px-3 bg-zinc-90 w-fit rounded-lg border border-zinc-800 text-[11px] font-black text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-zinc-400" />
              <span>更换新的 PDF 文件</span>
            </button>
          </div>
        )}

        {/* TAB Context Option: ANNOTATE */}
        {activeTab === 'annotate' && (
          <div className="flex items-center gap-4 shrink-0 justify-between w-full">
            <div className="flex items-center gap-2">
              {/* Tool selector buttons */}
              <div className="flex items-center bg-[#121216] border border-zinc-850 p-0.5 rounded-lg">
                {[
                  { id: 'select' as ToolType, label: '选择', icon: MousePointer, tip: '选择并拖改已有高亮或笔刷' },
                  { id: 'highlight' as ToolType, label: '笔刷高亮', icon: Highlighter, tip: '文字荧光着色工具' },
                  { id: 'pen' as ToolType, label: '手画自由笔', icon: Pencil, tip: '手绘画笔标记' },
                  { id: 'text' as ToolType, label: '插入字 annotation', icon: Type, tip: '在图纸单击插入文本块' },
                  { id: 'rect' as ToolType, label: '标注边框', icon: Square, tip: '画笔圈红色重点标注框' },
                  { id: 'eraser' as ToolType, label: '橡皮擦', icon: Eraser, tip: '擦除涂鸦标记' },
                ].map((tool) => {
                  const isActive = activeTool === tool.id;
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => onToolSelect?.(tool.id)}
                      className={`p-1.5 rounded-md transition ${
                        isActive
                          ? 'bg-[#1e1e24] border border-zinc-750 text-white shadow-inner font-extrabold'
                          : 'text-zinc-505 hover:text-zinc-200'
                      }`}
                      title={tool.tip}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>

              <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

              {/* Stroke sizes */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="scale-95 text-zinc-500 font-bold">画笔粗细:</span>
                <select
                  value={activeThickness}
                  onChange={(e) => onThicknessChange?.(Number(e.target.value))}
                  className="bg-[#121216] border border-zinc-800 rounded p-1 text-[11px] font-mono font-bold text-zinc-300 focus:outline-none"
                >
                  <option value={2}>2 px</option>
                  <option value={5}>5 px</option>
                  <option value={10}>10 px</option>
                </select>
              </div>

              <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

              {/* Selection annotations colors */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="scale-95 text-zinc-500 font-bold font-sans">颜色调色:</span>
                <div className="flex items-center gap-1 bg-[#121216] px-1.5 py-1 rounded-lg border border-zinc-850">
                  {colors.map((c) => {
                    const isSelected = activeColor === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => onColorSelect(c.id)}
                        className={`w-3 h-3 rounded-full border transition hover:scale-125 relative flex items-center justify-center ${
                          isSelected ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Redo, undo annotations handles */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onUndo}
                disabled={!hasAnnotations}
                className="flex items-center gap-1 py-1 px-2.5 rounded-lg text-[10.5px] font-black text-zinc-400 hover:text-white hover:bg-zinc-850 disabled:opacity-20 cursor-pointer"
                title="撤消上一次的批注笔触"
              >
                <Undo2 className="h-3.5 w-3.5 scale-90" />
                <span>撤消标注</span>
              </button>
              <button
                onClick={onClearPage}
                disabled={!hasAnnotations}
                className="flex items-center gap-1 py-1 px-2.5 rounded-lg text-[10.5px] font-black text-red-450 hover:bg-red-950/20 hover:text-red-400 disabled:opacity-20 cursor-pointer"
                title="清空当前页面上的全部标注"
              >
                <Trash2 className="h-3.5 w-3.5 scale-90" />
                <span>整页清空</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB Context Option: EDIT */}
        {activeTab === 'edit' && (
          <div className="flex items-center gap-3.5 shrink-0 transition-opacity justify-between w-full">
            <div className="flex items-center gap-3">
              {/* Pointing tools vs Hand modes */}
              <div className="flex items-center bg-[#121216] border border-zinc-850 p-0.5 rounded-lg select-none">
                <button
                  onClick={() => {
                    setActiveHandMode(true);
                    onChangeEditTool?.('select');
                    setToastMsg('视图平移拖拽手型已启用');
                  }}
                  className={`p-1 px-2 rounded text-[10.5px] font-black tracking-wider transition ${
                    activeHandMode ? 'bg-[#1c1c22] text-white shadow' : 'text-zinc-505 hover:text-zinc-200'
                  }`}
                  title="手型平移平铺图面"
                >
                  <Hand className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    setActiveHandMode(false);
                    onChangeEditTool?.('select');
                  }}
                  className={`p-1 px-2 rounded text-[10.5px] font-black tracking-wider transition ${
                    !activeHandMode && activeEditTool === 'select' ? 'bg-[#1c1c22] text-white shadow' : 'text-zinc-505 hover:text-zinc-200'
                  }`}
                  title="激活内容选择与文本编辑"
                >
                  <MousePointer className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="w-[1px] h-3.5 bg-zinc-800" />

              {/* FontSize change elements */}
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="text-zinc-500 font-bold">文本大小:</span>
                <select
                  value={activeFontSize}
                  onChange={(e) => onFontSizeSelect(Number(e.target.value))}
                  className="bg-[#121216] border border-zinc-800 rounded p-1 text-[11px] font-mono font-bold text-zinc-350 focus:outline-none"
                >
                  {[10, 12, 14, 16, 18, 20, 24, 28].map(size => (
                    <option key={size} value={size}>{size} px</option>
                  ))}
                </select>
              </div>

              <div className="w-[1px] h-3.5 bg-zinc-800" />

              {/* Shapes insertions */}
              <div className="relative">
                <button
                  onClick={() => setIsShapesDropdownOpen(!isShapesDropdownOpen)}
                  className={`flex items-center gap-1 py-1 px-2 text-[11.5px] font-black text-zinc-350 hover:text-white hover:bg-zinc-900 border rounded-lg transition ${
                    isShapesDropdownOpen ? 'bg-zinc-900 border-zinc-700' : 'border-zinc-850'
                  }`}
                >
                  <Square className="h-3.5 w-3.5 text-sky-400" />
                  <span>几何构件 ▾</span>
                </button>
                {isShapesDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsShapesDropdownOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-36 rounded-xl bg-[#121216] border border-zinc-800 shadow-2xl py-1 z-50">
                      {[
                        { id: 'line' as const, name: '✏️ 水平标线' },
                        { id: 'rect' as const, name: '🔳 矩形高亮' },
                        { id: 'ellipse' as const, name: '🔴 圈注圆框' },
                        { id: 'arrow' as const, name: '➡️ 定位箭头' }
                      ].map((sh) => (
                        <button
                          key={sh.id}
                          onClick={() => {
                            setIsShapesDropdownOpen(false);
                            onChangeEditTool?.(sh.id);
                            setToastMsg(`形状工具已切换为 [${sh.name.split(' ')[1]}]`);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 text-xs text-zinc-300 font-bold border-b border-zinc-850/40 last:border-0 transition"
                        >
                          {sh.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Dynamic grid Table Insertions container */}
              <div className="relative">
                <button
                  onClick={() => setIsTablePopoverOpen(!isTablePopoverOpen)}
                  className={`flex items-center gap-1 py-1 px-2.5 text-[11.5px] font-black text-zinc-350 hover:text-white hover:bg-zinc-900 border rounded-lg transition ${
                    isTablePopoverOpen ? 'bg-zinc-900 border-zinc-700' : 'border-zinc-850'
                  }`}
                >
                  <GridIcon className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                  <span>置入表格 ▾</span>
                </button>
                {isTablePopoverOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsTablePopoverOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 p-3 bg-[#111115] border border-zinc-800 rounded-xl shadow-2xl z-50 flex flex-col gap-2 min-w-[170px]">
                      <span className="text-[10px] font-black text-zinc-550 uppercase font-mono">自定义行列数</span>
                      <div className="flex gap-2">
                        <div className="w-1/2 flex flex-col gap-0.5">
                          <span className="text-[9px] text-zinc-500 font-black">行数</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={rowInput}
                            onChange={(e) => setRowInput(Math.max(1, parseInt(e.target.value) || 1))}
                            className="bg-[#09090b] text-white border border-zinc-800 rounded px-1.5 py-1 text-xs text-center font-bold"
                          />
                        </div>
                        <div className="w-1/2 flex flex-col gap-0.5">
                          <span className="text-[9px] text-zinc-505 font-black">列数</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={colInput}
                            onChange={(e) => setColInput(Math.max(1, parseInt(e.target.value) || 1))}
                            className="bg-[#09090b] text-white border border-zinc-800 rounded px-1.5 py-1 text-xs text-center font-bold"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          onInsertTable?.(rowInput, colInput);
                          setIsTablePopoverOpen(false);
                          setToastMsg(`已在画布正中成功放置 ${rowInput}×${colInput} 可双击编辑数据网格`);
                        }}
                        className="w-full bg-indigo-650 hover:bg-indigo-600 text-white font-black py-1.5 px-2 rounded-lg text-xs transition mt-1 cursor-pointer"
                      >
                        确认置入表格
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Dynamic stamp additions */}
              <div className="relative">
                <button
                  onClick={() => setIsStampDropdownOpen(!isStampDropdownOpen)}
                  className={`flex items-center gap-1 py-1 px-2 text-[11.5px] font-black text-zinc-350 hover:text-white hover:bg-zinc-900 border rounded-lg transition ${
                    isStampDropdownOpen ? 'bg-zinc-900 border-zinc-700' : 'border-zinc-850'
                  }`}
                >
                  <Award className="h-3.5 w-3.5 text-rose-450" />
                  <span>盖加图章 ▾</span>
                </button>
                {isStampDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsStampDropdownOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-44 rounded-xl bg-[#121216] border border-zinc-800 shadow-2xl py-1.5 z-50">
                      {[
                        { text: 'APPROVED 已审核批准', color: '#10b981', bg: '#064e3b/15' },
                        { text: 'CONFIDENTIAL 绝密文件', color: '#ef4444', bg: '#7f1d1d/15' },
                        { text: 'DRAFT 拟定讨论稿', color: '#f59e0b', bg: '#78350f/15' },
                        { text: 'FINAL 终稿正本印', color: '#3b82f6', bg: '#1e3a8a/15' }
                      ].map((item) => (
                        <button
                          key={item.text}
                          onClick={() => {
                            setIsStampDropdownOpen(false);
                            if (onInsertStamp) {
                              onInsertStamp(item.text, item.color);
                            }
                            setToastMsg(`已在画布正中置入图章：[${item.text.split(' ')[0]}]，您可以拖拽、缩放或使用指示性旋转杆调整图章！`);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 flex items-center transition"
                        >
                          <span
                            className="px-2 py-0.5 rounded text-[9.5px] font-black border"
                            style={{ color: item.color, backgroundColor: item.bg, borderColor: `${item.color}40` }}
                          >
                            {item.text.split(' ')[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Paper background themes selector container */}
              <div className="relative">
                <button
                  onClick={() => setIsBackgroundOpen(!isBackgroundOpen)}
                  className={`flex items-center gap-1 py-1 px-2.5 text-[11.5px] font-black text-zinc-350 hover:text-white hover:bg-zinc-900 border rounded-lg transition ${
                    isBackgroundOpen ? 'bg-zinc-900 border-zinc-700' : 'border-zinc-850'
                  }`}
                >
                  <Palette className="h-3.5 w-3.5 text-teal-400" />
                  <span>护眼背景 ▾</span>
                </button>
                {isBackgroundOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsBackgroundOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 p-3 rounded-xl bg-[#121216] border border-zinc-800 shadow-2xl z-50 min-w-[170px] flex flex-col gap-2">
                      <span className="text-[9.5px] font-black text-zinc-550 uppercase">画布护眼纹理底色</span>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { name: '经典亮白', hex: '#FFFFFF', title: '雅白色' },
                          { name: '护眼羊皮', hex: '#F9F1E5', title: '黄沙羊皮纸' },
                          { name: '清新葱翠', hex: '#EAF2EA', title: '清脆绿' },
                          { name: '经典雅黑', hex: '#0B0B0E', title: '酷雅硬黑' }
                        ].map((bgi) => (
                          <button
                            key={bgi.hex}
                            title={bgi.name}
                            onClick={() => {
                              setIsBackgroundOpen(false);
                              const canvasBody = document.getElementById('pdf-canvas-container');
                              if (canvasBody) {
                                canvasBody.style.backgroundColor = bgi.hex;
                                if (bgi.hex === '#0B0B0E') {
                                  canvasBody.style.filter = 'invert(0.9) hue-rotate(180deg)';
                                } else {
                                  canvasBody.style.filter = 'none';
                                }
                              }
                              setToastMsg(`画布背景已成功替换为 [${bgi.title}]`);
                            }}
                            className="w-7 h-7 rounded border border-zinc-800 hover:scale-110 shadow hover:border-zinc-500 transition-all cursor-pointer"
                            style={{ backgroundColor: bgi.hex }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Edit recovery tools */}
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-[9.5px] text-zinc-550 uppercase font-black">第 {editHistoryIndex} 步</span>
              <button
                onClick={onEditUndo}
                disabled={!canEditUndo}
                className="p-1 px-2 border border-transparent hover:bg-zinc-850 hover:text-white rounded disabled:opacity-20 cursor-pointer text-zinc-400"
                title="撤消上一次文字/置入图形修改"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onEditRedo}
                disabled={!canEditRedo}
                className="p-1 px-2 border border-transparent hover:bg-zinc-850 hover:text-white rounded disabled:opacity-20 cursor-pointer text-zinc-400"
                title="重做文字/图形修改"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB Context Option: PAGE (Page organization physical bounds) */}
        {activeTab === 'page' && (
          <div className="flex items-center gap-3 shrink-0 transition-opacity">
            <button
              onClick={onInsertBlankPage}
              className="flex items-center gap-1.5 py-1 px-3 bg-zinc-90 w-fit rounded-lg border border-zinc-850 text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition cursor-pointer"
            >
              <span>➕ 在本页后置入空白自定义页</span>
            </button>
            
            <div className="w-[1px] h-3.5 bg-zinc-800" />

            <label className="flex items-center gap-1.5 py-1 px-3 bg-zinc-90 w-fit rounded-lg border border-zinc-850 text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition cursor-pointer">
              <span>🗂️ 异步拼接合并外部 PDF 页</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onMergePDF?.(file);
                    setToastMsg(`外部 PDF「${file.name}」已被安全拼接记入附录。`);
                  }
                  e.target.value = '';
                }}
              />
            </label>

            <div className="w-[1px] h-3.5 bg-zinc-800" />

            <button
              onClick={onOpenHeaderFooter}
              className="flex items-center gap-1.5 py-1 px-3 bg-zinc-90 w-fit rounded-lg border border-zinc-850 text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition cursor-pointer"
            >
              <Hash className="h-3.5 w-3.5 text-zinc-400" />
              <span>智能页眉页脚与动态页码</span>
            </button>
          </div>
        )}

        {/* TAB Context Option: EXPORT (profiles distribution catalog) */}
        {activeTab === 'export' && (
          <div className="flex items-center gap-3.5 shrink-0 transition-opacity select-none">
            
            {/* Action 1: Export Complete PDF */}
            <button
              onClick={onExportPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-indigo-650 hover:bg-indigo-600 disabled:bg-zinc-900 border border-transparent rounded-lg text-xs font-black text-white hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span>{isExporting ? '打包原件导出加密中...' : '下载完整重构 PDF (All-Pages)'}</span>
            </button>

            <div className="w-[1px] h-3.5 bg-zinc-800" />

            {/* Action 2: Export Current Page Only PDF */}
            <button
              onClick={onExportCurrentPagePDF}
              className="flex items-center gap-1 py-1 px-2.5 rounded-lg border border-zinc-850 text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-900 hover:border-zinc-755 transition cursor-pointer animate-none"
            >
              <span>📄 单页 PDF 下载</span>
            </button>

            <div className="w-[1px] h-3.5 bg-zinc-805" />

            {/* Action 3: Export plain text */}
            <button
              onClick={onExportPlainText}
              className="flex items-center gap-1 py-1 px-2.5 rounded-lg border border-zinc-850 text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-900 hover:border-zinc-755 transition cursor-pointer animate-none"
            >
              <span>📝 导出纯文本 (Plain Text)</span>
            </button>

            <div className="w-[1px] h-3.5 bg-zinc-805" />

            {/* Action 4: Export page as PNG snapshot */}
            <button
              onClick={onExportCurrentPagePNG}
              className="flex items-center gap-1 py-1 px-2.5 rounded-lg border border-zinc-850 text-xs font-black text-zinc-300 hover:text-white hover:bg-zinc-900 hover:border-zinc-755 transition cursor-pointer animate-none"
            >
              <span>🖼️ 纯净 PNG 截图</span>
            </button>
          </div>
        )}

        {/* Global floating user toast message notifications banner (No frame overlay) */}
        {toastMsg && (
          <div className="bg-indigo-950/90 border border-indigo-500/35 px-3 py-1.5 rounded-lg text-[10.5px] text-indigo-300 font-extrabold flex items-center gap-2 shadow-lg animate-fade transition-transform ml-auto select-none shrink-0">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-400" />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>

    </div>
  );
}
