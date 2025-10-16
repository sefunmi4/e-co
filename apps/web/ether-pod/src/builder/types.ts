export type PrimitiveKind = "cube" | "sphere" | "cylinder" | "cone";

export type Axis = "x" | "y" | "z";

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface PrimitiveTransform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface PrimitiveMetadata {
  [key: string]: unknown;
}

export interface Primitive {
  id: string;
  kind: PrimitiveKind;
  transform: PrimitiveTransform;
  metadata?: PrimitiveMetadata;
}

export interface SerializedPrimitive {
  id: string;
  kind: PrimitiveKind;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  metadata?: PrimitiveMetadata;
}

export interface BuilderSnapshot {
  version: number;
  primitives: SerializedPrimitive[];
}

export const DEFAULT_TRANSFORM: PrimitiveTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

export const MIN_SCALE = 0.01;

export const clampScale = (value: number) =>
  Number.isFinite(value) ? Math.max(MIN_SCALE, value) : MIN_SCALE;

export const cloneTransform = (transform: PrimitiveTransform): PrimitiveTransform => ({
  position: { ...transform.position },
  rotation: { ...transform.rotation },
  scale: { ...transform.scale },
});

export const clonePrimitive = (primitive: Primitive): Primitive => ({
  ...primitive,
  transform: cloneTransform(primitive.transform),
  metadata: primitive.metadata ? { ...primitive.metadata } : undefined,
});
