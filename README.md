# Line Differential Relay Algorithm Lab

A browser-based **87L line differential protection laboratory** for education, algorithm research, and engineering demonstrations. The simulator compares conventional ping-pong alignment, a secure-window strategy, GPS time synchronization, and smart waveform tracking under realistic communication and electrical disturbances.

The interface is intentionally compact and industrial: the complete cause-and-effect chain is visible on a typical laptop screen without dashboard-style cards or long scrolling.

## Key capabilities

- Compare four line-differential alignment and security strategies side by side.
- Inject asymmetric delay, bounded jitter, packet loss, corruption, RTT route steps, clock offset, and clock drift.
- Explore through-load, load-change, external-fault, internal-fault, CT saturation, and CT polarity scenarios.
- Observe channel, alignment, waveform, and electrical-event confidence.
- Follow permission-state transitions: `NORMAL`, `WATCH`, `SECURE`, `BLOCKED`, and `RECOVERY`.
- Inspect raw and validated `Idiff`, `Ibias`, operate status, reason codes, and event history.
- Use a **phase-locked oscilloscope display**: the waveform does not scroll horizontally. Its fixed four-cycle sweep makes event-driven changes in magnitude, phase, distortion, and alignment easier to compare.

## Safety and engineering scope

This project is an educational and algorithm-research simulator. It is **not** a field-certified protection relay, a settings-calculation tool, or a substitute for manufacturer documentation, protection studies, hardware-in-the-loop testing, or utility approval.

## Local development

Requirements:

- Node.js 22 or newer
- npm 10 or newer

```bash
git clone https://github.com/<your-account>/line-diff-lab.git
cd line-diff-lab
npm install
npm run dev
```

Open the local URL printed by Vite.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
```

The production output is generated in `dist/` as a fully static site.

## GitHub Pages deployment

The repository includes `.github/workflows/deploy-pages.yml`.

1. Push the project to a public GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions**.
4. Push to the `main` branch or run the workflow manually.

Vite uses relative asset paths, so the same build works for both user/organization pages and project pages such as `https://owner.github.io/line-diff-lab/`.

## Architecture

The application is a client-only React + TypeScript simulation:

- `src/lib/sim/engine.ts` — deterministic real-time simulation engine, confidence model, state machine, protection characteristic, and phase-locked scope frame.
- `src/lib/sim/useSimulation.ts` — animation scheduling and React state bridge.
- `src/components/lab/` — compact industrial controls and visualization.
- `src/App.tsx` — single-screen laboratory composition.

More detail is available in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Contributing

Issues and pull requests are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before submitting changes. Security concerns should follow [`SECURITY.md`](SECURITY.md).

## License

Copyright © 2026 Mas Ari and contributors.

Licensed under the **GNU General Public License v3.0 only** (`GPL-3.0-only`). See [`LICENSE`](LICENSE).
