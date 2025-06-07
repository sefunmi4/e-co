export type Command = {
  type: string;
  payload?: any;
};

export type CommandHandler = (cmd: Command) => void;

const handlers: Record<string, CommandHandler[]> = {};

export function register(type: string, handler: CommandHandler) {
  if (!handlers[type]) handlers[type] = [];
  handlers[type].push(handler);
}

export function dispatch(cmd: Command) {
  (handlers[cmd.type] || []).forEach((h) => h(cmd));
}

// TODO: persist command history and synchronize across devices
