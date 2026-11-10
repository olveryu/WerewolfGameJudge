/**
 * SimpleMarkdown - lightweight Markdown rendering for AI chat replies
 *
 * Handles the formats the assistant uses: **bold**, `inline code`, ```code blocks```,
 * # / ## / ### headings, unordered (- / * / •) and ordered (1. / 1)) lists, and line breaks.
 * Builds React elements only, so model output is always escaped by React.
 */

import type { ReactNode } from 'react';

/** Splits one line into text, bold and inline-code fragments. */
function renderInline(line: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Matches **bold**, __bold__, `code`
  const inlineRegex = /(\*\*|__)(.+?)\1|`([^`]+)`/g;
  let lastIndex = 0;
  for (const match of line.matchAll(inlineRegex)) {
    if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
    const code = match[3];
    if (code !== undefined) {
      parts.push(
        <code key={`c-${match.index}`} className="ai-md-code">
          {code}
        </code>,
      );
    } else {
      parts.push(<strong key={`b-${match.index}`}>{match[2]}</strong>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) parts.push(line.slice(lastIndex));
  return parts;
}

export function SimpleMarkdown({ content }: { readonly content: string }) {
  const lines = content.split('\n');
  const elements: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    const lineKey = `md-${i}`;

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++; // skip opening ```
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={lineKey} className="ai-md-code-block">
          {codeLines.join('\n')}
        </pre>,
      );
      continue;
    }

    if (!trimmed) {
      elements.push(<div key={lineKey} className="ai-md-empty-line" />);
      i++;
      continue;
    }

    const headerMatch = /^(#{1,3})\s+(.+)/.exec(trimmed);
    if (headerMatch) {
      elements.push(
        <p key={lineKey} className="ai-md-heading" data-level={headerMatch[1]?.length}>
          {headerMatch[2]}
        </p>,
      );
      i++;
      continue;
    }

    const unorderedMatch = /^[-*•]\s+(.+)/.exec(trimmed);
    if (unorderedMatch) {
      elements.push(
        <div key={lineKey} className="ai-md-list-item">
          <span className="ai-md-bullet" aria-hidden>
            •
          </span>
          <span className="ai-md-list-text">{renderInline(unorderedMatch[1] ?? '')}</span>
        </div>,
      );
      i++;
      continue;
    }

    const orderedMatch = /^(\d+)[.)]\s+(.+)/.exec(trimmed);
    if (orderedMatch) {
      elements.push(
        <div key={lineKey} className="ai-md-list-item">
          <span className="ai-md-bullet">{orderedMatch[1]}.</span>
          <span className="ai-md-list-text">{renderInline(orderedMatch[2] ?? '')}</span>
        </div>,
      );
      i++;
      continue;
    }

    elements.push(
      <p key={lineKey} className="ai-md-paragraph">
        {renderInline(trimmed)}
      </p>,
    );
    i++;
  }

  return <div className="ai-md">{elements}</div>;
}
