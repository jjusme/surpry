import { useEffect, useState } from "react";
import { parseLocalDate } from "../../utils/format";

function getTimeLeft(targetDate) {
  const now = new Date();
  const target = parseLocalDate(targetDate);

  if (!target) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true, isToday: false };
  }

  const diff = target - now;

  if (diff <= 0) {
    const isToday =
      target.getFullYear() === now.getFullYear() &&
      target.getMonth() === now.getMonth() &&
      target.getDate() === now.getDate();

    return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true, isToday };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, passed: false, isToday: false };
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

export function CountdownTimer({
  targetDate,
  todayLabel,
  passedLabel = "¡Ya pasó!"
}) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (timeLeft.passed) {
    const label = timeLeft.isToday && todayLabel ? todayLabel : passedLabel;
    return (
      <p className="text-center text-sm font-bold text-success">
        {label}
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
