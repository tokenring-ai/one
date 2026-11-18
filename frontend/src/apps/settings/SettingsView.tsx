import { LogOut } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import SectionLabel from "../../components/ui/SectionLabel.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { getSignedInUsername, signOut, subscribeSignedInUsername } from "../../rpcAuth.ts";
import Button from "../../ui/button.tsx";
import { AboutSections } from "./SettingsAboutView.tsx";
import { AppearanceSection } from "./SettingsAppearanceView.tsx";
import { ConfirmationsSection } from "./SettingsConfirmationsView.tsx";
import { DataSection } from "./SettingsDataView.tsx";
import { LayoutSection } from "./SettingsLayoutView.tsx";
import { ShortcutsSection } from "./SettingsShortcuts.tsx";
import { SettingsCard, SettingsRow } from "./shared.tsx";

function SectionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <SectionLabel className="px-1">{label}</SectionLabel>
      {children}
    </section>
  );
}

/** Signed-in user and sign out; renders nothing when the server has no login. */
export function AccountSection() {
  const username = useSyncExternalStore(subscribeSignedInUsername, getSignedInUsername, getSignedInUsername);
  const [signingOut, setSigningOut] = useState(false);
  if (username === null) return null;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SectionGroup label="Account">
      <SettingsCard>
        <SettingsRow title={username} description="Signed in to this TokenRing server" border={false}>
          <Button type="button" variant="secondary" icon={LogOut} busy={signingOut} busyLabel="Signing out…" onClick={() => void handleSignOut()}>
            Sign out
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SectionGroup>
  );
}

/**
 * The whole settings page in one panel: device preferences, storage and the
 * about/resources groups stacked in a single scrollable column. The section
 * cards are the same components the standalone per-section views render.
 */
export default function SettingsView() {
  return (
    <ViewShell pad="page" width="prose">
      <div className="space-y-6">
        <AccountSection />
        <SectionGroup label="Appearance">
          <AppearanceSection />
        </SectionGroup>
        <SectionGroup label="Layout">
          <LayoutSection />
        </SectionGroup>
        <SectionGroup label="Keyboard shortcuts">
          <ShortcutsSection />
        </SectionGroup>
        <SectionGroup label="Confirmations">
          <ConfirmationsSection />
        </SectionGroup>
        <SectionGroup label="Data">
          <DataSection />
        </SectionGroup>
        <AboutSections />
      </div>
    </ViewShell>
  );
}
