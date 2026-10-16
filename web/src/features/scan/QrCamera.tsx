import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { DecodeHintType, NotFoundException } from "@zxing/library";
import { Button } from "@/components/ui/button";
import { QrGate } from "./qr-gate";
export function QrCamera({
  onRead,
  paused,
  enabled,
}: {
  onRead: (payload: string) => void;
  paused: boolean;
  enabled: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onRead);
  callback.current = onRead;
  const blocked = useRef(paused);
  blocked.current = paused;
  const gate = useRef(new QrGate());
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }
    let disposed = false;
    let controls: IScannerControls | undefined;
    let stream: MediaStream | undefined;
    setError("");
    setReady(false);
    const reader = new BrowserQRCodeReader(
      new Map([[DecodeHintType.TRY_HARDER, true]]),
      { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 120 },
    );
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("CAMERA_UNAVAILABLE");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        controls = await reader.decodeFromStream(
          stream,
          video.current!,
          (result, decodeError) => {
            if (disposed) return;
            if (result) {
              if (
                gate.current.frame(result.getText(), performance.now()) &&
                !blocked.current &&
                navigator.onLine
              )
                callback.current(result.getText());
            } else if (decodeError instanceof NotFoundException)
              gate.current.frame(null, performance.now());
          },
        );
        if (disposed) controls.stop();
        else setReady(true);
        stream.getVideoTracks().forEach((track) =>
          track.addEventListener("ended", () => {
            if (!disposed) {
              setReady(false);
              setError("กล้องหยุดทำงาน กรุณาเปิดกล้องอีกครั้ง");
            }
          }),
        );
      } catch {
        if (!disposed) {
          setReady(false);
          setError(
            "เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้องในตั้งค่าเว็บไซต์ แล้วกดเปิดกล้องอีกครั้ง",
          );
        }
      }
    }
    void start();
    return () => {
      disposed = true;
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [attempt, enabled]);
  return (
    <div className="camera-wrap">
      <div
        data-testid="camera-state"
        data-state={ready ? "ready" : "stopped"}
        className="camera-frame"
      >
        <video
          key={`${attempt}:${enabled}`}
          ref={video}
          playsInline
          muted
          autoPlay
          aria-label="ภาพจากกล้องสำหรับสแกน QR"
        />
        <div className="camera-target" aria-hidden="true" />
        {!ready && !error && (
          <p className="camera-message">
            {enabled ? "กำลังเปิดกล้อง…" : "หยุดกล้องชั่วคราว"}
          </p>
        )}
        <span className="camera-caption">
          {paused ? "พักการอ่าน QR" : "วาง QR ให้เห็นครบทั้งใบ"}
        </span>
      </div>
      {error && (
        <div className="error" data-testid="camera-error" role="alert">
          <p>{error}</p>
          <Button
            variant="outline"
            data-testid="camera-retry"
            onClick={() => setAttempt((a) => a + 1)}
          >
            เปิดกล้องอีกครั้ง
          </Button>
        </div>
      )}
    </div>
  );
}
