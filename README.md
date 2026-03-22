# BB84 Quantum Key Distribution Lab

A browser-based interactive demo of the BB84 quantum cryptography protocol.

This project simulates how Alice and Bob create a shared secret key using random bases and how an eavesdropper, Eve, introduces detectable errors by measuring photons in the wrong basis.

## Live Web App

This repository is structured as a static web app for Vercel.

Core files:

- `index.html`
- `styles.css`
- `web_app.js`
- `vercel.json`

## What It Demonstrates

- Alice chooses random bits and random bases
- Bob measures with his own random bases
- only matching-basis positions are kept
- some kept bits are revealed to estimate the error rate
- the remaining bits form the secret key
- Eve can intercept and resend photons, increasing the QBER

## Features

- configurable number of photon attempts
- adjustable test fraction
- optional eavesdropper with intercept probability
- sifted key and final secret key views
- transmission timeline visualization
- first-24 transmission breakdown table
- QBER and key-agreement metrics
- JSON report export

## Why It Is Useful

This is a clean way to show the main idea behind quantum cryptography:

- measuring a quantum state in the wrong basis disturbs it
- an eavesdropper can be detected statistically
- Alice and Bob do not need to reveal the whole key to test channel safety

## How To Use

1. Open the deployed site.
2. Click `Run BB84`.
3. Observe the kept bits, test bits, and final key.
4. Turn on Eve and raise the intercept probability.
5. Run the protocol again and compare the QBER.
6. Export a report if needed.

## Good Demo Script

1. Run with Eve off.
2. Point out that the QBER is near zero.
3. Turn Eve on at `100%`.
4. Run again.
5. Show that the QBER rises because Eve sometimes measures in the wrong basis.
6. Explain that this disturbance is the reason BB84 can detect eavesdropping.

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

It is not part of the deployed BB84 web app.
