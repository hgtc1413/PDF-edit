import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface PDFUploadZoneProps {
  onFileSelected: (file: File) => void;
  onLoadSample?: () => void;
}

export default function PDFUploadZone({ onFileSelected, onLoadSample }: PDFUploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('请上传有效的 PDF 文件 (.pdf)');
      return;
    }
    setError(null);
    onFileSelected(file);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      // Skip file processing if user is currently pasting text inside formatting inputs or text areas
      if (
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const filesArray = Array.from(e.clipboardData.files);
        // Find the first PDF file being copied/pasted from system clipboard
        const pdfFile = filesArray.find(
          (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        );
        if (pdfFile) {
          e.preventDefault();
          processFile(pdfFile);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [onFileSelected]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8 select-none">
      <div className="text-center mb-10 max-w-lg transition-transform duration-500">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600/10 border border-indigo-505/20 rounded-full mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-[10px] font-extrabold tracking-[0.1em] text-indigo-300 uppercase">
            SECURE LOCAL ENGINE
          </span>
        </div>
        <h1 id="app-title-main" className="text-4xl md:text-5xl font-black tracking-tight text-white mb-3 pb-1 bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
          AI PDF 智能编辑智库
        </h1>
        <p className="text-sm text-zinc-400 font-medium max-w-md mx-auto leading-relaxed">
          上传 PDF 文档，立即在本地触发全功能渲染、图纸批注、文字编辑与深度 AI 智能对话，数据不离开浏览器。
        </p>
      </div>

      <div
        id="pdf-drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        className={`w-full max-w-xl aspect-[1.5/1] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-8 cursor-pointer transition-all duration-350 relative group overflow-hidden ${
          isDragActive
            ? 'border-indigo-550 bg-indigo-950/40 shadow-[0_0_30px_rgba(99,102,241,0.25)] scale-[1.015]'
            : 'border-zinc-800 bg-zinc-900/60 backdrop-blur-xl hover:border-indigo-500/50 hover:bg-zinc-850/70 shadow-2xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]'
        }`}
      >
        {/* Sleek radial glow decoration inside the card */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-600/20 transition-all duration-500" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-600/20 transition-all duration-500" />

        <input
          id="pdf-file-input"
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,application/pdf"
          onChange={handleFileInput}
        />

        <div className={`p-4.5 rounded-2xl mb-5 transition-transform duration-350 group-hover:scale-110 ${
          isDragActive 
            ? 'bg-indigo-550/20 text-indigo-400 shadow-lg' 
            : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
        }`}>
          {isDragActive ? (
            <Upload className="h-10 w-10 animate-spin" />
          ) : (
            <FileText className="h-10 w-10 text-indigo-400" />
          )}
        </div>

        <p className="text-base font-bold text-zinc-100 text-center mb-1.5 px-4">
          {isDragActive ? '释放鼠标追加 PDF' : '拖拽 PDF 到此处，或从外部剪切板直接粘贴'}
        </p>
        <p className="text-xs text-zinc-400 text-center mb-6 leading-relaxed max-w-sm">
          点击选取本地文件，支持快捷键 
          <span className="inline-flex gap-0.5 mx-1">
            <kbd className="px-1.5 py-0.5 text-[9px] bg-zinc-800 border border-zinc-700 rounded font-mono text-zinc-300 font-black shadow-inner">Ctrl</kbd>
            <span className="text-zinc-650 font-bold">+</span>
            <kbd className="px-1.5 py-0.5 text-[9px] bg-zinc-800 border border-zinc-700 rounded font-mono text-zinc-300 font-black shadow-inner">V</kbd>
          </span> 
          自动载入
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 z-20">
          <button
            id="select-file-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onButtonClick();
            }}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 text-white font-extrabold text-xs tracking-wider uppercase shadow-[0_4px_24px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_30px_rgba(99,102,241,0.45)] transition-all transform hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 cursor-pointer text-center"
          >
            导入 PDF 文件
          </button>

          {onLoadSample && (
            <button
              id="load-sample-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLoadSample();
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-indigo-300 font-extrabold text-xs hover:border-indigo-400 hover:text-white transition-all transform hover:-translate-y-0.5"
            >
              🚀 导入高精设计底稿示例
            </button>
          )}
        </div>
      </div>

      {error && (
        <div id="upload-error-banner" className="mt-6 flex items-center gap-3 bg-red-950/40 text-red-400 border border-red-900/50 px-5 py-3.5 rounded-2xl max-w-md animate-bounce shadow-lg">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <span className="text-xs font-bold">{error}</span>
        </div>
      )}

      {/* Subtle safety prompt */}
      <div className="mt-12 flex items-center gap-2 text-[11px] text-zinc-500 font-semibold tracking-wide">
        <span className="w-1 w-1 bg-emerald-500 rounded-full animate-pulse" />
        所有渲染与修改均由浏览器沙盒本地运行，隐私万无一失
      </div>
    </div>
  );
}
