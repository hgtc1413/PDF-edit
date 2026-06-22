import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Type, Check, X, Eraser } from 'lucide-react';
import { PDFAnnotation, ToolType, HighlightPoint } from '../types';

interface PDFAnnotationOverlayProps {
  pageWidth: number;
  pageHeight: number;
  pageNumber: number;
  activeTool: ToolType;
  activeColor: string;
  activeThickness: number;
  annotations: PDFAnnotation[];
  onAddAnnotation: (ann: PDFAnnotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onClearAnnotations: () => void;
}

export default function PDFAnnotationOverlay({
  pageWidth,
  pageHeight,
  pageNumber,
  activeTool,
  activeColor,
  activeThickness,
  annotations,
  onAddAnnotation,
  onDeleteAnnotation,
  onClearAnnotations,
}: PDFAnnotationOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // States for active drawing interaction
  const [isDrawing, setIsDrawing] = useState(false);
  const [activePoints, setActivePoints] = useState<HighlightPoint[]>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  // Text insertion state
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textVal, setTextVal] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  // Clear selected ID if the tool changes
  useEffect(() => {
    setSelectedId(null);
  }, [activeTool]);

  // Focus text input when it opens
  useEffect(() => {
    if (textInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInput]);

  // Handle keyboard Delete / Backspace keys in non-input contexts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          return;
        }
        onDeleteAnnotation(selectedId);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, onDeleteAnnotation]);

  const getRelativeCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent triggering overlay actions if we clicked on children input forms
    if ((e.target as HTMLElement).closest('.text-draft-input-container')) {
      return;
    }

    // Done text editing if we click elsewhere while text drafting is active
    if (textInput) {
      submitTextAnnotation();
      return;
    }

    const coords = getRelativeCoords(e);

    if (activeTool === 'select') {
      // Direct selection or clearing selections
      return;
    }

    if (activeTool === 'eraser') {
      // Eraser does not use drawing drags
      return;
    }

    if (activeTool === 'text') {
      setTextInput({ x: coords.x, y: coords.y });
      setTextVal('');
      return;
    }

    // Active tool is drawing: highlight shapes, pens or box rect overlay
    setIsDrawing(true);
    if (activeTool === 'pen') {
      setActivePoints([{ x: coords.x, y: coords.y }]);
    } else if (activeTool === 'highlight' || activeTool === 'rect') {
      setDragStart({ x: coords.x, y: coords.y });
      setDragCurrent({ x: coords.x, y: coords.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return;
    const coords = getRelativeCoords(e);

    if (activeTool === 'pen') {
      setActivePoints((prev) => [...prev, { x: coords.x, y: coords.y }]);
    } else if ((activeTool === 'highlight' || activeTool === 'rect') && dragStart) {
      setDragCurrent({ x: coords.x, y: coords.y });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeTool === 'pen' && activePoints.length > 0) {
      const newAnn: PDFAnnotation = {
        id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'pen',
        pageNumber,
        color: activeColor,
        points: activePoints,
        thickness: activeThickness,
        author: '本地设计师',
        comment: '绘制自由笔划线条',
        createdAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      };
      onAddAnnotation(newAnn);
      setActivePoints([]);
    } else if ((activeTool === 'highlight' || activeTool === 'rect') && dragStart && dragCurrent) {
      const rx = Math.min(dragStart.x, dragCurrent.x);
      const ry = Math.min(dragStart.y, dragCurrent.y);
      const rw = Math.abs(dragCurrent.x - dragStart.x);
      const rh = Math.abs(dragCurrent.y - dragStart.y);

      // ignore simple drag-and-click mistakes
      if (rw > 0.003 && rh > 0.003) {
        if (activeTool === 'highlight') {
          const newAnn: PDFAnnotation = {
            id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'highlight',
            pageNumber,
            color: activeColor,
            x: rx,
            y: ry,
            width: rw,
            height: rh,
            author: '本地设计师',
            comment: '荧光背景重点高亮',
            createdAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          };
          onAddAnnotation(newAnn);
        } else {
          // rect container (border box)
          const newAnn: PDFAnnotation = {
            id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'rect',
            pageNumber,
            color: activeColor,
            x: rx,
            y: ry,
            width: rw,
            height: rh,
            isFilled: false, // hollow border line
            author: '本地设计师',
            comment: '添加矩形对齐线框',
            createdAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          };
          onAddAnnotation(newAnn);
        }
      }
      setDragStart(null);
      setDragCurrent(null);
    }
  };

  const submitTextAnnotation = () => {
    if (textInput && textVal.trim() !== '') {
      const newAnn: PDFAnnotation = {
        id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'text',
        pageNumber,
        color: activeColor,
        text: textVal,
        x: textInput.x,
        y: textInput.y,
        fontSize: 14,
        author: '本地设计师',
        comment: textVal,
        createdAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      };
      onAddAnnotation(newAnn);
    }
    setTextInput(null);
    setTextVal('');
  };

  // Safe color utility mapping for rendering
  const getColorHex = (cName: string, alpha = 1) => {
    const map: Record<string, string> = {
      yellow: `rgba(234, 179, 8, ${alpha})`,
      emerald: `rgba(16, 185, 129, ${alpha})`,
      blue: `rgba(59, 130, 246, ${alpha})`,
      red: `rgba(239, 68, 68, ${alpha})`,
      purple: `rgba(168, 85, 247, ${alpha})`,
      black: `rgba(20, 20, 20, ${alpha})`,
      white: `rgba(255, 255, 255, ${alpha})`,
    };
    return map[cName] || `rgba(234, 179, 8, ${alpha})`;
  };

  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`absolute inset-0 z-30 transition-all select-none ${
        activeTool === 'select'
          ? 'cursor-default'
          : activeTool === 'eraser'
          ? 'cursor-[cell] hover:brightness-110'
          : activeTool === 'text'
          ? 'cursor-text'
          : 'cursor-crosshair'
      }`}
      style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
    >
      {/* Target elements dynamic click overlays to clear annotations in rubber mode */}
      {activeTool === 'eraser' && (
        <div className="absolute top-2 right-2 bg-red-950/90 border border-red-500/50 rounded-full px-2.5 py-1 text-[10px] text-red-200 font-sans font-bold flex items-center gap-1.5 shadow-lg select-none pointer-events-none z-50">
          <Eraser className="h-3 w-3 animate-bounce" />
          <span>橡皮擦激活：点击要擦除的项目</span>
        </div>
      )}

      {/* Dynamic SVG Drawing Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Render Saved Annotations */}
        {pageAnnotations.map((ann) => {
          const isSelected = selectedId === ann.id;
          const isEraserMode = activeTool === 'eraser';

          // Select interaction wrappers
          const handleElementInteraction = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (isEraserMode) {
              onDeleteAnnotation(ann.id);
              if (selectedId === ann.id) setSelectedId(null);
            } else if (activeTool === 'select') {
              setSelectedId(ann.id);
            }
          };

          if (ann.type === 'highlight') {
            const rx = ann.x * pageWidth;
            const ry = ann.y * pageHeight;
            const rw = ann.width * pageWidth;
            const rh = ann.height * pageHeight;

            return (
              <g key={ann.id}>
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  fill={getColorHex(ann.color, 0.38)} // semi-transparent highlighter
                  className={`pointer-events-auto transition ${
                    isEraserMode
                      ? 'cursor-pointer hover:fill-red-500/40 hover:stroke-red-500 hover:stroke-2'
                      : activeTool === 'select'
                      ? 'cursor-pointer hover:fill-yellow-400/20'
                      : ''
                  }`}
                  onClick={handleElementInteraction}
                />
                {isSelected && (
                  <rect
                    x={rx - 3}
                    y={ry - 3}
                    width={rw + 6}
                    height={rh + 6}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                  />
                )}
              </g>
            );
          }

          if (ann.type === 'pen') {
            const pointsStr = ann.points
              .map((p) => `${p.x * pageWidth},${p.y * pageHeight}`)
              .join(' ');

            // Calculate scaled line stroke width responsive to current magnification
            const scaledStroke = ann.thickness * (pageWidth / 800);

            return (
              <g key={ann.id}>
                {/* Thick invisible click helper element to assist accurate selection/deletion */}
                {(activeTool === 'select' || isEraserMode) && (
                  <polyline
                    points={pointsStr}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={Math.max(16, scaledStroke + 12)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`pointer-events-auto cursor-pointer ${
                      isEraserMode ? 'hover:stroke-red-500/30' : 'hover:stroke-emerald-400/15'
                    }`}
                    onClick={handleElementInteraction}
                  />
                )}
                <polyline
                  points={pointsStr}
                  fill="none"
                  stroke={getColorHex(ann.color, isSelected ? 0.95 : 1.0)}
                  strokeWidth={scaledStroke}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={activeTool === 'select' || isEraserMode ? 'pointer-events-none' : ''}
                />
              </g>
            );
          }

          if (ann.type === 'rect') {
            const rx = ann.x * pageWidth;
            const ry = ann.y * pageHeight;
            const rw = ann.width * pageWidth;
            const rh = ann.height * pageHeight;

            return (
              <g key={ann.id}>
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  fill="none" // Hollow border frame representation
                  stroke={getColorHex(ann.color, isSelected ? 1.0 : 0.85)}
                  strokeWidth={isSelected ? 3.5 : 2}
                  strokeDasharray="4, 3"
                  className={`pointer-events-auto transition ${
                    isEraserMode
                      ? 'cursor-pointer hover:stroke-red-500 hover:fill-red-500/10'
                      : activeTool === 'select'
                      ? 'cursor-pointer hover:stroke-emerald-400'
                      : ''
                  }`}
                  onClick={handleElementInteraction}
                />
                {isSelected && (
                  <rect
                    x={rx - 4}
                    y={ry - 4}
                    width={rw + 8}
                    height={rh + 8}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1"
                  />
                )}
              </g>
            );
          }

          return null;
        })}

        {/* Real-time Ink Draft Lines Feedback Overlay */}
        {activeTool === 'pen' && activePoints.length > 0 && (
          <polyline
            points={activePoints
              .map((p) => `${p.x * pageWidth},${p.y * pageHeight}`)
              .join(' ')}
            fill="none"
            stroke={getColorHex(activeColor, 0.9)}
            strokeWidth={activeThickness * (pageWidth / 800)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Real-time Highlighting Box Drag Feedback Overlay */}
        {activeTool === 'highlight' && dragStart && dragCurrent && (
          <rect
            x={Math.min(dragStart.x, dragCurrent.x) * pageWidth}
            y={Math.min(dragStart.y, dragCurrent.y) * pageHeight}
            width={Math.abs(dragCurrent.x - dragStart.x) * pageWidth}
            height={Math.abs(dragCurrent.y - dragStart.y) * pageHeight}
            fill={getColorHex(activeColor, 0.3)}
            stroke={getColorHex(activeColor, 0.65)}
            strokeWidth={1.5}
            strokeDasharray="2, 2"
          />
        )}

        {/* Real-time Hollow Rect Frame Box Drag Feedback Overlay */}
        {activeTool === 'rect' && dragStart && dragCurrent && (
          <rect
            x={Math.min(dragStart.x, dragCurrent.x) * pageWidth}
            y={Math.min(dragStart.y, dragCurrent.y) * pageHeight}
            width={Math.abs(dragCurrent.x - dragStart.x) * pageWidth}
            height={Math.abs(dragCurrent.y - dragStart.y) * pageHeight}
            fill="none"
            stroke={getColorHex(activeColor, 0.9)}
            strokeWidth={2}
            strokeDasharray="4, 2"
          />
        )}
      </svg>

      {/* Render HTML tags for Text Comments */}
      {pageAnnotations.map((ann) => {
        if (ann.type !== 'text') return null;

        const isSelected = selectedId === ann.id;
        const colorStyle = getColorHex(ann.color, 1.0);
        const isEraserMode = activeTool === 'eraser';

        return (
          <div
            key={ann.id}
            onClick={(e) => {
              e.stopPropagation();
              if (isEraserMode) {
                onDeleteAnnotation(ann.id);
                if (selectedId === ann.id) setSelectedId(null);
              } else if (activeTool === 'select') {
                setSelectedId(ann.id);
              }
            }}
            className={`absolute px-2.5 py-1.5 rounded-lg select-none cursor-pointer transition-all ${
              isEraserMode
                ? 'hover:bg-red-950/60 hover:text-red-400 hover:border-red-500/60 border border-transparent cursor-pointer'
                : isSelected
                ? 'bg-zinc-950/95 border-2 border-emerald-500 shadow-xl scale-105 z-40'
                : 'hover:bg-zinc-900/40 hover:border-zinc-700/80 border border-transparent'
            }`}
            style={{
              left: `${ann.x * 100}%`,
              top: `${ann.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              color: isEraserMode ? undefined : colorStyle,
              fontSize: `${ann.fontSize}px`,
              fontWeight: 650,
            }}
          >
            {ann.text}
          </div>
        );
      })}

      {/* Dynamic Text Dialog Input Balloon */}
      {textInput && (
        <div
          className="absolute z-50 bg-zinc-900 border border-zinc-700 p-2 rounded-xl shadow-2xl flex items-center gap-1.5 text-draft-input-container"
          style={{
            left: `${textInput.x * 100}%`,
            top: `${textInput.y * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="bg-zinc-950 px-1.5 py-0.5 rounded text-[8px] font-sans font-bold text-zinc-400 shrink-0 select-none uppercase">
            添加文本
          </div>
          <input
            ref={textInputRef}
            type="text"
            placeholder="输入标注文字并确认..."
            value={textVal}
            onChange={(e) => setTextVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitTextAnnotation();
              if (e.key === 'Escape') setTextInput(null);
            }}
            className="bg-zinc-950 border border-zinc-800 text-xs font-semibold rounded px-2 py-1.5 focus:outline-none focus:border-zinc-650 text-white min-w-[140px]"
            style={{ color: getColorHex(activeColor, 1.0) }}
          />
          <button
            onClick={submitTextAnnotation}
            className="p-1 rounded bg-emerald-500 hover:bg-emerald-600 text-zinc-950 transition"
            title="确认添加"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setTextInput(null)}
            className="p-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white transition"
            title="取消"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Floating Toolbar details for standard Selected markup elements */}
      {selectedId && (
        <div
          className="absolute top-4 left-4 z-40 bg-zinc-900/95 backdrop-blur-md border border-red-500/30 px-3 py-1.5 rounded-xl flex items-center gap-3 shadow-2xl animate-in fade-in duration-150"
        >
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-zinc-500 leading-none uppercase">SELECTED</span>
            <span className="text-[11px] font-bold text-zinc-200 leading-none mt-1">
              {(() => {
                const item = annotations.find((a) => a.id === selectedId) as any;
                if (!item) return '';
                if (item.type === 'highlight') return '荧光框线高亮';
                if (item.type === 'pen') return '自由手绘线条';
                if (item.type === 'text') return '文字批注';
                if (item.type === 'rect') return '重点圈出矩形';
                return String(item.type).toUpperCase();
              })()}
            </span>
          </div>
          <div className="w-[1px] h-6 bg-zinc-800" />
          <button
            onClick={() => {
              onDeleteAnnotation(selectedId);
              setSelectedId(null);
            }}
            className="p-1 px-2.5 rounded bg-red-500 hover:bg-red-600 text-white font-bold text-xs flex items-center gap-1 transition"
            title="删除标注"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>删除</span>
          </button>
        </div>
      )}
    </div>
  );
}
