import ViewShell from "../../components/ui/ViewShell.tsx";
import SocialPlatforms from "../../features/social/SocialPlatforms.tsx";

/** Connection status for every messaging platform, plus the bots/messaging summary. */
export default function SocialPlatformsView() {
  return (
    <ViewShell pad="page" width="prose">
      <SocialPlatforms />
    </ViewShell>
  );
}
