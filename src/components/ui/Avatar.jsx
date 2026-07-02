import React from "react";
import { getInitials } from "../../utils/format";
import { cn } from "../../utils/cn";

export function Avatar({ name, url, className, ring = false, badge, ringClassName }) {
  if (!ring && !badge) {
    return url ? (
      <img
        src={url}
        alt={name}
        className={cn("rounded-full object-cover size-12 border-2 border-primary/30", className)}
      />
    ) : (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-primary/10 font-bold text-primary-strong size-12 text-sm",
          className
        )}
      >
        {getInitials(name)}
      </div>
    );
  }

  if (ring) {
    return (
      <div className={cn("relative inline-flex flex-shrink-0 rounded-full", className)}>
        {/* Gradient ring — fills full size as circle */}
        <div className={cn("absolute inset-0 rounded-full", ringClassName || "bg-gradient-to-tr from-primary to-primary-strong shadow-float")} />
        {/* Content circle — inset 3px, clipped to circle */}
        <div className="absolute inset-[3px] rounded-full overflow-hidden bg-bg">
          {url ? (
            <img src={url} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 font-bold text-primary-strong text-sm">
              {getInitials(name)}
            </div>
          )}
        </div>
        {badge && (
          <div className="absolute bottom-0 right-0 z-10">{badge}</div>
        )}
      </div>
    );
  }

  // badge only (no ring)
  return (
    <div className="relative inline-flex flex-shrink-0">
      {url ? (
        <img
          src={url}
          alt={name}
          className={cn("rounded-full object-cover size-12 border-2 border-primary/30", className)}
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-primary/10 font-bold text-primary-strong size-12 text-sm",
            className
          )}
        >
          {getInitials(name)}
        </div>
      )}
      <div className="absolute bottom-0 right-0 z-10">{badge}</div>
    </div>
  );
}
