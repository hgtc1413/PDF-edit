import React, { useState } from 'react';
import { PDFPageInfo } from '../types';
import {
  Layers,
  BookOpen,
  Bookmark,
  History,
  Plus,
  Trash2,
  ChevronRight,
  FileText,
  Activity,
  Check,
  PlusCircle,
  Menu
} from 'lucide-react';

interface PDFSidebarProps {
  pages: PDFPageInfo[];
  currentPage: number;
  onPageClick: (pageNumber: number) => void;
  onReorderPages?: (sourcePageNumber: number, targetPageNumber: number) => void;
  onDeletePage?: (pageNumber: number) => void;
  textEdits?: any[];
  annotations?: any[];
  onInsertBlankPage?: () => void;
  onDuplicatePage?: (pageNumber: number) => void;
  onRotatePage?: (pageNumber: number, degrees: number) => void;
  onSplitPage?: (pageNumber: number) => void;
}

interface UserBookmark {
  id: string;
  pageNumber: number;
  label: string;
  createdAt: string;
}

export default function PDFSidebar({
  pages,
  currentPage,
  onPageClick,
  onReorderPages,
  onDeletePage,
  textEdits = [],
  annotations = [],
  onInsertBlankPage,
  onDuplicatePage,
  onRotatePage,
  onSplitPage,
}: PDFSidebarProps) {
  const [activeTab, setActiveTab] = useState<'pages' | 'annotations' | 'bookmarks' | 'history'>('pages');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openMenuPageNum, setOpenMenuPageNum] = useState<number | null>(null);
  const [bookmarks, setBookmarks] = useState<UserBookmark[]>([
    { id: '1', pageNumber: 1, label: '封面页 & 核心议题', createdAt: '13:40' },
  ]);
  const [newBookmarkLabel, setNewBookmarkLabel] = useState('');
  const [showAddBookmark, setShowAddBookmark] = useState(false);

  // Search, filter, and page multi-selection states
  const [annotationSearch, setAnnotationSearch] = useState('');
  const [annotationFilter, setAnnotationFilter] = useState<'all' | 'highlight' | 'pen' | 'text' | 'rect'>('all');
  const [selectedPageNums, setSelectedPageNums] = useState<number[]>([]);

  // Toggle selection for pages
  const handlePageSelectToggle = (pageNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPageNums(prev => {
      if (prev.includes(pageNum)) {
        return prev.filter(n => n !== pageNum);
      } else {
        return [...prev, pageNum];
      }
    });
  };

  // Click card handle (supports shift & ctrl keys)
  const handlePageCardClick = (pageNum: number, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      handlePageSelectToggle(pageNum, e);
    } else if (e.shiftKey && selectedPageNums.length > 0) {
      e.stopPropagation();
      const lastSelected = selectedPageNums[selectedPageNums.length - 1];
      const start = Math.min(lastSelected, pageNum);
      const end = Math.max(lastSelected, pageNum);
      const range: number[] = [];
      for (let i = start; i <= end; i++) {
        range.push(i);
      }
      setSelectedPageNums(prev => {
        const combined = new Set([...prev, ...range]);
        return Array.from(combined);
      });
    } else {
      onPageClick(pageNum);
    }
  };

  // Annotations exporter
  const handleExportAnnotations = () => {
    if (annotations.length === 0) {
      alert('当前没有任何批注可供导出。');
      return;
    }
    const data = annotations.map(ann => ({
      id: ann.id,
      type: ann.type,
      pageNumber: ann.pageNumber,
      color: ann.color,
      author: ann.author || '本地设计师',
      comment: ann.comment || (ann.type === 'text' ? ann.text : `${ann.type} 批注`),
      createdAt: ann.createdAt || '刚刚'
    }));
    
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `pdf_annotations_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Drag and Drop helpers for pages
  const handleDragStart = (e: React.DragEvent, pageNumber: number) => {
    e.dataTransfer.setData('text/plain', String(pageNumber));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetPageNumber: number) => {
    e.preventDefault();
    const source = Number(e.dataTransfer.getData('text/plain'));
    if (!isNaN(source) && source !== targetPageNumber) {
      onReorderPages?.(source, targetPageNumber);
    }
  };

  const handleAddBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookmarkLabel.trim()) return;
    const newBmk: UserBookmark = {
      id: Date.now().toString(),
      pageNumber: currentPage,
      label: newBookmarkLabel.trim(),
      createdAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };
    setBookmarks(prev => [...prev, newBmk]);
    setNewBookmarkLabel('');
    setShowAddBookmark(false);
  };

  const handleDeleteBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  // Autogenerate outline items based on document pages counts
  const generateOutline = () => {
    const list = [];
    if (pages.length >= 1) {
      list.push({ page: 1, title: '📄 01 | 扉页 / 概览与版权说明' });
    }
    if (pages.length >= 2) {
      list.push({ page: 2, title: '📊 02 | 执行摘要 (Executive Review)' });
    }
    if (pages.length >= 3) {
      list.push({ page: 3, title: '🔬 03 | 第一部: 指标分析与推演' });
    }
    for (let i = 4; i <= pages.length; i++) {
      if (i === pages.length) {
        list.push({ page: i, title: `🏁 0${i} | 文档综述与数据校验` });
      } else {
        list.push({ page: i, title: `📑 0${i} | 附录 ${i - 3} | 指标补充网格` });
      }
    }
    return list;
  };

  // Compile a rich list of audit log items combining mock & realistic values matching annotations and textEdits changes
  const getAuditHistory = () => {
    const logs = [
      { id: '1', type: 'system', action: '载入原件并重塑视图结构', time: '13:40', detail: 'Vite 异步解析引擎' },
    ];

    if (bookmarks.length > 1) {
      logs.push({ id: 'bmk-log', type: 'bookmark', action: '追加用户自定义锚点书签', time: '刚刚', detail: `书签指向第 ${currentPage} 页` });
    }

    // Capture annotations log items
    annotations.forEach((annot, index) => {
      let typeLabel = '自由笔刷';
      if (annot.type === 'highlight') typeLabel = '荧光背景高亮';
      if (annot.type === 'rect') typeLabel = '强调边框';
      if (annot.type === 'text') typeLabel = '文字气泡注释';

      logs.push({
        id: `annot-${annot.id}`,
        type: 'annotate',
        action: `绘制批注 ${typeLabel}`,
        time: `13:41`,
        detail: `第 ${annot.pageNumber} 页 • 颜色: ${annot.color}`
      });
    });

    // Capture text edit actions
    textEdits.forEach((edit, index) => {
      let editLabel = '文本重塑';
      if (edit.type === 'image') editLabel = '置入外部插图';
      if (edit.type === 'table') editLabel = '新增数据网格';
      if (edit.type === 'shape') editLabel = '叠加矢量构件';

      logs.push({
        id: `edit-${edit.id}`,
        type: 'edit',
        action: `重构 ${editLabel}`,
        time: `13:41`,
        detail: `第 ${edit.pageNumber} 页 • "${edit.text ? edit.text.slice(0, 12) : ''}"`
      });
    });

    return logs.reverse(); // Newest first
  };

  const navItems = [
    { id: 'pages' as const, label: '微缩页', icon: Layers, tooltip: '页面缩略图 & 批量管理' },
    { id: 'annotations' as const, label: '批注库', icon: BookOpen, tooltip: '批注管理系统（查找/筛选/导出）' },
    { id: 'bookmarks' as const, label: '书签录', icon: Bookmark, tooltip: '自定义页面书签' },
    { id: 'history' as const, label: '审计条', icon: History, tooltip: '行为修改轨迹审计' },
  ];

  if (isSidebarCollapsed) {
    return (
      <aside className="w-12 border-r border-[#1f1f23] bg-[#0c0c0e] flex flex-col items-center py-4 gap-4 shrink-0 h-[calc(100vh-65px-32px)] select-none">
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1a1a1e] transition cursor-pointer"
          title="展开侧边导航"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="w-6 h-[1px] bg-zinc-800 my-1" />
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarCollapsed(false);
              }}
              className={`w-12 h-12 flex items-center justify-center relative cursor-pointer select-none transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-500/12 text-[#6366f1] border-l-2 border-[#6366f1]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
              }`}
              title={item.tooltip}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <aside className="w-60 border-r border-[#1f1f23] bg-[#0c0c0e] flex shrink-0 h-[calc(100vh-65px-32px)] select-none overflow-hidden font-sans">
      {/* 1. Left Vertical Icon Strip (Rail Sidebar Option toggles) */}
      <div className="w-12 border-r border-[#111115] bg-[#08080a] flex flex-col items-center py-4 gap-4 shrink-0">
        <button
          onClick={() => setIsSidebarCollapsed(true)}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-[#151518] transition cursor-pointer"
          title="收起侧边导航"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="w-6 h-[1px] bg-zinc-850/60 my-1" />
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-12 h-12 flex flex-col items-center justify-center relative cursor-pointer select-none transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-500/12 text-[#6366f1] border-l-2 border-[#6366f1]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
              }`}
              title={item.tooltip}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>

      {/* 2. Main Tab Body Contents Pane */}
      <div className="flex-1 flex flex-col bg-[#0c0c0e]/40 overflow-hidden">
        {/* Tab Title Header */}
        <div className="p-3.5 border-b border-[#1f1f23] bg-[#09090b]/80 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-black text-zinc-400 tracking-widest uppercase font-display">
            {activeTab === 'pages' && '文档缩略页'}
            {activeTab === 'annotations' && '批注管理系统'}
            {activeTab === 'bookmarks' && '用户快跳书签'}
            {activeTab === 'history' && '审计变更日志'}
          </span>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#18181b] text-zinc-400 font-bold border border-zinc-800 shadow-inner">
            {activeTab === 'pages' ? `${pages.length} 页` :
             activeTab === 'annotations' ? `${annotations.length} 个` :
             activeTab === 'bookmarks' ? `${bookmarks.length} 条` : `${getAuditHistory().length} 动作`}
          </span>
        </div>

        {/* Tab content wrappers */}
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          
          {/* PA_GES TAB */}
          {activeTab === 'pages' && (
            <div className="space-y-4 py-1">
              {/* Batch Operations Panel */}
              {selectedPageNums.length > 0 && (
                <div className="p-3 bg-indigo-950/40 border border-indigo-900/50 rounded-xl mb-4 text-xs font-semibold text-indigo-200">
                  <div className="flex items-center justify-between mb-2">
                    <span>已选中 {selectedPageNums.length} 页</span>
                    <button
                      onClick={() => setSelectedPageNums([])}
                      className="text-[10px] text-zinc-400 hover:text-white"
                    >
                      清除选择
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold">
                    <button
                      onClick={() => {
                        selectedPageNums.forEach(num => onRotatePage?.(num, 90));
                        alert(`已成功批量旋转 ${selectedPageNums.length} 页`);
                      }}
                      className="py-1 px-2 border border-zinc-805 bg-[#101014] hover:bg-zinc-900 text-zinc-200 rounded flex items-center justify-center gap-1 cursor-pointer"
                    >
                      🔄 旋转 90°
                    </button>

                    <button
                      onClick={() => {
                        // Sort in descending order to avoid shift issues
                        const sorted = [...selectedPageNums].sort((a, b) => b - a);
                        sorted.forEach(num => onDuplicatePage?.(num));
                        alert(`已成功批量克隆 ${selectedPageNums.length} 页`);
                        setSelectedPageNums([]);
                      }}
                      className="py-1 px-2 border border-zinc-805 bg-[#101014] hover:bg-zinc-900 text-zinc-200 rounded flex items-center justify-center gap-1 cursor-pointer"
                    >
                      👥 复制克隆
                    </button>

                    <button
                      onClick={() => {
                        const files = selectedPageNums.map(num => `第_${num}_页.pdf`).join(', ');
                        alert(`⬇️ 正在将 [ ${files} ] 打包高精提取下载...`);
                      }}
                      className="py-1 px-2 border border-zinc-805 bg-[#101014] hover:bg-zinc-900 text-zinc-200 rounded flex items-center justify-center gap-1 cursor-pointer"
                    >
                      ⚡ 提取页面
                    </button>

                    <button
                      disabled={pages.length - selectedPageNums.length < 1}
                      onClick={() => {
                        if (pages.length - selectedPageNums.length < 1) {
                          alert('错误：无法删除所有页面，必须保留至少 1 页。');
                          return;
                        }
                        if (window.confirm(`确定要批量删除这 ${selectedPageNums.length} 个页面吗？`)) {
                          const sorted = [...selectedPageNums].sort((a, b) => b - a);
                          sorted.forEach(num => onDeletePage?.(num));
                          setSelectedPageNums([]);
                        }
                      }}
                      className="py-1 px-2 border border-zinc-805 bg-red-950/20 hover:bg-red-900/40 text-red-400 rounded flex items-center justify-center gap-1 disabled:opacity-30 cursor-pointer"
                    >
                      🗑️ 批量删除
                    </button>
                  </div>
                </div>
              )}

              {pages.map((page) => {
                const isActive = page.pageNumber === currentPage;
                const isSelected = selectedPageNums.includes(page.pageNumber);
                const ratio = page.height > 0 ? page.width / page.height : 0.707;

                return (
                  <div
                    key={page.pageNumber}
                    onClick={(e) => handlePageCardClick(page.pageNumber, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setOpenMenuPageNum(page.pageNumber);
                    }}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, page.pageNumber)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, page.pageNumber)}
                    className="group cursor-pointer flex flex-col items-center gap-1.5 relative select-none"
                  >
                    <div
                      className={`relative rounded-xl overflow-hidden border transition-all duration-200 flex items-center justify-center bg-[#131316] shadow-md ${
                        isSelected
                          ? 'border-indigo-400 ring-2 ring-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.3)] scale-[1.02]'
                          : isActive
                          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.22)] scale-[1.02]'
                          : 'border-zinc-853 group-hover:border-zinc-700/80'
                      }`}
                      style={{
                        width: '110px',
                        height: `${110 / ratio}px`,
                        maxHeight: '155px',
                      }}
                    >
                      {page.thumbnailUrl ? (
                        <img
                          src={page.thumbnailUrl}
                          alt={`第 ${page.pageNumber} 页`}
                          className="w-full h-full object-contain pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"
                          referrerPolicy="no-referrer"
                        />
                      ) : page.originalPageNumber === -1 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800">
                          <span className="text-base">📄</span>
                          <span className="text-[8px] font-black text-zinc-400 mt-1 uppercase text-center scale-90">
                            自定义空白页
                          </span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center animate-pulse gap-1.5 bg-zinc-900/60">
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-indigo-500 animate-spin" />
                          <span className="text-[8.5px] text-zinc-550 font-mono">缩略制图中...</span>
                        </div>
                      )}

                      {/* Interactive Selection Checkbox */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePageSelectToggle(page.pageNumber, e);
                        }}
                        className={`absolute top-1.5 left-1.5 w-4.5 h-4.5 rounded border flex items-center justify-center transition-all cursor-pointer z-40 ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow'
                            : 'bg-zinc-950/80 border-zinc-700 hover:border-zinc-500 text-transparent opacity-0 group-hover:opacity-100'
                        }`}
                        title="勾选此页面进行批量操作"
                      >
                        <Check className="h-3 w-3 text-white stroke-[3px]" />
                      </div>

                      {/* Digit label (shift key reference) */}
                      <div className={`absolute bottom-1.5 left-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8.5px] font-mono font-black border transition-all ${
                        isActive
                          ? 'bg-[#18181b] text-indigo-400 border-indigo-500 shadow'
                          : 'bg-zinc-850 text-zinc-450 border-zinc-750 group-hover:bg-zinc-700'
                      }`}>
                        {page.pageNumber}
                      </div>

                      {/* Delete index banner */}
                      <button
                        type="button"
                        disabled={pages.length <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pages.length <= 1) return;
                          const confirmed = window.confirm(`确认彻底删除第 ${page.pageNumber} 页？`);
                          if (confirmed) {
                            onDeletePage?.(page.pageNumber);
                          }
                        }}
                        className={`absolute top-1.5 right-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow ${
                          pages.length <= 1
                            ? 'bg-zinc-800 text-zinc-650 cursor-not-allowed opacity-30'
                            : 'bg-red-600/90 hover:bg-red-500 text-white cursor-pointer'
                        }`}
                        title={pages.length <= 1 ? '至少保留一页' : '安全移除此页面'}
                      >
                        <span className="text-[10px] font-black leading-none">×</span>
                      </button>

                      {/* Advanced Options Menu Trigger button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuPageNum(openMenuPageNum === page.pageNumber ? null : page.pageNumber);
                        }}
                        className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-zinc-900/95 border border-zinc-750 hover:bg-zinc-800 hover:border-zinc-500 text-[#6366f1] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-40 cursor-pointer"
                        title="页面操作菜单"
                      >
                        <span className="text-[10px] select-none leading-none">⚙️</span>
                      </button>

                      {/* Dropdown list */}
                      {openMenuPageNum === page.pageNumber && (
                        <>
                          <div className="fixed inset-0 z-40 bg-transparent" onClick={(e) => { e.stopPropagation(); setOpenMenuPageNum(null); }} />
                          <div className="absolute bottom-7 right-1.5 w-48 rounded-xl bg-zinc-950 border border-zinc-800 shadow-[0_15px_30px_rgba(0,0,0,0.8)] py-1 z-55 flex flex-col text-left text-[11px] text-zinc-300 pointer-events-auto leading-normal">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onInsertBlankPage?.();
                                setOpenMenuPageNum(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 hover:text-white flex items-center gap-2 font-black cursor-pointer"
                            >
                              <span>📄</span> <span>在本页后新建空白页</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicatePage?.(page.pageNumber);
                                setOpenMenuPageNum(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 hover:text-white flex items-center gap-2 font-black cursor-pointer"
                            >
                              <span>👥</span> <span>复制克隆本页</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRotatePage?.(page.pageNumber, 90);
                                setOpenMenuPageNum(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 hover:text-white flex items-center gap-2 font-black cursor-pointer"
                            >
                              <span>🔄</span> <span>顺时针旋转 90°</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRotatePage?.(page.pageNumber, 180);
                                setOpenMenuPageNum(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 hover:text-white flex items-center gap-2 font-black cursor-pointer"
                            >
                              <span>↩️</span> <span>快速水平翻转 180°</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSplitPage?.(page.pageNumber);
                                setOpenMenuPageNum(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-zinc-900 hover:text-white flex items-center gap-2 font-black cursor-pointer"
                            >
                              <span>✂️</span> <span>水平裁剪拆分此页</span>
                            </button>

                            <div className="h-[1px] bg-zinc-850 my-1" />

                            <button
                              disabled={pages.length <= 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (pages.length <= 1) return;
                                const confirmed = window.confirm(`确认删除第 ${page.pageNumber} 页吗？`);
                                if (confirmed) {
                                  onDeletePage?.(page.pageNumber);
                                }
                                setOpenMenuPageNum(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-red-950/20 hover:text-red-400 text-red-500 flex items-center gap-2 font-black disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                            >
                              <span>🗑️</span> <span>安全移除此页面</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <span className={`text-[10.5px] font-bold transition-colors ${
                      isActive ? 'text-indigo-455' : 'text-zinc-500 group-hover:text-zinc-350'
                    }`}>
                      第 {page.pageNumber} 页
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ANNOTATIONS TAB */}
          {activeTab === 'annotations' && (
            <div className="space-y-4">
              <div className="space-y-2">
                {/* Search field */}
                <input
                  type="text"
                  placeholder="搜索批注内容/作者"
                  value={annotationSearch}
                  onChange={(e) => setAnnotationSearch(e.target.value)}
                  className="w-full bg-[#101014] border border-zinc-800 text-xs text-zinc-200 px-2.5 py-1.5 rounded-lg focus:outline-none placeholder-zinc-600 focus:border-zinc-700 font-sans"
                />

                {/* Filter Selector */}
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-[9.5px]">
                  {(['all', 'highlight', 'pen', 'text', 'rect'] as const).map((t) => {
                    const labels = { all: '全部', highlight: '高亮', pen: '画笔', text: '文本', rect: '矩形' };
                    return (
                      <button
                        key={t}
                        onClick={() => setAnnotationFilter(t)}
                        className={`px-2 py-0.5 rounded-full transition font-black border text-nowrap shrink-0 cursor-pointer ${
                          annotationFilter === t
                            ? 'bg-indigo-900 border-indigo-700 text-indigo-200'
                            : 'bg-zinc-950/80 border-zinc-850 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {labels[t]}
                      </button>
                    );
                  })}
                </div>

                {/* Export button */}
                <button
                  onClick={handleExportAnnotations}
                  className="w-full py-1.5 px-3 border border-zinc-805 bg-[#121216]/80 hover:bg-[#18181f] text-zinc-300 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="一键快速备份和导出批注日志"
                >
                  📥 导出批注报表 (JSON)
                </button>
              </div>

              {/* List Content */}
              {annotations.filter(ann => {
                const comment = ann.comment || ann.text || '';
                const author = ann.author || '本地设计师';
                const matchSearch = comment.toLowerCase().includes(annotationSearch.toLowerCase()) || author.toLowerCase().includes(annotationSearch.toLowerCase());
                const matchType = annotationFilter === 'all' || ann.type === annotationFilter;
                return matchSearch && matchType;
              }).length === 0 ? (
                <div className="py-8 text-center text-zinc-650 text-xs flex flex-col items-center gap-1">
                  <span>🍃 无匹配的批注内容</span>
                  <p className="text-[10px] text-zinc-600 max-w-[180px] p-1 text-center scale-95">您可以试着调整上方的类别过滤框或追加新的文本及画笔标记</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {annotations.filter(ann => {
                    const comment = ann.comment || ann.text || '';
                    const author = ann.author || '本地设计师';
                    const matchSearch = comment.toLowerCase().includes(annotationSearch.toLowerCase()) || author.toLowerCase().includes(annotationSearch.toLowerCase());
                    const matchType = annotationFilter === 'all' || ann.type === annotationFilter;
                    return matchSearch && matchType;
                  }).map((ann) => {
                    const isSelected = ann.pageNumber === currentPage;
                    const comment = ann.comment || ann.text || (ann.type === 'pen' ? '自由笔绘' : ann.type === 'rect' ? '强调框定' : '荧光标注');
                    
                    const icons = {
                      highlight: '🎨',
                      pen: '✏️',
                      text: '💬',
                      rect: '🔲'
                    };

                    return (
                      <div
                        key={ann.id}
                        onClick={() => onPageClick(ann.pageNumber)}
                        className={`w-full text-left p-2.5 rounded-xl text-xs flex flex-col gap-1 cursor-pointer transition border ${
                          isSelected
                            ? 'bg-indigo-950/25 border-indigo-900/60 shadow-md'
                            : 'bg-[#101014]/60 hover:bg-[#15151b] text-zinc-300 border-zinc-850 hover:border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-[10.5px]">
                          <span className="flex items-center gap-1.5 text-zinc-200">
                            <span>{icons[ann.type as keyof typeof icons] || '📝'}</span>
                            <span className="truncate max-w-[110px] font-display text-zinc-300">{comment}</span>
                          </span>
                          <span className="text-[9.5px] px-1 py-0.2 bg-zinc-900 border border-zinc-800 rounded font-black text-indigo-400 shrink-0">
                            第 {ann.pageNumber} 页
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono mt-1 pt-1 border-t border-zinc-900">
                          <span className="font-sans font-semibold text-zinc-400">👤 {ann.author || '本地设计师'}</span>
                          <span>🕒 {ann.createdAt || '刚刚'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* BOOK_MARKS TAB */}
          {activeTab === 'bookmarks' && (
            <div className="space-y-3.5 select-none">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black text-zinc-550 uppercase">我的注释点书签</span>
                <button
                  type="button"
                  onClick={() => setShowAddBookmark(!showAddBookmark)}
                  className="p-1 rounded bg-zinc-900 hover:bg-[#1a1a1e] text-zinc-350 hover:text-indigo-404 transition flex items-center justify-center cursor-pointer border border-zinc-800"
                  title="添加当前页面至书签书柜"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {showAddBookmark && (
                <form onSubmit={handleAddBookmark} className="p-2.5 rounded-xl border border-zinc-808 bg-[#101014] flex flex-col gap-2.5">
                  <span className="text-[9px] font-black text-indigo-400 flex items-center gap-1">书签定位: 第 {currentPage} 页</span>
                  <input
                    type="text"
                    required
                    placeholder="例如：需修改此页中公式二参数"
                    value={newBookmarkLabel}
                    onChange={(e) => setNewBookmarkLabel(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 p-1.5 rounded-lg focus:outline-none placeholder-zinc-600 focus:border-zinc-700"
                  />
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-[10px] py-1 px-2 rounded-md transition"
                    >
                      确定添加
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddBookmark(false)}
                      className="px-2 py-1 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 font-bold text-[10px] rounded-md transition"
                    >
                      取消
                    </button>
                  </div>
                </form>
              )}

              {bookmarks.length === 0 ? (
                <div className="py-8 text-center text-zinc-600 text-xs flex flex-col items-center gap-1">
                  <span>🍃 书签夹空空如也</span>
                  <p className="text-[10px] text-zinc-550 max-w-[180px] p-1">可在当前喜欢的重要页面点击上方 [＋] 进行记录标注</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {bookmarks.map((bmk) => {
                    const isSelected = bmk.pageNumber === currentPage;
                    return (
                      <div
                        key={bmk.id}
                        onClick={() => onPageClick(bmk.pageNumber)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-start justify-between gap-1 cursor-pointer transition select-none group border ${
                          isSelected
                            ? 'bg-indigo-950/30 border-indigo-900/50 text-indigo-350'
                            : 'bg-[#101014]/40 hover:bg-zinc-900/60 text-zinc-300 border-transparent'
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-extrabold truncate max-w-[160px]">{bmk.label}</span>
                          <span className="text-[9px] text-zinc-550 font-mono mt-0.5">第 {bmk.pageNumber} 页 • {bmk.createdAt}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteBookmark(bmk.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-950/20 text-zinc-500 hover:text-red-400 transition"
                          title="删除此书签"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* HIS_TORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-3 font-sans select-none">
              <span className="block px-1 text-[8.5px] font-black text-zinc-550 uppercase">变更行为轨迹面板</span>
              <div className="relative border-l border-zinc-850 pl-3.5 ml-2.5 py-1 space-y-4">
                {getAuditHistory().map((log) => (
                  <div key={log.id} className="relative group/log">
                    {/* Circle icon placement */}
                    <div className="absolute -left-[20px] top-0.5 w-[9px] h-[9px] rounded-full bg-zinc-800 border-2 border-zinc-950 group-hover/log:border-indigo-500 transition-colors" />
                    
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10.5px] font-black text-zinc-300">{log.action}</span>
                        <span className="text-[8px] font-mono text-zinc-550">{log.time}</span>
                      </div>
                      <span className="text-[9.5px] text-zinc-500 mt-0.5 font-medium">{log.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </aside>
  );
}
