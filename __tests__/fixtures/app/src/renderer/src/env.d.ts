import type { DesktopApi } from '@shared/types/desktop-api.type';

declare global {
  interface Window {
    desktop: DesktopApi;
  }
}
