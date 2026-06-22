import { useEffect, useRef, useState } from 'react';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { PDFPageInfo, PDFAnnotation, ToolType, WorkMode, TextEdit } from '../types';
import PDFAnnotationOverlay from './PDFAnnotationOverlay';
import PDFTextEditOverlay from './PDFTextEditOverlay';

interface PDFMainViewProps {
  pdfDoc: any; // PDFDocumentProxy from pdf.js
  currentPage: number;
  totalPages: number;
  zoomScale: number;
  workMode: WorkMode;
  textEdits: TextEdit[];
  onSaveTextEdit: (edit: TextEdit) => void;
  onDeleteTextEdit: (id: string) => void;
  onBatchSaveTextEdits?: (edits: TextEdit[]) => void;
  onPageChange: (page: number) => void;
  annotations: PDFAnnotation[];
  activeTool: ToolType;
  activeColor: string;
  activeThickness: number;
  onAddAnnotation: (ann: PDFAnnotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onClearAnnotations: () => void;
  
  activeFontSize: number;
  pages?: PDFPageInfo[];
  activeEditTool?: 'select' | 'line' | 'rect' | 'ellipse' | 'arrow' | 'stamp';
  onChangeEditTool?: (tool: 'select' | 'line' | 'rect' | 'ellipse' | 'arrow' | 'stamp') => void;
  selectedElem?: TextEdit | null;
  onSelectedElemChange?: (elem: TextEdit | null) => void;
  apiKey?: string;
}

export default function PDFMainView({
  pdfDoc,
  currentPage,
  totalPages,
  zoomScale,
  workMode,
  textEdits,
  onSaveTextEdit,
  onDeleteTextEdit,
  onBatchSaveTextEdits,
  onPageChange,
  annotations,
  activeTool,
  activeColor,
  activeThickness,
  onAddAnnotation,
  onDeleteAnnotation,
  onClearAnnotations,
  activeFontSize,
  pages = [],
  activeEditTool = 'select',
  onChangeEditTool,
  selectedElem = null,
  onSelectedElemChange,
  apiKey,
}: PDFMainViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Keep track of rendered width and height for coordinate calculations
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    let isCurrent = true;

    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        setIsRendering(true);
        setRenderError(null);

        // Cancel previous rendering task if it exists
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {
            // ignore
          }
          renderTaskRef.current = null;
        }

        const activePageInfo = pages.find((p) => p.pageNumber === currentPage);
        const originalPageNumber = activePageInfo?.originalPageNumber ?? currentPage;

        if (originalPageNumber === -1) {
          const width = (activePageInfo?.width ?? 595) * zoomScale;
          const height = (activePageInfo?.height ?? 842) * zoomScale;
          setPageSize({ width, height });

          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');
          if (context) {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            context.scale(dpr, dpr);

            // Fill background as white
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, width, height);

            // Draw dashed border / margins
            context.lineWidth = 1;
            context.strokeStyle = '#E4E4E7';
            context.setLineDash([5, 5]);
            context.strokeRect(10, 10, width - 20, height - 20);

            context.setLineDash([]);
            context.fillStyle = '#A1A1AA';
            context.font = 'bold 16px sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('📄 自定义插入的空白页 (Blank Page)', width / 2, height / 2);
          }
          if (isCurrent) {
            setIsRendering(false);
          }
          return;
        }

        const pageDoc = activePageInfo?.pdfDoc ?? pdfDoc;
        if (!pageDoc) return;

        const page = await pageDoc.getPage(originalPageNumber);
        if (!isCurrent) return;

        const rotationAngle = ((page.rotation || 0) + (activePageInfo?.rotation || 0)) % 360;
        const viewport = page.getViewport({ scale: zoomScale, rotation: rotationAngle });

        // Update dimension info state
        setPageSize({ width: viewport.width, height: viewport.height });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Retina display scale adjustments for super crisp render
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.scale(dpr, dpr);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;

        if (isCurrent) {
          setIsRendering(false);
        }
      } catch (error: any) {
        if (error.name === 'RenderingCancelledException' || error.message?.includes('cancelled')) {
          // Normal cancellation, do not trigger error state
          return;
        }
        console.error('Error rendering page:', error);
        if (isCurrent) {
          setRenderError('页面渲染失败。请尝试点击上方或左侧切换页面重试。');
          setIsRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      isCurrent = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [pdfDoc, currentPage, zoomScale, pages]);

  return (
    <main className={`flex-grow overflow-auto flex flex-col md:flex-row items-stretch justify-start h-[calc(100vh-65px-32px)] relative transition-colors duration-300 ${
      workMode === 'edit' ? 'bg-[#060608]' : 'bg-[#0f0f11] bg-[radial-gradient(#27272a_1px,transparent_1px)] bg-[size:24px_24px]'
    }`}>
      {/* Main Workspace Frame with zero redundant horizontal gutters */}
      <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto px-2 py-3 md:px-4 md:py-6 relative select-none">
        {/* Floating loading overlay for zoom/render feedback */}
        {isRendering && (
          <div className="absolute top-3 right-3 bg-zinc-900/90 backdrop-blur-md border border-zinc-800/80 px-3.5 py-1.5 rounded-full flex items-center gap-2 shadow-lg z-25">
            <Loader2 className="h-3.5 w-3.5 text-indigo-500 animate-spin" />
            <span className="text-[10px] font-extrabold text-indigo-400 font-sans tracking-wide">
              正在绘制高精图纸...
            </span>
          </div>
        )}

        {/* Actual Rendered PDF Document Paper Wrapper with thick shadows */}
        <div className="flex-grow flex items-center justify-center w-full min-h-0 relative z-10 py-1">
          {renderError ? (
            <div className="max-w-md bg-red-950/30 border border-red-900/50 text-red-400 p-6 rounded-2xl text-center shadow-lg">
              <p className="font-bold text-sm mb-1 text-red-300">{renderError}</p>
              <p className="text-xs text-zinc-500">
                无法加载当前渲染图层。您可以尝试切换页面目录、手动载入或重设画板缩放。
              </p>
            </div>
          ) : (
            <div className="relative group max-w-full">
              {/* 3D stage effects: diffuse bottom occlusion & reflection shadows */}
              <div className="absolute -inset-[3px] rounded-2xl bg-gradient-to-r from-indigo-500/10 to-indigo-500/20 opacity-85 blur-xl pointer-events-none -z-10 group-hover:opacity-100 transition-opacity duration-300" />
              {/* Soft edge glow highlight */}
              <div className="absolute -inset-[1px] rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-all duration-300 blur-[2px] pointer-events-none -z-10" />
              {/* Deep black diffuse reflection footprint at the bottom to give "floor depth" feel */}
              <div className="absolute -bottom-10 left-8 right-8 h-10 bg-black/95 rounded-full blur-[35px] pointer-events-none -z-10 opacity-100 scale-95 group-hover:scale-100 group-hover:-bottom-12 group-hover:blur-[40px] transition-all duration-300" />
              <div className="absolute -bottom-6 left-16 right-16 h-6 bg-indigo-500/20 rounded-full blur-[20px] pointer-events-none -z-10 opacity-70 group-hover:opacity-100 transition-opacity duration-300" />

              <div
                id="pdf-canvas-container"
                className={`relative rounded-xl bg-white transition-all duration-300 max-w-full ${
                  workMode === 'edit'
                    ? 'border-2 border-sky-400 ring-4 ring-sky-500/20 shadow-[0_0_50px_rgba(56,189,248,0.3)]'
                    : 'border border-zinc-950 shadow-[0_30px_80px_rgba(0,0,0,0.78),_0_0_1px_rgba(255,255,255,0.08),_0_0_40px_rgba(99,102,241,0.05)] hover:shadow-[0_45px_100px_rgba(0,0,0,0.88),_0_0_1px_rgba(255,255,255,0.15),_0_0_50px_rgba(99,102,241,0.1)] hover:-translate-y-1.5'
                }`}
              >
                <canvas
                  ref={canvasRef}
                  className="rounded-xl max-w-full"
                  style={{ opacity: 1 }}
                />

                {/* PDF Interaction Layer */}
                {!isRendering && pageSize.width > 0 && (
                  <>
                    <PDFTextEditOverlay
                      pdfDoc={pages.find(p => p.pageNumber === currentPage)?.pdfDoc ?? pdfDoc}
                      pageWidth={pageSize.width}
                      pageHeight={pageSize.height}
                      pageNumber={currentPage}
                      originalPageNumber={pages.find(p => p.pageNumber === currentPage)?.originalPageNumber}
                      zoomScale={zoomScale}
                      activeColor={activeColor}
                      activeFontSize={activeFontSize}
                      textEdits={textEdits}
                      onSaveTextEdit={onSaveTextEdit}
                      onDeleteTextEdit={onDeleteTextEdit}
                      onBatchSaveTextEdits={onBatchSaveTextEdits}
                      workMode={workMode}
                      activeEditTool={activeEditTool}
                      onChangeEditTool={onChangeEditTool}
                      rotation={pages.find(p => p.pageNumber === currentPage)?.rotation ?? 0}
                      selectedGroupElem={selectedElem}
                      onSelectedGroupElemChange={onSelectedElemChange}
                      apiKey={apiKey}
                    />

                    {workMode !== 'edit' && (
                      <PDFAnnotationOverlay
                        pageWidth={pageSize.width}
                        pageHeight={pageSize.height}
                        pageNumber={currentPage}
                        activeTool={activeTool}
                        activeColor={activeColor}
                        activeThickness={activeThickness}
                        annotations={annotations}
                        onAddAnnotation={onAddAnnotation}
                        onDeleteAnnotation={onDeleteAnnotation}
                        onClearAnnotations={onClearAnnotations}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Floating navigation overlay on mobile screen widths */}
        <div className="flex md:hidden items-center justify-center gap-6 mt-2 relative z-10 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 py-2.5 px-6 rounded-full self-center shadow-[0_15px_30px_rgba(0,0,0,0.45)] text-zinc-300">
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none cursor-pointer transition rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xs font-mono font-black text-zinc-200">
            第 {currentPage} 页 / 共 {totalPages} 页
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none cursor-pointer transition rounded-lg"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </main>
  );
}
