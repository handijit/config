import { contextBridge, ipcRenderer } from 'electron';

import { IPC_CHANNELS } from '@shared/constants/ipc-channel.constants';
import type { DesktopApi } from '@shared/types/desktop-api.type';

const api: DesktopApi = {
  greet: async name => String(await ipcRenderer.invoke(IPC_CHANNELS.greet, name)),
};

contextBridge.exposeInMainWorld('desktop', api);
