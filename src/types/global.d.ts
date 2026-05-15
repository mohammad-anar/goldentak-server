import { Server } from 'socket.io';

declare global {
  // Extend NodeJS Global to include io
  namespace NodeJS {
    interface Global {
      io: Server;
    }
  }
}

export {};
