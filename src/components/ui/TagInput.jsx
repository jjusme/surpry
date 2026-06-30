import React, { useState } from "react";
import { cn } from "../../utils/cn";

export function TagInput({ value = [], onChange, placeholder = "Agregar...", maxTags = 10, className }) {
  const [inputValue, setInputValue] = useState("");

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || value.includes(trimmed) || value.length >= maxTags) return;
    onChange([...value, trimmed]);
    setInputValue("");
  };

  const removeTag = (tag) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
    if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-bg-elevated px-3 py-2 min-h-[3rem]", className)}>
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary-strong"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-0.5 size-4 rounded-full flex items-center justify-center hover:bg-primary/25 transition-colors"
          >
            <span className="material-symbols-outlined text-[0.85rem]">close</span>
          </button>
        </span>
      ))}
      {value.length < maxTags && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[6rem] bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
        />
      )}
    </div>
  );
}
