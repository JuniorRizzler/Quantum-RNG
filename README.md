# Quantum RNG Lab

A web-based hardware-noise random number lab that captures webcam entropy in the browser, applies extraction pipelines, evaluates output with statistical tests, generates unbiased random integers, and exports experiment reports.

## Live Web App

This repository is structured as a static site for Vercel.

Core web files:

- `index.html`
- `styles.css`
- `web_app.js`
- `vercel.json`

## Features

- webcam-based entropy capture with `getUserMedia`
- grayscale frame differencing to isolate noisy changes
- three extraction modes:
  - `raw_lsb`
  - `von_neumann`
  - `sha256_whitened`
- randomness checks:
  - ones ratio
  - byte entropy
  - monobit test
  - runs test
  - serial correlation
  - chi-square
- random whole-number generation in a chosen range
- histogram and history charts
- comparison logging across physical conditions
- JSON and Markdown report export

## How To Use

1. Open the deployed site.
2. Click `Start Camera`.
3. Allow browser camera access.
4. Click `Generate Sample`.
5. Review the statistics and charts.
6. Click `Generate Integer`.
7. Record a few conditions like `lens covered` and `room light`.
8. Export the report.

## Local Development

Serve the project as a static site:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Important Note

Safe description:

`hardware-noise random generator using camera sensor noise, with possible quantum shot-noise contribution`

Do not claim this is a certified true quantum random number generator.

## Legacy Desktop Version

The old Python desktop version is preserved only as reference in:

- `legacy-desktop/`

It is not used by the deployed web app.
