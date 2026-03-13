import { useEffect, useState } from "react";

function getTimeLeft(targetDate) {
    const now = new Date();
    const target = new Date(targetDate);
    const diff = target - now;

    if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, passed: false };
}

function Chip({ value, label }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-2xl font-black text-primary shadow-card">
                {String(value).padStart(2, "0")}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">
                {label}
            </p>
        </div>
    );
}

/**
 * CountdownTimer — live countdown to a target date.
 * @param {string} targetDate  ISO date string or Date-compatible value
 */
export function CountdownTimer({ targetDate }) {
    const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(getTimeLeft(targetDate));
        }, 1000);

        return () => clearInterval(interval);
    }, [targetDate]);

    if (timeLeft.passed) {
        return (
            <p className="text-center text-sm font-bold text-success">
                ¡El cumpleaños ha llegado! 🎉
            </p>
        );
    }

    return (
        <div className="flex items-start justify-center gap-3">
            <Chip value={timeLeft.days} label="días" />
            <Chip value={timeLeft.hours} label="hrs" />
            <Chip value={timeLeft.minutes} label="min" />
            <Chip value={timeLeft.seconds} label="seg" />
        </div>
    );
}
