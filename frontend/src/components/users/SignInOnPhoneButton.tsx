import { Smartphone } from "lucide-react";
import { useState } from "react";
import SelfAccessLinkDialog from "./SelfAccessLinkDialog.tsx";

/** A small, always-available control: shows a QR code that signs this person in on their phone. */
export default function SignInOnPhoneButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        aria-label="Sign in on another device"
        title="Sign in on another device"
        aria-haspopup="dialog"
      >
        <Smartphone className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && <SelfAccessLinkDialog onClose={() => setOpen(false)} />}
    </>
  );
}
