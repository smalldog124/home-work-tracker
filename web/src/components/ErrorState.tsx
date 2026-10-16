import { message, reason } from "@/lib/api";
import { Button } from "./ui/button";
export function ErrorState({
  error,
  retry,
  testId,
}: {
  error: unknown;
  retry?: () => void;
  testId?: string;
}) {
  return (
    <div
      role="alert"
      className="error"
      data-testid={
        testId ||
        (reason(error) === "VERSION_CONFLICT"
          ? "version-conflict"
          : "form-error")
      }
    >
      <p>{message(error)}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          โหลดข้อมูลล่าสุด
        </Button>
      )}
    </div>
  );
}
