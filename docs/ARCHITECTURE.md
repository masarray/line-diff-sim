# Architecture

## Design goals

The simulator is designed for teaching and algorithm comparison rather than dashboard reporting. The UI keeps disturbances, phase-locked waveforms, communications, confidence, state transitions, protection decisions, and the resulting virtual relay action visible as one cause-and-effect chain.

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

## Virtual relay and trip memory

`src/lib/relay/relayLatch.ts` is a pure state model separate from the React faceplate. The first permitted `operate` transition stores a relay target containing:

- trip time;
- validated `Idiff` and `Ibias`;
- alignment residual;
- algorithm mode;
- electrical scenario;
- reason codes;
- valid internal-fault or unwanted-operation classification.

The memory remains latched when the operate condition clears. A manual reset request is rejected while `operate` remains active, mirroring the practical expectation that a protection target cannot be meaningfully cleared while its initiating condition is still present.

`src/components/lab/VirtualRelay.tsx` maps current simulation state and retained trip memory into a generic vendor-neutral relay faceplate. The visual output path follows `87L pickup → permission → 86 latch → 52 breaker`. This explicitly distinguishes three outcomes:

- **Valid fault trip:** an active internal-fault event completes the output path.
- **Maltrip/unwanted operation:** a non-internal scenario completes the output path.
- **Trip prevented:** pickup is visible, but permission blocks the output before the latch and breaker.

The paired Maltrip Demo and Smart Corrected presets use the same through-load and path-asymmetry conditions so the user can compare the waveform, differential quantity, permission decision, and physical relay response without changing multiple controls manually.

## Regression tests

`tests/engine.test.ts` checks long-duration advancement, healthy smart-mode startup, asymmetric-path correction, sustained loss blocking, internal/external fault discrimination, event timing, stationary phase reference, and event-driven scope changes.

`tests/relayLatch.test.ts` checks valid/unwanted trip classification, retained targets, reset inhibition, trip-prevention presentation, and the contrasting outcomes of the Maltrip Demo and Smart Corrected presets. GitHub Actions runs all checks on pull requests before any Pages deployment can reach `main`.

## Static hosting

The application has no server runtime, API routes, SSR, or platform-specific build dependency. Vite produces relative static assets suitable for GitHub Pages and ordinary static web hosting.
