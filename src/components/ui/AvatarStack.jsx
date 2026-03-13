import { Avatar } from "./Avatar";
import { cn } from "../../utils/cn";

/**
 * AvatarStack — overlapping avatar circles with a +N overflow chip.
 * @param {Array<{name: string, url?: string}>} users
 * @param {number} max  number of avatars to show before overflow
 * @param {string} className
 */
export function AvatarStack({ users = [], max = 3, className }) {
    const visible = users.slice(0, max);
    const overflow = users.length - visible.length;

    return (
        <div className={cn("flex items-center", className)}>
            {visible.map((user, i) => (
                <div
                    key={user.id || i}
                    className="relative"
                    style={{ marginLeft: i === 0 ? 0 : "-0.5rem" }}
                >
                    <Avatar
                        name={user.name || user.display_name}
                        url={user.url || user.avatar_url}
                        className="size-9 border-2 border-surface text-xs"
                    />
                </div>
            ))}
            {overflow > 0 && (
                <div
                    className="relative flex size-9 items-center justify-center rounded-full border-2 border-surface bg-surface-muted text-xs font-bold text-text-muted"
                    style={{ marginLeft: "-0.5rem" }}
                >
                    +{overflow}
                </div>
            )}
        </div>
    );
}
