import { contextBridge, ipcRenderer } from "electron";

/** Exposes one call to the page. */
export const expose = (): void => {
  contextBridge.exposeInMainWorld("fixture", {
    version: (): Promise<unknown> => ipcRenderer.invoke("version"),
  });
};
