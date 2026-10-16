let sounds: Record<"success" | "error", HTMLAudioElement> | undefined;
function audio(kind: "success" | "error") {
  return new Audio(`/sounds/scan-${kind}.wav`);
}
export function unlockScanSounds() {
  if (sounds) return;
  sounds = { success: audio("success"), error: audio("error") };
  for (const sound of Object.values(sounds)) {
    sound.muted = true;
    void sound
      .play()
      .then(() => {
        sound.pause();
        sound.currentTime = 0;
        sound.muted = false;
      })
      .catch(() => {
        sound.muted = false;
      });
  }
}
export function playScanSound(kind: "success" | "error") {
  const sound = sounds?.[kind] || audio(kind);
  try {
    sound.currentTime = 0;
    void sound.play().catch(() => {});
  } catch { /* An audio permission failure must not change a confirmed save. */ }
}
