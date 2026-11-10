import type { DesktopApi } from '@shared/types/desktop-api.type';

/** The page's one door to main; tests mock this module instead of window.desktop. */
export const desktop = (): DesktopApi => window.desktop;
