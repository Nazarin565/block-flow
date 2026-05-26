import type { WsClientMessage, WsServerMessage } from './types';

export function subscribeJob(
  id: string,
  onMessage: (msg: WsServerMessage) => void,
): () => void {
  const ws = new WebSocket(import.meta.env.VITE_WS_URL as string);
  let torn = false;

  ws.addEventListener('open', () => {
    if (torn) return;
    const msg: WsClientMessage = { type: 'subscribe', jobId: id };
    ws.send(JSON.stringify(msg));
  });

  ws.addEventListener('message', (event: MessageEvent<string>) => {
    if (torn) return;
    try {
      const msg = JSON.parse(event.data) as WsServerMessage;
      onMessage(msg);
    } catch {
      // ignore malformed frames
    }
  });

  ws.addEventListener('error', () => {
    if (torn) return;
    torn = true;
    onMessage({ type: 'error', message: 'connection_failed' });
  });

  return () => {
    torn = true;
    ws.close();
  };
}
