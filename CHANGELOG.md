# Changelog

All notable changes to this project will be documented here.

## Unreleased

- Added a generic industrial virtual 87L relay faceplate beside the phase-locked waveform display.
- Added live RUN, COMM, ERROR, PICKUP, TRIP PERMIT, SECURE, BLOCK, EVENT, and latched TRIP indications.
- Added a visual `87L → permission → 86 → breaker 52` validation path with breaker open/closed state.
- Added retained relay trip memory for trip time, `Idiff`, `Ibias`, residual error, mode, scenario, and reason codes.
- Added manual relay reset with reset inhibition while the operate condition remains active.
- Added valid internal-fault versus unwanted-operation/maltrip classification.
- Added paired **Maltrip Demo** and **Smart Corrected** presets for direct cause-and-effect comparison.
- Added deterministic relay-latch, reset, trip-prevention, classification, and teaching-preset regression tests.
- Corrected packet reception, burst-loss, corruption, packet-age, and gap counting behavior.
- Removed the 0.625-second limit that silently truncated long simulation advances.
- Prevented false RTT-step detection during healthy startup.
- Improved smart waveform tracking initialization, search bounds, recovery, and asymmetric-path handling.
- Corrected operate-event logging and added explicit electrical-event state.
- Ensured the phase-locked scope reflects the current fault state while remaining stationary on the time axis.
- Stopped continuous scope redraws while paused and made single-step automatically hold the simulation.
- Added deterministic engine regression tests and pull-request quality checks.
- Improved control semantics, timeline bounds, accessibility, and repository documentation.

## 1.0.0 — 2026-07-30

- Removed all platform-specific generator configuration, metadata, telemetry, and runtime files.
- Converted the project from TanStack Start/SSR to a static Vite React application.
- Added a GitHub Pages deployment workflow and relative production asset paths.
- Replaced the continuously scrolling waveform buffer with a phase-locked four-cycle oscilloscope frame.
- Reduced production dependencies and removed unused generated UI components.
- Added GPL-3.0 licensing, architecture documentation, contribution guidance, security policy, and repository quality checks.
