import { expect, test } from '@playwright/test';
import { createPrimitiveStore, extractBuilderSnapshot, serializeSnapshot } from '../../src/builder';
import type { PodSnapshot } from '@backend/lib/pods';

test.describe('builder snapshot hydration', () => {
  test('saved primitives reload with identical transforms', async () => {
    const store = createPrimitiveStore({ idFactory: () => 'primitive-playwright' });
    const placed = store.place('cube');
    store.translate(placed.id, 'x', 1.25, 0.25);
    store.rotate(placed.id, 'y', 90);
    store.scale(placed.id, 'z', 0.5);

    const snapshot = store.serialize();
    // Simulate the backend payload shape by embedding the snapshot into a PodSnapshot stub.
    const podSnapshot: PodSnapshot = {
      artifact_id: 'artifact',
      owner_id: 'owner',
      pod: {
        id: 'pod',
        owner_id: 'owner',
        title: 'Example Pod',
        description: null,
        created_at: '',
        updated_at: '',
      },
      items: [
        {
          id: 'item',
          pod_id: 'pod',
          artifact_id: null,
          item_type: 'builder_snapshot',
          item_data: snapshot,
          position: 0,
          visibility: 'public',
          created_at: '',
        },
      ],
      published_at: '',
    };

    const hydrated = extractBuilderSnapshot(podSnapshot);
    expect(hydrated).not.toBeNull();
    const roundTrip = serializeSnapshot(hydrated!.primitives);
    expect(roundTrip.primitives[0]?.position).toEqual(snapshot.primitives[0]?.position);
    expect(roundTrip.primitives[0]?.rotation).toEqual(snapshot.primitives[0]?.rotation);
    expect(roundTrip.primitives[0]?.scale).toEqual(snapshot.primitives[0]?.scale);
  });
});
