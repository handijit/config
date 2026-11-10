/** What preload exposes to the page as `window.desktop`. */
export type DesktopApi = {
  greet: (name: string) => Promise<string>;
};
