import type { AppManifest, LayoutTemplate, ViewKind } from "./types.ts";

/**
 * Views a plugin adds to an app it does not own (widgets on Home, say).
 * React-free, like the rest of a plugin's `layout.ts`.
 */
export interface AppExtension {
  /** Id of the app to extend. */
  app: string;
  /** View ids to add to the app's `views`. */
  views: readonly string[];
  /**
   * Also show them in the app's default layout, appended to the first
   * multi-item container (not `single`) that accepts this kind by name,
   * preferring a side area over the app's main (primary) one.
   * Without it they are only offered under a container's ⋯ › Add view.
   * Either way, layouts a user already customised keep their arrangement.
   */
  into?: ViewKind;
}

function appendInto(template: LayoutTemplate, kind: ViewKind, views: readonly string[], allowPrimary: boolean): { template: LayoutTemplate; placed: boolean } {
  if ("split" in template) {
    const children = [...template.children];
    for (const [index, child] of children.entries()) {
      const result = appendInto(child, kind, views, allowPrimary);
      if (!result.placed) continue;
      children[index] = result.template;
      return { template: { ...template, children }, placed: true };
    }
    return { template, placed: false };
  }
  if (template.presenter === "single" || !template.accepts.includes(kind) || (template.primary && !allowPrimary)) return { template, placed: false };
  return { template: { ...template, items: [...(template.items ?? []), ...views] }, placed: true };
}

/** `app` with every extension aimed at it applied: views appended (once), and placed in the default layout when asked. */
export function extendApp(app: AppManifest, extensions: readonly AppExtension[]): AppManifest {
  const mine = extensions.filter(extension => extension.app === app.id);
  if (mine.length === 0) return app;
  let views = [...app.views];
  let layout = app.layout;
  for (const extension of mine) {
    const fresh = extension.views.filter(view => !views.includes(view));
    if (fresh.length === 0) continue;
    views = [...views, ...fresh];
    if (extension.into) {
      // A plugin's widgets join the app's side area; only an app with nowhere else gets them in its main one.
      const aside = appendInto(layout, extension.into, fresh, false);
      layout = (aside.placed ? aside : appendInto(layout, extension.into, fresh, true)).template;
    }
  }
  return { ...app, views, layout };
}
