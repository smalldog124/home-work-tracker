import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { X } from "lucide-react";
export function Panel({
  title,
  children,
  onClose,
  testId,
  closeTestId,
  locked = false,
  onCloseAutoFocus,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  testId?: string;
  closeTestId?: string;
  locked?: boolean;
  onCloseAutoFocus?: () => void;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="panel-overlay" />
        <Dialog.Content
          className="panel"
          data-testid={testId}
          onCloseAutoFocus={onCloseAutoFocus ? (event) => {
            event.preventDefault();
            onCloseAutoFocus();
          } : undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (locked) e.preventDefault();
          }}
        >
          <div className="panel-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close
              aria-label="ปิด"
              data-testid={closeTestId}
              disabled={locked}
            >
              <X size={22} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            กรอกข้อมูลและตรวจสอบก่อนบันทึก
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
