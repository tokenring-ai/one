import type { ComponentType, LazyExoticComponent } from "react";
import type { AppManifest, KindManifest, ViewManifest, ViewParams } from "./types.ts";

export interface ViewProps<P extends ViewParams = ViewParams> {
  params: P;
}

export type ViewComponent = ComponentType<ViewProps> | LazyExoticComponent<ComponentType<ViewProps>>;

/** A view manifest plus its React component. Manifests stay React-free; this lives in a plugin's app.tsx. */
export interface ViewDefinition extends ViewManifest {
  component: ViewComponent;
}

export function defineView(definition: ViewDefinition): ViewDefinition {
  return definition;
}

export function defineKind(kind: KindManifest): KindManifest {
  return kind;
}

export function defineApp(app: AppManifest): AppManifest {
  return app;
}
