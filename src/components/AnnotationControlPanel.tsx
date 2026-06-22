import { MousePointer, Highlighter, Pencil, Type, Square, Eraser, Trash2, Undo2 } from 'lucide-react';
import { ToolType } from '../types';

interface AnnotationControlPanelProps {
  activeTool: ToolType;
  activeColor: string;
  activeThickness: number;
  onToolSelect: (tool: ToolType) => void;
  onColorSelect: (color: string) => void;
  onThicknessChange: (thickness: number) => void;
  onUndo: () => void;
  onClearPage: () => void;
  hasAnnotations: boolean;
}

export default function AnnotationControlPanel({
  activeTool,
  activeColor,
  activeThickness,
  onToolSelect,
  onColorSelect,
  onThicknessChange,
  onUndo,
  onClearPage,
  hasAnnotations,
}: AnnotationControlPanelProps) {
  const tools = [
    { id: 'select' as ToolType, label: '对象选择', icon: MousePointer, tooltip: '选择并管理已有批注 (按Del键删除)' },
    { id: 'highlight' as ToolType, label: '高亮笔', icon: Highlighter, tooltip: '画笔拖拽：绘制半透明荧光高亮框' },
    { id: 'pen' as ToolType, label: '自由画笔', icon: Pencil, tooltip: '自由手绘：在页面上随意书写手绘' },
    { id: 'text' as ToolType, label: '文字标注', icon: Type, tooltip: '点击页面任意位置：插入文字批注标签' },
    { id: 'rect' as ToolType, label: '矩形圈地', icon: Square, tooltip: '拖拽圈地：绘制重点矩形框' },
    { id: 'eraser' as ToolType, label: '橡皮擦', icon: Eraser, tooltip: '点击要删除的批注：进行即时擦除' },
  ];

  const thicknesses = [
    { value: 2, label: '细(2px)' },
    { value: 5, label: '中(5px)' },
    { value: 10, label: '粗(10px)' },
  ];

  return (
    <div className="bg-white p-3 flex flex-col gap-3 select-none w-full">
      {/* Design Heading */}
      <div className="flex flex-col border-b border-zinc-100 pb-2 w-full">
        <span className="text-[10px] font-black text-blue-600 tracking-wider">MARKUP TOOLS</span>
        <span className="text-[11px] text-zinc-500 font-extrabold mt-0.5">批注工具箱</span>
      </div>

      {/* Grid of Tools (6 boxes as 3x2 grid or vertical layout) */}
      <div className="grid grid-cols-3 gap-1.5 w-full shrink-0">
        {tools.map((t) => {
          const isActive = activeTool === t.id;
          const Icon = t.icon;

          return (
            <button
              key={t.id}
              id={`tool-btn-${t.id}`}
              onClick={() => onToolSelect(t.id)}
              className={`p-2 rounded-xl transition-all relative group flex flex-col items-center justify-center border-2 ${
                isActive
                  ? 'bg-blue-55/90 text-blue-600 border-blue-600 ring-4 ring-blue-500/10 shadow-sm scale-[1.02] font-black'
                  : 'text-zinc-500 border-zinc-100 hover:text-zinc-800 hover:bg-zinc-100 hover:border-zinc-200'
              }`}
              title={t.label}
            >
              <Icon className="h-4.5 w-4.5" />
              <span className="text-[9px] font-bold mt-1 text-zinc-500 group-hover:text-zinc-750 block truncate w-full text-center">
                {t.label.slice(0, 4)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="h-[1px] w-full bg-zinc-100" />

      {/* Stroke Line Widths */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-zinc-400">画笔粗细</span>
        <div className="grid grid-cols-3 gap-1">
          {thicknesses.map((th) => {
            const isSelected = activeThickness === th.value;
            return (
              <button
                key={th.value}
                onClick={() => onThicknessChange(th.value)}
                className={`text-[10px] py-1 rounded-lg font-bold flex items-center justify-center transition border ${
                  isSelected
                    ? 'bg-blue-50 text-blue-600 border-blue-200 font-black'
                    : 'text-zinc-400 border-zinc-100 hover:text-zinc-700 hover:bg-zinc-50'
                }`}
                title={th.label}
              >
                {th.value} px
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[1px] w-full bg-zinc-100" />

      {/* Undo & Reset actions */}
      <div className="flex items-center gap-1.5 w-full">
        <button
          id="undo-markup-btn"
          disabled={!hasAnnotations}
          onClick={onUndo}
          className={`flex-1 py-1.5 rounded-lg transition border flex items-center justify-center gap-1 text-[10px] font-bold ${
            hasAnnotations
              ? 'text-zinc-750 bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
              : 'text-zinc-300 border-zinc-100 cursor-not-allowed opacity-40 bg-zinc-50'
          }`}
          title="撤销上一步"
        >
          <Undo2 className="h-3 w-3" />
          <span>撤销</span>
        </button>

        <button
          id="clear-page-markup-btn"
          disabled={!hasAnnotations}
          onClick={onClearPage}
          className={`flex-1 py-1.5 rounded-lg transition border flex items-center justify-center gap-1 text-[10px] font-bold ${
            hasAnnotations
              ? 'text-red-650 bg-white border-zinc-200 hover:border-red-200 hover:bg-red-50/50'
              : 'text-zinc-300 border-zinc-100 cursor-not-allowed opacity-40 bg-zinc-50'
          }`}
          title="清空当前页面标注"
        >
          <Trash2 className="h-3 w-3" />
          <span>清空页</span>
        </button>
      </div>
    </div>
  );
}
