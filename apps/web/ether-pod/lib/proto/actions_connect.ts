// @generated manually for eco.actions service
import { MethodKind as ConnectMethodKind, type ServiceType } from "@connectrpc/connect";
import {
  Action,
  ActionAck,
  EvaluateRequest,
  EvaluateResponse,
  FrequencyStreamRequest,
  FrequencyUpdate,
  GestureEvaluation,
} from "./actions_pb";
import { PointerEvent } from "./symbolcast_pb";

const MethodKind =
  ConnectMethodKind ??
  ({
    Unary: "unary",
    ServerStreaming: "serverStreaming",
    ClientStreaming: "clientStreaming",
  } as const);

export const ActionsService = {
  typeName: "eco.actions.EcoActions",
  methods: {
    cast: {
      name: "Cast",
      I: Action,
      O: ActionAck,
      kind: MethodKind.Unary,
    },
    evaluate: {
      name: "Evaluate",
      I: EvaluateRequest,
      O: EvaluateResponse,
      kind: MethodKind.Unary,
    },
    streamFrequencies: {
      name: "StreamFrequencies",
      I: FrequencyStreamRequest,
      O: FrequencyUpdate,
      kind: MethodKind.ServerStreaming,
    },
    recognizeGesture: {
      name: "RecognizeGesture",
      I: PointerEvent,
      O: GestureEvaluation,
      kind: MethodKind.ClientStreaming,
    },
  },
} as const satisfies ServiceType;
