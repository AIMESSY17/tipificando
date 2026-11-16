"use client";
// Inclinación compartida: mouse en compu, giroscopio en celu. Si nadie toca nada, la escena hace un vaivén suave.
export const input = { x: 0, y: 0, t: 0 };
let escuchando = false;

export function escuchar() {
  if (escuchando || typeof window === "undefined") return;
  escuchando = true;
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    input.x = (e.clientX / window.innerWidth) * 2 - 1;
    input.y = (e.clientY / window.innerHeight) * 2 - 1;
    input.t = performance.now();
  }, { passive: true });
  window.addEventListener("deviceorientation", (e) => {
    if (e.gamma == null) return;
    input.x = Math.max(-1, Math.min(1, e.gamma / 25));
    input.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
    input.t = performance.now();
  }, { passive: true });
}

export function pedirGiroscopio() {
  const D = typeof window !== "undefined" && window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === "function") D.requestPermission().catch(() => {});
}
