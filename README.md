# Quantum Teleportation Lab

A browser-based interactive demo of quantum teleportation.

This project shows how an unknown qubit state can be transferred from Alice to Bob using an entangled pair plus two classical bits. It is designed to be visually interesting, school-friendly, and easy to explain without pretending that matter itself is being teleported.

## Live Web App

This repository is structured as a static web app for Vercel.

Core files:

- `index.html`
- `styles.css`
- `web_app.js`
- `vercel.json`

## What It Demonstrates

- choosing an input qubit state
- creating a shared Bell pair
- Bell-basis measurement on Alice's side
- generating two classical measurement bits
- Bob's correction operation
- reconstruction of the original state on Bob's qubit

## Why It’s Cooler Than a Basic Simulator

- it has a step-by-step visual stage
- it shows the flow of entanglement and classical information
- it explains what each step means in plain language
- it makes the “teleportation” idea feel concrete and memorable

## What It Does Not Claim

- it does not teleport matter
- it does not move information faster than light
- it does not run on real quantum hardware

It is a browser-based educational visualization of the protocol.

## How To Use

1. Open the deployed site.
2. Pick a qubit state such as `|+⟩` or `|i+⟩`.
3. Click `Teleport State`.
4. Watch the protocol advance through the five steps.
5. Read the two classical bits and Bob's correction.
6. Export the report if you want a saved record.

## Good Demo Script

1. Start with `|+⟩`.
2. Explain that Alice wants to transfer this unknown state.
3. Point out that Alice and Bob first share an entangled pair.
4. Show that Alice measures and gets two classical bits.
5. Explain that Bob still needs those classical bits.
6. Show Bob applying the correction and recovering the original state.

## Local Development

Serve the project as a static site:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Legacy Desktop Folder

The previous Python project is preserved only as reference in:

- `legacy-desktop/`

It is not part of the deployed teleportation web app.
