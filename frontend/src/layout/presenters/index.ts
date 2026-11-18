import { AppWindow, GalleryHorizontal, type LucideIcon, Rows3, Square } from "lucide-react";
import type { PresenterId } from "../types.ts";
import { accordionPresenter } from "./accordion.tsx";
import { carouselPresenter } from "./carousel.tsx";
import { singlePresenter } from "./single.tsx";
import { tabsPresenter } from "./tabs.tsx";
import type { Presenter } from "./types.ts";

export interface PresenterEntry {
  id: PresenterId;
  label: string;
  icon: LucideIcon;
  presenter: Presenter;
}

export const PRESENTERS: Readonly<Record<PresenterId, PresenterEntry>> = {
  tabs: { id: "tabs", label: "Tabs", icon: AppWindow, presenter: tabsPresenter },
  single: { id: "single", label: "Single", icon: Square, presenter: singlePresenter },
  accordion: { id: "accordion", label: "Accordion", icon: Rows3, presenter: accordionPresenter },
  carousel: { id: "carousel", label: "Carousel", icon: GalleryHorizontal, presenter: carouselPresenter },
};
