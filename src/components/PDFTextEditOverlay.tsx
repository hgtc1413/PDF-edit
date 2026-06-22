import React, { useState, useEffect, useRef } from 'react';
import {
  Trash2,
  Type,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Eye,
  Trash,
  Sparkles,
  ChevronDown,
  Copy,
  Plus,
  Minus,
  Clipboard,
  Loader2,
} from 'lucide-react';
import { TextEdit, WorkMode } from '../types';

interface PDFTextEditOverlayProps {
  pdfDoc: any; // PDFDocumentProxy from PDF.js
  pageWidth: number;
  pageHeight: number;
  pageNumber: number;
  originalPageNumber?: number; // Actual PDF page index (1-based), or -1 if blank page
  zoomScale: number;
  activeColor: string;
  activeFontSize: number;
  textEdits: TextEdit[];
  onSaveTextEdit: (edit: TextEdit) => void;
  onDeleteTextEdit: (id: string) => void;
  onBatchSaveTextEdits?: (edits: TextEdit[]) => void; // Batch utility for history / box shifts
  workMode: WorkMode;
  activeEditTool?: 'select' | 'line' | 'rect' | 'ellipse' | 'arrow' | 'stamp';
  onChangeEditTool?: (tool: 'select' | 'line' | 'rect' | 'ellipse' | 'arrow' | 'stamp') => void;
  rotation?: number;
  selectedGroupElem?: TextEdit | null;
  onSelectedGroupElemChange?: (elem: TextEdit | null) => void;
  apiKey?: string;
}

export default function PDFTextEditOverlay({
  pdfDoc,
  pageWidth,
  pageHeight,
  pageNumber,
  originalPageNumber,
  zoomScale,
  activeColor,
  activeFontSize,
  textEdits,
  onSaveTextEdit,
  onDeleteTextEdit,
  onBatchSaveTextEdits,
  workMode,
  activeEditTool = 'select',
  onChangeEditTool,
  rotation = 0,
  selectedGroupElem = null,
  onSelectedGroupElemChange,
  apiKey,
}: PDFTextEditOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [pdfViewport, setPdfViewport] = useState<any>(null);
  const [textItems, setTextItems] = useState<any[]>([]);

  // Selected elements tracker
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Focus tracking state for double-click typing
  const [editingId, setEditingId] = useState<string | null>(null);

  // Style Clipboard System (Copy/Paste Style)
  const [styleClipboard, setStyleClipboard] = useState<Partial<TextEdit> | null>(null);
  const [isAiProcessingLocal, setIsAiProcessingLocal] = useState(false);

  // Dragging and transform state machine
  const [pointerMode, setPointerMode] = useState<'idle' | 'dragging' | 'resizing' | 'rotating' | 'boxSelecting' | 'drawing'>('idle');
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragStartElements, setDragStartElements] = useState<Record<string, { x: number; y: number; width?: number; height?: number }>>({});
  const [activeHandle, setActiveHandle] = useState<string | null>(null);

  // Box-selection visual state
  const [boxSelectStart, setBoxSelectStart] = useState({ x: 0, y: 0 });
  const [boxSelectCur, setBoxSelectCur] = useState({ x: 0, y: 0 });

  // Floating Color Picker open state
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isHighlightMenuOpen, setIsHighlightMenuOpen] = useState(false);

  // Standard Page Height for coordinates
  const pdfHeight = pageHeight / zoomScale;
  const pdfWidth = pageWidth / zoomScale;

  // Convert PDF coordinates (origin bottom-left) to Viewport CSS Pixels
  const toViewport = (pdfX: number, pdfY: number) => {
    if (pdfViewport && typeof pdfViewport.convertToViewportPoint === 'function') {
      return pdfViewport.convertToViewportPoint(pdfX, pdfY);
    }
    return [pdfX * zoomScale, (pdfHeight - pdfY) * zoomScale];
  };

  // Convert Viewport CSS Pixels to PDF coordinates (origin bottom-left)
  const toPdf = (vx: number, vy: number) => {
    if (pdfViewport && typeof pdfViewport.convertToPdfPoint === 'function') {
      return pdfViewport.convertToPdfPoint(vx, vy);
    }
    return [vx / zoomScale, pdfHeight - (vy / zoomScale)];
  };

  // Clustering raw text items from PDF.js
  useEffect(() => {
    let isCurrent = true;
    if (!pdfDoc) return;

    if (originalPageNumber === -1) {
      setTextItems([]);
      setPdfViewport({
        convertToViewportPoint: (pdfX: number, pdfY: number) => [pdfX * zoomScale, (842 - pdfY) * zoomScale],
        convertToPdfPoint: (vx: number, vy: number) => [vx / zoomScale, 842 - (vy / zoomScale)]
      });
      setLoading(false);
      return;
    }

    const actualPageNumber = originalPageNumber ?? pageNumber;

    const fetchTextContent = async () => {
      setLoading(true);
      try {
        const page = await pdfDoc.getPage(actualPageNumber);
        const rotationAngle = ((page.rotation || 0) + rotation) % 360;
        const viewport = page.getViewport({ scale: zoomScale, rotation: rotationAngle });
        
        if (!isCurrent) return;
        setPdfViewport(viewport);

        const content = await page.getTextContent();
        if (!isCurrent) return;

        const rawItems = content.items.map((item: any) => {
          const fontSize = Math.abs(item.transform[3]) || item.height || 12;
          return {
            str: item.str || '',
            fontName: item.fontName,
            transform: item.transform,
            width: item.width,
            height: item.height || fontSize,
            fontSize: fontSize,
            pdfX: item.transform[4],
            pdfY: item.transform[5],
          };
        }).filter((item: any) => item.str !== '');

        const merged: any[] = [];
        if (rawItems.length > 0) {
          const lines: any[][] = [];
          const sortedByY = [...rawItems].sort((a, b) => b.pdfY - a.pdfY);

          for (const item of sortedByY) {
            const verticalThreshold = Math.min(6, item.fontSize * 0.35);
            let foundLine = false;

            for (const line of lines) {
              if (Math.abs(line[0].pdfY - item.pdfY) < verticalThreshold) {
                line.push(item);
                foundLine = true;
                break;
              }
            }

            if (!foundLine) {
              lines.push([item]);
            }
          }

          let mergedIdx = 0;
          for (const line of lines) {
            line.sort((a, b) => a.pdfX - b.pdfX);
            let current = { ...line[0] };

            for (let i = 1; i < line.length; i++) {
              const next = line[i];
              const gap = next.pdfX - (current.pdfX + current.width);
              const maxGap = Math.min(10, current.fontSize * 0.6);

              if (gap >= -5 && gap < maxGap) {
                let space = '';
                if (gap > current.fontSize * 0.15) {
                  const lastChar = current.str.slice(-1);
                  const firstChar = next.str.slice(0, 1);
                  const isLatin = /[a-zA-Z0-9]/.test(lastChar) && /[a-zA-Z0-9]/.test(firstChar);
                  if (isLatin && !current.str.endsWith(' ') && !next.str.startsWith(' ')) {
                    space = ' ';
                  }
                }
                current.str += space + next.str;
                current.width = (next.pdfX + next.width) - current.pdfX;
                current.fontSize = Math.max(current.fontSize, next.fontSize);
                current.height = Math.max(current.height, next.height);
              } else {
                merged.push({
                  ...current,
                  id: `txt-orig-${pageNumber}-${mergedIdx++}`,
                });
                current = { ...next };
              }
            }
            merged.push({
              ...current,
              id: `txt-orig-${pageNumber}-${mergedIdx++}`,
            });
          }
        }

        setTextItems(merged);
      } catch (err) {
        console.error('Error fetching PDF text content:', err);
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };

    fetchTextContent();
    setSelectedIds([]);
    setEditingId(null);

    return () => {
      isCurrent = false;
    };
  }, [pdfDoc, pageNumber, originalPageNumber, zoomScale]);

  // Handle focusing editable spans
  useEffect(() => {
    if (editingId) {
      const el = document.getElementById(`span-${editingId}`);
      if (el) {
        el.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [editingId]);

  // Globally intercept Delete key to delete selected items
  // Helper to delete/mask a single element (including original page document elements)
  const handleDeleteElement = (id: string) => {
    let nextEdits = [...textEdits];
    const existingIdx = nextEdits.findIndex((item) => item.id === id);
    if (existingIdx !== -1) {
      const item = nextEdits[existingIdx];
      if (item.isOriginal) {
        // If it's an original element, mark it as deleted instead of removing it from edit list
        nextEdits[existingIdx] = { ...item, isDeleted: true };
      } else {
        nextEdits.splice(existingIdx, 1);
      }
    } else {
      // It's an unedited original element! Mark it as deleted
      const template = pageElements.find((p) => p.id === id);
      if (template) {
        nextEdits.push({
          id: id,
          pageNumber: pageNumber,
          type: template.type || 'text',
          text: template.text || '',
          originalText: template.originalText || template.text || '',
          x: template.x,
          y: template.y,
          width: template.width,
          height: template.height,
          fontSize: template.fontSize,
          color: template.color || 'black',
          isNew: false,
          isOriginal: true,
          isDeleted: true,
        });
      }
    }

    if (onBatchSaveTextEdits) {
      onBatchSaveTextEdits(nextEdits);
    } else {
      nextEdits.forEach((edit) => onSaveTextEdit(edit));
      if (existingIdx === -1) {
        onDeleteTextEdit(id);
      }
    }
    setSelectedIds((prev) => prev.filter(selId => selId !== id));
  };

  // Helper to delete/mask all selected elements
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    
    let nextEdits = [...textEdits];
    selectedIds.forEach((id) => {
      const existingIdx = nextEdits.findIndex((item) => item.id === id);
      if (existingIdx !== -1) {
        const item = nextEdits[existingIdx];
        if (item.isOriginal) {
          nextEdits[existingIdx] = { ...item, isDeleted: true };
        } else {
          nextEdits.splice(existingIdx, 1);
        }
      } else {
        const template = pageElements.find((p) => p.id === id);
        if (template) {
          nextEdits.push({
            id: id,
            pageNumber: pageNumber,
            type: template.type || 'text',
            text: template.text || '',
            originalText: template.originalText || template.text || '',
            x: template.x,
            y: template.y,
            width: template.width,
            height: template.height,
            fontSize: template.fontSize,
            color: template.color || 'black',
            isNew: false,
            isOriginal: true,
            isDeleted: true,
          });
        }
      }
    });

    if (onBatchSaveTextEdits) {
      onBatchSaveTextEdits(nextEdits);
    } else {
      nextEdits.forEach((edit) => onSaveTextEdit(edit));
      selectedIds.forEach((id) => {
        if (!nextEdits.some(n => n.id === id)) {
          onDeleteTextEdit(id);
        }
      });
    }
    setSelectedIds([]);
  };

  // Globally intercept Delete key to delete selected items
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (workMode !== 'edit') return;
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [workMode, selectedIds, textEdits, pageNumber, onBatchSaveTextEdits, onDeleteTextEdit]);

  // Get active edit element styles
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

  // Map elements on page
  const getElementsForPage = () => {
    // Original cluster text lines represented as pseudo-elements if edited
    const pageTextEdits = textEdits.filter((e) => e.pageNumber === pageNumber);
    const elements: any[] = [];

    // Push original lines that are NOT edited (so we can select & edit them)
    textItems.forEach((orig) => {
      const edit = pageTextEdits.find((e) => e.id === orig.id);
      if (edit) {
        if (!edit.isDeleted) {
          elements.push({
            ...edit,
            isOriginal: true,
            fontName: orig.fontName,
          });
        }
      } else if (workMode === 'edit') {
        elements.push({
          id: orig.id,
          pageNumber,
          type: 'text',
          text: orig.str,
          originalText: orig.str,
          x: orig.pdfX,
          y: orig.pdfY,
          width: orig.width,
          height: orig.height,
          fontSize: orig.fontSize,
          color: 'black',
          isNew: false,
          isOriginal: true,
          fontName: orig.fontName,
        });
      }
    });

    // Push new elements (new texts, shapes, images, tables)
    pageTextEdits.forEach((edit) => {
      if ((edit.isNew || edit.type !== 'text') && !edit.isDeleted) {
        elements.push(edit);
      }
    });

    return elements;
  };

  const pageElements = getElementsForPage();

  const lastSyncedIdRef = useRef<string | null>(null);

  // Synchronize selection state with parent's properties inspector
  useEffect(() => {
    const childSelectedId = selectedIds.length === 1 ? selectedIds[0] : null;
    const parentSelectedId = selectedGroupElem ? selectedGroupElem.id : null;

    if (childSelectedId !== lastSyncedIdRef.current) {
      lastSyncedIdRef.current = childSelectedId;
      const activeSelectedElem = childSelectedId ? pageElements.find(el => el.id === childSelectedId) : null;
      if (onSelectedGroupElemChange) {
        onSelectedGroupElemChange(activeSelectedElem || null);
      }
    } else if (parentSelectedId !== childSelectedId) {
      lastSyncedIdRef.current = parentSelectedId;
      if (parentSelectedId === null) {
        setSelectedIds([]);
      } else {
        setSelectedIds([parentSelectedId]);
      }
    }
  }, [selectedIds, selectedGroupElem, pageElements, onSelectedGroupElemChange]);

  // Pointer Handlers for Drawing, Dragging, Sizing, BoxSelecting
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (workMode !== 'edit') return;
    if (editingId) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    const [pdfX, pdfY] = toPdf(vx, vy);

    // 1. Drawing Shape mode
    if (activeEditTool !== 'select' && activeEditTool !== 'stamp') {
      e.preventDefault();
      const newId = `shape-${activeEditTool}-${Date.now()}`;
      setPointerMode('drawing');
      setDragStartPos({ x: pdfX, y: pdfY });
      
      const newShape: TextEdit = {
        id: newId,
        pageNumber,
        type: 'shape',
        shapeType: activeEditTool as any,
        text: '',
        originalText: '',
        x: pdfX,
        y: pdfY,
        width: 1,
        height: 1,
        fontSize: activeFontSize,
        color: activeColor,
        isNew: true,
        thickness: 3,
        borderColor: activeColor === 'white' ? 'black' : activeColor,
        fillColor: 'transparent',
        fillOpacity: 0.5,
      };

      onSaveTextEdit(newShape);
      setSelectedIds([newId]);
      return;
    }

    // Use closest attribute retrieval to ensure clicking children (like span elements) works
    const clickedTarget = e.target as HTMLElement;
    const handleName = clickedTarget.getAttribute('data-handle');
    const clickedElemId = clickedTarget.getAttribute('data-id') || clickedTarget.closest('[data-id]')?.getAttribute('data-id') || null;

    // 2. Handle Resizing Clicked
    if (handleName && clickedElemId) {
      e.stopPropagation();
      e.preventDefault();
      setPointerMode('resizing');
      setActiveHandle(handleName);
      setDragStartPos({ x: pdfX, y: pdfY });

      const targetElem = pageElements.find(el => el.id === clickedElemId);
      if (targetElem) {
        setDragStartElements({
          [clickedElemId]: {
            x: targetElem.x,
            y: targetElem.y,
            width: targetElem.width,
            height: targetElem.height,
          }
        });
      }
      return;
    }

    // 3. Image Rotation Handle Clicked
    const isRotateHandle = clickedTarget.getAttribute('data-rotate-handle') === 'true';
    if (isRotateHandle && clickedElemId) {
      e.stopPropagation();
      e.preventDefault();
      setPointerMode('rotating');
      setDragStartPos({ x: vx, y: vy }); // relative view px for angle calculations
      return;
    }

    // 4. Element Drag Clicked
    if (clickedElemId) {
      e.stopPropagation();
      const targetElem = pageElements.find(el => el.id === clickedElemId);
      if (!targetElem) return;

      const isModifier = e.shiftKey || e.metaKey;
      let nextSelection = [...selectedIds];

      if (isModifier) {
        if (nextSelection.includes(clickedElemId)) {
          nextSelection = nextSelection.filter(id => id !== clickedElemId);
        } else {
          nextSelection.push(clickedElemId);
        }
      } else {
        if (!nextSelection.includes(clickedElemId)) {
          nextSelection = [clickedElemId];
        }
      }

      setSelectedIds(nextSelection);
      setPointerMode('dragging');
      setDragStartPos({ x: pdfX, y: pdfY });

      // Record start states of all selected elements
      const startState: Record<string, { x: number; y: number; width?: number; height?: number }> = {};
      nextSelection.forEach(id => {
        const el = pageElements.find(item => item.id === id);
        if (el) {
          startState[id] = { x: el.x, y: el.y, width: el.width, height: el.height };
        }
      });
      setDragStartElements(startState);
      return;
    }

    // 5. Box Selecting Clicked on Blank Space
    if (clickedTarget === containerRef.current || clickedTarget.id === "pdf-text-edit-overlay") {
      setPointerMode('boxSelecting');
      setBoxSelectStart({ x: vx, y: vy });
      setBoxSelectCur({ x: vx, y: vy });
      setSelectedIds([]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerMode === 'idle' || workMode !== 'edit') return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    const [pdfX, pdfY] = toPdf(vx, vy);

    // 1. Dragging position
    if (pointerMode === 'dragging') {
      const dx = pdfX - dragStartPos.x;
      const dy = pdfY - dragStartPos.y;

      let updatedEdits = [...textEdits];

      selectedIds.forEach((id) => {
        const origCoords = dragStartElements[id];
        if (!origCoords) return;

        const nextX = origCoords.x + dx;
        const nextY = origCoords.y + dy;

        const existingIdx = updatedEdits.findIndex((item) => item.id === id);
        if (existingIdx !== -1) {
          // Update existing
          updatedEdits[existingIdx] = {
            ...updatedEdits[existingIdx],
            x: nextX,
            y: nextY,
          };
        } else {
          // It's a newly edited original element! Let's find its template from pageElements:
          const template = pageElements.find(p => p.id === id);
          if (template) {
            updatedEdits.push({
              id: id,
              pageNumber: pageNumber,
              type: template.type || 'text',
              text: template.text || '',
              originalText: template.originalText || template.text || '',
              x: nextX,
              y: nextY,
              width: template.width,
              height: template.height,
              fontSize: template.fontSize,
              color: template.color || 'black',
              isNew: false,
              isBold: template.isBold,
              isItalic: template.isItalic,
              isUnderline: template.isUnderline,
              isStrikethrough: template.isStrikethrough,
              align: template.align,
              fontName: template.fontName,
            });
          }
        }
      });

      // Handle batch update if available, otherwise iterate
      if (onBatchSaveTextEdits) {
        onBatchSaveTextEdits(updatedEdits);
      } else {
        selectedIds.forEach((id) => {
          const updated = updatedEdits.find(u => u.id === id);
          if (updated) onSaveTextEdit(updated);
        });
      }
      return;
    }

    // 2. Resizing Bounds
    if (pointerMode === 'resizing' && activeHandle) {
      const targetId = Object.keys(dragStartElements)[0];
      const orig = dragStartElements[targetId];
      if (!orig) return;

      const dx = pdfX - dragStartPos.x;
      const dy = pdfY - dragStartPos.y; // PDF points: Y goes upwards

      const el = pageElements.find(item => item.id === targetId);
      if (!el) return;

      let nextX = el.x;
      let nextY = el.y;
      let nextWidth = el.width;
      let nextHeight = el.height;

      // Handle custom Line/Arrow endpoints
      if (el.type === 'shape' && (el.shapeType === 'line' || el.shapeType === 'arrow')) {
        if (activeHandle === 'start') {
          nextX = orig.x + dx;
          nextY = orig.y + dy;
          nextWidth = (orig.width || 0) - dx;
          nextHeight = (orig.height || 0) - dy;
        } else {
          nextWidth = (orig.width || 0) + dx;
          nextHeight = (orig.height || 0) + dy;
        }
      } else {
        // Standard bounding box resizing
        const startW = orig.width ?? 100;
        const startH = orig.height ?? 30;

        switch (activeHandle) {
          case 'br': // bottom-right direction Y goes down, X goes right
            nextWidth = Math.max(10, startW + dx);
            nextHeight = Math.max(10, startH - dy);
            nextY = orig.y + dy;
            break;
          case 'tr': // top-right direction Y goes up, X goes right
            nextWidth = Math.max(10, startW + dx);
            nextHeight = Math.max(10, startH + dy);
            break;
          case 'bl': // bottom-left
            nextWidth = Math.max(10, startW - dx);
            nextHeight = Math.max(10, startH - dy);
            nextX = orig.x + dx;
            nextY = orig.y + dy;
            break;
          case 'tl': // top-left
            nextWidth = Math.max(10, startW - dx);
            nextHeight = Math.max(10, startH + dy);
            nextX = orig.x + dx;
            break;
          case 'mr': // middle-right
            nextWidth = Math.max(10, startW + dx);
            break;
          case 'ml': // middle-left
            nextWidth = Math.max(10, startW - dx);
            nextX = orig.x + dx;
            break;
        }
      }

      const updatedElem = {
        ...el,
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      };

      onSaveTextEdit(updatedElem);
      return;
    }

    // 3. Drawing Shape Freeform
    if (pointerMode === 'drawing') {
      const activeId = selectedIds[0];
      const el = pageElements.find(item => item.id === activeId);
      if (!el) return;

      const startX = dragStartPos.x;
      const startY = dragStartPos.y;

      const updatedElem = {
        ...el,
        width: pdfX - startX,
        height: pdfY - startY,
      };

      onSaveTextEdit(updatedElem);
      return;
    }

    // 4. Rotating
    if (pointerMode === 'rotating') {
      const targetId = selectedIds[0];
      const el = pageElements.find(item => item.id === targetId);
      if (!el || (el.type !== 'image' && el.type !== 'shape')) return;

      const [cx, cy] = toViewport(el.x + el.width / 2, el.y + el.height / 2);
      const angleRad = Math.atan2(vy - cy, vx - cx);
      let angleDeg = (angleRad * 180) / Math.PI + 90; // offset to point upwards correctly
      if (angleDeg < 0) angleDeg += 360;

      onSaveTextEdit({
        ...el,
        rotation: Math.round(angleDeg),
      });
      return;
    }

    // 5. Box Selecting Check intersection
    if (pointerMode === 'boxSelecting') {
      setBoxSelectCur({ x: vx, y: vy });

      const x1 = Math.min(boxSelectStart.x, vx);
      const y1 = Math.min(boxSelectStart.y, vy);
      const x2 = Math.max(boxSelectStart.x, vx);
      const y2 = Math.max(boxSelectStart.y, vy);

      const newlySelected: string[] = [];

      pageElements.forEach((el) => {
        const [ex, ey] = toViewport(el.x, el.y);
        const ew = el.width * zoomScale;
        const eh = el.height * zoomScale;

        // Check if overlaps selection box
        const intersects = !(ex + ew < x1 || ex > x2 || ey + eh < y1 || ey > y2);
        if (intersects) {
          newlySelected.push(el.id);
        }
      });

      setSelectedIds(newlySelected);
    }
  };

  const handlePointerUp = () => {
    if (pointerMode === 'drawing') {
      // Clean tiny clicks
      const activeId = selectedIds[0];
      const el = pageElements.find(item => item.id === activeId);
      if (el && Math.abs(el.width) < 4 && Math.abs(el.height) < 4) {
        onDeleteTextEdit(activeId);
        setSelectedIds([]);
      }
      if (onChangeEditTool) {
        onChangeEditTool('select');
      }
    }
    setPointerMode('idle');
    setActiveHandle(null);
  };

  // ContentEditable Blur text block saving
  const handleTextBlur = (id: string, isNewItem: boolean, originalItem?: any) => {
    const el = document.getElementById(`span-${id}`);
    if (!el) return;

    const textVal = (el.textContent || '').trim();
    setEditingId(null);

    const elem = pageElements.find(item => item.id === id);
    if (!elem) return;

    if (textVal === '') {
      handleDeleteElement(id);
      return;
    }

    // Build or update text edit element
    const charW = textVal.length * elem.fontSize * 0.6;
    const finalW = isNewItem ? charW : Math.max(elem.width, charW);

    const updated: TextEdit = {
      ...elem,
      text: textVal,
      width: finalW,
    };

    onSaveTextEdit(updated);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>, id: string, isNewItem: boolean) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingId(null);
    }
  };

  // Modify Selected Text Box Custom Styles
  const updateSelectedTextStyle = (props: Partial<TextEdit>) => {
    if (selectedIds.length !== 1) return;
    const targetId = selectedIds[0];
    const elem = pageElements.find(el => el.id === targetId);
    if (!elem || (elem.type !== 'text' && elem.type !== undefined)) return;

    // Convert to a formal text edit first if original PDF text
    const isAlreadySaved = textEdits.some(e => e.id === targetId);
    const updated: TextEdit = {
      ...elem,
      ...props,
      isNew: !isAlreadySaved ? false : elem.isNew,
    };

    onSaveTextEdit(updated);
  };

  // Table Cell Text editing helper
  const handleTableCellBlur = (tblId: string, row: number, col: number, nextText: string) => {
    const el = pageElements.find(el => el.id === tblId);
    if (!el || !el.cells) return;

    const nextCells = el.cells.map((rArr: string[], rIdx: number) => {
      return rArr.map((cVal: string, cIdx: number) => {
        return (rIdx === row && cIdx === col) ? nextText : cVal;
      });
    });

    onSaveTextEdit({
      ...el,
      cells: nextCells,
    });
  };

  // Double Click standard text block to edit
  const handleTextDoubleClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (workMode !== 'edit') return;
    // Enter line edit contentEditable mode
    setEditingId(id);
  };

  // Font Stack helper
  const getFontFamily = (fontName?: string) => {
    const lower = (fontName || '').toLowerCase();
    let textStack = "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif";
    if (lower.includes('mono') || lower.includes('courier')) {
      textStack = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";
    } else if (lower.includes('serif') || lower.includes('times') || lower.includes('georgia')) {
      textStack = "'Playfair Display', 'Times New Roman', Georgia, serif";
    }
    return textStack;
  };

  // Drawing Shape svg paths generator
  const renderShapeSvg = (el: any) => {
    const w = el.width * zoomScale;
    const h = el.height * zoomScale;

    const strokeColor = getColorHex(el.borderColor || el.color);
    const fill = el.fillColor === 'transparent' ? 'none' : getColorHex(el.fillColor || 'transparent');
    const strokeWidth = (el.thickness || 3) * zoomScale;
    const opacity = el.fillOpacity ?? 0.5;
    const strokeDasharray = el.borderStyle === 'dashed' ? '5,5' : undefined;

    // Line/Arrow have Y offset logic
    if (el.shapeType === 'line') {
      return (
        <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
          <line
            x1={0}
            y1={0}
            x2={w}
            y2={-h}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        </svg>
      );
    }

    if (el.shapeType === 'arrow') {
      const headlen = 10 * zoomScale; // length of head in px
      const angle = Math.atan2(-h, w);
      const x2 = w;
      const y2 = -h;

      return (
        <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
          <line
            x1={0}
            y1={0}
            x2={x2}
            y2={y2}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
          {/* Arrowhead lines */}
          <path
            d={`M ${x2} ${y2} 
                L ${x2 - headlen * Math.cos(angle - Math.PI / 6)} ${y2 - headlen * Math.sin(angle - Math.PI / 6)} 
                M ${x2} ${y2} 
                L ${x2 - headlen * Math.cos(angle + Math.PI / 6)} ${y2 - headlen * Math.sin(angle + Math.PI / 6)}`}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </svg>
      );
    }

    if (el.shapeType === 'rect') {
      return (
        <svg className="absolute inset-0 pointer-events-none w-full h-full">
          <rect
            x={w < 0 ? w : 0}
            y={h < 0 ? h : 0}
            width={Math.abs(w)}
            height={Math.abs(h)}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            fill={fill}
            fillOpacity={opacity}
          />
        </svg>
      );
    }

    if (el.shapeType === 'ellipse') {
      const rx = Math.abs(w / 2);
      const ry = Math.abs(h / 2);
      const cx = w / 2;
      const cy = h / 2;
      return (
        <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            fill={fill}
            fillOpacity={opacity}
          />
        </svg>
      );
    }

    return null;
  };

  // Float Toolbar variables for any single selected element
  const selectedElem = selectedIds.length === 1 ? pageElements.find(el => el.id === selectedIds[0]) : null;

  const adjustLayer = (targetId: string, direction: 'front' | 'back') => {
    const target = textEdits.find(e => e.id === targetId);
    if (!target) return;
    const remaining = textEdits.filter(e => e.id !== targetId);
    const nextEdits = direction === 'front' ? [...remaining, target] : [target, ...remaining];
    if (onBatchSaveTextEdits) {
      onBatchSaveTextEdits(nextEdits);
    } else {
      nextEdits.forEach(edit => onSaveTextEdit(edit));
    }
  };

  return (
    <div
      ref={containerRef}
      id="pdf-text-edit-overlay"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`absolute inset-0 select-none bg-transparent ${
        workMode === 'edit'
          ? `z-40 ${activeEditTool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`
          : 'z-20 pointer-events-none'
      }`}
      style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
    >
      {/* 1. Empty State Banner Help text */}
      {workMode === 'edit' && (
        <div className="absolute top-2.5 left-2.5 bg-zinc-900/90 border border-zinc-700/80 rounded-xl px-3.5 py-1.5 text-[10px] text-white font-sans font-black flex items-center gap-2 shadow-2xl select-none pointer-events-none z-55 max-w-[90%] md:max-w-xl transition-all">
          <Type className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="leading-tight">
            【排版编辑】双击文字即可修改原生文本；任意点击/拖拽选择图形、图片与表格调整大小方向 
            (支持 Ctrl+Z 撤销，Delete 键一键删除)
          </span>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 px-3 py-1.5 rounded-xl text-blue-600 text-xs font-semibold shadow-md flex items-center gap-2 border border-zinc-200">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-blue-600 animate-spin" />
            <span>精确定位排版图纸...</span>
          </div>
        </div>
      )}

      {/* 2. Visual Drag Selection Box marquee boundary */}
      {pointerMode === 'boxSelecting' && (
        <div
          className="absolute border border-dashed border-blue-500 bg-blue-500/10 pointer-events-none z-50 rounded-xs"
          style={{
            left: `${Math.min(boxSelectStart.x, boxSelectCur.x)}px`,
            top: `${Math.min(boxSelectStart.y, boxSelectCur.y)}px`,
            width: `${Math.abs(boxSelectStart.x - boxSelectCur.x)}px`,
            height: `${Math.abs(boxSelectStart.y - boxSelectCur.y)}px`,
          }}
        />
      )}

      {/* 3. Render and Manage Elements on Page */}
      {!loading &&
        pdfViewport &&
        pageElements.map((el) => {
          const isSelected = selectedIds.includes(el.id);
          const isEditing = editingId === el.id;

          const [vx, vy] = toViewport(el.x, el.y);
          const w = el.width * zoomScale;
          const h = el.height * zoomScale;

          // Compute absolute visual coordinates
          const left = vx;
          const top = vy - h;
          const width = Math.abs(w);
          const height = Math.abs(h);

          // Render Style config
          const isUneditedOriginal = el.originalText && el.text === el.originalText && !el.isNew;
          const textBlockStyle: React.CSSProperties = {
            left: `${left}px`,
            top: `${top}px`,
            width: isEditing ? 'auto' : `${width}px`,
            minWidth: isEditing ? `${width}px` : undefined,
            height: `${height}px`,
            fontSize: `${el.fontSize * zoomScale}px`,
            fontFamily: el.fontFamily || getFontFamily(el.fontName),
            fontWeight: el.isBold ? '600' : '400',
            fontStyle: el.isItalic ? 'italic' : 'oblique',
            textDecoration: [
              el.isUnderline && 'underline',
              el.isStrikethrough && 'line-through'
            ].filter(Boolean).join(' ') || 'none',
            textAlign: el.align || 'left',
            color: (isUneditedOriginal && !isEditing) ? 'transparent' : getColorHex(el.color),
            lineHeight: el.lineHeight || '1',
            letterSpacing: el.letterSpacing || 'normal',
            opacity: el.opacity !== undefined ? el.opacity : 1,
            backgroundColor: el.bgColor && el.bgColor !== 'transparent' ? getColorHex(el.bgColor) : 'transparent',
            zIndex: isSelected ? 41 : 35,
          };

          // A. TEXT ELEMENT RENDERER
          if (el.type === 'text' || !el.type) {
            return (
              <div
                key={el.id}
                data-id={el.id}
                style={textBlockStyle}
                onDoubleClick={(e) => handleTextDoubleClick(e, el.id)}
                className={`absolute flex items-center group transition-shadow ${
                  workMode === 'edit'
                    ? `border select-none ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/10 ring-2 ring-blue-500/20'
                          : 'border-dashed border-sky-400/40 bg-sky-400/5 hover:border-sky-500 hover:bg-sky-500/10'
                      } cursor-pointer rounded-xs pointer-events-auto shadow-xs`
                    : 'pointer-events-none'
                }`}
              >
                {/* PDF Cover box to mask original texts underneath edited items */}
                {el.originalText && (el.originalText !== el.text || isEditing) && (
                  <div 
                    className="absolute inset-0 bg-white pointer-events-none select-none rounded-[1px]"
                    style={{
                      zIndex: -1,
                    }}
                  />
                )}

                <span
                  id={`span-${el.id}`}
                  contentEditable={isEditing}
                  suppressContentEditableWarning
                  onBlur={() => handleTextBlur(el.id, el.isNew, el)}
                  onKeyDown={(e) => handleTextKeyDown(e, el.id, el.isNew)}
                  style={{
                    color: (isUneditedOriginal && !isEditing) ? 'transparent' : getColorHex(el.color),
                    outline: 'none',
                    width: '100%',
                    height: '100%',
                    cursor: isEditing ? 'text' : 'inherit',
                  }}
                  className="inline-block focus:ring-0 whitespace-pre-wrap break-words overflow-visible w-full h-full"
                >
                  {el.text}
                </span>

                {/* Sizing Handles */}
                {isSelected && workMode === 'edit' && (
                  <>
                    <div data-handle="tl" data-id={el.id} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-50 hover:bg-blue-500" />
                    <div data-handle="tr" data-id={el.id} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize z-50 hover:bg-blue-500" />
                    <div data-handle="bl" data-id={el.id} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize z-50 hover:bg-blue-500" />
                    <div data-handle="br" data-id={el.id} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-50 hover:bg-blue-500" />
                    {/* Middle Edge side-width adjustment handles */}
                    <div data-handle="ml" data-id={el.id} className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2 h-3.5 bg-white border-2 border-blue-500 rounded-sm cursor-ew-resize z-50 hover:bg-blue-500" />
                    <div data-handle="mr" data-id={el.id} className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2 h-3.5 bg-white border-2 border-blue-500 rounded-sm cursor-ew-resize z-50 hover:bg-blue-500" />
                  </>
                )}
              </div>
            );
          }

          // B. SHAPE ELEMENT RENDERER
          if (el.type === 'shape') {
            const isLineType = el.shapeType === 'line' || el.shapeType === 'arrow';
            
            // Map common color names to valid hex strings
            const getColorHex = (name: string) => {
              const map: Record<string, string> = {
                yellow: '#eab308',
                emerald: '#10b981',
                red: '#ef4444',
                blue: '#3b82f6',
                purple: '#a855f7',
                black: '#000000',
                white: '#ffffff',
              };
              return map[name] || name;
            };

            return (
              <div
                key={el.id}
                data-id={el.id}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  zIndex: isSelected ? 42 : 36,
                }}
                className={`absolute ${workMode === 'edit' ? 'pointer-events-auto border' : 'pointer-events-none'} ${
                  isSelected ? 'border-blue-500 bg-blue-50/5' : 'border-transparent'
                } rounded-xs flex items-center justify-center`}
              >
                {/* SVG drawings renderer */}
                {renderShapeSvg(el)}

                {/* If stamp/shape text exists, render centered text */}
                {el.text && (
                  <div
                    className="absolute inset-0 flex items-center justify-center select-none pointer-events-none uppercase font-black text-center"
                    style={{
                      color: getColorHex(el.borderColor || el.color || 'red'),
                      fontSize: el.fontSize ? `${el.fontSize * zoomScale}px` : '11px',
                      lineHeight: '1.2',
                      padding: '4px',
                    }}
                  >
                    {el.text}
                  </div>
                )}

                {/* 2 Handles for Line / Arrow terminals */}
                {isSelected && workMode === 'edit' && isLineType && (
                  <>
                    <div data-handle="start" data-id={el.id} className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-blue-500 border border-white rounded-full cursor-pointer z-50 hover:scale-110" />
                    <div data-handle="end" data-id={el.id} className="absolute top-[-6px] right-[-6px] w-3.5 h-3.5 bg-blue-500 border border-white rounded-full cursor-pointer z-50 hover:scale-110" style={{ transform: `translate(${w}px, ${-h}px)` }} />
                  </>
                )}

                {/* Corner Sizers for box shapes & stamps */}
                {isSelected && workMode === 'edit' && !isLineType && (
                  <>
                    <div data-handle="tl" data-id={el.id} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-50" />
                    <div data-handle="tr" data-id={el.id} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize z-50" />
                    <div data-handle="bl" data-id={el.id} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize z-50" />
                    <div data-handle="br" data-id={el.id} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-50" />

                    {/* Rotation Handle Lever of shape/stamp */}
                    <div className="absolute left-1/2 -top-6 transform -translate-x-1/2 flex flex-col items-center select-none pointer-events-auto">
                      <div data-rotate-handle="true" data-id={el.id} className="w-3.5 h-3.5 bg-amber-500 border border-white rounded-full cursor-pointer hover:bg-amber-600 transition shadow" title="拖动旋转图章" />
                      <div className="w-[1px] h-3.5 bg-amber-500" />
                    </div>
                  </>
                )}
              </div>
            );
          }

          // C. IMAGE ELEMENT RENDERER
          if (el.type === 'image' && el.imageSrc) {
            const cropStyle = {
              clipPath: `inset(${el.cropTop || 0}% ${el.cropRight || 0}% ${el.cropBottom || 0}% ${el.cropLeft || 0}%)`
            };
            return (
              <div
                key={el.id}
                data-id={el.id}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  transform: `rotate(${el.rotation || 0}deg)`,
                  zIndex: isSelected ? 43 : 37,
                }}
                className={`absolute select-none group border ${
                  isSelected ? 'border-blue-500 bg-blue-50/10' : 'border-zinc-200'
                } pointer-events-auto cursor-grab active:cursor-grabbing rounded`}
              >
                <img
                  src={el.imageSrc}
                  style={cropStyle}
                  className="w-full h-full object-fill select-none pointer-events-none"
                  referrerPolicy="no-referrer"
                  alt="pdf-edit-asset"
                />

                {/* Sizing Handles */}
                {isSelected && workMode === 'edit' && (
                  <>
                    <div data-handle="tl" data-id={el.id} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-50" />
                    <div data-handle="tr" data-id={el.id} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize z-50" />
                    <div data-handle="bl" data-id={el.id} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize z-50" />
                    <div data-handle="br" data-id={el.id} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-50" />

                    {/* Rotation Handle Lever of image */}
                    <div className="absolute left-1/2 -top-6 transform -translate-x-1/2 flex flex-col items-center select-none pointer-events-auto">
                      <div data-rotate-handle="true" data-id={el.id} className="w-4 h-4 bg-amber-500 border border-white rounded-full cursor-pointer hover:bg-amber-600 transition shadow" title="拖动旋转图片" />
                      <div className="w-[1px] h-3.5 bg-amber-500" />
                    </div>
                  </>
                )}
              </div>
            );
          }

          // D. TABLE ELEMENT RENDERER
          if (el.type === 'table' && el.cells) {
            return (
              <div
                key={el.id}
                data-id={el.id}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  zIndex: isSelected ? 44 : 38,
                }}
                className={`absolute select-none border bg-white ${
                  isSelected ? 'border-blue-500 p-1 shadow-lg' : 'border-zinc-300'
                } pointer-events-auto`}
              >
                <div className="w-full h-full overflow-auto scrollbar-none">
                  <table className="w-full h-full border-collapse text-xs text-zinc-800">
                    <tbody>
                      {el.cells.map((rowArr: string[], rIdx: number) => (
                        <tr key={rIdx} className={`border-b border-zinc-200/50 ${
                          el.zebraStripes && rIdx % 2 !== 0 && rIdx !== 0 ? 'bg-zinc-50/70' : ''
                        }`}>
                          {rowArr.map((cellText: string, cIdx: number) => {
                            const isHeaderCell = rIdx === 0 && el.tableHeaderStyle !== 'none';
                            const headerClass = el.tableHeaderStyle === 'dark' 
                              ? 'bg-zinc-900 text-white font-semibold'
                              : el.tableHeaderStyle === 'light'
                                ? 'bg-zinc-100 text-zinc-900 font-semibold border-b border-zinc-300'
                                : 'border-b border-zinc-200';
                            
                            return (
                              <td
                                key={cIdx}
                                contentEditable={workMode === 'edit'}
                                suppressContentEditableWarning
                                onBlur={(e) => handleTableCellBlur(el.id, rIdx, cIdx, e.currentTarget.textContent || '')}
                                style={{
                                  borderRight: el.tableBorderOpacity !== 0 ? `1px solid rgba(212, 212, 216, ${el.tableBorderOpacity !== undefined ? el.tableBorderOpacity : 1})` : undefined,
                                  borderBottom: el.tableBorderOpacity !== 0 ? `1px solid rgba(212, 212, 216, ${el.tableBorderOpacity !== undefined ? el.tableBorderOpacity : 1})` : undefined,
                                }}
                                className={`p-1.5 font-sans hover:bg-zinc-50 focus:bg-blue-50/50 focus:outline-none min-w-[35px] text-center ${headerClass}`}
                              >
                                {cellText}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Sizing Handles */}
                {isSelected && workMode === 'edit' && (
                  <>
                    <div data-handle="tl" data-id={el.id} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-50 hover:bg-blue-500" />
                    <div data-handle="tr" data-id={el.id} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize z-50 hover:bg-blue-500" />
                    <div data-handle="bl" data-id={el.id} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize z-50 hover:bg-blue-500" />
                    <div data-handle="br" data-id={el.id} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-50 hover:bg-blue-500" />
                  </>
                )}
              </div>
            );
          }

          return null;
        })}

      {/* 4. Formatting Properties Floating Toolbar */}
      {workMode === 'edit' && selectedElem && (
        <div
          className="absolute bg-zinc-900/95 border border-zinc-805 text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-xl p-1.5 z-60 animate-none flex items-center gap-1.5 scale-90 whitespace-nowrap overflow-x-auto max-w-[95vw] md:max-w-none scrollbar-none select-none transition-all"
          style={{
            left: `${toViewport(selectedElem.x, selectedElem.y)[0]}px`,
            top: `${Math.max(10, toViewport(selectedElem.x, selectedElem.y)[1] - (selectedElem.height * zoomScale) - 56)}px`,
            transform: 'translateX(-15%)',
          }}
        >
          {/* A. TEXT EDIT TOOLBAR CONTROLS */}
          {(selectedElem.type === 'text' || !selectedElem.type) && (
            <>
              {/* Bold shortcut toggler */}
              <button
                type="button"
                onClick={() => updateSelectedTextStyle({ isBold: !selectedElem.isBold })}
                className={`p-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center cursor-pointer border text-[11px] font-bold ${
                  selectedElem.isBold 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' 
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                }`}
                title="加粗"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>

              {/* Italic Shortcut */}
              <button
                type="button"
                onClick={() => updateSelectedTextStyle({ isItalic: !selectedElem.isItalic })}
                className={`p-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center cursor-pointer border text-[11px] font-bold ${
                  selectedElem.isItalic 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' 
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                }`}
                title="斜体"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>

              {/* Underline Shortcut */}
              <button
                type="button"
                onClick={() => updateSelectedTextStyle({ isUnderline: !selectedElem.isUnderline })}
                className={`p-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center cursor-pointer border text-[11px] font-bold ${
                  selectedElem.isUnderline 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' 
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                }`}
                title="下划线"
              >
                <Underline className="h-3.5 w-3.5" />
              </button>

              <div className="w-[1px] h-4 bg-zinc-800 mx-0.5 shrink-0" />

              {/* Color dropdown shortcut */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsColorMenuOpen(!isColorMenuOpen);
                    setIsHighlightMenuOpen(false);
                  }}
                  className="p-1 px-2 h-7 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white transition flex items-center justify-center gap-1.5 border border-zinc-700 bg-zinc-800 cursor-pointer text-[10.5px] font-bold"
                  title="设置文本颜色"
                >
                  <Palette className="h-3.5 w-3.5" style={{ color: getColorHex(selectedElem.color) }} />
                  <span>颜色</span>
                  <ChevronDown className="h-2.5 w-2.5 text-zinc-500" />
                </button>

                {isColorMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-50 bg-transparent" onClick={() => setIsColorMenuOpen(false)} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-1.5 bg-zinc-900 border border-zinc-850 rounded-xl shadow-2xl z-55 flex items-center gap-1.5">
                      {['black', 'white', 'red', 'blue', 'emerald', 'purple', 'yellow'].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => {
                            updateSelectedTextStyle({ color: col });
                            setIsColorMenuOpen(false);
                          }}
                          className="w-4 h-4 rounded-full border border-zinc-700 hover:border-zinc-550 transition hover:scale-125 cursor-pointer"
                          style={{ backgroundColor: getColorHex(col) }}
                          title={col}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="w-[1px] h-4 bg-zinc-800 mx-0.5 shrink-0" />

              {/* Size controls (字号- / Size / 字号+) */}
              <div className="flex items-center bg-zinc-855 border border-zinc-750 hover:border-zinc-650 rounded-lg h-7 px-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => updateSelectedTextStyle({ fontSize: Math.max(5, (selectedElem.fontSize || 12) - 1) })}
                  className="w-5 h-5 rounded hover:bg-zinc-750 text-zinc-250 hover:text-white font-mono font-bold flex items-center justify-center cursor-pointer select-none"
                  title="减小字号 (-1)"
                >
                  <Minus className="h-2.5 w-2.5" />
                </button>
                <span className="px-1.5 text-xs font-bold font-mono text-zinc-200">
                  {Math.round(selectedElem.fontSize || 12)}px
                </span>
                <button
                  type="button"
                  onClick={() => updateSelectedTextStyle({ fontSize: Math.min(128, (selectedElem.fontSize || 12) + 1) })}
                  className="w-5 h-5 rounded hover:bg-zinc-750 text-zinc-250 hover:text-white font-mono font-bold flex items-center justify-center cursor-pointer select-none"
                  title="增大字号 (+1)"
                >
                  <Plus className="h-2.5 w-2.5" />
                </button>
              </div>

              <div className="w-[1px] h-4 bg-zinc-800 mx-0.5 shrink-0" />

              {/* Alignment Selection */}
              <div className="flex items-center bg-zinc-850 rounded-lg p-0.5 border border-zinc-750 h-7 shrink-0">
                {(['left', 'center', 'right'] as const).map((align) => {
                  const isActive = (selectedElem.align || 'left') === align;
                  return (
                    <button
                      key={align}
                      type="button"
                      onClick={() => updateSelectedTextStyle({ align })}
                      className={`w-6 h-6 rounded flex items-center justify-center transition cursor-pointer ${
                        isActive ? 'bg-indigo-650 text-white shadow-xs' : 'text-zinc-400 hover:text-white hover:bg-zinc-750'
                      }`}
                      title={`${align === 'left' ? '左对齐' : align === 'center' ? '横向居中' : '右对齐'}`}
                    >
                      {align === 'left' && <AlignLeft className="h-3 w-3" />}
                      {align === 'center' && <AlignCenter className="h-3 w-3" />}
                      {align === 'right' && <AlignRight className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>

              <div className="w-[1px] h-4 bg-zinc-800 mx-0.5 shrink-0" />

              {/* Copy/Paste Style shortcuts */}
              <button
                type="button"
                onClick={() => {
                  setStyleClipboard({
                    fontSize: selectedElem.fontSize,
                    color: selectedElem.color,
                    bgColor: selectedElem.bgColor,
                    isBold: selectedElem.isBold,
                    isItalic: selectedElem.isItalic,
                    isUnderline: selectedElem.isUnderline,
                    fontFamily: selectedElem.fontFamily,
                    align: selectedElem.align,
                    letterSpacing: selectedElem.letterSpacing,
                    lineHeight: selectedElem.lineHeight,
                  });
                }}
                className="p-1 px-2 h-7 rounded-lg text-zinc-350 hover:bg-zinc-800 hover:text-white border border-zinc-750 bg-zinc-855 cursor-pointer flex items-center gap-1.5 text-[10.5px] font-bold font-sans"
                title="复制当前文本的一切字体、颜色和大小样式属性"
              >
                <Copy className="h-3 w-3" />
                <span>复制样式</span>
              </button>

              {styleClipboard && (
                <button
                  type="button"
                  onClick={() => {
                    updateSelectedTextStyle(styleClipboard);
                  }}
                  className="p-1 px-2 h-7 rounded-lg text-emerald-400 hover:bg-emerald-950/30 hover:text-emerald-300 border border-emerald-900/40 bg-zinc-850 cursor-pointer flex items-center gap-1.5 text-[10.5px] font-black"
                  title="将复制的样式套用至此文本上"
                >
                  <Clipboard className="h-3 w-3" />
                  <span>粘贴样式</span>
                </button>
              )}

              <div className="w-[1px] h-4 bg-zinc-800 mx-0.5 shrink-0" />

              {/* AI Quick helper shortcut */}
              <div className="relative">
                <button
                  type="button"
                  disabled={isAiProcessingLocal}
                  onClick={() => {
                    setIsHighlightMenuOpen(!isHighlightMenuOpen);
                    setIsColorMenuOpen(false);
                  }}
                  className="p-1 px-2.5 h-7 rounded-lg text-indigo-300 bg-indigo-950/45 hover:bg-indigo-900/50 hover:text-indigo-200 border border-indigo-900/45 transition flex items-center justify-center gap-1.5 cursor-pointer text-[10.5px] font-black"
                  title="智能大模型一键润色、改写与扩写缩写"
                >
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-400" />
                  <span>AI改写</span>
                  <ChevronDown className="h-2.5 w-2.5 text-indigo-500" />
                </button>

                {isHighlightMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-50 bg-transparent" onClick={() => setIsHighlightMenuOpen(false)} />
                    <div className="absolute bottom-full right-0 mb-2 p-1 bg-zinc-900 w-[180px] border border-zinc-800 bg-zinc-900 rounded-xl shadow-2xl z-55 flex flex-col">
                      <span className="text-[8.5px] text-zinc-500 font-bold px-2 py-1 select-none border-b border-zinc-800">一键 AI 智能加工</span>
                      {[
                        { label: '✨ 智能通顺润色', action: 'polish' },
                        { label: '📝 正式商务改写', action: 'rewrite', val: '专业商务陈述' },
                        { label: '📣 科技营销撰写', action: 'rewrite', val: '营销科技感推广' },
                        { label: '📊 扩写比例扩充', action: 'expand' },
                        { label: '✂️ 缩写精炼提炼', action: 'shorten' },
                        { label: '🌍 翻译为英文', action: 'translate', val: 'English' },
                        { label: '🇨🇳 外文自动汉化', action: 'translate', val: 'Chinese' },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={async () => {
                            setIsHighlightMenuOpen(false);
                            // Call local Gemini handler
                            setIsAiProcessingLocal(true);
                            try {
                              let prompt = '';
                              if (opt.action === 'polish') {
                                prompt = `对以下段落进行专业的语病纠正、通顺度润色、并提升其可读性。保持原意，使其更加精练优雅：\n\n「 ${selectedElem.text} 」`;
                              } else if (opt.action === 'translate') {
                                prompt = `将以下文字准确翻译为【${opt.val}】。要求行文自然地道，保持原意。切勿返回任何旁白、对白、引号或 markdown，直接输出翻译结果：\n\n「 ${selectedElem.text} 」`;
                              } else if (opt.action === 'rewrite') {
                                prompt = `对以下段落进行语气转换或重构。现在的预期语气是【${opt.val}】。请相应改写：\n\n「 ${selectedElem.text} 」`;
                              } else if (opt.action === 'expand') {
                                prompt = `在不改变原段落意图的大前提下，适度扩宽语句结构，补充一些更具体的技术或商业描述细节促进其充实。要求语句极度通顺、精美：\n\n「 ${selectedElem.text} 」`;
                              } else if (opt.action === 'shorten') {
                                prompt = `一键精炼和缩写下面文字，提取绝对中心论点，剔除修饰，大幅提炼精炼缩减，不丢失任何定量财务或数据。输出极简明短句：\n\n「 ${selectedElem.text} 」`;
                              }

                              if (!apiKey) {
                                alert('请在右侧面板顶部配置有效的 Google AI Studio Gemini API Key 才能驱动大模型！');
                                return;
                              }

                              const response = await fetch(
                                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
                                {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    contents: [{ parts: [{ text: prompt }] }],
                                    generationConfig: { temperature: 0.3 }
                                  })
                                }
                              );

                              if (!response.ok) throw new Error('API Exception');
                              const resJson = await response.json();
                              const nextStr = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                              if (nextStr) {
                                updateSelectedTextStyle({ text: nextStr });
                              } else {
                                alert('未获得有效的 AI 改写序列结果');
                              }
                            } catch (err) {
                              alert('AI 改写发生故障，请核对右侧配置的 API Key 是否正确');
                            } finally {
                              setIsAiProcessingLocal(false);
                            }
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:text-white transition rounded-lg font-medium flex items-center gap-1.5 cursor-pointer"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {isAiProcessingLocal && (
                <div className="flex items-center gap-1 px-1.5 select-none shrink-0 border border-indigo-900/40 bg-zinc-950 rounded-lg h-7">
                  <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                  <span className="text-[9.5px] text-zinc-400">研写中...</span>
                </div>
              )}
            </>
          )}

          {/* B. SHAPE EDIT TOOLBAR CONTROLS */}
          {selectedElem.type === 'shape' && (
            <>
              <span className="text-[10px] font-black text-zinc-400 select-none px-1 shrink-0">矢量图形</span>
              
              <select
                value={selectedElem.borderStyle || 'solid'}
                onChange={(e) => onSaveTextEdit({ ...selectedElem, borderStyle: e.target.value as any })}
                className="bg-zinc-800 border border-zinc-700 hover:border-zinc-500 rounded-lg text-[10.5px] font-bold px-1.5 py-1 text-zinc-100 cursor-pointer focus:outline-none"
                title="设置边框类型（实线/虚线）"
              >
                <option value="solid" className="bg-zinc-900 text-zinc-100">🔴 实线轮廓 (Solid)</option>
                <option value="dashed" className="bg-zinc-900 text-zinc-100">➖ 虚线轮廓 (Dashed)</option>
              </select>

              <select
                value={selectedElem.thickness || 3}
                onChange={(e) => onSaveTextEdit({ ...selectedElem, thickness: Number(e.target.value) })}
                className="bg-zinc-800 border border-zinc-700 hover:border-zinc-500 rounded-lg text-[10.5px] font-bold px-1.5 py-1 text-zinc-100 cursor-pointer focus:outline-none"
                title="设置线条粗细"
              >
                {[1, 2, 3, 4, 5, 8, 12].map((tk) => (
                  <option key={tk} value={tk} className="bg-zinc-900 text-zinc-100">粗细: {tk}px</option>
                ))}
              </select>

              <div className="w-[1px] h-4 bg-zinc-200" />

              <div className="relative">
                <button
                  onClick={() => {
                    setIsColorMenuOpen(!isColorMenuOpen);
                    setIsHighlightMenuOpen(false);
                  }}
                  className="p-1 rounded-lg text-zinc-650 hover:bg-zinc-155 transition flex items-center justify-center gap-1 border border-zinc-200 bg-zinc-50 cursor-pointer"
                  title="设置轮廓边框颜色"
                >
                  <div className="w-3 h-3 rounded-full border border-zinc-400 animate-none shrink-0" style={{ backgroundColor: getColorHex(selectedElem.borderColor || 'black') }} />
                  <span className="text-[10px] font-black text-zinc-500">边框</span>
                </button>
                {isColorMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-50 bg-transparent" onClick={() => setIsColorMenuOpen(false)} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-1.5 bg-white border border-zinc-200 rounded-xl shadow-xl z-55 flex items-center gap-1.5">
                      {['black', 'white', 'red', 'blue', 'yellow', 'emerald', 'purple'].map((col) => (
                        <button
                          key={col}
                          onClick={() => {
                            onSaveTextEdit({ ...selectedElem, borderColor: col });
                            setIsColorMenuOpen(false);
                          }}
                          className="w-4 h-4 rounded-full border border-zinc-350 transition hover:scale-125 cursor-pointer"
                          style={{ backgroundColor: getColorHex(col) }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    setIsHighlightMenuOpen(!isHighlightMenuOpen);
                    setIsColorMenuOpen(false);
                  }}
                  className="p-1 rounded-lg text-zinc-650 hover:bg-zinc-155 transition flex items-center justify-center gap-1 border border-zinc-200 bg-zinc-50 cursor-pointer"
                  title="设置闭合区域填充颜色"
                >
                  <div className="w-3 h-3 rounded-full border border-dashed border-zinc-400 shrink-0" style={{ backgroundColor: selectedElem.fillColor ? getColorHex(selectedElem.fillColor) : 'transparent' }} />
                  <span className="text-[10px] font-black text-zinc-500">填充</span>
                </button>
                {isHighlightMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-50 bg-transparent" onClick={() => setIsHighlightMenuOpen(false)} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-1.5 bg-white border border-zinc-200 rounded-xl shadow-xl z-55 flex items-center gap-1.5">
                      {['transparent', 'yellow', 'emerald', 'blue', 'red', 'purple', 'black', 'white'].map((col) => (
                        <button
                          key={col}
                          onClick={() => {
                            onSaveTextEdit({ ...selectedElem, fillColor: col });
                            setIsHighlightMenuOpen(false);
                          }}
                          className="w-4 h-4 rounded-full border border-zinc-350 transition hover:scale-125 flex items-center justify-center cursor-pointer"
                          style={{ backgroundColor: col === 'transparent' ? 'transparent' : getColorHex(col) }}
                        >
                          {col === 'transparent' && <span className="text-[8px] text-zinc-400 font-bold">×</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <select
                value={selectedElem.fillOpacity !== undefined ? selectedElem.fillOpacity : 0.5}
                onChange={(e) => onSaveTextEdit({ ...selectedElem, fillOpacity: Number(e.target.value) })}
                className="bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] font-bold px-1.5 py-1 text-zinc-700 cursor-pointer"
                title="设置填充区域不透明度"
              >
                <option value={1}>不透明度: 100%</option>
                <option value={0.8}>不透明度: 80%</option>
                <option value={0.5}>不透明度: 50%</option>
                <option value={0.25}>不透明度: 25%</option>
                <option value={0}>不透明度: 0%</option>
              </select>

              <div className="w-[1px] h-4 bg-zinc-200" />

              <button
                onClick={() => adjustLayer(selectedElem.id, 'front')}
                className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded text-[10.5px] hover:bg-zinc-150 font-black cursor-pointer"
                title="置于顶层"
              >
                🔼 置顶
              </button>
              <button
                onClick={() => adjustLayer(selectedElem.id, 'back')}
                className="px-2 py-1 bg-zinc-50 border border-[#b2b4bc] rounded text-[10.5px] hover:bg-zinc-150 font-black cursor-pointer"
                title="下推底层"
              >
                🔽 置底
              </button>
            </>
          )}

          {/* C. IMAGE EDIT TOOLBAR CONTROLS */}
          {selectedElem.type === 'image' && (
            <>
              <span className="text-[10px] font-black text-zinc-400 select-none px-1 shrink-0">外部插图</span>

              <select
                value={selectedElem.opacity !== undefined ? selectedElem.opacity : 1}
                onChange={(e) => onSaveTextEdit({ ...selectedElem, opacity: Number(e.target.value) })}
                className="bg-zinc-50 border border-zinc-200 rounded-lg text-[10.5px] font-bold px-1.5 py-1 text-zinc-800 cursor-pointer"
                title="设置图片透明度"
              >
                <option value={1}>不透度: 100%</option>
                <option value={0.8}>不透度: 80%</option>
                <option value={0.6}>不透度: 60%</option>
                <option value={0.4}>不透度: 40%</option>
              </select>

              <button
                onClick={() => {
                  const nextRot = ((selectedElem.rotation || 0) + 90) % 360;
                  onSaveTextEdit({ ...selectedElem, rotation: nextRot });
                }}
                className="px-2 py-1 bg-zinc-50 border border-zinc-250 hover:bg-zinc-150 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer"
                title="顺时针水平快速翻滚旋转"
              >
                <span>🔄 旋转 90°</span>
              </button>

              <div className="w-[1px] h-4 bg-zinc-200" />

              <div className="flex items-center gap-1 select-none">
                <span className="text-[9.5px] font-black text-zinc-500 shrink-0">✂️ 剪裁边距 %</span>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={selectedElem.cropLeft || 0}
                  onChange={(e) => onSaveTextEdit({ ...selectedElem, cropLeft: Number(e.target.value) })}
                  className="w-10 text-center bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  title="裁剪左侧区域十分制 %"
                  placeholder="左"
                />
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={selectedElem.cropRight || 0}
                  onChange={(e) => onSaveTextEdit({ ...selectedElem, cropRight: Number(e.target.value) })}
                  className="w-10 text-center bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  title="裁剪右侧区域百分制 %"
                  placeholder="右"
                />
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={selectedElem.cropTop || 0}
                  onChange={(e) => onSaveTextEdit({ ...selectedElem, cropTop: Number(e.target.value) })}
                  className="w-10 text-center bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  title="裁剪顶部区域百分制 %"
                  placeholder="上"
                />
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={selectedElem.cropBottom || 0}
                  onChange={(e) => onSaveTextEdit({ ...selectedElem, cropBottom: Number(e.target.value) })}
                  className="w-10 text-center bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  title="裁剪底部区域百分制 %"
                  placeholder="下"
                />
              </div>

              <div className="w-[1px] h-4 bg-zinc-200" />

              <button
                onClick={() => adjustLayer(selectedElem.id, 'front')}
                className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded text-[10.5px] hover:bg-zinc-150 font-black cursor-pointer"
              >
                🔼 置顶
              </button>
              <button
                onClick={() => adjustLayer(selectedElem.id, 'back')}
                className="px-2 py-1 bg-zinc-50 border border-[#b2b4bc] rounded text-[10.5px] hover:bg-zinc-150 font-black cursor-pointer"
              >
                🔽 置底
              </button>
            </>
          )}

          {/* D. TABLE EDIT TOOLBAR CONTROLS */}
          {selectedElem.type === 'table' && (
            <>
              <span className="text-[10px] font-black text-zinc-400 select-none px-1 shrink-0">数据网格</span>

              <select
                value={selectedElem.tableHeaderStyle || 'light'}
                onChange={(e) => onSaveTextEdit({ ...selectedElem, tableHeaderStyle: e.target.value as any })}
                className="bg-zinc-50 border border-zinc-200 hover:border-zinc-350 rounded-lg text-[10.5px] font-bold px-1.5 py-1 text-zinc-800 cursor-pointer"
                title="设置表头颜色外观"
              >
                <option value="none">无表头装饰</option>
                <option value="light">💼 浅灰表头 (Light)</option>
                <option value="dark">🌑 商务黑色表头 (Dark)</option>
              </select>

              <button
                onClick={() => onSaveTextEdit({ ...selectedElem, zebraStripes: !selectedElem.zebraStripes })}
                className={`px-2 py-1 border rounded-lg text-[10px] font-black flex items-center transition cursor-pointer ${
                  selectedElem.zebraStripes
                    ? 'bg-[#6366f1] border-[#6366f1] text-white shadow'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-150 hover:text-zinc-900'
                }`}
              >
                {selectedElem.zebraStripes ? '✅ 开启斑马条纹' : '◽ 开启斑马条纹'}
              </button>

              <select
                value={selectedElem.tableBorderOpacity !== undefined ? selectedElem.tableBorderOpacity : 1}
                onChange={(e) => onSaveTextEdit({ ...selectedElem, tableBorderOpacity: Number(e.target.value) })}
                className="bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] font-bold px-1.5 py-1 text-zinc-705 cursor-pointer"
                title="边框线透明度等级"
              >
                <option value={1}>实线边框 (100% 不透明)</option>
                <option value={0.6}>淡灰过渡 (60% 不透明)</option>
                <option value={0.25}>微弱背景线 (25% 不透明)</option>
                <option value={0}>隐藏边框 (0% 无边框)</option>
              </select>

              <div className="w-[1px] h-4 bg-zinc-200" />

              <button
                onClick={() => adjustLayer(selectedElem.id, 'front')}
                className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded text-[10.5px] hover:bg-zinc-150 font-black cursor-pointer"
              >
                🔼 置顶
              </button>
              <button
                onClick={() => adjustLayer(selectedElem.id, 'back')}
                className="px-2 py-1 bg-zinc-50 border border-[#b2b4bc] rounded text-[10.5px] hover:bg-zinc-150 font-black cursor-pointer"
              >
                🔽 置底
              </button>
            </>
          )}

          <div className="w-[1px] h-4 bg-zinc-200" />

          {/* Common Item Deletion Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteElement(selectedElem.id);
              setSelectedIds([]);
            }}
            className="p-1 px-1.5 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition flex items-center gap-1 font-black text-[10px] cursor-pointer shrink-0"
            title="强力一键粉碎并移出该原件"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0 animate-pulse text-red-500" />
            <span>彻底删除</span>
          </button>
        </div>
      )}
    </div>
  );
}
