export type Command = {
  type: string;
  payload?: any;
};

export type CommandHandler = (cmd: Command) => void;

import { info } from './logger';

const handlers: Record<string, CommandHandler[]> = {};

export function register(type: string, handler: CommandHandler) {
  if (!handlers[type]) handlers[type] = [];
  handlers[type].push(handler);
  info(`Registered handler for command: ${type}`);
}

export function dispatch(cmd: Command) {
  info(`Dispatching command: ${cmd.type}`, cmd.payload);
  (handlers[cmd.type] || []).forEach((h) => h(cmd));
}

// TODO: persist command history and synchronize across devices
