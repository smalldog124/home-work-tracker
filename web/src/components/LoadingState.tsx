export function LoadingState({ text = "กำลังโหลดข้อมูล…" }: { text?: string }) {
  return (
    <p role="status" className="loading">
      {text}
    </p>
  );
}
