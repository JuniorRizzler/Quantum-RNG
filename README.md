# Quantum RNG Lab

A browser-based hardware-noise random number lab that uses webcam sensor entropy, extraction pipelines, statistical validation, random integer generation, comparison logging, and report export.

## Live App

This repository is now structured to run as a static web app on Vercel.

Main web files:

- `index.html`
- `styles.css`
- `web_app.js`
- `vercel.json`

## What It Does

- captures webcam frames directly in the browser
- compares consecutive grayscale frames to isolate noisy changes
- extracts least-significant bits from pixel differences
- supports three output modes:
  - `raw_lsb`
  - `von_neumann`
  - `sha256_whitened`
- runs simple randomness checks:
  - ones ratio
  - byte entropy
  - monobit test
  - runs test
  - serial correlation
  - chi-square
- generates unbiased random integers in a chosen range
- draws a histogram and sample-history chart
- records comparisons across conditions like `lens covered`, `room light`, and `moving scene`
- exports JSON and Markdown reports

## Why It Stands Out

This is not just a button that prints a random number. It is built as an experiment:

- it uses a physical entropy source
- it compares extraction methods
- it measures statistical quality
- it lets you record multiple real-world conditions
- it exports reports you can show in a project or competition

## Important Honesty Note

Safe description:

`hardware-noise random generator using camera sensor noise, with possible quantum shot-noise contribution`

Do not claim this is a certified true quantum random number generator. The project is strongest when it is scientifically honest.

## Browser Use

1. Open the deployed site.
2. Click `Start Camera`.
3. Allow camera permission.
4. Click `Generate Sample`.
5. Review the randomness tests and charts.
6. Click `Generate Integer`.
7. Record a few comparison conditions.
8. Export the report.

## Local Development

You can open the web app locally by serving the folder with any static file server.

Simple option:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Legacy Desktop Version

The repo still includes a local Python desktop version for reference:

- `desktop_app.py`
- `qrng/`

That version is not used by Vercel. The deployable app is the browser version.

## Repo Description

An experimental hardware-noise randomness lab built for the web that captures webcam entropy, applies extraction pipelines, evaluates output with statistical tests, visualizes distribution quality in real time, generates unbiased random integers, and exports reproducible experiment reports.
