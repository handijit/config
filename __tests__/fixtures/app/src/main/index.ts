import { join } from 'node:path';

import { app, ipcMain } from 'electron';

import { greet } from '@main/services/greeting.service';

import { IPC_CHANNELS } from '@shared/constants/ipc-channel.constants';

ipcMain.handle(IPC_CHANNELS.greet, (_event, name) => greet(String(name)));

export const preloadPath = (): string => join(app.getVersion(), 'preload.js');
