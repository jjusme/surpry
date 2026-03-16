import { getInitials } from "../../utils/format";
import { cn } from "../../utils/cn";

export function Avatar({ name, url, className, ring = false, badge }) {
  const inner = url ? (
    <img
      src={url}
      alt={name}
      className={cn(
        "rounded-full object-cover",
        !ring && "size-12",
        !ring && "border-2 border-primary/30",
        className
      )}
    />
  ) : (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-primary/10 font-bold text-primary-strong",
        !ring && "size-12",
        !ring && "text-sm",
        className
      )}
    >
      {getInitials(name)}
    </div>
  );

  if (!ring && !badge) return inner;

  return (
    <div className="relative inline-block">
      {ring ? (
        <div className={cn("rounded-full p-[3px]", "bg-gradient-to-tr from-primary to-primary-strong shadow-float")}>
          <div className="rounded-full bg-bg p-[1px]">
            {url ? (
              <img
                src={url}
                alt={name}
                className={cn("block rounded-full object-cover overflow-hidden", className)}
              />
            ) : (
              <div
                className={cn(
                  "flex items-center justify-center rounded-full bg-primary/10 font-bold text-primary-strong",
                  className
                )}
              >
                {getInitials(name)}
              </div>
            )}
          </div>
        </div>
      ) : inner}
      {badge && (
        <div className="absolute bottom-0 right-0">{badge}</div>
      )}
    </div>
  );
}
