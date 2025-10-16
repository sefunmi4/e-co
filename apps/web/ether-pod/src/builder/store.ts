import {
  BuilderSnapshot,
  DEFAULT_TRANSFORM,
  Primitive,
  PrimitiveKind,
  PrimitiveTransform,
  SerializedPrimitive,
  clonePrimitive,
} from "./types";
import { createScaleGizmo, createRotationGizmo, createTranslationGizmo, Gizmo } from "./gizmos";
import { serializeSnapshot, deserializeSnapshot } from "./snapshot";

export interface PrimitiveStoreOptions {
  idFactory?: () => string;
}

export interface PlacePrimitiveOptions {
  transform?: Partial<PrimitiveTransform>;
  metadata?: Primitive["metadata"];
}

export class PrimitiveStore {
  private readonly primitives = new Map<string, Primitive>();
  private readonly createId: () => string;

  constructor(options: PrimitiveStoreOptions = {}) {
    this.createId = options.idFactory ?? (() => globalThis.crypto?.randomUUID?.() ?? `primitive-${Math.random().toString(36).slice(2)}`);
  }

  list(): Primitive[] {
    return Array.from(this.primitives.values()).map((primitive) => clonePrimitive(primitive));
  }

  get(id: string): Primitive | undefined {
    const primitive = this.primitives.get(id);
    return primitive ? clonePrimitive(primitive) : undefined;
  }

  place(kind: PrimitiveKind, options: PlacePrimitiveOptions = {}): Primitive {
    const id = this.createId();
    const transform: PrimitiveTransform = {
      position: { ...DEFAULT_TRANSFORM.position },
      rotation: { ...DEFAULT_TRANSFORM.rotation },
      scale: { ...DEFAULT_TRANSFORM.scale },
    };
    if (options.transform) {
      if (options.transform.position) {
        Object.assign(transform.position, options.transform.position);
      }
      if (options.transform.rotation) {
        Object.assign(transform.rotation, options.transform.rotation);
      }
      if (options.transform.scale) {
        Object.assign(transform.scale, options.transform.scale);
      }
    }
    const primitive: Primitive = {
      id,
      kind,
      transform,
      metadata: options.metadata ? { ...options.metadata } : undefined,
    };
    this.primitives.set(id, primitive);
    return clonePrimitive(primitive);
  }

  update(id: string, updater: (primitive: Primitive) => Primitive): Primitive {
    const current = this.primitives.get(id);
    if (!current) {
      throw new Error(`Primitive ${id} does not exist`);
    }
    const next = updater(clonePrimitive(current));
    this.primitives.set(id, clonePrimitive(next));
    return this.get(id)!;
  }

  applyGizmo(id: string, gizmo: Gizmo, magnitude: number): Primitive {
    return this.update(id, (primitive) => gizmo.apply(primitive, magnitude));
  }

  translate(id: string, axis: "x" | "y" | "z", magnitude: number, snap?: number | null) {
    const gizmo = createTranslationGizmo(axis, snap);
    return this.applyGizmo(id, gizmo, magnitude);
  }

  rotate(id: string, axis: "x" | "y" | "z", magnitude: number, snap?: number | null) {
    const gizmo = createRotationGizmo(axis, snap);
    return this.applyGizmo(id, gizmo, magnitude);
  }

  scale(id: string, axis: "x" | "y" | "z", magnitude: number, snap?: number | null) {
    const gizmo = createScaleGizmo(axis, snap);
    return this.applyGizmo(id, gizmo, magnitude);
  }

  delete(id: string): boolean {
    return this.primitives.delete(id);
  }

  clear() {
    this.primitives.clear();
  }

  serialize(): BuilderSnapshot {
    const primitives = this.list().map((primitive): SerializedPrimitive => ({
      id: primitive.id,
      kind: primitive.kind,
      position: { ...primitive.transform.position },
      rotation: { ...primitive.transform.rotation },
      scale: { ...primitive.transform.scale },
      metadata: primitive.metadata ? { ...primitive.metadata } : undefined,
    }));
    return serializeSnapshot(primitives);
  }

  hydrate(snapshot: BuilderSnapshot) {
    this.clear();
    const primitives = deserializeSnapshot(snapshot);
    for (const primitive of primitives) {
      this.primitives.set(primitive.id, primitive);
    }
  }
}

export const createPrimitiveStore = (options?: PrimitiveStoreOptions) =>
  new PrimitiveStore(options);
