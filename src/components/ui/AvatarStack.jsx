import React from "react";
import { getInitials } from "../../utils/format";
import { cn } from "../../utils/cn";

export function AvatarStack({ users = [], max = 3, className }) {
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;

  return (
    <div className={cn("flex items-center", className)}>
      {visible.map((user, i) => {
        const name = user.name || user.display_name;
        const url = user.url || user.avatar_url;

        return (
          <div
            key={user.id || i}
            className="relative size-8 flex-shrink-0 rounded-full overflow-hidden border-2 border-surface"
            style={{ marginLeft: i === 0 ? 0 : "-0.5rem" }}
          >
            {url ? (
              <img
                src={url}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-[10px] font-bold text-primary-strong">
                {getInitials(name)}
              </div>
            )}
          </div>
        );
      })}

      {overflow > 0 && (
        <div
          className="relative flex size-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-surface bg-surface-muted text-[10px] font-bold text-text-muted"
          style={{ marginLeft: "-0.5rem" }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
