import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ContactAdminDetails() {
  const [copied, setCopied] = useState("");
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("คัดลอกแล้ว");
    } catch {
      setCopied("คัดลอกไม่ได้ กรุณาคัดลอกจากข้อความด้านบน");
    }
  }
  return (
    <div className="admin-contact-details">
      <p>ติดต่อผู้ดูแลเพื่อเปลี่ยนแพ็กเกจ แจ้งอีเมลที่ใช้เข้าสู่ระบบ ผู้ดูแลจะส่งโค้ดให้คุณนอกเว็บไซต์</p>
      <p>LINE ID: <strong>smalldoc124</strong></p>
      <Button type="button" variant="outline" onClick={() => void copy("smalldoc124")}>คัดลอก LINE ID</Button>
      <p>โทรศัพท์: <a href="tel:0883564267">088-3564267</a></p>
      <Button type="button" variant="outline" onClick={() => void copy("088-3564267")}>คัดลอกเบอร์โทรศัพท์</Button>
      {copied && <p role="status">{copied}</p>}
    </div>
  );
}
