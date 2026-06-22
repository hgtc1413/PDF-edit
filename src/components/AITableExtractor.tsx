import React, { useState } from 'react';
import {
  Table,
  Grid,
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  AlertCircle,
  FileSpreadsheet,
  PlusCircle,
  MinusCircle,
  Eye,
  Info
} from 'lucide-react';

interface ExtractedTable {
  title: string;
  headers: string[];
  rows: string[][];
}

interface AITableExtractorProps {
  apiKey: string;
  currentPage: number;
  extractedPagesText: Record<number, string>;
  isExtractingText: boolean;
  pagesCount: number;
}

export default function AITableExtractor({
  apiKey,
  currentPage,
  extractedPagesText,
  isExtractingText,
  pagesCount
}: AITableExtractorProps) {
  const [sourceRange, setSourceRange] = useState<'current' | 'all' | 'selection'>('current');
  const [customRule, setCustomRule] = useState('');
  const [isExtractingTable, setIsExtractingTable] = useState(false);
  const [extractedTables, setExtractedTables] = useState<ExtractedTable[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [downloadedIndex, setDownloadedIndex] = useState<number | null>(null);

  // Helper: Get text from standard selection or state
  const getSelectedText = () => {
    const sel = window.getSelection();
    return sel ? sel.toString().trim() : '';
  };

  const hasSelection = getSelectedText().length > 0;

  const handleStartExtraction = async () => {
    if (!apiKey) {
      setErrorText('请在顶部配置您的 Gemini API Key 才能开始提取。');
      return;
    }

    setErrorText(null);
    setIsExtractingTable(true);

    let textToAnalyze = '';
    
    if (sourceRange === 'selection') {
      const selText = getSelectedText();
      if (!selText) {
        setErrorText('未在 PDF 阅读器中检测到选中文本，请使用鼠标划选页面文字，或切换为“当前页”提取。');
        setIsExtractingTable(false);
        return;
      }
      textToAnalyze = selText;
    } else if (sourceRange === 'current') {
      textToAnalyze = extractedPagesText[currentPage] || '';
      if (!textToAnalyze.trim()) {
        setErrorText(`当前第 ${currentPage} 页未识别到任何文本内容，您可以尝试选择“全文”进行提取。`);
        setIsExtractingTable(false);
        return;
      }
    } else {
      // All pages combined
      textToAnalyze = Object.entries(extractedPagesText)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([page, txt]) => `[Page ${page}]:\n${txt}`)
        .join('\n\n');
      
      if (!textToAnalyze.trim()) {
        setErrorText('文档全文字符串为空，请等待上方“解析文档索引”完毕后重试。');
        setIsExtractingTable(false);
        return;
      }
    }

    try {
      const userInstructions = customRule.trim() 
        ? `用户额外约束：【${customRule.trim()}】` 
        : '';

      const userPrompt = `这里是一段来源于 PDF 文档的文本内容。
请仔细阅读，并将其中的表格或排版规则的网格结构数据完整而准确地提炼。
提取时请严格遵循真实值，不要胡编数据或进行无根据的趋势外推。

${userInstructions}

需要处理的文本如下：
---
${textToAnalyze}
---`;

      const systemPrompt = `你是一个出色的 PDF 数据处理和表格提取专家。
你只能输出合法且严格的 JSON 数组。
请不要包含任何自然语言回复、Markdown 语法包裹框、Markdown 标题或者多余的空字符。
返回的 JSON 数据必须是一个数组，数组内的每个对象表示一个抽提的表格。数据格式定义如下：
[
  {
    "title": "表格代表的事体名称或页码描述（比如“2025年第一季度营收明细”，如果找不到标题，则结合内容生成一个具体的中文标题）",
    "headers": ["列名1", "列名2", "列名3"],
    "rows": [
      ["第一行第一列", "第一行第二列", "第一行第三列"],
      ["第二行第一列", "第二行第二列", "第二行第三列"]
    ]
  }
]
如果文本十分凌乱、或实在不包含任何表格网格结构，请绝对返回一个空的 JSON 数组：[]。`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            }
          }),
        }
      );

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error?.message || `表格提取接口响应失败 (${response.status})`);
      }

      const resJson = await response.json();
      const answerText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      if (!answerText.trim()) {
        throw new Error('AI 返回的内容为空');
      }

      let parsed: ExtractedTable[] = [];
      try {
        parsed = JSON.parse(answerText);
      } catch {
        // Fallback robust extraction
        const match = answerText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error('AI 返回的数据不是合法的 JSON 格式，请重试');
        }
      }

      if (!Array.isArray(parsed)) {
        parsed = [];
      }

      setExtractedTables(parsed);
      if (parsed.length === 0) {
        setErrorText('AI 在划定文本段落中未感知到明确的表格结构或数据。您可以尝试换一个页面或选中具体内容部分。');
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || '表格数据提取时发生异常。');
    } finally {
      setIsExtractingTable(false);
    }
  };

  // Editing logic helpers
  const handleCellChange = (tableIdx: number, rowIdx: number, colIdx: number, val: string) => {
    setExtractedTables(prev => {
      const copy = [...prev];
      const tbl = { ...copy[tableIdx] };
      tbl.rows = tbl.rows.map((row, r) => 
        r === rowIdx ? row.map((cell, c) => c === colIdx ? val : cell) : row
      );
      copy[tableIdx] = tbl;
      return copy;
    });
  };

  const handleHeaderChange = (tableIdx: number, colIdx: number, val: string) => {
    setExtractedTables(prev => {
      const copy = [...prev];
      const tbl = { ...copy[tableIdx] };
      tbl.headers = tbl.headers.map((h, c) => c === colIdx ? val : h);
      copy[tableIdx] = tbl;
      return copy;
    });
  };

  const handleTitleChange = (tableIdx: number, val: string) => {
    setExtractedTables(prev => {
      const copy = [...prev];
      copy[tableIdx] = { ...copy[tableIdx], title: val };
      return copy;
    });
  };

  const handleAddRow = (tableIdx: number) => {
    setExtractedTables(prev => {
      const copy = [...prev];
      const tbl = { ...copy[tableIdx] };
      const emptyRow = Array(tbl.headers.length).fill('');
      tbl.rows = [...tbl.rows, emptyRow];
      copy[tableIdx] = tbl;
      return copy;
    });
  };

  const handleDeleteRow = (tableIdx: number, rowIdx: number) => {
    setExtractedTables(prev => {
      const copy = [...prev];
      const tbl = { ...copy[tableIdx] };
      tbl.rows = tbl.rows.filter((_, idx) => idx !== rowIdx);
      copy[tableIdx] = tbl;
      return copy;
    });
  };

  const handleAddColumn = (tableIdx: number) => {
    setExtractedTables(prev => {
      const copy = [...prev];
      const tbl = { ...copy[tableIdx] };
      tbl.headers = [...tbl.headers, `新列 ${tbl.headers.length + 1}`];
      tbl.rows = tbl.rows.map(row => [...row, '']);
      copy[tableIdx] = tbl;
      return copy;
    });
  };

  const handleDeleteColumn = (tableIdx: number, colIdx: number) => {
    setExtractedTables(prev => {
      const copy = [...prev];
      const tbl = { ...copy[tableIdx] };
      tbl.headers = tbl.headers.filter((_, idx) => idx !== colIdx);
      tbl.rows = tbl.rows.map(row => row.filter((_, idx) => idx !== colIdx));
      copy[tableIdx] = tbl;
      return copy;
    });
  };

  const handleDeleteTable = (tableIdx: number) => {
    setExtractedTables(prev => prev.filter((_, idx) => idx !== tableIdx));
  };

  // Actions
  const copyAsMarkdown = (table: ExtractedTable, idx: number) => {
    try {
      if (table.headers.length === 0) return;
      const headerLine = `| ${table.headers.join(' | ')} |`;
      const separatorLine = `| ${table.headers.map(() => '---').join(' | ')} |`;
      const rowLines = table.rows.map(row => `| ${row.join(' | ')} |`).join('\n');
      const markdownTable = `### ${table.title}\n\n${headerLine}\n${separatorLine}\n${rowLines}`;
      
      navigator.clipboard.writeText(markdownTable);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Markdown Copy failed', err);
    }
  };

  const exportToCSV = (table: ExtractedTable, idx: number) => {
    try {
      const headersCSV = table.headers.map(h => `"${(h || '').replace(/"/g, '""')}"`).join(',');
      const rowsCSV = table.rows.map(row => 
        row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      const fullCSV = `${headersCSV}\n${rowsCSV}`;
      
      // Dynamic UTF-8 BOM byte array prefix to force Excel read correctly (extremely critical for non-English letters)
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), fullCSV], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${table.title || 'extracted_table'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setDownloadedIndex(idx);
      setTimeout(() => setDownloadedIndex(null), 2000);
    } catch (err) {
      console.error('CSV Export failed', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FA] select-none">
      {/* 2. Configure Extraction Pane */}
      <div className="p-4 bg-white border-b border-zinc-200 shrink-0 flex flex-col gap-3.5 shadow-xs">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-zinc-400 tracking-wider uppercase font-sans">
            1. 请选择数据抽取范围
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => setSourceRange('current')}
              className={`py-1.5 px-1 rounded-lg border text-[11px] font-bold text-center transition cursor-pointer ${
                sourceRange === 'current'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-zinc-50 text-zinc-650 hover:bg-zinc-100 border-zinc-200'
              }`}
            >
              当前第 {currentPage} 页
            </button>
            <button
              onClick={() => setSourceRange('all')}
              className={`py-1.5 px-1 rounded-lg border text-[11px] font-bold text-center transition cursor-pointer ${
                sourceRange === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-zinc-50 text-zinc-650 hover:bg-zinc-100 border-zinc-200'
              }`}
            >
              PDF 全文({pagesCount}页)
            </button>
            <button
              onClick={() => setSourceRange('selection')}
              className={`py-1.5 px-1 rounded-lg border text-[11px] font-bold text-center transition cursor-pointer relative ${
                sourceRange === 'selection'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-zinc-50 text-zinc-650 hover:bg-zinc-100 border-zinc-200'
              }`}
            >
              选中的划线文本
              {hasSelection && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white animate-pulse" />
              )}
            </button>
          </div>
          {sourceRange === 'selection' && !hasSelection && (
            <span className="text-[9px] text-amber-600 font-bold leading-normal flex items-start gap-1 mt-1 animate-pulse">
              <Info className="h-3 w-3 shrink-0 mt-0.5" />
              提示: 检测到您尚未圈选任何文字。请首先在左侧 PDF 文件上用鼠标划线圈选出表格所在的段落。
            </span>
          )}
        </div>

        {/* Custom refinement constraints */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-zinc-400 tracking-wider uppercase font-sans">
            2. 自定义提取规则 (可选)
          </label>
          <input
            type="text"
            placeholder="例如：只提取包含销售额、日期的行数据"
            value={customRule}
            onChange={(e) => setCustomRule(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-205 focus:border-zinc-350 text-xs text-zinc-800 rounded-lg px-3 py-1.5 placeholder-zinc-400 focus:outline-none focus:ring-0 shadow-inner"
          />
        </div>

        {/* Primary extraction button */}
        <button
          onClick={handleStartExtraction}
          disabled={isExtractingTable || isExtractingText || !apiKey}
          className={`w-full py-2 px-3 rounded-full flex items-center justify-center gap-2 transition cursor-pointer text-xs font-black shadow-md ${
            apiKey && !isExtractingTable && !isExtractingText
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-750 hover:to-indigo-750 text-white hover:scale-[1.01] active:scale-[0.99]'
              : 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed shadow-none'
          }`}
        >
          {isExtractingTable ? (
            <>
              <Loader2 className="h-4 w-4 text-white animate-spin" />
              <span>AI 表格特征智能识别中...</span>
            </>
          ) : (
            <>
              <FileSpreadsheet className="h-4 w-4" />
              <span>一键自动抽提结构化表格</span>
            </>
          )}
        </button>
      </div>

      {/* 3. Output Panels */}
      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-4">
        {errorText && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-start gap-2.5 shadow-sm animate-none">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1 select-text">
              <h4 className="font-extrabold text-[11px] leading-tight">表格提取异常</h4>
              <p className="text-[10px] text-zinc-500 mt-1 leading-normal">{errorText}</p>
            </div>
          </div>
        )}

        {extractedTables.length === 0 ? (
          /* Empty State Billboard */
          <div className="my-auto py-10 flex flex-col items-center text-center select-none max-w-[280px] mx-auto opacity-75">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-3">
              <Table className="h-6 w-6 text-zinc-400" />
            </div>
            <span className="text-xs font-black text-zinc-700 font-sans">暂无提取的表格数据</span>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-2 p-1">
              请选择上方范围并运行一键提取，Gemini 将精确感知段落结构，整理出可二次编辑的交互式网格表格。
            </p>
          </div>
        ) : (
          /* List of extracted interactive tables */
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-sans font-black select-none px-0.5">
              <span>已检测到 {extractedTables.length} 个结构化表格</span>
              <button
                onClick={() => setExtractedTables([])}
                className="text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer"
              >
                <span>清空全部</span>
              </button>
            </div>

            {extractedTables.map((table, tIdx) => {
              return (
                <div key={tIdx} className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                  {/* Table title card header */}
                  <div className="px-3.5 py-2.5 bg-zinc-50/80 border-b border-zinc-200 flex items-center justify-between gap-1 select-none">
                    <input
                      type="text"
                      value={table.title || `未命名表格 ${tIdx + 1}`}
                      onChange={(e) => handleTitleChange(tIdx, e.target.value)}
                      className="text-xs font-extrabold text-zinc-800 bg-transparent border-b border-transparent focus:border-blue-400 hover:bg-zinc-100/50 py-0.5 px-1 rounded focus:outline-none transition min-w-[130px] max-w-[175px] truncate font-sans"
                      title="点击名称可直接修改"
                    />

                    {/* Table Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyAsMarkdown(table, tIdx)}
                        className="p-1 rounded hover:bg-zinc-200/80 text-zinc-500 hover:text-zinc-850 hover:scale-105 transition active:scale-95 flex items-center gap-1"
                        title="复制 Markdown 表格"
                      >
                        {copiedIndex === tIdx ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => exportToCSV(table, tIdx)}
                        className="p-1 rounded hover:bg-zinc-200/80 text-zinc-550 hover:text-blue-600 hover:scale-105 transition active:scale-95"
                        title="导出 CSV (完美适配 Excel 编码)"
                      >
                        {downloadedIndex === tIdx ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>

                      <div className="w-[1px] h-3.5 bg-zinc-200 mx-0.5" />

                      <button
                        onClick={() => handleDeleteTable(tIdx)}
                        className="p-1 rounded hover:bg-red-50 text-zinc-405 hover:text-red-650 hover:scale-105 transition"
                        title="删除此表格"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Cell grid content */}
                  <div className="w-full overflow-x-auto max-w-full select-text border-b border-zinc-100 scrollbar-thin">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr className="bg-zinc-50/50 border-b border-zinc-150">
                          {table.headers.map((hdr, hIdx) => (
                            <th key={hIdx} className="border-r border-zinc-150 p-1.5 text-left text-[10px] font-black text-zinc-600 relative group/th min-w-[70px]">
                              <input
                                type="text"
                                value={hdr}
                                onChange={(e) => handleHeaderChange(tIdx, hIdx, e.target.value)}
                                className="bg-transparent text-[10px] font-black text-zinc-650 w-full hover:bg-zinc-200/70 py-0.5 px-0.5 rounded border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-0 leading-none"
                              />
                              <button
                                onClick={() => handleDeleteColumn(tIdx, hIdx)}
                                className="absolute -top-1 -right-1 hidden group-hover/th:flex bg-red-500 text-white rounded-full p-0.5 shadow hover:bg-red-600 transition active:scale-90 scale-75"
                                title="删除该列"
                              >
                                <MinusCircle className="h-3 w-3" />
                              </button>
                            </th>
                          ))}
                          <th className="p-1 min-w-[28px] text-center">
                            <button
                              onClick={() => handleAddColumn(tIdx)}
                              className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition flex items-center justify-center mx-auto"
                              title="在右侧追加新列"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-zinc-50/40 border-b border-zinc-100/80 last:border-b-0 even:bg-zinc-50/15">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="border-r border-zinc-100 p-1">
                                <input
                                  type="text"
                                  value={cell || ''}
                                  onChange={(e) => handleCellChange(tIdx, rIdx, cIdx, e.target.value)}
                                  className="bg-transparent text-[11px] text-zinc-800 font-medium w-full py-0.5 px-1 border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-0 transition line-clamp-1"
                                />
                              </td>
                            ))}
                            <td className="p-1 text-center select-none">
                              <button
                                onClick={() => handleDeleteRow(tIdx, rIdx)}
                                className="p-1 rounded opacity-0 hover:opacity-100 group-hover:opacity-100 text-zinc-350 hover:text-red-500 hover:bg-red-50 transition mx-auto flex items-center justify-center scale-90"
                                style={{ contentVisibility: 'auto' }}
                                title="删除该行"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Row footer trigger */}
                  <div className="p-2 bg-zinc-50/30 flex items-center justify-center select-none shrink-0 border-t border-zinc-100">
                    <button
                      onClick={() => handleAddRow(tIdx)}
                      className="px-4 py-1 rounded-full text-[10px] text-zinc-500 hover:text-zinc-800 hover:bg-zinc-150/80 transition flex items-center gap-1 cursor-pointer font-bold border border-zinc-200 bg-white"
                    >
                      <PlusCircle className="h-3.5 w-3.5 text-zinc-450" />
                      <span>添加一行新数据</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
