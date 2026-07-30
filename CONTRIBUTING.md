# Contributing

Thank you for improving the Line Differential Relay Algorithm Lab.

## Before opening a pull request

1. Create a focused branch from `main`.
2. Keep simulation changes deterministic where practical.
3. Do not present conceptual behavior as a certified relay implementation.
4. Preserve the compact, single-screen industrial UX unless a change has a clear engineering benefit.
5. Run all checks:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

## Pull-request expectations

Describe:

- the engineering problem being addressed;
- the expected behavior before and after the change;
- any assumptions or simplifications in the protection or communication model;
- screenshots for visible UI changes;
- tests or manual scenarios used for validation.

## Coding style

- Use TypeScript with explicit domain names.
- Prefer small pure calculations and clear units in variable names.
- Avoid hidden platform dependencies and unnecessary runtime packages.
- Keep canvas rendering independent from simulation calculations.
