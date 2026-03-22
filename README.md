# Camera Noise RNG Lab

A polished Python experiment app that turns a webcam into a local hardware-noise random number lab.

This project is designed as a school-friendly research demo, not just a random-number toy. It lets you collect entropy from camera sensor noise, compare extraction methods, run simple randomness tests, generate whole numbers, and export experiment reports.

## What It Does

- captures live camera frames
- isolates noisy changes between frames
- extracts bits from sensor noise
- supports three output modes:
  - `raw_lsb`
  - `von_neumann`
  - `sha256_whitened`
- runs simple statistical checks:
  - ones ratio
  - byte entropy
  - monobit test
  - runs test
  - serial correlation
  - chi-square
- generates random integers in a custom range
- draws a byte histogram and sample history graph
- logs comparisons across conditions like `lens covered`, `room light`, and `moving scene`
- exports both `JSON` and `Markdown` reports

## Why It Stands Out

Most student RNG projects stop at “it prints random numbers.” This one is built as an experiment:

- it uses a physical noise source
- it compares multiple extraction methods
- it measures output quality
- it records observations under different real-world conditions
- it produces a report you can show to a teacher or judge

## Important Honesty Note

Safe description:

`hardware-noise random generator using camera sensor noise, with possible quantum shot-noise contribution`

Do not claim this is a certified true quantum random number generator. The strength of the project is that it is scientifically honest.

## Project Structure

- [app.py](C:/Users/2029089/camera-qrng-prototype/app.py): main GUI and CLI app
- [qrng/camera_entropy.py](C:/Users/2029089/camera-qrng-prototype/qrng/camera_entropy.py): camera capture and entropy sampling
- [qrng/extractor.py](C:/Users/2029089/camera-qrng-prototype/qrng/extractor.py): extraction modes and whitening
- [qrng/stats.py](C:/Users/2029089/camera-qrng-prototype/qrng/stats.py): randomness tests and histograms
- [run_qrng_lab.bat](C:/Users/2029089/camera-qrng-prototype/run_qrng_lab.bat): Windows double-click launcher

## Install

```bash
python -m pip install -r requirements.txt
```

## Run

GUI:

```bash
python app.py
```

Windows double-click launcher:

```bat
run_qrng_lab.bat
```

CLI:

```bash
python app.py --cli --mode sha256_whitened --blocks 8 --min 1 --max 100
```

If your webcam is not camera `0`, try:

```bash
python app.py --camera-index 1
```

## Best Demo Flow

1. Cover the camera lens and generate a sample.
2. Record it as `lens covered`.
3. Switch to `room light` and generate another sample.
4. Wave your hand in front of the camera and record `moving scene`.
5. Compare the statistics in the log.
6. Switch between `raw_lsb`, `von_neumann`, and `sha256_whitened`.
7. Generate a random whole number from `1` to `100`.
8. Export the report.

## GitHub Publish Checklist

- add your own name to the repo description and README if you want authorship visible
- keep `output/` out of git; `.gitignore` already handles that
- add screenshots or a screen recording to the repo page
- include one exported report example in a separate `examples/` folder if you want
- write a short project summary when you create the GitHub repo

## Good Repo Description

`A polished Python hardware-noise RNG lab that uses webcam sensor noise, extraction methods, live randomness tests, and experiment report export.`

## Presentation Title

`Camera Noise RNG Lab: Testing Physical Randomness with Extraction and Statistical Analysis`
