// @generated manually for eco.actions. Keep in sync with proto/actions.proto
import {
  Message,
  proto3,
  type PlainMessage,
} from "@bufbuild/protobuf";

export class Action extends Message<Action> {
  id = "";
  kind = "";
  payload = "";
  requestedBy = "";

  constructor(data?: Partial<PlainMessage<Action>>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "eco.actions.Action";
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 },
    { no: 2, name: "kind", kind: "scalar", T: 9 },
    { no: 3, name: "payload", kind: "scalar", T: 9 },
    { no: 4, name: "requested_by", kind: "scalar", T: 9 },
  ]);
}

export class ActionAck extends Message<ActionAck> {
  id = "";
  accepted = false;
  message = "";

  constructor(data?: Partial<PlainMessage<ActionAck>>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "eco.actions.ActionAck";
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: "id", kind: "scalar", T: 9 },
    { no: 2, name: "accepted", kind: "scalar", T: 8 },
    { no: 3, name: "message", kind: "scalar", T: 9 },
  ]);
}

export class EvaluateRequest extends Message<EvaluateRequest> {
  jobId = "";
  expression = "";
  requestedBy = "";
  model = "";

  constructor(data?: Partial<PlainMessage<EvaluateRequest>>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "eco.actions.EvaluateRequest";
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: "job_id", kind: "scalar", T: 9 },
    { no: 2, name: "expression", kind: "scalar", T: 9 },
    { no: 3, name: "requested_by", kind: "scalar", T: 9 },
    { no: 4, name: "model", kind: "scalar", T: 9 },
  ]);
}

export class EvaluateResponse extends Message<EvaluateResponse> {
  jobId = "";
  energy = 0;
  fidelity = 0;
  model = "";

  constructor(data?: Partial<PlainMessage<EvaluateResponse>>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "eco.actions.EvaluateResponse";
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: "job_id", kind: "scalar", T: 9 },
    { no: 2, name: "energy", kind: "scalar", T: 1 },
    { no: 3, name: "fidelity", kind: "scalar", T: 1 },
    { no: 4, name: "model", kind: "scalar", T: 9 },
  ]);
}

export class FrequencyStreamRequest extends Message<FrequencyStreamRequest> {
  jobId = "";

  constructor(data?: Partial<PlainMessage<FrequencyStreamRequest>>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "eco.actions.FrequencyStreamRequest";
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: "job_id", kind: "scalar", T: 9 },
  ]);
}

export class FrequencyUpdate extends Message<FrequencyUpdate> {
  jobId = "";
  frequency = 0;
  amplitude = 0;
  timestampMs = proto3.util.long(0);

  constructor(data?: Partial<PlainMessage<FrequencyUpdate>>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "eco.actions.FrequencyUpdate";
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: "job_id", kind: "scalar", T: 9 },
    { no: 2, name: "frequency", kind: "scalar", T: 1 },
    { no: 3, name: "amplitude", kind: "scalar", T: 1 },
    { no: 4, name: "timestamp_ms", kind: "scalar", T: 3 },
  ]);
}

export class GestureEvaluation extends Message<GestureEvaluation> {
  jobId = "";
  gestureId = "";
  gestureLabel = "";
  confidence = 0;
  result?: EvaluateResponse;

  constructor(data?: Partial<PlainMessage<GestureEvaluation>>) {
    super();
    proto3.util.initPartial(data, this);
  }

  static readonly runtime = proto3;
  static readonly typeName = "eco.actions.GestureEvaluation";
  static readonly fields = proto3.util.newFieldList(() => [
    { no: 1, name: "job_id", kind: "scalar", T: 9 },
    { no: 2, name: "gesture_id", kind: "scalar", T: 9 },
    { no: 3, name: "gesture_label", kind: "scalar", T: 9 },
    { no: 4, name: "confidence", kind: "scalar", T: 1 },
    { no: 5, name: "result", kind: "message", T: EvaluateResponse },
  ]);
}
