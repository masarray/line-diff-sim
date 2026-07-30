# Line Differential Relay Algorithm Lab

A browser-based **87L line differential protection laboratory** for education, algorithm research, and engineering demonstrations. The simulator compares conventional ping-pong alignment, a secure-window strategy, GPS time synchronization, and smart waveform tracking under realistic communication and electrical disturbances.

The interface is intentionally compact and industrial: the complete cause-and-effect chain is visible on a typical laptop screen without dashboard-style cards or long scrolling.

**Live simulator:** https://masarray.github.io/line-diff-sim/

## Key capabilities

- Compare four line-differential alignment and security strategies side by side.
- Inject asymmetric delay, bounded jitter, packet loss, corruption, RTT route steps, clock offset, and positive or negative clock drift.
- Explore through-load, load-change, external-fault, internal-fault, CT saturation, and CT polarity scenarios.
- Observe channel, alignment, waveform, and electrical-event confidence.
- Follow permission-state transitions: `NORMAL`, `WATCH`, `SECURE`, `BLOCKED`, and `RECOVERY`.
- Inspect raw and validated `Idiff`, `Ibias`, operate status, reason codes, and event history.
- Use a **phase-locked oscilloscope display**: the waveform does not scroll horizontally. Its fixed four-cycle sweep makes event-driven changes in magnitude, phase, distortion, and alignment easier to compare.
- Pause the simulation to retain a stable engineering snapshot without continuous redraws.

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

The deterministic engine regression suite covers healthy startup, asymmetric communication paths, packet loss security, internal/external fault discrimination, event timing, complete time advancement, and phase-locked oscilloscope behavior.

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
- `src/components/lab/` — compact industrial controls and visualization.
- `tests/engine.test.ts` — deterministic behavior and regression checks.
- `src/App.tsx` — single-screen laboratory composition.

More detail is available in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Contributing

Issues and pull requests are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before submitting changes. Security concerns should follow [`SECURITY.md`](SECURITY.md).

## License

Copyright © 2026 Mas Ari and contributors.

Licensed under the **GNU General Public License v3.0 only** (`GPL-3.0-only`). See [`LICENSE`](LICENSE).
