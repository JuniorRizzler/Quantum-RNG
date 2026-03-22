const els = {
  cameraSelect: document.getElementById("cameraSelect"),
  modeSelect: document.getElementById("modeSelect"),
  blocksInput: document.getElementById("blocksInput"),
  conditionSelect: document.getElementById("conditionSelect"),
  minInput: document.getElementById("minInput"),
  maxInput: document.getElementById("maxInput"),
  conditionNoteInput: document.getElementById("conditionNoteInput"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  generateBtn: document.getElementById("generateBtn"),
  integerBtn: document.getElementById("integerBtn"),
  recordBtn: document.getElementById("recordBtn"),
  reportBtn: document.getElementById("reportBtn"),
  statusBadge: document.getElementById("statusBadge"),
  qualityBadge: document.getElementById("qualityBadge"),
  cameraFeed: document.getElementById("cameraFeed"),
  diffCanvas: document.getElementById("diffCanvas"),
  workCanvas: document.getElementById("workCanvas"),
  statsGrid: document.getElementById("statsGrid"),
  hexOutput: document.getElementById("hexOutput"),
  numberOutput: document.getElementById("numberOutput"),
  sampleSummary: document.getElementById("sampleSummary"),
  histogramCanvas: document.getElementById("histogramCanvas"),
  historyCanvas: document.getElementById("historyCanvas"),
  comparisonLog: document.getElementById("comparisonLog"),
};

const state = {
  stream: null,
  previousGray: null,
  generatedBytes: new Uint8Array(),
  history: [],
  comparisons: [],
  lastStats: null,
  lastMeta: null,
};

function setStatus(text) {
  els.statusBadge.textContent = text;
}

async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((d) => d.kind === "videoinput");
  els.cameraSelect.innerHTML = "";
  cameras.forEach((camera, index) => {
    const option = document.createElement("option");
    option.value = camera.deviceId;
    option.textContent = camera.label || `Camera ${index + 1}`;
    els.cameraSelect.appendChild(option);
  });
}

async function startCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  const deviceId = els.cameraSelect.value;
  const constraints = {
    video: deviceId ? { deviceId: { exact: deviceId }, width: 640, height: 360 } : { width: 640, height: 360 },
    audio: false,
  };
  state.stream = await navigator.mediaDevices.getUserMedia(constraints);
  els.cameraFeed.srcObject = state.stream;
  await els.cameraFeed.play();
  state.previousGray = null;
  setStatus("Camera live");
}

function getContexts() {
  return {
    work: els.workCanvas.getContext("2d", { willReadFrequently: true }),
    diff: els.diffCanvas.getContext("2d", { willReadFrequently: true }),
    hist: els.histogramCanvas.getContext("2d"),
    history: els.historyCanvas.getContext("2d"),
  };
}

function captureGrayFrame() {
  const { work } = getContexts();
  const w = els.workCanvas.width;
  const h = els.workCanvas.height;
  work.drawImage(els.cameraFeed, 0, 0, w, h);
  const imageData = work.getImageData(0, 0, w, h);
  const gray = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < imageData.data.length; i += 4, j += 1) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    gray[j] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

function drawDiff(diff) {
  const { diff: diffCtx } = getContexts();
  const w = els.diffCanvas.width;
  const h = els.diffCanvas.height;
  const imageData = diffCtx.createImageData(w, h);
  for (let i = 0, j = 0; j < diff.length; i += 4, j += 1) {
    const value = diff[j];
    imageData.data[i] = value;
    imageData.data[i + 1] = value;
    imageData.data[i + 2] = value;
    imageData.data[i + 3] = 255;
  }
  diffCtx.putImageData(imageData, 0, 0);
}

function diffFrames(current, previous) {
  const diff = new Uint8Array(current.length);
  for (let i = 0; i < current.length; i += 1) {
    diff[i] = Math.abs(current[i] - previous[i]);
  }
  return diff;
}

function lsbBits(values) {
  const bits = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    bits[i] = values[i] & 1;
  }
  return bits;
}

function bitsToBytes(bits) {
  const usableLength = bits.length - (bits.length % 8);
  const bytes = new Uint8Array(usableLength / 8);
  for (let i = 0; i < usableLength; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) {
      value = (value << 1) | bits[i + j];
    }
    bytes[i / 8] = value;
  }
  return bytes;
}

function vonNeumann(bits) {
  const usableLength = bits.length - (bits.length % 2);
  const out = [];
  for (let i = 0; i < usableLength; i += 2) {
    const a = bits[i];
    const b = bits[i + 1];
    if (a !== b) {
      out.push(b);
    }
  }
  return Uint8Array.from(out);
}

async function shaExpand(seedBytes, blocks) {
  const out = [];
  for (let i = 0; i < blocks; i += 1) {
    const counter = new Uint8Array(4);
    new DataView(counter.buffer).setUint32(0, i);
    const combined = new Uint8Array(counter.length + seedBytes.length);
    combined.set(counter, 0);
    combined.set(seedBytes, counter.length);
    const digest = await crypto.subtle.digest("SHA-256", combined);
    out.push(...new Uint8Array(digest));
  }
  return Uint8Array.from(out);
}

async function extractEntropy(rawBits, mode, blocks) {
  const rawBytes = bitsToBytes(rawBits);
  if (mode === "raw_lsb") {
    return { output: rawBytes, extractedBits: rawBits.length };
  }
  const vnBits = vonNeumann(rawBits);
  const vnBytes = bitsToBytes(vnBits);
  if (mode === "von_neumann") {
    return { output: vnBytes, extractedBits: vnBits.length };
  }
  const whitened = vnBytes.length ? await shaExpand(vnBytes, Math.max(1, blocks)) : new Uint8Array();
  return { output: whitened, extractedBits: vnBits.length };
}

function bitsFromBytes(bytes) {
  const bits = [];
  bytes.forEach((b) => {
    for (let shift = 7; shift >= 0; shift -= 1) {
      bits.push((b >> shift) & 1);
    }
  });
  return bits;
}

function histogram(bytes) {
  const hist = new Array(256).fill(0);
  bytes.forEach((b) => { hist[b] += 1; });
  return hist;
}

function entropy(bytes) {
  if (!bytes.length) return 0;
  const hist = histogram(bytes);
  let e = 0;
  hist.forEach((count) => {
    if (count) {
      const p = count / bytes.length;
      e -= p * Math.log2(p);
    }
  });
  return e;
}

function chiSquare(bytes) {
  if (!bytes.length) return 0;
  const hist = histogram(bytes);
  const expected = bytes.length / 256;
  return hist.reduce((acc, count) => acc + ((count - expected) ** 2) / expected, 0);
}

function serialCorrelation(bytes) {
  if (bytes.length < 2) return 0;
  const values = Array.from(bytes, Number);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < values.length - 1; i += 1) {
    numerator += (values[i] - mean) * (values[i + 1] - mean);
  }
  values.forEach((v) => { denominator += (v - mean) ** 2; });
  return denominator ? numerator / denominator : 0;
}

function countRuns(bits) {
  if (!bits.length) return 0;
  let runs = 1;
  for (let i = 1; i < bits.length; i += 1) {
    if (bits[i] !== bits[i - 1]) runs += 1;
  }
  return runs;
}

function computeStats(bytes, meta) {
  const bits = bitsFromBytes(bytes);
  const ones = bits.reduce((a, b) => a + b, 0);
  const total = bits.length;
  const ratio = total ? ones / total : 0;
  const mono = total ? Math.abs(ones - total / 2) / Math.sqrt(total / 4) : 0;
  const runs = countRuns(bits);
  const expectedRuns = total ? 1 + 2 * (total - 1) * ratio * (1 - ratio) : 0;
  const serial = serialCorrelation(bytes);
  return {
    mode: meta.mode,
    outputBytes: bytes.length,
    totalBits: total,
    onesRatio: ratio,
    byteEntropy: entropy(bytes),
    chiSquare: chiSquare(bytes),
    monobitZ: mono,
    runs,
    expectedRuns,
    serialCorrelation: serial,
    rawBits: meta.rawBits,
    extractedBits: meta.extractedBits,
    histogram: histogram(bytes),
    monobitPass: mono < 2.575,
    runsPass: total ? Math.abs(runs - expectedRuns) / Math.sqrt(total) < 2.5 : false,
    serialPass: Math.abs(serial) < 0.1,
  };
}

function qualitySummary(stats) {
  const passes = [stats.monobitPass, stats.runsPass, stats.serialPass].filter(Boolean).length;
  if (passes === 3 && Math.abs(stats.onesRatio - 0.5) < 0.02 && stats.byteEntropy > 6.5) return "Quality: strong sample";
  if (passes >= 2) return "Quality: usable sample";
  return "Quality: unstable sample, try more blocks or a different scene";
}

function renderStats(stats) {
  const items = [
    ["Ones Ratio", stats.onesRatio.toFixed(4), Math.abs(stats.onesRatio - 0.5) < 0.03 ? "pass" : "check"],
    ["Byte Entropy", `${stats.byteEntropy.toFixed(4)} / 8`, stats.byteEntropy > 6 ? "pass" : "check"],
    ["Monobit z", stats.monobitZ.toFixed(3), stats.monobitPass ? "pass" : "fail"],
    ["Runs", `${stats.runs} / ${stats.expectedRuns.toFixed(1)}`, stats.runsPass ? "pass" : "fail"],
    ["Serial Corr", stats.serialCorrelation.toFixed(4), stats.serialPass ? "pass" : "fail"],
    ["Chi-square", stats.chiSquare.toFixed(2), "check"],
  ];
  els.statsGrid.innerHTML = items.map(([label, value, cls]) => `
    <article class="stat-card">
      <span class="label">${label}</span>
      <div class="value ${cls}">${value}</div>
    </article>
  `).join("");
  els.qualityBadge.textContent = qualitySummary(stats);
}

function drawHistogram(hist) {
  const ctx = els.histogramCanvas.getContext("2d");
  const width = els.histogramCanvas.width;
  const height = els.histogramCanvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#edf6ff";
  ctx.font = "16px Segoe UI";
  ctx.fillText("Byte Histogram", 16, 24);
  const grouped = [];
  for (let i = 0; i < 256; i += 16) grouped.push(hist.slice(i, i + 16).reduce((a, b) => a + b, 0));
  const max = Math.max(1, ...grouped);
  const barW = (width - 40) / grouped.length;
  grouped.forEach((count, i) => {
    const barH = ((height - 56) * count) / max;
    ctx.fillStyle = "#49dcb1";
    ctx.fillRect(20 + i * barW, height - 24 - barH, barW - 4, barH);
  });
}

function drawHistory() {
  const ctx = els.historyCanvas.getContext("2d");
  const width = els.historyCanvas.width;
  const height = els.historyCanvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#edf6ff";
  ctx.font = "16px Segoe UI";
  ctx.fillText("Entropy / Ones Ratio History", 16, 24);
  if (!state.history.length) return;

  const drawSeries = (values, color, yMin, yMax) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = 20 + (index * (width - 40)) / Math.max(values.length - 1, 1);
      const norm = yMax === yMin ? 0 : (value - yMin) / (yMax - yMin);
      const y = height - 24 - norm * (height - 56);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  drawSeries(state.history.map((s) => s.byteEntropy / 8), "#49dcb1", 0, 1);
  drawSeries(state.history.map((s) => s.onesRatio), "#ffd166", 0.35, 0.65);
}

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomIntFromBytes(bytes, min, max) {
  if (min > max) throw new Error("Minimum cannot be greater than maximum.");
  const span = max - min + 1;
  const nbytes = Math.max(1, Math.ceil(Math.log2(span) / 8));
  const limit = 2 ** (8 * nbytes) - (2 ** (8 * nbytes) % span);
  for (let i = 0; i <= bytes.length - nbytes; i += nbytes) {
    let candidate = 0;
    for (let j = 0; j < nbytes; j += 1) candidate = (candidate << 8) | bytes[i + j];
    if (candidate < limit) return min + (candidate % span);
  }
  throw new Error("Not enough random bytes. Generate a new sample.");
}

function downloadText(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function refreshComparisonLog() {
  if (!state.comparisons.length) {
    els.comparisonLog.textContent = "No comparisons recorded yet.";
    return;
  }
  els.comparisonLog.textContent = state.comparisons.map((entry, idx) => {
    const testState = entry.monobitPass && entry.runsPass && entry.serialPass ? "PASS" : "CHECK";
    const note = entry.note ? `\n   note: ${entry.note}` : "";
    return `${idx + 1}. ${entry.timestamp} | ${entry.condition} | mode=${entry.mode} | entropy=${entry.byteEntropy.toFixed(4)} | ones=${entry.onesRatio.toFixed(4)} | tests=${testState}${note}`;
  }).join("\n");
}

async function generateSample() {
  if (!state.stream) {
    await startCamera();
  }
  setStatus("Generating...");
  const current = captureGrayFrame();
  if (!state.previousGray) {
    state.previousGray = current;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  const next = captureGrayFrame();
  const diff = diffFrames(next, state.previousGray || current);
  state.previousGray = next;
  drawDiff(diff);
  const rawBits = lsbBits(diff);
  const mode = els.modeSelect.value;
  const blocks = Number(els.blocksInput.value) || 8;
  const extracted = await extractEntropy(rawBits, mode, blocks);
  state.generatedBytes = extracted.output;
  state.lastMeta = { mode, rawBits: rawBits.length, extractedBits: extracted.extractedBits };
  state.lastStats = computeStats(state.generatedBytes, state.lastMeta);
  state.history.push(state.lastStats);
  if (state.history.length > 40) state.history = state.history.slice(-40);

  renderStats(state.lastStats);
  els.hexOutput.value = toHex(state.generatedBytes);
  els.sampleSummary.textContent = qualitySummary(state.lastStats);
  drawHistogram(state.lastStats.histogram);
  drawHistory();
  setStatus("Sample ready");
}

function generateInteger() {
  if (!state.generatedBytes.length) {
    alert("Generate a sample first.");
    return;
  }
  const min = Number(els.minInput.value);
  const max = Number(els.maxInput.value);
  try {
    const value = randomIntFromBytes(state.generatedBytes, min, max);
    els.numberOutput.textContent = `${value}`;
  } catch (error) {
    alert(error.message);
  }
}

function recordComparison() {
  if (!state.lastStats) {
    alert("Generate a sample first.");
    return;
  }
  state.comparisons.push({
    timestamp: new Date().toLocaleString(),
    condition: els.conditionSelect.value,
    note: els.conditionNoteInput.value.trim(),
    mode: state.lastStats.mode,
    onesRatio: state.lastStats.onesRatio,
    byteEntropy: state.lastStats.byteEntropy,
    chiSquare: state.lastStats.chiSquare,
    monobitPass: state.lastStats.monobitPass,
    runsPass: state.lastStats.runsPass,
    serialPass: state.lastStats.serialPass,
  });
  refreshComparisonLog();
  setStatus("Comparison recorded");
}

function exportReport() {
  const payload = {
    project: "Quantum RNG Lab",
    generatedAt: new Date().toISOString(),
    mode: els.modeSelect.value,
    blocks: Number(els.blocksInput.value) || 8,
    integerRange: [Number(els.minInput.value), Number(els.maxInput.value)],
    latestStats: state.lastStats,
    comparisons: state.comparisons,
    notes: [
      "This is a browser-based hardware-noise RNG prototype using webcam sensor noise.",
      "It is not a certified true quantum random number generator.",
      "All processing runs client-side in the browser.",
    ],
  };
  downloadText(`qrng-report-${Date.now()}.json`, JSON.stringify(payload, null, 2));
  const md = [
    "# Quantum RNG Lab Report",
    "",
    `- Generated at: ${new Date().toLocaleString()}`,
    `- Mode: ${payload.mode}`,
    `- Blocks: ${payload.blocks}`,
    `- Integer range: ${payload.integerRange[0]} to ${payload.integerRange[1]}`,
    "",
    "## Latest Stats",
    payload.latestStats ? `- Ones ratio: ${payload.latestStats.onesRatio.toFixed(4)}` : "- No sample recorded",
    payload.latestStats ? `- Byte entropy: ${payload.latestStats.byteEntropy.toFixed(4)} / 8` : "",
    payload.latestStats ? `- Monobit pass: ${payload.latestStats.monobitPass}` : "",
    payload.latestStats ? `- Runs pass: ${payload.latestStats.runsPass}` : "",
    payload.latestStats ? `- Serial pass: ${payload.latestStats.serialPass}` : "",
    "",
    "## Comparison Log",
    ...state.comparisons.map((item) => `- ${item.timestamp} | ${item.condition} | mode=${item.mode} | entropy=${item.byteEntropy.toFixed(4)} | ones=${item.onesRatio.toFixed(4)}`),
  ].join("\n");
  downloadText(`qrng-report-${Date.now()}.md`, md, "text/markdown");
}

async function init() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Camera API unavailable");
    els.startCameraBtn.disabled = true;
    return;
  }
  try {
    await navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    await listCameras();
    setStatus("Ready");
  } catch {
    setStatus("Camera permission needed");
  }
}

els.startCameraBtn.addEventListener("click", () => startCamera().catch((err) => {
  alert(`Camera error: ${err.message}`);
  setStatus("Camera error");
}));
els.generateBtn.addEventListener("click", () => generateSample().catch((err) => {
  alert(`Sample error: ${err.message}`);
  setStatus("Error");
}));
els.integerBtn.addEventListener("click", generateInteger);
els.recordBtn.addEventListener("click", recordComparison);
els.reportBtn.addEventListener("click", exportReport);
navigator.mediaDevices?.addEventListener?.("devicechange", listCameras);

init();
