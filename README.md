# Line Differential Relay Algorithm Lab

A browser-based **87L line differential protection laboratory** for education, algorithm research, and engineering demonstrations. The simulator compares conventional ping-pong alignment, a secure-window strategy, GPS time synchronization, and smart waveform tracking under realistic communication and electrical disturbances.

The interface is intentionally compact and industrial: the waveform, communication path, protection decision, and physical relay response can be observed together on a typical engineering laptop.

**Live simulator:** https://masarray.github.io/line-diff-sim/

## Key capabilities

- Compare four line-differential alignment and security strategies side by side.
- Inject asymmetric delay, bounded jitter, packet loss, corruption, RTT route steps, clock offset, and positive or negative clock drift.
- Explore through-load, load-change, external-fault, internal-fault, CT saturation, and CT polarity scenarios.
- Observe channel, alignment, waveform, and electrical-event confidence.
- Follow permission-state transitions: `NORMAL`, `WATCH`, `SECURE`, `BLOCKED`, and `RECOVERY`.
- Inspect raw and validated `Idiff`, `Ibias`, operate status, reason codes, and event history.
- Use a **phase-locked oscilloscope display**: the waveform does not scroll horizontally. Its fixed four-cycle sweep makes event-driven changes in magnitude, phase, distortion, and alignment easier to compare.
- Observe a **virtual 87L protection relay** with RUN, COMM, ERROR, PICKUP, SECURE, BLOCK, EVENT, PERMIT, and latched TRIP indications.
- Follow the complete visual output chain: `87L pickup → trip permission → 86 trip latch → 52 circuit breaker`.
- Retain trip time, `Idiff`, `Ibias`, residual alignment error, operating mode, scenario, and reason codes in relay trip memory.
- Reset the relay target locally. Reset is inhibited while the operate condition remains active.
- Pause the simulation to retain a stable engineering snapshot without continuous redraws.

## Visual maltrip demonstration

The simulator includes two paired presets for explaining unwanted line-differential operation:

1. Select **Maltrip Demo**. The simulator applies severe 12/3 ms path asymmetry to through-load while using conventional RTT/2 compensation. Observe the stationary remote-aligned waveform, rising `Idiff`, completed relay trip path, red target patch, and breaker 52 opening.
2. The relay classifies the captured operation as **UNWANTED OPERATION / MALTRIP** because the electrical scenario is not an internal fault.
3. Allow the waveform condition to clear or pause outside the operate interval. The red target and breaker indication remain latched, reproducing relay trip memory.
4. Press **RESET RELAY** on the faceplate. A reset attempt is rejected while `operate` is still active.
5. Select **Smart Corrected** to apply the same electrical and communication conditions with smart waveform tracking. Compare the corrected phase alignment, restrained `Idiff`, and absence of a trip latch.

This paired experiment makes a communication-induced differential maltrip visible as a cause-and-effect chain instead of relying only on phasor equations or verbal explanation.

## Safety and engineering scope

This project is an educational and algorithm-research simulator. It is **not** a field-certified protection relay, a settings-calculation tool, or a substitute for manufacturer documentation, protection studies, hardware-in-the-loop testing, or utility approval.

## Local development

Requirements:

- Node.js 22 or newer
- npm 10 or newer

```bash
git clone https://github.com/masarray/line-diff-sim.git
cd line-diff-sim
npm install
npm run dev
```

Open the local URL printed by Vite.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The deterministic regression suite covers healthy startup, asymmetric communication paths, packet loss security, internal/external fault discrimination, event timing, complete time advancement, phase-locked oscilloscope behavior, relay trip memory, reset inhibition, maltrip classification, and the paired maltrip/smart-correction presets.

The production output is generated in `dist/` as a fully static site.

## GitHub Pages deployment

The repository includes `.github/workflows/deploy-pages.yml`.

1. Open **Settings → Pages**.
2. Under **Build and deployment**, select **GitHub Actions**.
3. Push to the `main` branch or run the workflow manually.

Pull requests run type checking, linting, regression tests, and a production build without deploying. A successful `main` build deploys the static site to `https://masarray.github.io/line-diff-sim/`.

Vite uses relative asset paths, so the same build also works from another GitHub Pages project repository.

## Architecture

The application is a client-only React + TypeScript simulation:

- `src/lib/sim/engineCore.ts` — deterministic simulation engine, packet model, confidence model, state machine, and protection characteristic.
- `src/lib/sim/engine.ts` — public engine surface and phase-locked oscilloscope frame.
- `src/lib/sim/useSimulation.ts` — animation scheduling and React state bridge.
- `src/lib/relay/relayLatch.ts` — deterministic relay trip memory, reset inhibition, and valid/unwanted trip classification.
- `src/components/lab/VirtualRelay.tsx` — generic industrial relay faceplate and trip-output mimic.
- `src/components/lab/` — compact industrial controls and visualization.
- `tests/engine.test.ts` and `tests/relayLatch.test.ts` — deterministic behavior and regression checks.
- `src/App.tsx` — responsive laboratory composition.

More detail is available in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Contributing

Issues and pull requests are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before submitting changes. Security concerns should follow [`SECURITY.md`](SECURITY.md).

## License

Copyright © 2026 Mas Ari and contributors.

Licensed under the **GNU General Public License v3.0 only** (`GPL-3.0-only`). See [`LICENSE`](LICENSE).
