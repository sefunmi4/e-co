import {
  Axis,
  Primitive,
  PrimitiveTransform,
  Vector3,
  clampScale,
  clonePrimitive,
} from "./types";

export type GizmoKind = "translate" | "rotate" | "scale";

export interface Gizmo {
  kind: GizmoKind;
  axis: Axis;
  snap?: number | null;
  apply: (primitive: Primitive, magnitude: number) => Primitive;
}

const axisUnit = (axis: Axis): Vector3 => {
  switch (axis) {
    case "x":
      return { x: 1, y: 0, z: 0 };
    case "y":
      return { x: 0, y: 1, z: 0 };
    case "z":
    default:
      return { x: 0, y: 0, z: 1 };
  }
};

const snapValue = (value: number, snap?: number | null) => {
  if (!snap || snap <= 0) {
    return value;
  }
  const snapped = Math.round(value / snap) * snap;
  const precision = Math.ceil(Math.log10(1 / snap));
  const factor = precision > 0 ? 10 ** precision : 1;
  return Math.round(snapped * factor) / factor;
};

const translate = (
  transform: PrimitiveTransform,
  axis: Axis,
  magnitude: number,
  snap?: number | null,
): PrimitiveTransform => {
  const unit = axisUnit(axis);
  const next: PrimitiveTransform = {
    position: { ...transform.position },
    rotation: { ...transform.rotation },
    scale: { ...transform.scale },
  };
  const snapped = snapValue(magnitude, snap);
  next.position.x += unit.x * snapped;
  next.position.y += unit.y * snapped;
  next.position.z += unit.z * snapped;
  return next;
};

const rotate = (
  transform: PrimitiveTransform,
  axis: Axis,
  magnitude: number,
  snap?: number | null,
): PrimitiveTransform => {
  const next: PrimitiveTransform = {
    position: { ...transform.position },
    rotation: { ...transform.rotation },
    scale: { ...transform.scale },
  };
  const snapped = snapValue(magnitude, snap);
  const target = axis === "x" ? "x" : axis === "y" ? "y" : "z";
  const updated = next.rotation[target] + snapped;
  // Normalise rotations into the -360..360 range so repeated snapshots stay stable.
  const normalised = ((updated % 360) + 360) % 360;
  next.rotation[target] = normalised === 360 ? 0 : normalised;
  return next;
};

const scale = (
  transform: PrimitiveTransform,
  axis: Axis,
  magnitude: number,
  snap?: number | null,
): PrimitiveTransform => {
  const next: PrimitiveTransform = {
    position: { ...transform.position },
    rotation: { ...transform.rotation },
    scale: { ...transform.scale },
  };
  const snapped = snapValue(magnitude, snap);
  const target = axis === "x" ? "x" : axis === "y" ? "y" : "z";
  next.scale[target] = clampScale(next.scale[target] + snapped);
  return next;
};

const withTransform = (
  primitive: Primitive,
  next: PrimitiveTransform,
): Primitive => ({
  ...primitive,
  transform: next,
});

export const createTranslationGizmo = (axis: Axis, snap?: number | null): Gizmo => ({
  kind: "translate",
  axis,
  snap,
  apply: (primitive, magnitude) => {
    const copy = clonePrimitive(primitive);
    const next = translate(copy.transform, axis, magnitude, snap);
    return withTransform(copy, next);
  },
});

export const createRotationGizmo = (axis: Axis, snap?: number | null): Gizmo => ({
  kind: "rotate",
  axis,
  snap,
  apply: (primitive, magnitude) => {
    const copy = clonePrimitive(primitive);
    const next = rotate(copy.transform, axis, magnitude, snap);
    return withTransform(copy, next);
  },
});

export const createScaleGizmo = (axis: Axis, snap?: number | null): Gizmo => ({
  kind: "scale",
  axis,
  snap,
  apply: (primitive, magnitude) => {
    const copy = clonePrimitive(primitive);
    const next = scale(copy.transform, axis, magnitude, snap);
    return withTransform(copy, next);
  },
});
