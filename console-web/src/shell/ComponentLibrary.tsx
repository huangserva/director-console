// v2-P2/P4 + UI-fix #2/#3: component-library panel. 12 category chips (+ 全部)
// REALLY filter the card grid, and the search box filters by name/type. Cards
// are draggable into the card track and click-to-insert (drag preferred).
import { useState } from "react";
import {
  APPROXIMATED_CARD_TYPES,
  filterLibraryCards,
  LIBRARY_CARDS,
  LIBRARY_CATEGORIES,
  type CardType,
  type LibraryFilter,
} from "../lib/packaging-plan";
import { Icon, type IconName } from "./Icon";

export const CARD_DRAG_MIME = "application/x-card-type";

export function ComponentLibrary(props: {
  activeCategory: LibraryFilter;
  onSelectCategory: (id: LibraryFilter) => void;
  onInsert?: (cardType: CardType) => void;
  canInsert?: boolean;
}) {
  const { activeCategory, onSelectCategory, onInsert, canInsert } = props;
  const [query, setQuery] = useState("");
  const cards = filterLibraryCards(LIBRARY_CARDS, activeCategory, query);

  return (
    <div className="pc-lib">
      <div className="pc-panelhead">组件库</div>
      <div className="pc-search">
        <Icon name="search" size={14} />
        <input placeholder="搜索包装组件" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && (
          <button className="pc-search-clear" onClick={() => setQuery("")} title="清空">
            ×
          </button>
        )}
      </div>
      <div className="pc-sectlabel">
        <span>组件分类 · 12 类</span>
      </div>
      <div className="pc-chips">
        <button
          type="button"
          className={activeCategory === "all" ? "pc-chip active" : "pc-chip"}
          onClick={() => onSelectCategory("all")}
        >
          全部
        </button>
        {LIBRARY_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={cat.id === activeCategory ? "pc-chip active" : "pc-chip"}
            onClick={() => onSelectCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div className="pc-sectlabel">
        <span>组件卡片（{cards.length}）</span>
        <span className="muted">{canInsert ? "拖入时间线 / 点击插入" : "可拖入时间线"}</span>
      </div>
      <div className="pc-cardgrid">
        {cards.length === 0 && <div className="pc-note muted">没有匹配的组件卡片。</div>}
        {cards.map((card) => {
          const approx = APPROXIMATED_CARD_TYPES.has(card.cardType);
          return (
            <div
              key={card.cardType}
              className={canInsert ? "pc-compcard insertable" : "pc-compcard"}
              title={`${card.title} · ${card.sub}${approx ? "（近似组件）" : ""}`}
              draggable={canInsert}
              onDragStart={(e) => {
                e.dataTransfer.setData(CARD_DRAG_MIME, card.cardType);
                e.dataTransfer.setData("text/plain", card.title);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => canInsert && onInsert?.(card.cardType)}
            >
              {canInsert && <span className="pc-compcard-grip" title="拖入时间线 / 点击插入">⠿</span>}
              <div className="pc-compcard-ic">
                <Icon name={card.icon as IconName} size={15} />
              </div>
              <div className="pc-compcard-t">
                {card.title}
                {approx && <span className="pc-approx" title="暂用近似引擎组件，P4 registry 补专门组件">近似</span>}
              </div>
              <div className="pc-compcard-s">{card.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
