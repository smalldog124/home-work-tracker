import { Panel } from "@/components/ui/dialog";
import { ContactAdminDetails } from "./ContactAdminDetails";

export function ContactAdminPanel({ onClose, onCloseAutoFocus }: {
  onClose: () => void;
  onCloseAutoFocus?: () => void;
}) {
  return (
    <Panel title="ติดต่อผู้ดูแล" onClose={onClose} onCloseAutoFocus={onCloseAutoFocus}>
      <ContactAdminDetails />
    </Panel>
  );
}
