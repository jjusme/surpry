import { getInitials } from "../../utils/format";
import { cn } from "../../utils/cn";

export function Avatar({ name, url, className }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={cn(
          "size-12 rounded-full border-2 border-primary/30 object-cover",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex size-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary-strong",
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
