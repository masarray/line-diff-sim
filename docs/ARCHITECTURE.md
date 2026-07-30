# Architecture

## Design goals

The simulator is designed for teaching and algorithm comparison rather than dashboard reporting. The UI keeps disturbances, waveforms, communications, confidence, state transitions, and protection output visible in one coherent screen.

## Simulation loop

The engine runs at a nominal sample rate of 3.2 kHz. React requests elapsed wall-clock time through `requestAnimationFrame`, and the engine advances deterministically in fixed simulation steps. Presentation state is sampled at a lower rate to reduce unnecessary React and canvas work. While paused, no periodic snapshot is published, so the oscilloscope remains visually and computationally stable until a parameter change, reset, or explicit step.

## Communication model

Communication packets are modeled at a 1 ms cadence. Valid packet reception, corruption, packet age, and correlated burst-loss gaps are tracked separately. This avoids treating attempted packets as received packets and gives the permission state machine a consistent stale-data signal.

RTT route steps, bounded random-walk jitter, forward/return asymmetry, and corruption are conceptual disturbances. They are intended to expose algorithm trade-offs, not reproduce a specific transport protocol or relay message format.

## Algorithm modes

- **A — Conventional ping-pong:** estimates one-way delay as half of RTT.
- **B — Ping-pong + secure window:** freezes the last valid alignment and adds permission-state security logic during unreliable communications.
- **C — GPS time sync:** applies time-synchronization quality, signed offset, and signed drift, with a modeled fallback path.
- **D — Smart waveform tracking:** performs a frequency-aware bounded alignment search that converges toward the delay producing the lower differential residual.

These are conceptual models intended to make trade-offs visible. They are not implementations of any specific commercial relay.

## Permission state machine

Secure modes move through `NORMAL`, `WATCH`, `SECURE`, `BLOCKED`, and `RECOVERY`. Hard data-invalid conditions block immediately. Lower confidence first enters observation and a bounded secure window; recovery requires valid data and restored confidence before normal permission returns.

The conventional mode remains intentionally less sophisticated so users can compare the security consequences of each strategy.

## Phase-locked oscilloscope

The numerical engine continues to advance in time, but the displayed scope does not use a scrolling ring buffer. Every render reconstructs the same fixed four-cycle electrical window from the **current** simulation and event state.

Consequences:

- The local current remains anchored to the same phase reference.
- Delay and alignment changes appear as relative phase displacement.
- Load and fault events appear as magnitude, polarity, or waveform-shape changes.
- Communication quality is shown as a scope-status overlay rather than as motion across the screen.
- Pausing the simulation produces a stable engineering snapshot.

## Protection model

The engine calculates one-cycle RMS values for `Idiff`, raw `Idiff`, and `Ibias`, applies a pickup and slope characteristic, and gates operation through the current permission state. Confidence is separated into channel, alignment, waveform, and electrical-event dimensions to make security decisions explainable.

Scenario event windows are deterministic, allowing the oscilloscope, RMS calculation, operate decision, and test suite to refer to the same active-event state.

## Regression tests

`tests/engine.test.ts` checks long-duration advancement, healthy smart-mode startup, asymmetric-path correction, sustained loss blocking, internal/external fault discrimination, event timing, stationary phase reference, and event-driven scope changes. GitHub Actions runs these checks on pull requests before any Pages deployment can reach `main`.

## Static hosting

The application has no server runtime, API routes, SSR, or platform-specific build dependency. Vite produces relative static assets suitable for GitHub Pages and ordinary static web hosting.
