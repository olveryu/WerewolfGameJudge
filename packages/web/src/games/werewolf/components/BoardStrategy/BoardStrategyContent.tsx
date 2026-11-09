/**
 * BoardStrategyContent — accordion content for board strategy guides.
 *
 * Shows the core gameplay description + collapsible strategy sections
 * (good faction / wolf faction / third party / first night / pitfalls).
 * Receives boardName via props and looks up data from BOARD_STRATEGY.
 */
import './BoardStrategy.css';

import { useState } from 'react';

import IconChevronDown from '~icons/ion/chevron-down';
import IconChevronUp from '~icons/ion/chevron-up';

import { BOARD_STRATEGY, type BoardStrategy } from './boardStrategyData';

type StrategyAccent = 'villager' | 'wolf' | 'third' | 'warning' | 'muted';

interface StrategySection {
  readonly key: string;
  readonly title: string;
  readonly accent: StrategyAccent;
  readonly items: readonly string[];
}

function buildSections(data: BoardStrategy): StrategySection[] {
  const sections: StrategySection[] = [
    { key: 'good', title: '好人方策略', accent: 'villager', items: data.goodStrategy },
    { key: 'wolf', title: '狼人方策略', accent: 'wolf', items: data.wolfStrategy },
  ];
  if (data.thirdStrategy && data.thirdStrategy.length > 0) {
    sections.push({
      key: 'third',
      title: '第三方策略',
      accent: 'third',
      items: data.thirdStrategy,
    });
  }
  sections.push(
    { key: 'firstNight', title: '首夜关键决策', accent: 'warning', items: data.firstNight },
    { key: 'pitfalls', title: '常见翻车', accent: 'muted', items: data.pitfalls },
  );
  return sections;
}

export function BoardStrategyContent({ boardName }: { readonly boardName: string }) {
  const data = BOARD_STRATEGY[boardName];
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set());

  if (data === undefined) {
    return <p className="board-strategy-empty">暂无攻略数据</p>;
  }

  const toggleSection = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="board-strategy">
      <div className="board-strategy-meta-row">
        <span className="board-strategy-meta-chip">难度 {data.difficulty}/5</span>
        <span className="board-strategy-meta-chip">{data.recommendLevel}</span>
        {data.tags.map((tag) => (
          <span key={tag} className="board-strategy-tag">
            {tag}
          </span>
        ))}
      </div>

      <section className="board-strategy-summary">
        <h3 className="board-strategy-section-title">核心博弈</h3>
        <p className="board-strategy-summary-text">{data.summary}</p>
      </section>

      {buildSections(data).map((section) => {
        const isExpanded = expandedKeys.has(section.key);
        const bodyId = `board-strategy-${section.key}`;
        return (
          <section key={section.key} data-accent={section.accent}>
            <button
              type="button"
              className="board-strategy-accordion-header"
              aria-expanded={isExpanded}
              aria-controls={bodyId}
              onClick={() => toggleSection(section.key)}
            >
              <span className="board-strategy-accent" aria-hidden />
              <span className="board-strategy-accordion-title">{section.title}</span>
              {isExpanded ? <IconChevronUp aria-hidden /> : <IconChevronDown aria-hidden />}
            </button>
            {isExpanded && (
              <ul id={bodyId} className="board-strategy-accordion-body">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <div className="board-strategy-meta-analysis">
        <span className="board-strategy-meta-label">Meta</span>
        <p className="board-strategy-meta-value">{data.meta}</p>
      </div>
    </div>
  );
}
