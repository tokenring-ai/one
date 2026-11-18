import { Smartphone } from "lucide-react";
import { useState } from "react";
import Button from "../../ui/button.tsx";
import SelfAccessLinkDialog from "./SelfAccessLinkDialog.tsx";

/** Explains the feature in place and opens the same dialog as the top bar control. */
export function SelfAccessLinkPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Make a one-time QR code that opens TokenRing on your phone as you. It works once and expires quickly.</p>
      <Button type="button" variant="secondary" icon={Smartphone} onClick={() => setOpen(true)}>
        Show a QR code for my phone
      </Button>
      {open && <SelfAccessLinkDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
