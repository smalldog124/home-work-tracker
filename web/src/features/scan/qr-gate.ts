// A held QR stays latched across save pauses. Three failed frames over 450 ms
// count as removal, so a single blur does not submit the same QR again.
export class QrGate {
  private held: string | null = null;
  private missingAt: number | null = null;
  private missingFrames = 0;
  frame(payload: string | null, now: number): boolean {
    if (payload === null) {
      this.missingAt ??= now;
      this.missingFrames++;
      if (this.missingFrames >= 3 && now - this.missingAt >= 450)
        this.held = null;
      return false;
    }
    this.missingAt = null;
    this.missingFrames = 0;
    if (payload === this.held) return false;
    this.held = payload;
    return true;
  }
}
