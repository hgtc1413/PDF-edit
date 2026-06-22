import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { PDFPageInfo, PDFAnnotation, ToolType, WorkMode, TextEdit } from './types';
import PDFUploadZone from './components/PDFUploadZone';
import PDFToolbar from './components/PDFToolbar';
import PDFSidebar from './components/PDFSidebar';
import PDFMainView from './components/PDFMainView';
import AISidebar from './components/AISidebar';
import PDFHeaderFooterManager from './components/PDFHeaderFooterManager';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [pages, setPages] = useState<PDFPageInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [errorString, setErrorString] = useState<string | null>(null);

  // Markups, Modes and Editing States
  const [workMode, setWorkMode] = useState<WorkMode>('markup');
  const [activeEditTool, setActiveEditTool] = useState<'select' | 'line' | 'rect' | 'ellipse' | 'arrow' | 'stamp'>('select');
  const [textEdits, setTextEdits] = useState<TextEdit[]>([]);
  const [selectedElem, setSelectedElem] = useState<TextEdit | null>(null);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);
  const [deletedAnnotations, setDeletedAnnotations] = useState<PDFAnnotation[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType>('highlight'); // Set highlight as default
  const [activeColor, setActiveColor] = useState<string>('black'); // Classic carbon black default color
  const [activeThickness, setActiveThickness] = useState<number>(5);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isHeaderFooterOpen, setIsHeaderFooterOpen] = useState<boolean>(false);

  // Shared Global Text Indexing Metrics
  const [activeFontSize, setActiveFontSize] = useState<number>(14);
  const [extractedChars, setExtractedChars] = useState<number>(0);
  const [extractedWords, setExtractedWords] = useState<number>(0);

  // Global keydown listeners for undo capability
  const handleUndo = () => {
    setAnnotations((prev) => {
      // Find the last added marker belonging to the current page
      const pageAnns = prev.filter((a) => a.pageNumber === currentPage);
      if (pageAnns.length === 0) return prev;
      const lastOnPage = pageAnns[pageAnns.length - 1];
      setDeletedAnnotations((del) => [...del, lastOnPage]);
      return prev.filter((a) => a.id !== lastOnPage.id);
    });
  };

  const handleRedo = () => {
    setDeletedAnnotations((prevDel) => {
      const pageDeletes = prevDel.filter((a) => a.pageNumber === currentPage);
      if (pageDeletes.length === 0) return prevDel;
      const lastDeleted = pageDeletes[pageDeletes.length - 1];
      setAnnotations((prevAnns) => [...prevAnns, lastDeleted]);
      return prevDel.filter((a) => a.id !== lastDeleted.id);
    });
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Avoid firing when active editing/typing inside an input box or text zone
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleExportPDF();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentPage((prev) => Math.max(1, prev - 1));
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentPage((prev) => Math.min(pages.length, prev + 1));
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setWorkMode('markup');
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoomScale((prev) => Math.min(4.0, prev + 0.1));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setZoomScale((prev) => Math.max(0.5, prev - 0.1));
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentPage, pages, annotations, textEdits, pdfBytes, deletedAnnotations]);

  const handleFileSelected = async (selectedFile: File) => {
    setFile(selectedFile);
    setLoading(true);
    setErrorString(null);
    setLoadingProgress('正在读取文档，正在初始化本地渲染容器...');
    setAnnotations([]); // Clear old markup on a new load
    setTextEdits([]);   // Clear old edits
    setDeletedAnnotations([]);
    setExtractedChars(0);
    setExtractedWords(0);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      setPdfBytes(uint8);

      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        throw new Error('无法从 CDN 加载 PDF.js 渲染引擎，请检查您的网络连通性并刷新重试。');
      }

      // Load PDF Document
      const loadingTask = pdfjsLib.getDocument({ data: uint8 });
      const doc = await loadingTask.promise;

      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      setZoomScale(1.0);

      // Pre-populate empty pages with skeleton indicators
      const placeholders: PDFPageInfo[] = Array.from({ length: doc.numPages }, (_, idx) => ({
        pageNumber: idx + 1,
        originalPageNumber: idx + 1,
        thumbnailUrl: null,
        width: 612, // standard letter width fallback
        height: 792, // standard letter height fallback
        pdfDoc: doc,
        pdfFileBytes: uint8,
      }));
      setPages(placeholders);
      setLoading(false);

      // Progressive sidebar thumbnail loading loop in background
      (async () => {
        for (let i = 1; i <= doc.numPages; i++) {
          try {
            const page = await doc.getPage(i);
            const viewport = page.getViewport({ scale: 0.22 }); // compact render for quick download

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext('2d');
            if (context) {
               await page.render({ canvasContext: context, viewport }).promise;
               const url = canvas.toDataURL('image/jpeg', 0.85);

               setPages((prev) =>
                 prev.map((p) =>
                   p.pageNumber === i
                     ? {
                         ...p,
                         thumbnailUrl: url,
                         width: page.view[2] - page.view[0],
                         height: page.view[3] - page.view[1],
                       }
                     : p
                 )
               );
            }
          } catch (thumbnailError) {
             console.error(`Error yielding thumbnail for page ${i}:`, thumbnailError);
          }
        }
      })();

    } catch (err: any) {
      console.error('Error loading PDF document:', err);
      setErrorString(err.message || '解析 PDF 文档失败。请确保文件不是加密保护的加密文件。');
      setLoading(false);
      setFile(null);
    }
  };

  const handleUploadNew = () => {
    setFile(null);
    setPdfDoc(null);
    setPdfBytes(null);
    setCurrentPage(1);
    setTotalPages(0);
    setZoomScale(1.0);
    setPages([]);
    setErrorString(null);
    setAnnotations([]);
    setTextEdits([]);
    setWorkMode('markup');
    setExtractedChars(0);
    setExtractedWords(0);
  };

  const handleLoadSamplePDF = async () => {
    setLoading(true);
    setErrorString(null);
    setLoadingProgress('正在渲染本地高精设计底稿演示底片...');
    try {
      const pdfLibDoc = await PDFDocument.create();
      const font = await pdfLibDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfLibDoc.embedFont(StandardFonts.HelveticaBold);

      // Page 1
      const page1 = pdfLibDoc.addPage([595, 842]);
      page1.drawText('AI PDF Smart Blueprints Workspace', {
        x: 50,
        y: 780,
        size: 18,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.3),
      });
      page1.drawText('Desktop-grade PDF layout reconstruction engine is currently loaded.', {
        x: 50,
        y: 750,
        size: 11,
        font: font,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Background decorative lines representing an engineering design drawing sheet
      page1.drawRectangle({
        x: 40,
        y: 40,
        width: 515,
        height: 762,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
      });

      // Page 2
      const page2 = pdfLibDoc.addPage([595, 842]);
      page2.drawText('Evaluation Matrix & Reference Logs (Page 2)', {
        x: 50,
        y: 780,
        size: 16,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.3),
      });

      const pdfBytesSample = await pdfLibDoc.save();
      const sampleBlob = new Blob([pdfBytesSample], { type: 'application/pdf' });
      const sampleFile = new File([sampleBlob], 'Enterprise_Blueprint_Workspace_Sample.pdf', { type: 'application/pdf' });

      await handleFileSelected(sampleFile);

      // Pre-populates page 1 with comprehensive mock elements to showcase full desktop editor capabilities
      const sampleTextEdits: TextEdit[] = [
        {
          id: 'txt-sample-1',
          pageNumber: 1,
          type: 'text',
          text: '🚀 AI PDF Enterprise Blueprint Workspace (双击体验交互)',
          originalText: '',
          x: 50,
          y: 720,
          width: 380,
          height: 24,
          fontSize: 15,
          color: 'blue',
          isBold: true,
          isNew: true,
        },
        {
          id: 'txt-sample-2',
          pageNumber: 1,
          type: 'text',
          text: '当前底板已激活「专业排版编辑」模式。所有编辑框均支持拖拽、移动、缩放和微调层级。',
          originalText: '',
          x: 50,
          y: 680,
          width: 480,
          height: 18,
          fontSize: 11,
          color: 'black',
          isNew: true,
        },
        {
          id: 'table-sample-1',
          pageNumber: 1,
          type: 'table',
          text: '',
          originalText: '',
          x: 50,
          y: 430, // in PDF coordinates
          width: 480,
          height: 120,
          fontSize: 12,
          color: 'black',
          isNew: true,
          cells: [
            ['评估指标', '基准安全限', '当前实际分值', '状态等级'],
            ['空气流动吞吐 (QPS)', '> 5,000 QPS', '8,240 QPS', '✔ 优异达标'],
            ['高平移响应延时', '< 150 ms', '75 ms', '✔ 极佳达标'],
            ['三频高精渲染帧率', '> 60 FPS', '120 FPS', '✔ 精妙过检'],
          ],
          tableHeaderStyle: 'dark',
          zebraStripes: true,
          tableBorderOpacity: 0.6,
        },
        {
          id: 'shape-sample-1',
          pageNumber: 1,
          type: 'shape',
          shapeType: 'rect',
          text: '',
          originalText: '',
          x: 45,
          y: 560,
          width: 490,
          height: 135,
          fontSize: 12,
          color: 'blue',
          isNew: true,
          thickness: 2,
          borderColor: 'emerald',
          fillColor: 'transparent',
        },
        {
          id: 'shape-sample-2',
          pageNumber: 1,
          type: 'shape',
          shapeType: 'arrow',
          text: '',
          originalText: '',
          x: 480,
          y: 660,
          width: 50,
          height: 40,
          fontSize: 12,
          color: 'red',
          isNew: true,
          thickness: 3,
          borderColor: 'red',
        },
        {
          id: 'txt-sample-3',
          pageNumber: 1,
          type: 'text',
          text: '⚠️ 核心控制指标：点击左侧缩略图齿轮 ⚙️ 可进行页面复制与旋转重构',
          originalText: '',
          x: 130,
          y: 600,
          width: 320,
          height: 16,
          fontSize: 10,
          color: 'red',
          isBold: true,
          isNew: true,
        }
      ];

      setTextEdits(sampleTextEdits);
      setWorkMode('edit');
    } catch (err: any) {
      console.error('Error creating sample PDF:', err);
      setErrorString('无法生成演示底稿。');
      setLoading(false);
    }
  };

  const handleAddAnnotation = (ann: PDFAnnotation) => {
    setAnnotations((prev) => [...prev, ann]);
  };

  const handleDeleteAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  };

  const handleClearAnnotations = () => {
    // Clear annotations for this current page only (surgical deletion)
    setAnnotations((prev) => prev.filter((a) => a.pageNumber !== currentPage));
  };

  // Text edits manager handlers
  const handleSaveTextEdit = (edit: TextEdit) => {
    setTextEdits((prev) => {
      const existing = prev.find((e) => e.id === edit.id);
      if (existing) {
        return prev.map((e) => (e.id === edit.id ? edit : e));
      } else {
        return [...prev, edit];
      }
    });
    setSelectedElem((prev) => (prev && prev.id === edit.id ? edit : prev));
  };

  const handleDeleteTextEdit = (id: string) => {
    setTextEdits((prev) => prev.filter((e) => e.id !== id));
    setSelectedElem((prev) => (prev && prev.id === id ? null : prev));
  };

  const handleInsertTable = (rows: number, cols: number) => {
    const newId = `table-${Date.now()}`;
    const cells: string[][] = Array.from({ length: rows }, (_, rIdx) =>
      Array.from({ length: cols }, (_, cIdx) => (rIdx === 0 ? `列 ${cIdx + 1}` : `数据`) )
    );

    const newTable: TextEdit = {
      id: newId,
      pageNumber: currentPage,
      type: 'table',
      text: '',
      originalText: '',
      x: 100,
      y: 400,
      width: Math.min(480, cols * 80),
      height: Math.min(250, rows * 28),
      fontSize: 11,
      color: 'black',
      isNew: true,
      cells,
      tableHeaderStyle: 'dark',
      zebraStripes: true,
      tableBorderOpacity: 0.6,
    };

    setTextEdits((prev) => [...prev, newTable]);
    setSelectedElem(newTable);
    setActiveEditTool('select'); // automatically select the new table
  };

  const handleInsertStamp = (text: string, colorCode: string) => {
    const newId = `stamp-${Date.now()}`;
    const newStamp: TextEdit = {
      id: newId,
      pageNumber: currentPage,
      type: 'shape',
      shapeType: 'rect',
      text,
      originalText: '',
      x: 120,
      y: 420,
      width: 150,
      height: 44,
      fontSize: 11,
      color: colorCode === '#ef4444' ? 'red' : colorCode === '#10b981' ? 'emerald' : colorCode === '#f59e0b' ? 'yellow' : 'blue',
      isNew: true,
      borderColor: colorCode === '#ef4444' ? 'red' : colorCode === '#10b981' ? 'emerald' : colorCode === '#f59e0b' ? 'yellow' : 'blue',
      fillColor: colorCode === '#ef4444' ? 'red' : colorCode === '#10b981' ? 'emerald' : colorCode === '#f59e0b' ? 'yellow' : 'blue',
      fillOpacity: 0.1,
      thickness: 2,
      borderStyle: 'solid',
      rotation: -8, // slight angle stamp rotation
    };

    setTextEdits((prev) => [...prev, newStamp]);
    setSelectedElem(newStamp);
    setActiveEditTool('select');
  };

  // Page management action handlers
  const handleReorderPages = (sourcePageNumber: number, targetPageNumber: number) => {
    setPages((prevPages) => {
      const newPages = [...prevPages];
      const sourceIdx = newPages.findIndex((p) => p.pageNumber === sourcePageNumber);
      const targetIdx = newPages.findIndex((p) => p.pageNumber === targetPageNumber);
      if (sourceIdx !== -1 && targetIdx !== -1) {
        const [movedItem] = newPages.splice(sourceIdx, 1);
        newPages.splice(targetIdx, 0, movedItem);

        // Remap page numbers sequentially
        const updated = newPages.map((p, idx) => ({
          ...p,
          pageNumber: idx + 1,
        }));

        // Adjust currentPage to match the moved target dynamically
        const movedPage = updated.find((p) => p.pdfFileBytes === movedItem.pdfFileBytes && p.originalPageNumber === movedItem.originalPageNumber);
        if (movedPage) {
          setCurrentPage(movedPage.pageNumber);
        }
        return updated;
      }
      return prevPages;
    });
  };

  const handleDeletePage = (pageNumberToDelete: number) => {
    if (pages.length <= 1) {
      alert('文档中必须保留至少一页，无法删除最后一页。');
      return;
    }

    setPages((prevPages) => {
      const filtered = prevPages.filter((p) => p.pageNumber !== pageNumberToDelete);
      const updated = filtered.map((p, idx) => ({
        ...p,
        pageNumber: idx + 1,
      }));
      setTotalPages(updated.length);
      return updated;
    });

    setAnnotations((prev) => {
      const remaining = prev.filter((a) => a.pageNumber !== pageNumberToDelete);
      return remaining.map((a) => {
        if (a.pageNumber > pageNumberToDelete) {
          return { ...a, pageNumber: a.pageNumber - 1 };
        }
        return a;
      });
    });

    setTextEdits((prev) => {
      const remaining = prev.filter((e) => e.pageNumber !== pageNumberToDelete);
      return remaining.map((e) => {
        if (e.pageNumber > pageNumberToDelete) {
          return { ...e, pageNumber: e.pageNumber - 1 };
        }
        return e;
      });
    });

    setCurrentPage((prevCurrent) => {
      if (pageNumberToDelete === prevCurrent) {
        return Math.max(1, prevCurrent - 1);
      } else if (pageNumberToDelete < prevCurrent) {
        return prevCurrent - 1;
      }
      return prevCurrent;
    });
  };

  const handleInsertBlankPage = () => {
    setPages((prevPages) => {
      const newPages = [...prevPages];
      const insertIdx = prevPages.findIndex((p) => p.pageNumber === currentPage);

      const newBlankPage: PDFPageInfo = {
        pageNumber: currentPage + 1,
        originalPageNumber: -1, // custom blank indicator
        thumbnailUrl: null,
        width: 595,
        height: 842,
      };

      if (insertIdx !== -1) {
        newPages.splice(insertIdx + 1, 0, newBlankPage);
      } else {
        newPages.push(newBlankPage);
      }

      const updated = newPages.map((p, idx) => ({
        ...p,
        pageNumber: idx + 1,
      }));
      setTotalPages(updated.length);
      return updated;
    });

    setCurrentPage((current) => current + 1);
  };

  const handleMergePDF = async (fileToMerge: File) => {
    setLoading(true);
    setLoadingProgress('正在解析并提取第二个 PDF 文件的页面内容...');
    try {
      const arrayBuffer = await fileToMerge.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        throw new Error('PDF.js 渲染库未配置，请刷新后重试。');
      }

      const otherPdfDoc = await pdfjsLib.getDocument({ data: uint8 }).promise;

      const otherPages: PDFPageInfo[] = [];
      for (let i = 1; i <= otherPdfDoc.numPages; i++) {
        otherPages.push({
          pageNumber: pages.length + i,
          originalPageNumber: i,
          thumbnailUrl: null,
          width: 612,
          height: 792,
          pdfDoc: otherPdfDoc,
          pdfFileBytes: uint8,
        });
      }

      const mergedPages = [...pages, ...otherPages];
      setPages(mergedPages);
      setTotalPages(mergedPages.length);

      // Async loading of thumbnails for merged pages
      (async () => {
        for (let i = 1; i <= otherPdfDoc.numPages; i++) {
          try {
            const page = await otherPdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.22 });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext('2d');
            if (context) {
              await page.render({ canvasContext: context, viewport }).promise;
              const url = canvas.toDataURL('image/jpeg', 0.85);

              const pageNumToUpdate = pages.length + i;
              setPages((prev) =>
                prev.map((p) =>
                  p.pageNumber === pageNumToUpdate
                    ? {
                        ...p,
                        thumbnailUrl: url,
                        width: page.view[2] - page.view[0],
                        height: page.view[3] - page.view[1],
                      }
                    : p
                )
              );
            }
          } catch (tError) {
            console.error('Error rendering merged thumbnail:', tError);
          }
        }
      })();

    } catch (err: any) {
      console.error('Error merging PDF files:', err);
      alert(err.message || '合并文件遇到异常错误。请检查文件是否加密。');
    } finally {
      setLoading(false);
    }
  };

  // Export full PDF with modifications
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const finalDoc = await PDFDocument.create();
      const helveticaFont = await finalDoc.embedFont(StandardFonts.Helvetica);

      // Mapping color strings to correct rgb function in pdf-lib
      const getColorRgb = (colorName: string) => {
        const map: Record<string, { r: number; g: number; b: number }> = {
          yellow: { r: 0.92, g: 0.7, b: 0.03 },
          emerald: { r: 0.06, g: 0.72, b: 0.5 },
          red: { r: 0.94, g: 0.27, b: 0.27 },
          blue: { r: 0.23, g: 0.51, b: 0.96 },
          purple: { r: 0.66, g: 0.33, b: 0.97 },
          black: { r: 0, g: 0, b: 0 },
          white: { r: 1, g: 1, b: 1 },
        };
        const c = map[colorName] || { r: 0.2, g: 0.2, b: 0.2 };
        return rgb(c.r, c.g, c.b);
      };

      for (let i = 0; i < pages.length; i++) {
        const pageInfo = pages[i];
        let compiledPage: any;

        if (pageInfo.originalPageNumber === -1) {
          compiledPage = finalDoc.addPage([pageInfo.width, pageInfo.height]);
        } else {
          const srcBytes = pageInfo.pdfFileBytes ?? pdfBytes;
          if (!srcBytes) continue;
          const srcDoc = await PDFDocument.load(srcBytes);
          const [copiedPage] = await finalDoc.copyPages(srcDoc, [(pageInfo.originalPageNumber ?? 1) - 1]);
          compiledPage = finalDoc.addPage(copiedPage);
        }

        const visualPageNum = i + 1;

        // 1. Write Text Edits
        const pageTextEdits = textEdits.filter((e) => e.pageNumber === visualPageNum && !e.isDeleted);
        for (const edit of pageTextEdits) {
          if (edit.type === 'table') {
            const rows = edit.cells?.length || 0;
            const cols = edit.cells?.[0].length || 0;
            if (rows > 0 && cols > 0) {
              const cellWidth = edit.width / cols;
              const cellHeight = edit.height / rows;
              for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                  const cellX = edit.x + c * cellWidth;
                  const cellY = edit.y + (rows - 1 - r) * cellHeight;

                  if (r === 0 && edit.tableHeaderStyle !== 'none') {
                    compiledPage.drawRectangle({
                      x: cellX,
                      y: cellY,
                      width: cellWidth,
                      height: cellHeight,
                      color: edit.tableHeaderStyle === 'dark' ? rgb(18/255, 18/255, 22/255) : rgb(244/255, 244/255, 245/255),
                    });
                  } else if (edit.zebraStripes && r % 2 !== 0) {
                    compiledPage.drawRectangle({
                      x: cellX,
                      y: cellY,
                      width: cellWidth,
                      height: cellHeight,
                      color: rgb(249/255, 249/255, 249/255),
                    });
                  }

                  const borderOpacity = edit.tableBorderOpacity !== undefined ? edit.tableBorderOpacity : 0.6;
                  compiledPage.drawRectangle({
                    x: cellX,
                    y: cellY,
                    width: cellWidth,
                    height: cellHeight,
                    borderColor: rgb(212/255, 212/255, 216/255),
                    borderWidth: 0.5,
                    opacity: borderOpacity,
                  });

                  const cellVal = edit.cells?.[r]?.[c] || '';
                  const fSize = edit.fontSize || 10;
                  const textWidthEst = cellVal.length * fSize * 0.55;
                  const textX = cellX + Math.max(2, (cellWidth - textWidthEst) / 2);
                  const textY = cellY + (cellHeight - fSize) / 2 + 1;

                  compiledPage.drawText(cellVal, {
                    x: textX,
                    y: textY,
                    size: fSize,
                    color: (r === 0 && edit.tableHeaderStyle === 'dark') ? rgb(1, 1, 1) : rgb(39/255, 39/255, 42/255),
                    font: helveticaFont,
                  });
                }
              }
            }
          } else if (edit.type === 'shape') {
            const w = edit.width;
            const h = edit.height;
            const stroke = getColorRgb(edit.borderColor || edit.color || 'black');
            const borderW = edit.thickness || 2;
            const fill = edit.fillColor && edit.fillColor !== 'transparent' ? getColorRgb(edit.fillColor) : undefined;
            const fillOp = edit.fillOpacity !== undefined ? edit.fillOpacity : 0.5;

            if (edit.shapeType === 'rect') {
              compiledPage.drawRectangle({
                x: edit.x,
                y: edit.y,
                width: w,
                height: h,
                borderColor: stroke,
                borderWidth: borderW,
                color: fill,
                opacity: fill ? fillOp : 1,
                rotate: edit.rotation ? degrees(edit.rotation) : undefined,
              });
            } else if (edit.shapeType === 'ellipse') {
              compiledPage.drawEllipse({
                x: edit.x + w / 2,
                y: edit.y + h / 2,
                xScale: Math.abs(w / 2),
                yScale: Math.abs(h / 2),
                borderColor: stroke,
                borderWidth: borderW,
                color: fill,
                opacity: fill ? fillOp : 1,
              });
            } else if (edit.shapeType === 'line' || edit.shapeType === 'arrow') {
              compiledPage.drawLine({
                start: { x: edit.x, y: edit.y },
                end: { x: edit.x + w, y: edit.y + h },
                thickness: borderW,
                color: stroke,
              });

              if (edit.shapeType === 'arrow') {
                const headlen = 10;
                const angle = Math.atan2(h, w);
                const endX = edit.x + w;
                const endY = edit.y + h;
                compiledPage.drawLine({
                  start: { x: endX, y: endY },
                  end: { x: endX - headlen * Math.cos(angle - Math.PI / 6), y: endY - headlen * Math.sin(angle - Math.PI / 6) },
                  thickness: borderW,
                  color: stroke,
                });
                compiledPage.drawLine({
                  start: { x: endX, y: endY },
                  end: { x: endX - headlen * Math.cos(angle + Math.PI / 6), y: endY - headlen * Math.sin(angle + Math.PI / 6) },
                  thickness: borderW,
                  color: stroke,
                });
              }
            }

            if (edit.text) {
              const size = edit.fontSize || 12;
              const textWidthEst = edit.text.length * size * 0.6;
              const textX = edit.x + Math.max(5, (w - textWidthEst) / 2);
              const textY = edit.y + (h - size) / 2 + 1;
              compiledPage.drawText(edit.text, {
                x: textX,
                y: textY,
                size: size,
                color: stroke,
                font: helveticaFont,
                rotate: edit.rotation ? degrees(edit.rotation) : undefined,
              });
            }
          } else {
            if (!edit.isNew) {
              const coverBottomMargin = edit.fontSize * 0.22;
              const coverHeight = edit.fontSize * 1.12;
              const coverWidth = edit.originalWidth ?? edit.width;

              compiledPage.drawRectangle({
                x: edit.x,
                y: edit.y - coverBottomMargin,
                width: coverWidth,
                height: coverHeight,
                color: rgb(1, 1, 1),
              });
            }

            compiledPage.drawText(edit.text, {
              x: edit.x,
              y: edit.y,
              size: edit.fontSize,
              color: getColorRgb(edit.color),
              font: helveticaFont,
            });
          }
        }

        // 2. Write Drawing Annotations
        const pageAnns = annotations.filter((ann) => ann.pageNumber === visualPageNum);
        const { width, height } = compiledPage.getSize();
        for (const ann of pageAnns) {
          if (ann.type === 'highlight') {
            compiledPage.drawRectangle({
              x: ann.x * width,
              y: (1 - ann.y - ann.height) * height,
              width: ann.width * width,
              height: ann.height * height,
              color: getColorRgb(ann.color),
              opacity: 0.38,
            });
          } else if (ann.type === 'rect') {
            compiledPage.drawRectangle({
              x: ann.x * width,
              y: (1 - ann.y - ann.height) * height,
              width: ann.width * width,
              height: ann.height * height,
              borderColor: getColorRgb(ann.color),
              borderWidth: 2,
            });
          } else if (ann.type === 'text') {
            compiledPage.drawText(ann.text, {
              x: ann.x * width,
              y: (1 - ann.y) * height - 12,
              size: ann.fontSize || 14,
              color: getColorRgb(ann.color),
              font: helveticaFont,
            });
          } else if (ann.type === 'pen' && ann.points && ann.points.length > 1) {
            for (let pIdx = 0; pIdx < ann.points.length - 1; pIdx++) {
              const p1 = ann.points[pIdx];
              const p2 = ann.points[pIdx + 1];
              compiledPage.drawLine({
                start: { x: p1.x * width, y: (1 - p1.y) * height },
                end: { x: p2.x * width, y: (1 - p2.y) * height },
                thickness: ann.thickness || 3,
                color: getColorRgb(ann.color),
              });
            }
          }
        }
      }

      const finalPdfBytes = await finalDoc.save();

      const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited_${file?.name || 'document.pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error merging and exporting PDF:', err);
      alert('导出 PDF 文件时遭遇异常，请重试。');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCurrentPagePDF = async () => {
    setIsExporting(true);
    try {
      const finalDoc = await PDFDocument.create();
      const helveticaFont = await finalDoc.embedFont(StandardFonts.Helvetica);

      const pageInfo = pages.find((p) => p.pageNumber === currentPage);
      if (!pageInfo) return;

      const getColorRgb = (colorName: string) => {
        const map: Record<string, { r: number; g: number; b: number }> = {
          yellow: { r: 0.92, g: 0.7, b: 0.03 },
          emerald: { r: 0.06, g: 0.72, b: 0.5 },
          red: { r: 0.94, g: 0.27, b: 0.27 },
          blue: { r: 0.23, g: 0.51, b: 0.96 },
          purple: { r: 0.66, g: 0.33, b: 0.97 },
          black: { r: 0, g: 0, b: 0 },
          white: { r: 1, g: 1, b: 1 },
        };
        const c = map[colorName] || { r: 0.2, g: 0.2, b: 0.2 };
        return rgb(c.r, c.g, c.b);
      };

      let compiledPage: any;
      if (pageInfo.originalPageNumber === -1) {
        compiledPage = finalDoc.addPage([pageInfo.width, pageInfo.height]);
      } else {
        const srcBytes = pageInfo.pdfFileBytes ?? pdfBytes;
        if (!srcBytes) return;
        const srcDoc = await PDFDocument.load(srcBytes);
        const [copiedPage] = await finalDoc.copyPages(srcDoc, [(pageInfo.originalPageNumber ?? 1) - 1]);
        compiledPage = finalDoc.addPage(copiedPage);
      }

      // Write Text Edits
      const pageTextEdits = textEdits.filter((e) => e.pageNumber === currentPage && !e.isDeleted);
      for (const edit of pageTextEdits) {
        if (edit.type === 'table') {
          const rows = edit.cells?.length || 0;
          const cols = edit.cells?.[0].length || 0;
          if (rows > 0 && cols > 0) {
            const cellWidth = edit.width / cols;
            const cellHeight = edit.height / rows;
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                const cellX = edit.x + c * cellWidth;
                const cellY = edit.y + (rows - 1 - r) * cellHeight;

                if (r === 0 && edit.tableHeaderStyle !== 'none') {
                  compiledPage.drawRectangle({
                    x: cellX,
                    y: cellY,
                    width: cellWidth,
                    height: cellHeight,
                    color: edit.tableHeaderStyle === 'dark' ? rgb(18/255, 18/255, 22/255) : rgb(244/255, 244/255, 245/255),
                  });
                } else if (edit.zebraStripes && r % 2 !== 0) {
                  compiledPage.drawRectangle({
                    x: cellX,
                    y: cellY,
                    width: cellWidth,
                    height: cellHeight,
                    color: rgb(249/255, 249/255, 249/255),
                  });
                }

                const borderOpacity = edit.tableBorderOpacity !== undefined ? edit.tableBorderOpacity : 0.6;
                compiledPage.drawRectangle({
                  x: cellX,
                  y: cellY,
                  width: cellWidth,
                  height: cellHeight,
                  borderColor: rgb(212/255, 212/255, 216/255),
                  borderWidth: 0.5,
                  opacity: borderOpacity,
                });

                const cellVal = edit.cells?.[r]?.[c] || '';
                const fSize = edit.fontSize || 10;
                const textWidthEst = cellVal.length * fSize * 0.55;
                const textX = cellX + Math.max(2, (cellWidth - textWidthEst) / 2);
                const textY = cellY + (cellHeight - fSize) / 2 + 1;

                compiledPage.drawText(cellVal, {
                  x: textX,
                  y: textY,
                  size: fSize,
                  color: (r === 0 && edit.tableHeaderStyle === 'dark') ? rgb(1, 1, 1) : rgb(39/255, 39/255, 42/255),
                  font: helveticaFont,
                });
              }
            }
          }
        } else if (edit.type === 'shape') {
          const w = edit.width;
          const h = edit.height;
          const stroke = getColorRgb(edit.borderColor || edit.color || 'black');
          const borderW = edit.thickness || 2;
          const fill = edit.fillColor && edit.fillColor !== 'transparent' ? getColorRgb(edit.fillColor) : undefined;
          const fillOp = edit.fillOpacity !== undefined ? edit.fillOpacity : 0.5;

          if (edit.shapeType === 'rect') {
            compiledPage.drawRectangle({
              x: edit.x,
              y: edit.y,
              width: w,
              height: h,
              borderColor: stroke,
              borderWidth: borderW,
              color: fill,
              opacity: fill ? fillOp : 1,
              rotate: edit.rotation ? degrees(edit.rotation) : undefined,
            });
          } else if (edit.shapeType === 'ellipse') {
            compiledPage.drawEllipse({
              x: edit.x + w / 2,
              y: edit.y + h / 2,
              xScale: Math.abs(w / 2),
              yScale: Math.abs(h / 2),
              borderColor: stroke,
              borderWidth: borderW,
              color: fill,
              opacity: fill ? fillOp : 1,
            });
          } else if (edit.shapeType === 'line' || edit.shapeType === 'arrow') {
            compiledPage.drawLine({
              start: { x: edit.x, y: edit.y },
              end: { x: edit.x + w, y: edit.y + h },
              thickness: borderW,
              color: stroke,
            });

            if (edit.shapeType === 'arrow') {
              const headlen = 10;
              const angle = Math.atan2(h, w);
              const endX = edit.x + w;
              const endY = edit.y + h;
              compiledPage.drawLine({
                start: { x: endX, y: endY },
                end: { x: endX - headlen * Math.cos(angle - Math.PI / 6), y: endY - headlen * Math.sin(angle - Math.PI / 6) },
                thickness: borderW,
                color: stroke,
              });
              compiledPage.drawLine({
                start: { x: endX, y: endY },
                end: { x: endX - headlen * Math.cos(angle + Math.PI / 6), y: endY - headlen * Math.sin(angle + Math.PI / 6) },
                thickness: borderW,
                color: stroke,
              });
            }
          }

          if (edit.text) {
            const size = edit.fontSize || 12;
            const textWidthEst = edit.text.length * size * 0.6;
            const textX = edit.x + Math.max(5, (w - textWidthEst) / 2);
            const textY = edit.y + (h - size) / 2 + 1;
            compiledPage.drawText(edit.text, {
              x: textX,
              y: textY,
              size: size,
              color: stroke,
              font: helveticaFont,
              rotate: edit.rotation ? degrees(edit.rotation) : undefined,
            });
          }
        } else {
          if (!edit.isNew) {
            const coverBottomMargin = edit.fontSize * 0.22;
            const coverHeight = edit.fontSize * 1.12;
            const coverWidth = edit.originalWidth ?? edit.width;

            compiledPage.drawRectangle({
              x: edit.x,
              y: edit.y - coverBottomMargin,
              width: coverWidth,
              height: coverHeight,
              color: rgb(1, 1, 1),
            });
          }

          compiledPage.drawText(edit.text, {
            x: edit.x,
            y: edit.y,
            size: edit.fontSize,
            color: getColorRgb(edit.color),
            font: helveticaFont,
          });
        }
      }

      // Write Drawing Annotations
      const pageAnns = annotations.filter((ann) => ann.pageNumber === currentPage);
      const { width, height } = compiledPage.getSize();
      for (const ann of pageAnns) {
        if (ann.type === 'highlight') {
          compiledPage.drawRectangle({
            x: ann.x * width,
            y: (1 - ann.y - ann.height) * height,
            width: ann.width * width,
            height: ann.height * height,
            color: getColorRgb(ann.color),
            opacity: 0.38,
          });
        } else if (ann.type === 'rect') {
          compiledPage.drawRectangle({
            x: ann.x * width,
            y: (1 - ann.y - ann.height) * height,
            width: ann.width * width,
            height: ann.height * height,
            borderColor: getColorRgb(ann.color),
            borderWidth: 2,
          });
        } else if (ann.type === 'text') {
          compiledPage.drawText(ann.text, {
            x: ann.x * width,
            y: (1 - ann.y) * height - 12,
            size: ann.fontSize || 14,
            color: getColorRgb(ann.color),
            font: helveticaFont,
          });
        } else if (ann.type === 'pen' && ann.points && ann.points.length > 1) {
          for (let pIdx = 0; pIdx < ann.points.length - 1; pIdx++) {
            const p1 = ann.points[pIdx];
            const p2 = ann.points[pIdx + 1];
            compiledPage.drawLine({
              start: { x: p1.x * width, y: (1 - p1.y) * height },
              end: { x: p2.x * width, y: (1 - p2.y) * height },
              thickness: ann.thickness || 3,
              color: getColorRgb(ann.color),
            });
          }
        }
      }

      const finalPdfBytes = await finalDoc.save();
      const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `page_${currentPage}_only_${file?.name || 'document.pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting current page:', err);
      alert('仅导出当前页遭遇错误，请重试。');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPlainText = async () => {
    setIsExporting(true);
    let out = `=== PDF 提取纯文本导出 | 文件名: ${file?.name} ===\n\n`;
    try {
      for (const p of pages) {
        out += `--- 第 ${p.pageNumber} 页 ---\n`;
        if (p.originalPageNumber === -1) {
          out += `[用户添加的自定义空白页]\n\n`;
          continue;
        }

        const resolveDoc = p.pdfDoc ?? pdfDoc;
        if (resolveDoc) {
          try {
            const pdfPage = await resolveDoc.getPage(p.originalPageNumber);
            const content = await pdfPage.getTextContent();
            let text = content.items.map((it: any) => it.str).join(' ');

            const editsOnPage = textEdits.filter((e) => e.pageNumber === p.pageNumber);
            if (editsOnPage.length > 0) {
              text += `\n【在此页面进行的原文编辑补充】：\n` + editsOnPage.map((e) => `• “${e.originalText}” 改写为 “${e.text}”`).join('\n');
            }
            out += text + '\n\r\n';
          } catch (e) {
            out += `[无法解析此特定页面文本]\n\n`;
          }
        }
      }

      const blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file?.name?.replace('.pdf','') || 'document'}_extracted.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting plain text:', err);
      alert('提取文字数据失败，请重试。');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCurrentPagePNG = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      alert('无法获取画板容器以提取图片，请生成页面渲染后再试。');
      return;
    }
    try {
      const url = canvas.toDataURL('image/png', 1.0);
      const a = document.createElement('a');
      a.href = url;
      a.download = `page_${currentPage}_render_${file?.name?.replace('.pdf','')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error rendering png:', err);
      alert('导出图片失败。如果开启了浏览器沙盒保护，建议在安全模式下尝试运行。');
    }
  };

  const handleTextExtracted = (chars: number, words: number) => {
    setExtractedChars(chars);
    setExtractedWords(words);
  };

  const hasPageAnnotations = annotations.filter((a) => a.pageNumber === currentPage).length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased select-none overflow-hidden h-screen font-sans">
      {pdfDoc && file ? (
        // Active document layout view
        <div className="flex flex-col h-screen overflow-hidden">
          <PDFToolbar
            fileName={file.name}
            currentPage={currentPage}
            totalPages={totalPages}
            zoomScale={zoomScale}
            workMode={workMode}
            onWorkModeChange={setWorkMode}
            onExportPDF={handleExportPDF}
            onExportCurrentPagePDF={handleExportCurrentPagePDF}
            onExportPlainText={handleExportPlainText}
            onExportCurrentPagePNG={handleExportCurrentPagePNG}
            onInsertBlankPage={handleInsertBlankPage}
            onMergePDF={handleMergePDF}
            isExporting={isExporting}
            onPageChange={setCurrentPage}
            onZoomChange={setZoomScale}
            onUploadNew={handleUploadNew}
            onOpenHeaderFooter={() => setIsHeaderFooterOpen(true)}
            
            // Typography selection states
            activeColor={activeColor}
            onColorSelect={setActiveColor}
            activeFontSize={activeFontSize}
            onFontSizeSelect={setActiveFontSize}

            // Markup controls attributes
            activeTool={activeTool}
            onToolSelect={setActiveTool}
            activeThickness={activeThickness}
            onThicknessChange={setActiveThickness}
            onUndo={handleUndo}
            onClearPage={handleClearAnnotations}
            hasAnnotations={hasPageAnnotations}

            // Edit Mode states and insertion handlers
            activeEditTool={activeEditTool}
            onChangeEditTool={setActiveEditTool}
            onInsertTable={handleInsertTable}
            onInsertStamp={handleInsertStamp}
          />
          <div className="flex flex-1 overflow-hidden bg-[#070709]">
            <PDFSidebar
              pages={pages}
              currentPage={currentPage}
              onPageClick={setCurrentPage}
              onReorderPages={handleReorderPages}
              onDeletePage={handleDeletePage}
              textEdits={textEdits}
              annotations={annotations}
            />
            
            <PDFMainView
              pdfDoc={pdfDoc}
              pages={pages}
              currentPage={currentPage}
              totalPages={totalPages}
              zoomScale={zoomScale}
              workMode={workMode}
              textEdits={textEdits}
              onSaveTextEdit={handleSaveTextEdit}
              onDeleteTextEdit={handleDeleteTextEdit}
              onPageChange={setCurrentPage}
              annotations={annotations}
              activeTool={activeTool}
              activeColor={activeColor}
              activeThickness={activeThickness}
              onAddAnnotation={handleAddAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
              onClearAnnotations={handleClearAnnotations}
              
              activeFontSize={activeFontSize}
              selectedElem={selectedElem}
              onSelectedElemChange={setSelectedElem}
              apiKey={apiKey}
              activeEditTool={activeEditTool}
              onChangeEditTool={setActiveEditTool}
            />
            
            <AISidebar
              pdfDoc={pdfDoc}
              pages={pages}
              currentPage={currentPage}
              onTextExtracted={handleTextExtracted}
              fileName={file?.name || ''}
              workMode={workMode}
              selectedElem={selectedElem}
              onSaveTextEdit={handleSaveTextEdit}
              onDeleteTextEdit={handleDeleteTextEdit}
              onSelectedGroupElemChange={setSelectedElem}
              textEdits={textEdits}
              annotations={annotations}
              apiKey={apiKey}
              onApiKeyChange={handleSaveApiKey}
            />
          </div>

          {/* Solid, majestic bottom status bar */}
          <footer className="h-8 shrink-0 bg-[#09090b] border-t border-[#1a1a1f] flex items-center justify-between px-4 text-[10.5px] text-zinc-400 font-sans font-semibold select-none z-50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse shadow ${
                  workMode === 'edit' ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                }`} />
                <span className="text-zinc-305 font-bold">
                  {workMode === 'edit' ? '💻 专业编辑模式' : '✍️ 批注阅读模式'}
                </span>
              </div>
              <span className="text-zinc-700 hidden xs:inline">|</span>
              <span className="text-zinc-400 hidden xs:inline">
                第 {currentPage} 页 / 共 {totalPages} 页
              </span>
              <span className="text-zinc-700 hidden sm:inline">|</span>
              <span className="text-zinc-450 hidden sm:inline">
                缩放比例: {(zoomScale * 100).toFixed(0)}%
              </span>
              <span className="text-zinc-700 hidden md:inline">|</span>
              <span className="text-zinc-450 hidden md:inline font-mono">
                {workMode === 'edit' ? '⚡ 自由选取/拖动文本与图像元素' : '🎨 笔墨及矩形高亮注释点已加载'}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                <span className="text-[8px]">●</span> 本地云端同步完毕
              </span>
              <span className="text-zinc-800">|</span>
              <span className="text-zinc-550 font-mono text-[9px] uppercase tracking-wider hidden sm:inline">Acrobat Engine v5.0</span>
            </div>
          </footer>

          {/* Batch headers and footers design & geometry modal */}
          <PDFHeaderFooterManager
            isOpen={isHeaderFooterOpen}
            onClose={() => setIsHeaderFooterOpen(false)}
            totalPages={totalPages}
            pages={pages}
            textEdits={textEdits}
            onUpdateTextEdits={setTextEdits}
            fileName={file?.name || ''}
          />
        </div>
      ) : (
        // Initial drop zone / file selector view
        <div className="flex-grow flex flex-col justify-center h-screen overflow-hidden bg-zinc-950">
          {loading ? (
            <div id="loading-spinner-container" className="flex flex-col items-center justify-center py-20 gap-5 max-w-sm mx-auto text-center px-4">
              <div className="relative flex items-center justify-center">
                <div className="h-12 w-12 rounded-full border-4 border-zinc-800 border-t-indigo-500 animate-spin shadow-lg" />
                <div className="absolute h-6 w-6 rounded-full bg-indigo-500/10 animate-ping" />
              </div>
              <div className="space-y-1.5 mt-2">
                <p className="text-zinc-200 font-bold text-sm tracking-wide">
                  正在初始化智能渲染沙盒
                </p>
                <p className="text-zinc-500 text-xs font-semibold animate-pulse leading-relaxed">
                  {loadingProgress}
                </p>
              </div>
            </div>
          ) : (
            <div className="container mx-auto py-10">
              <PDFUploadZone onFileSelected={handleFileSelected} onLoadSample={handleLoadSamplePDF} />

              {errorString && (
                <div className="max-w-md mx-auto mt-6 p-4.5 rounded-2xl bg-red-950/30 border border-red-900/50 text-red-400 flex items-start gap-3 shadow-lg">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
                  <div>
                    <h3 className="font-extrabold text-sm text-red-300">载入 PDF 失败</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{errorString}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
