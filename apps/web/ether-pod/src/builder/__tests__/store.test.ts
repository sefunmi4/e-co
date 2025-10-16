import { describe, expect, it } from "vitest";
import {
  createPrimitiveStore,
  createRotationGizmo,
  createScaleGizmo,
  createTranslationGizmo,
  serializeSnapshot,
  deserializeSnapshot,
} from "../index";

describe("PrimitiveStore", () => {
  it("places primitives with default transforms", () => {
    const store = createPrimitiveStore({ idFactory: () => "primitive-1" });
    const primitive = store.place("cube");
    expect(primitive.transform.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(primitive.transform.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(primitive.transform.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("applies translation, rotation, and scale gizmos", () => {
    const store = createPrimitiveStore({ idFactory: () => "primitive-2" });
    const { id } = store.place("sphere");

    const translate = createTranslationGizmo("x");
    const rotate = createRotationGizmo("y");
    const scale = createScaleGizmo("z");

    store.applyGizmo(id, translate, 2.5);
    store.applyGizmo(id, rotate, 45);
    store.applyGizmo(id, scale, 0.5);

    const primitive = store.get(id)!;
    expect(primitive.transform.position.x).toBeCloseTo(2.5);
    expect(primitive.transform.rotation.y).toBeCloseTo(45);
    expect(primitive.transform.scale.z).toBeCloseTo(1.5);
  });

  it("serializes and hydrates primitives without mutating transforms", () => {
    const store = createPrimitiveStore({ idFactory: () => "primitive-3" });
    const { id } = store.place("cylinder");
    store.translate(id, "y", 4, 0.25);
    store.rotate(id, "z", 185);
    store.scale(id, "x", -0.75);

    const snapshot = store.serialize();
    const rehydrated = createPrimitiveStore();
    rehydrated.hydrate(snapshot);

    const original = store.get(id)!;
    const copy = rehydrated.get(id)!;

    expect(copy.transform.position).toEqual(original.transform.position);
    expect(copy.transform.rotation).toEqual(original.transform.rotation);
    expect(copy.transform.scale).toEqual(original.transform.scale);
  });

  it("round-trips via serializeSnapshot/deserializeSnapshot", () => {
    const store = createPrimitiveStore({ idFactory: () => "primitive-4" });
    const first = store.place("cone");
    store.translate(first.id, "z", 3);
    store.rotate(first.id, "x", 30);
    store.scale(first.id, "y", 0.25);

    const snapshot = serializeSnapshot(store.list());
    const primitives = deserializeSnapshot(snapshot);

    expect(primitives).toHaveLength(1);
    expect(primitives[0].transform).toEqual(store.get(first.id)!.transform);
  });
});
