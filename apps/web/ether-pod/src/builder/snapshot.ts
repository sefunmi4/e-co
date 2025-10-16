import type { BuilderSnapshot, Primitive, SerializedPrimitive } from "./types";
import { clonePrimitive } from "./types";

const CURRENT_VERSION = 1;

const normalisePrimitive = (primitive: SerializedPrimitive): Primitive => ({
  id: primitive.id,
  kind: primitive.kind,
  transform: {
    position: { ...primitive.position },
    rotation: { ...primitive.rotation },
    scale: { ...primitive.scale },
  },
  metadata: primitive.metadata ? { ...primitive.metadata } : undefined,
});

export const serializeSnapshot = (
  primitives: Array<SerializedPrimitive | Primitive>,
): BuilderSnapshot => {
  const payload: SerializedPrimitive[] = primitives.map((primitive) => {
    if ("transform" in primitive) {
      const { transform, metadata } = primitive;
      return {
        id: primitive.id,
        kind: primitive.kind,
        position: { ...transform.position },
        rotation: { ...transform.rotation },
        scale: { ...transform.scale },
        metadata: metadata ? { ...metadata } : undefined,
      };
    }
    return {
      id: primitive.id,
      kind: primitive.kind,
      position: { ...primitive.position },
      rotation: { ...primitive.rotation },
      scale: { ...primitive.scale },
      metadata: primitive.metadata ? { ...primitive.metadata } : undefined,
    };
  });
  payload.sort((a, b) => a.id.localeCompare(b.id));
  return {
    version: CURRENT_VERSION,
    primitives: payload,
  };
};

export const deserializeSnapshot = (snapshot: BuilderSnapshot): Primitive[] => {
  if (snapshot.version > CURRENT_VERSION) {
    throw new Error(
      `Unsupported builder snapshot version ${snapshot.version} (expected <= ${CURRENT_VERSION})`,
    );
  }
  return snapshot.primitives.map((primitive) => clonePrimitive(normalisePrimitive(primitive)));
};
