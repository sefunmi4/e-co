// @generated manually for eco.symbolcast.PointerEvent
import { Message, proto3, type PlainMessage } from "@bufbuild/protobuf";

export class PointerEvent extends Message<PointerEvent> {
  timestamp = proto3.util.long(0);
  x = 0;
  y = 0;
  pressure = 0;
  deviceId = "";

  constructor(data?: Partial<PlainMessage<PointerEvent>>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "eco.symbolcast.PointerEvent";
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: "timestamp", kind: "scalar", T: 4 },
    { no: 2, name: "x", kind: "scalar", T: 2 },
    { no: 3, name: "y", kind: "scalar", T: 2 },
    { no: 4, name: "pressure", kind: "scalar", T: 2 },
    { no: 5, name: "device_id", kind: "scalar", T: 9 },
  ]);
}
