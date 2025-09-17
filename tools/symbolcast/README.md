# SymbolCast Studio

The SymbolCast tooling package now ships a mock `symbolcastd` daemon alongside future training utilities. The daemon implements the `SymbolCast.Recognize` gRPC service, cycles through a triangle/circle/square gesture set, and publishes mapped actions on `eco.action.cast` so downstream services can react without a real ONNX model.

```bash
cargo run -p symbolcastd
```

Environment variables:

- `SYMBOLCASTD_ADDR` – listening address for the gRPC server (default `127.0.0.1:50061`).
- `NATS_URL` – optional NATS endpoint used to publish `eco.gesture.detected` and `eco.action.cast` events.

Upcoming iterations will add notebooks and recording tools for building real SymbolCast models.
