import { useState } from "react";
import {
  CHORE_CATEGORIES,
  STARTER_CHORES,
  choreEmojiValueForKey,
  choreIconUrl,
  resolveChoreFallbackEmoji,
  resolveChoreIconKey,
  resolveChoreIconSrc,
  type ChoreCategory,
} from "./model";

export function ChoreIcon({
  chore,
  className = "",
}: {
  chore: { key?: string; title?: string; emoji?: string };
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = resolveChoreIconSrc(chore);
  const fallbackEmoji = resolveChoreFallbackEmoji(chore);

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={chore.title ?? "Chore icon"}
        className={`chore-icon-img ${className}`.trim()}
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span className={`chore-icon-emoji-fallback ${className}`.trim()} aria-hidden="true">
      {fallbackEmoji}
    </span>
  );
}

export function ChoreIconBox({
  chore,
}: {
  chore: { key?: string; title?: string; emoji?: string };
}) {
  const hasIcon = Boolean(resolveChoreIconSrc(chore));
  return (
    <div className={`chore-emoji ${hasIcon ? "has-icon" : ""}`}>
      <ChoreIcon chore={chore} />
    </div>
  );
}

export function ChoreIconPicker({
  value,
  onChange,
  defaultCategory,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  defaultCategory?: ChoreCategory;
}) {
  const [filter, setFilter] = useState<"all" | ChoreCategory>(defaultCategory ?? "all");
  const selectedKey = resolveChoreIconKey({ emoji: value });
  const selectedTemplate = STARTER_CHORES.find((item) => item.key === selectedKey);
  const hasCustomEmoji =
    Boolean(value) &&
    !value.startsWith("icon:") &&
    !value.startsWith("/chore-icons/") &&
    !selectedKey;

  const visibleTemplates = STARTER_CHORES.filter(
    (item) => filter === "all" || item.choreCategory === filter,
  );

  return (
    <div className="chore-icon-picker">
      <div className="chore-icon-picker-head">
        <span className="field-label m-0">Chore icon</span>
        <div className="chore-icon-selected-preview">
          <ChoreIcon
            chore={{
              emoji: value,
              ...(selectedTemplate
                ? { key: selectedTemplate.key, title: selectedTemplate.title }
                : {}),
            }}
            className="h-8 w-8"
          />
          <span className="truncate text-xs text-muted-foreground">
            {selectedTemplate ? selectedTemplate.title : `Emoji (${value || "🧹"})`}
          </span>
        </div>
      </div>

      <div className="cat-filter-bar mb-2">
        <button
          type="button"
          className={`cat-filter-chip ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All ({STARTER_CHORES.length})
        </button>
        {CHORE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`cat-filter-chip cat-${cat.id} ${filter === cat.id ? "active" : ""}`}
            onClick={() => setFilter(cat.id)}
          >
            {cat.emoji} {cat.shortLabel}
          </button>
        ))}
      </div>

      <div className="chore-icon-picker-grid" role="listbox" aria-label="Choose a chore icon">
        {hasCustomEmoji && (
          <button
            type="button"
            role="option"
            aria-selected={true}
            className="chore-icon-pick-btn active"
            title={`Current emoji (${value})`}
            onClick={() => onChange(value)}
          >
            <span className="text-xl leading-none">{value}</span>
          </button>
        )}
        {visibleTemplates.map((tpl) => {
          const isSelected = selectedKey === tpl.key;
          return (
            <button
              key={tpl.key}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`chore-icon-pick-btn ${isSelected ? "active" : ""}`}
              title={tpl.title}
              aria-label={tpl.title}
              onClick={() => onChange(choreEmojiValueForKey(tpl.key))}
            >
              <img
                src={choreIconUrl(tpl.key)}
                alt={tpl.title}
                className="chore-icon-img"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
