# Architecture

## Design goals

The simulator is designed for teaching and algorithm comparison rather than dashboard reporting. The UI keeps disturbances, waveforms, communications, confidence, state transitions, and protection output visible in one coherent screen.

## Simulation loop

The engine runs at a nominal sample rate of 3.2 kHz. React requests elapsed wall-clock time through `requestAnimationFrame`, and the engine advances deterministically in fixed simulation steps. The presentation state is sampled at a lower rate to reduce unnecessary React and canvas work.

## Algorithm modes

- **A — Conventional ping-pong:** estimates one-way delay as half of RTT.
- **B — Ping-pong + secure window:** freezes the last valid alignment and adds permission-state security logic during unreliable communications.
- **C — GPS time sync:** applies time-synchronization quality, offset, and drift, with a modeled fallback path.
- **D — Smart waveform tracking:** performs a bounded alignment search that converges toward the delay producing the lower differential residual.

These are conceptual models intended to make trade-offs visible. They are not implementations of any specific commercial relay.

## Phase-locked oscilloscope

The numerical engine continues to advance in time, but the displayed scope does not use a scrolling ring buffer. Every render reconstructs the same fixed four-cycle electrical window from the current simulation state.

Consequences:

- The local current remains anchored to the same phase reference.
- Delay and alignment changes appear as relative phase displacement.
- Load and fault events appear as magnitude, polarity, or waveform-shape changes.
- Communication quality is shown as a scope-status overlay rather than as motion across the screen.
- Pausing the simulation produces a stable engineering snapshot.

## Protection model

The engine calculates one-cycle RMS values for `Idiff`, raw `Idiff`, and `Ibias`, applies a pickup and slope characteristic, and gates operation through the current permission state. Confidence is separated into channel, alignment, waveform, and electrical-event dimensions to make security decisions explainable.

## Static hosting

The application has no server runtime, API routes, SSR, or platform-specific build dependency. Vite produces relative static assets suitable for GitHub Pages and ordinary static web hosting.
