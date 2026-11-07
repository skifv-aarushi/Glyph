declare module 'y-websocket/bin/utils' {
  import * as Y from 'yjs';
  import { IncomingMessage } from 'http';
  import { WebSocket } from 'ws';

  export interface WSSharedDoc extends Y.Doc {
    name: string;
    conns: Map<WebSocket, Set<number>>;
    awareness: any;
  }

  export const docs: Map<string, WSSharedDoc>;
  export function getYDoc(docname: string, gc?: boolean): WSSharedDoc;
  export function setupWSConnection(
    conn: WebSocket,
    req: IncomingMessage,
    opts?: { docName?: string; gc?: boolean }
  ): void;
  export function setPersistence(persistence: any): void;
  export function getPersistence(): any;
}

