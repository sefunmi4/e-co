import { vi } from 'vitest';

declare module 'vitest' {
  interface Suite {} // ensure module augmentation doesn't error
}

vi.mock('@bufbuild/protobuf', () => {
  const proto3 = {
    util: {
      setEnumType: () => {},
      initPartial: (data: unknown, target: Record<string, unknown>) => {
        if (data && typeof data === 'object') {
          Object.assign(target, data as Record<string, unknown>);
        }
      },
      newFieldList: (factory: () => unknown) => factory(),
    },
  };

  class ProtoMessage<T> {
    constructor(data?: Partial<T>) {
      if (data && typeof data === 'object') {
        Object.assign(this, data);
      }
    }

    static readonly runtime = proto3;
    static readonly typeName = 'mock';
    static readonly fields = [] as unknown[];

    static create<U>(data?: Partial<U>): U {
      return new (this as unknown as { new (data?: Partial<U>): U })(data);
    }

    static fromBinary() {
      throw new Error('Binary parsing not implemented in test stub');
    }

    static fromJson() {
      throw new Error('JSON parsing not implemented in test stub');
    }

    static fromJsonString() {
      throw new Error('JSON parsing not implemented in test stub');
    }

    static equals(a: unknown, b: unknown) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
  }

  return {
    Message: ProtoMessage,
    proto3,
    PlainMessage: Object,
    PartialMessage: Object,
  };
});
