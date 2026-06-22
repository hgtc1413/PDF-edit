export interface PDFPageInfo {
  pageNumber: number;
  originalPageNumber?: number; // Pointer to original PDF.js and pdf-lib page index (1-based), -1 if blank page
  thumbnailUrl: string | null;
  width: number;
  height: number;
  pdfDoc?: any; // Associated PDFDocumentProxy if loaded from merged source
  pdfFileBytes?: Uint8Array; // Raw original file bytes containing this page for exporting
  rotation?: number; // Rotation degree of this page (0, 90, 180, 270)
  splitType?: 'top' | 'bottom'; // Tells if page resulted from slice splits
}

export interface PDFDocumentState {
  fileName: string;
  fileSize: number;
  totalPages: number;
  rawBytes: Uint8Array | null;
}

export type ToolType = 'select' | 'highlight' | 'pen' | 'text' | 'rect' | 'eraser';

export type WorkMode = 'markup' | 'edit';

export interface TextEdit {
  id: string;
  pageNumber: number;
  type?: 'text' | 'shape' | 'image' | 'table'; // defaults to 'text' if undefined for compatibility
  text: string;
  originalText: string;
  x: number;          // PDF page points
  y: number;          // PDF page points
  width: number;      // PDF page points
  height: number;     // PDF page points
  fontSize: number;   // PDF page points
  color: string;      // RGB or hex color string name (e.g., 'black', 'red')
  isNew: boolean;     // True if user-added, False if replacement of existing text
  originalWidth?: number; // PDF page points of original block being covered

  // Enhancements for formatting
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  align?: 'left' | 'center' | 'right';
  fontFamily?: string;
  bgColor?: string;
  letterSpacing?: string;
  lineHeight?: number;
  opacity?: number;
  isOriginal?: boolean;
  isDeleted?: boolean;
  fontName?: string;

  // Shape specific properties
  shapeType?: 'line' | 'rect' | 'ellipse' | 'arrow';
  thickness?: number;
  borderColor?: string;
  fillColor?: string;
  fillOpacity?: number; // range [0..1]
  borderStyle?: 'solid' | 'dashed';

  // Image specific properties
  imageSrc?: string;    // Base64 or URL
  imageType?: 'jpg' | 'png' | 'webp';
  rotation?: number;    // rotation angle in degrees (0..360)
  cropLeft?: number;    // slider cropping percentages (0..100)
  cropRight?: number;
  cropTop?: number;
  cropBottom?: number;

  // Table specific properties
  rows?: number;
  cols?: number;
  cells?: string[][];   // 2D grid representation: row-major array [rows][cols] of strings
  tableHeaderStyle?: 'dark' | 'light' | 'none';
  zebraStripes?: boolean;
  tableBorderOpacity?: number;

  // Header/Footer specific properties
  isHeaderFooter?: boolean;
  headerFooterType?: 'header' | 'footer';
}

export type AnnotationType = 'highlight' | 'pen' | 'text' | 'rect';

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  pageNumber: number;
  color: string;
  comment?: string;
  author?: string;
  createdAt?: string;
}

export interface HighlightPoint {
  x: number;  // 相对页面自然宽度百分比比例 [0..1]
  y: number;  // 相对页面自然高度百分比比例 [0..1]
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight';
  x: number; // 相对页面 [0..1]
  y: number; // 相对页面 [0..1]
  width: number; // 相对页面 [0..1]
  height: number; // 相对页面 [0..1]
}

export interface PenAnnotation extends BaseAnnotation {
  type: 'pen';
  points: HighlightPoint[];
  thickness: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  fontSize: number;
  x: number; // relative [0..1]
  y: number; // relative [0..1]
}

export interface RectAnnotation extends BaseAnnotation {
  type: 'rect';
  x: number; // relative [0..1]
  y: number; // relative [0..1]
  width: number; // relative [0..1]
  height: number; // relative [0..1]
  isFilled: boolean;
}

export type PDFAnnotation = HighlightAnnotation | PenAnnotation | TextAnnotation | RectAnnotation;
