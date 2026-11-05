import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export interface MarkdownViewProps {
  content: string;
  className?: string;
}

export type MarkdownBlock =
  | { type: 'code_block'; lang?: string; code: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' }
  | {
      type: 'table';
      headers: string[];
      alignments: ('left' | 'center' | 'right')[];
      rows: string[][];
    }
  | { type: 'ul'; items: { text: string; indent: number }[] }
  | { type: 'ol'; items: { text: string; indent: number }[]; start: number }
  | { type: 'paragraph'; text: string };

/**
 * Validates URLs to prevent script execution (XSS via javascript: or data: URIs).
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('data:')
  ) {
    return false;
  }
  return true;
}

/**
 * Deterministically parses inline markdown:
 * - Code: `code`
 * - Links: [label](url)
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Bold-Italic: ***text***
 *
 * All text nodes are standard React virtual DOM strings, ensuring that any
 * raw HTML (<script>, <img onerror>, etc.) is automatically escaped and harmless.
 */

/**
 * Unescapes standard markdown backslash-escaped punctuation characters.
 */
export function unescapeMarkdown(text: string): string {
  return text.replace(/\\([\\`*{}\[\]()#+\-.!_>~|$])/g, '$1');
}

/**
 * Formats inline mathematical/networking formula expressions ($2^h$, $2^h - 2$, $\to$).
 */
export function formatInlineMath(math: string, keyPrefix: string): React.ReactNode {
  // Replace standard LaTeX symbols used in networking formulas
  const cleaned = math
    .replace(/\\(to|rightarrow|longrightarrow)/g, '→')
    .replace(/\\(leftarrow|longleftarrow)/g, '←')
    .replace(/\\(le|leq)/g, '≤')
    .replace(/\\(ge|geq)/g, '≥')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈');

  // Match power/superscripts such as 2^h, 2^{h-2}, 10^6
  const parts: React.ReactNode[] = [];
  const superRegex = /([a-zA-Z0-9]+)\^(\{([^}]+)\}|([a-zA-Z0-9]+))/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = superRegex.exec(cleaned)) !== null) {
    if (m.index > lastIdx) {
      parts.push(cleaned.slice(lastIdx, m.index));
    }
    const base = m[1];
    const exp = m[3] || m[4];
    parts.push(
      <span key={`${keyPrefix}-sup-${m.index}`}>
        {base}
        <sup className="text-[9px] font-semibold text-accent-vivid ml-0.5">{exp}</sup>
      </span>,
    );
    lastIdx = superRegex.lastIndex;
  }

  if (lastIdx < cleaned.length) {
    parts.push(cleaned.slice(lastIdx));
  }

  return (
    <span
      key={keyPrefix}
      className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-surface-elevated border border-border-hairline text-accent font-mono text-[11px] sm:text-xs select-all"
    >
      {parts.length > 0 ? parts : cleaned}
    </span>
  );
}

export function renderInlineMarkdown(text?: string | null): React.ReactNode[] {
  if (!text) return [];

  // CommonMark/GFM compliant inline token regex:
  // - Handles backslash escapes: (?<!\\)
  // - Restricts underscore emphasis to word boundaries: (?<![a-zA-Z0-9\\])...(?![a-zA-Z0-9])
  // - Eliminates intra-word underscore accidental matching (e.g. AS_PATH, NEXT_HOP)
  // - Handles inline math expressions ($2^h$, $2^h - 2$, $\to$)
  const tokenRegex =
    /((?<!\\)`[^`]+`|(?<!\\)\[[^\]]+\]\([^)]+\)|(?<!\\)\*\*\*(?!\s|\*\*\*)[^*]+(?<!\s|\*\*\*)\*\*\*|(?<![a-zA-Z0-9\\])___(?!\s|___)[^_]+(?<!\s|___)___(?![a-zA-Z0-9])|(?<!\\)\*\*(?!\s|\*\*)[^*]+(?<!\s|\*\*)\*\*|(?<![a-zA-Z0-9\\])__(?!\s|__)[^_]+(?<!\s|__)__(?![a-zA-Z0-9])|(?<!\\)\*(?!\s|\*)[^*]+(?<!\s|\*)\*|(?<![a-zA-Z0-9\\])_(?!\s|_)[^_]+(?<!\s|_)_(?![a-zA-Z0-9])|(?<!\\)\$(?!\s|\$)[^$\n]+?(?<!\s|\$)\$)/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(unescapeMarkdown(text.slice(lastIndex, match.index)));
    }

    const token = match[0];
    const key = `inline-${match.index}-${token.slice(0, 8)}`;

    if (token.startsWith('`') && token.endsWith('`')) {
      const code = token.slice(1, -1);
      nodes.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded-md bg-white/[0.08] text-sky-300 font-mono text-[11px] sm:text-xs border border-white/[0.06] select-all"
        >
          {code}
        </code>,
      );
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const splitIdx = token.indexOf('](');
      const label = token.slice(1, splitIdx);
      const rawUrl = token.slice(splitIdx + 2, -1);

      if (isSafeUrl(rawUrl)) {
        nodes.push(
          <a
            key={key}
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-white underline underline-offset-2 transition-colors font-medium inline-flex items-center gap-0.5"
          >
            {renderInlineMarkdown(label)}
          </a>,
        );
      } else {
        nodes.push(
          <span key={key} className="text-slate-400">
            {renderInlineMarkdown(label)}
          </span>,
        );
      }
    } else if (
      (token.startsWith('***') && token.endsWith('***')) ||
      (token.startsWith('___') && token.endsWith('___'))
    ) {
      const inner = token.slice(3, -3);
      nodes.push(
        <strong key={key} className="font-bold italic text-white">
          {renderInlineMarkdown(inner)}
        </strong>,
      );
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      const inner = token.slice(2, -2);
      nodes.push(
        <strong key={key} className="font-semibold text-white">
          {renderInlineMarkdown(inner)}
        </strong>,
      );
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      const inner = token.slice(1, -1);
      nodes.push(
        <em key={key} className="italic text-slate-200">
          {renderInlineMarkdown(inner)}
        </em>,
      );
    } else if (token.startsWith('$') && token.endsWith('$') && token.length > 2) {
      const innerMath = token.slice(1, -1);
      nodes.push(formatInlineMath(innerMath, key));
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(unescapeMarkdown(text.slice(lastIndex)));
  }

  return nodes;
}

/**
 * Pure function that parses markdown text into structural blocks.
 */
export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  if (!markdown) return [];

  const lines = markdown.split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Fenced Code Blocks: ```
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      blocks.push({
        type: 'code_block',
        lang: lang || undefined,
        code: codeLines.join('\n'),
      });
      continue;
    }

    // 2. Empty Line: skip
    if (trimmed === '') {
      i++;
      continue;
    }

    // 2b. Horizontal Rule: ---, ***, ___
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 3. Headings: #, ##, ###, ####
    const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 4. Blockquotes: > ...
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('>') ||
          (lines[i].trim() !== '' &&
            quoteLines.length > 0 &&
            !lines[i].trim().startsWith('#') &&
            !lines[i].trim().startsWith('```') &&
            !lines[i].trim().startsWith('|') &&
            !lines[i].match(/^(\s*)[-*]\s+/) &&
            !lines[i].match(/^(\s*)\d+\.\s+/)))
      ) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        text: quoteLines.join(' '),
      });
      continue;
    }

    // 5. Tables: row with | and next row is separator | --- |
    if (
      rawLine.includes('|') &&
      i + 1 < lines.length &&
      lines[i + 1].includes('|') &&
      lines[i + 1].includes('-')
    ) {
      const parseRow = (r: string) =>
        r
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseRow(rawLine);
      const sepLine = lines[i + 1];
      const sepCols = parseRow(sepLine);
      const alignments = sepCols.map((c) => {
        if (c.startsWith(':') && c.endsWith(':')) return 'center' as const;
        if (c.endsWith(':')) return 'right' as const;
        return 'left' as const;
      });

      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(parseRow(lines[i]));
        i++;
      }

      blocks.push({
        type: 'table',
        headers,
        alignments,
        rows,
      });
      continue;
    }

    // 6. Ordered List: 1. ...
    const olMatch = rawLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const startNum = parseInt(olMatch[2], 10);
      const items: { text: string; indent: number }[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (itemMatch) {
          const indent = Math.floor(itemMatch[1].length / 2);
          items.push({ text: itemMatch[3], indent });
          i++;
        } else if (
          lines[i].trim() !== '' &&
          items.length > 0 &&
          (lines[i].startsWith('   ') || lines[i].startsWith('\t') || lines[i].startsWith('  '))
        ) {
          items[items.length - 1].text += '\n' + lines[i].trim();
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        type: 'ol',
        items,
        start: startNum || 1,
      });
      continue;
    }

    // 7. Unordered List: - or *
    const ulMatch = rawLine.match(/^(\s*)[-*]\s+(.*)$/);
    if (ulMatch) {
      const items: { text: string; indent: number }[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)[-*]\s+(.*)$/);
        if (itemMatch) {
          const indent = Math.floor(itemMatch[1].length / 2);
          items.push({ text: itemMatch[2], indent });
          i++;
        } else if (
          lines[i].trim() !== '' &&
          items.length > 0 &&
          (lines[i].startsWith('   ') || lines[i].startsWith('\t') || lines[i].startsWith('  '))
        ) {
          items[items.length - 1].text += '\n' + lines[i].trim();
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        type: 'ul',
        items,
      });
      continue;
    }

    // 8. Normal Paragraph: collect lines until blank line or next block
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].match(/^(\s*)[-*]\s+/) &&
      !lines[i].match(/^(\s*)\d+\.\s+/) &&
      !(lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('-'))
    ) {
      pLines.push(lines[i]);
      i++;
    }

    if (pLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: pLines.join(' '),
      });
    }
  }

  return blocks;
}

/**
 * Formats a list item's content, properly structuring any indented sub-bullets
 * or multi-line continuations into nested lists rather than flat run-on text.
 */
function renderListItemContent(text: string): React.ReactNode {
  if (!text.includes('\n')) {
    return renderInlineMarkdown(text);
  }

  const lines = text.split('\n');
  const mainLine = lines[0];
  const subBullets: string[] = [];
  const continuations: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const l = lines[i].trim();
    const bulletMatch = l.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      subBullets.push(bulletMatch[1]);
    } else if (l) {
      continuations.push(l);
    }
  }

  return (
    <div className="space-y-1">
      <div>{renderInlineMarkdown(mainLine)}</div>
      {subBullets.length > 0 && (
        <ul className="mt-1.5 space-y-1 pl-4 list-disc list-outside text-slate-300">
          {subBullets.map((bullet, bIdx) => (
            <li key={bIdx} className="leading-relaxed">
              {renderInlineMarkdown(bullet)}
            </li>
          ))}
        </ul>
      )}
      {continuations.length > 0 && (
        <div className="mt-1 space-y-1">
          {continuations.map((c, cIdx) => (
            <p key={cIdx} className="leading-relaxed">
              {renderInlineMarkdown(c)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

interface CodeBlockProps {
  code: string;
  lang?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl bg-canvas-subtle/90 border border-border-hairline shadow-inner-light">
      <div className="flex items-center justify-between px-3 py-1 bg-surface-subtle/80 border-b border-border-hairline text-[10px] font-mono text-slate-400 select-none">
        <span className="uppercase tracking-wider">{lang || 'command'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-white hover:bg-surface-interactive transition-colors touch-target-44"
          aria-label={copied ? 'Copied code' : 'Copy code to clipboard'}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-status-converged" />
              <span className="text-status-converged font-sans text-xs font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="font-sans text-xs font-medium">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto max-w-full">
        <pre className="text-xs font-mono text-sky-200 leading-relaxed whitespace-pre select-text">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  const blocks = React.useMemo(() => parseMarkdownBlocks(content), [content]);

  return (
    <div className={`space-y-3.5 text-slate-300 leading-relaxed font-sans ${className}`}>
      {blocks.map((block, idx) => {
        const key = `block-${idx}-${block.type}`;

        switch (block.type) {
          case 'code_block': {
            return <CodeBlock key={key} code={block.code} lang={block.lang} />;
          }

          case 'hr': {
            return <hr key={key} className="my-3.5 border-t border-white/[0.1]" />;
          }

          case 'heading': {
            switch (block.level) {
              case 1:
                return (
                  <h1
                    key={key}
                    className="text-lg sm:text-xl font-bold text-white mt-5 mb-2.5 heading-title tracking-tight"
                  >
                    {renderInlineMarkdown(block.text)}
                  </h1>
                );
              case 2:
                return (
                  <h2
                    key={key}
                    className="text-base sm:text-lg font-bold text-white mt-4 mb-2 heading-title tracking-tight"
                  >
                    {renderInlineMarkdown(block.text)}
                  </h2>
                );
              case 3:
                return (
                  <h3
                    key={key}
                    className="text-sm sm:text-base font-bold text-slate-100 mt-3.5 mb-1.5 heading-title tracking-tight"
                  >
                    {renderInlineMarkdown(block.text)}
                  </h3>
                );
              default:
                return (
                  <h4
                    key={key}
                    className="text-xs sm:text-sm font-semibold text-slate-200 mt-3 mb-1 tracking-tight"
                  >
                    {renderInlineMarkdown(block.text)}
                  </h4>
                );
            }
          }

          case 'blockquote': {
            return (
              <blockquote
                key={key}
                className="border-l-2 border-brand-500/80 bg-brand-500/10 px-4 py-3 rounded-r-xl text-slate-200 italic my-3.5 leading-relaxed text-xs sm:text-sm shadow-sm"
              >
                {renderInlineMarkdown(block.text)}
              </blockquote>
            );
          }

          case 'table': {
            return (
              <div
                key={key}
                className="my-4 relative rounded-xl border border-border-hairline bg-surface-subtle/50 shadow-sm max-w-full overflow-hidden group"
              >
                {/* Horizontal scroll container */}
                <div className="overflow-x-auto max-w-full scrollbar-thin scrollbar-thumb-surface-interactive">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[480px]">
                    <thead>
                      <tr className="border-b border-border-hairline bg-surface-elevated/70">
                        {block.headers.map((h, hIdx) => {
                          const align = block.alignments[hIdx] || 'left';
                          return (
                            <th
                              key={hIdx}
                              className={`p-3 font-semibold text-white ${
                                align === 'center'
                                  ? 'text-center'
                                  : align === 'right'
                                  ? 'text-right'
                                  : 'text-left'
                              }`}
                            >
                              {renderInlineMarkdown(h)}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-hairline/60 text-slate-300">
                      {block.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
                          {row.map((cell, cIdx) => {
                            const align = block.alignments[cIdx] || 'left';
                            return (
                              <td
                                key={cIdx}
                                className={`p-3 leading-relaxed ${
                                  align === 'center'
                                    ? 'text-center'
                                    : align === 'right'
                                    ? 'text-right'
                                    : 'text-left'
                                }`}
                              >
                                {renderInlineMarkdown(cell)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Subtle right-edge scroll cue gradient mask for mobile */}
                <div
                  className="pointer-events-none sm:hidden absolute top-0 bottom-7 right-0 w-8 bg-gradient-to-l from-surface-subtle via-surface-subtle/50 to-transparent"
                  aria-hidden="true"
                />

                {/* Mobile scroll cue helper bar */}
                <div className="sm:hidden px-3 py-1 bg-surface-elevated/40 border-t border-border-hairline flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>← Swipe table horizontally →</span>
                  <span className="text-accent/80 font-sans">Scroll for more</span>
                </div>
              </div>
            );
          }

          case 'ul': {
            return (
              <ul
                key={key}
                className="space-y-1.5 my-2.5 text-xs sm:text-sm text-slate-300 list-disc list-outside pl-5 leading-relaxed"
              >
                {block.items.map((item, itemIdx) => (
                  <li
                    key={itemIdx}
                    className={`leading-relaxed ${
                      item.indent > 0 ? 'ml-4 list-[circle] text-slate-400' : ''
                    }`}
                  >
                    {renderListItemContent(item.text)}
                  </li>
                ))}
              </ul>
            );
          }

          case 'ol': {
            return (
              <ol
                key={key}
                start={block.start}
                className="space-y-1.5 my-2.5 text-xs sm:text-sm text-slate-300 list-decimal list-outside pl-5 leading-relaxed"
              >
                {block.items.map((item, itemIdx) => (
                  <li
                    key={itemIdx}
                    className={`leading-relaxed ${
                      item.indent > 0 ? 'ml-4 list-[lower-alpha] text-slate-400' : ''
                    }`}
                  >
                    {renderListItemContent(item.text)}
                  </li>
                ))}
              </ol>
            );
          }

          case 'paragraph': {
            return (
              <p key={key} className="text-xs sm:text-sm text-slate-300 leading-relaxed my-2.5">
                {renderInlineMarkdown(block.text)}
              </p>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
};
