import confetti from "canvas-confetti";

const PALETTE = ["#8B5CF6", "#F472B6", "#FCD34D", "#34D399"];
const PALETTE_BIRTHDAY = ["#FCD34D", "#F472B6", "#8B5CF6", "#34D399", "#FB923C"];

export function shootCelebration() {
  confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: PALETTE });
}

export function shootCompletion() {
  const end = Date.now() + 2500;
  const colors = ["#8B5CF6", "#7C3AED", "#F472B6", "#FCD34D"];
  (function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function shootBirthday() {
  confetti({ particleCount: 120, spread: 100, origin: { y: 0.5 }, colors: PALETTE_BIRTHDAY });
}
