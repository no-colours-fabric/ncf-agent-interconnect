import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('interconnect', {
  invoke: (method: string, params: unknown = {}) =>
    ipcRenderer.invoke('interconnect:call', method, params),
  onChange: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('interconnect:change', listener);
    return () => ipcRenderer.removeListener('interconnect:change', listener);
  },
  onNavigate: (callback: (tab: string) => void) => {
    const listener = (_event: unknown, tab: string) => callback(tab);
    ipcRenderer.on('interconnect:navigate', listener);
    return () => ipcRenderer.removeListener('interconnect:navigate', listener);
  },
});
