const STATE_LIBRARY = {
  zero: {
    label: "|0⟩",
    desc: "north pole of the Bloch sphere",
    vector: [0, -1],
  },
  one: {
    label: "|1⟩",
    desc: "south pole of the Bloch sphere",
    vector: [0, 1],
  },
  plus: {
    label: "|+⟩",
    desc: "equal superposition on the x-axis",
    vector: [1, 0],
  },
  minus: {
    label: "|−⟩",
    desc: "equal superposition on the negative x-axis",
    vector: [-1, 0],
  },
  iplus: {
    label: "|i+⟩",
    desc: "positive y-axis phase state",
    vector: [0.7, -0.7],
  },
  iminus: {
    label: "|i−⟩",
    desc: "negative y-axis phase state",
    vector: [-0.7, 0.7],
  },
};

const CORRECTIONS = {
  "00": { label: "I", desc: "no correction needed" },
  "01": { label: "X", desc: "bit flip" },
  "10": { label: "Z", desc: "phase flip" },
  "11": { label: "ZX", desc: "phase flip and bit flip" },
};

const els = {
  stateSelect: document.getElementById("stateSelect"),
  speedInput: document.getElementById("speedInput"),
  speedLabel: document.getElementById("speedLabel"),
  autoPlayInput: document.getElementById("autoPlayInput"),
  mathHintsInput: document.getElementById("mathHintsInput"),
  runBtn: document.getElementById("runBtn"),
  nextStepBtn: document.getElementById("nextStepBtn"),
  randomizeBtn: document.getElementById("randomizeBtn"),
  exportBtn: document.getElementById("exportBtn"),
  statusBadge: document.getElementById("statusBadge"),
  stepBadge: document.getElementById("stepBadge"),
  heroState: document.getElementById("heroState"),
  heroBits: document.getElementById("heroBits"),
  heroCorrection: document.getElementById("heroCorrection"),
  aliceInputState: document.getElementById("aliceInputState"),
  aliceInputDesc: document.getElementById("aliceInputDesc"),
  entangledState: document.getElementById("entangledState"),
  bobState: document.getElementById("bobState"),
  bobDesc: document.getElementById("bobDesc"),
  bitM1: document.getElementById("bitM1"),
  bitM2: document.getElementById("bitM2"),
  correctionOutput: document.getElementById("correctionOutput"),
  mathHintOutput: document.getElementById("mathHintOutput"),
  storyOutput: document.getElementById("storyOutput"),
  timelineList: document.getElementById("timelineList"),
  keySummary: document.getElementById("keySummary"),
  teleportCanvas: document.getElementById("teleportCanvas"),
};

const state = {
  run: null,
  activeStep: 0,
  timer: null,
};

function setStatus(text) {
  els.statusBadge.textContent = text;
}

function randomChoice(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function buildRun() {
  const stateId = els.stateSelect.value;
  const picked = STATE_LIBRARY[stateId];
  const bits = `${Math.random() < 0.5 ? 0 : 1}${Math.random() < 0.5 ? 0 : 1}`;
  const correction = CORRECTIONS[bits];
  const steps = [
    {
      title: "Prepare the unknown qubit",
      text: `Alice starts with ${picked.label}, the state she wants to transfer without directly copying it.`,
      bobLabel: "waiting…",
      bobDesc: "Bob has not received any quantum information yet.",
      hint: `Input state: ${picked.label}`,
    },
    {
      title: "Create entanglement",
      text: "Alice and Bob share an entangled Bell pair: (|00⟩ + |11⟩) / √2.",
      bobLabel: "entangled",
      bobDesc: "Bob's qubit is correlated with Alice's pair partner.",
      hint: "Shared Bell pair: (|00⟩ + |11⟩) / √2",
    },
    {
      title: "Bell measurement",
      text: `Alice performs a Bell-basis measurement on her two qubits and gets classical bits ${bits}. Her original state is destroyed here.`,
      bobLabel: `${correction.label} · ${picked.label}`,
      bobDesc: "Before correction, Bob's qubit is a transformed version of the target state.",
      hint: `Measurement bits = ${bits}, so Bob temporarily has ${correction.label}|ψ⟩.`,
    },
    {
      title: "Send classical bits",
      text: "Alice sends the two classical bits to Bob over a normal communication channel.",
      bobLabel: `${correction.label} · ${picked.label}`,
      bobDesc: "Bob now knows which correction to apply.",
      hint: `Classical channel sends m₁m₂ = ${bits}`,
    },
    {
      title: "Bob reconstructs the state",
      text: `Bob applies ${correction.label} and recovers ${picked.label}. The state has been transferred, not copied.`,
      bobLabel: picked.label,
      bobDesc: `Teleportation complete. Bob now holds ${picked.label}.`,
      hint: `Bob applies ${correction.label}, so ${correction.label}(${correction.label}|ψ⟩) = |ψ⟩`,
    },
  ];

  return {
    stateId,
    picked,
    bits,
    correction,
    steps,
  };
}

function renderRun() {
  const run = state.run;
  if (!run) return;
  els.heroState.textContent = run.picked.label;
  els.heroBits.textContent = run.bits;
  els.heroCorrection.textContent = run.correction.label;
  els.aliceInputState.textContent = run.picked.label;
  els.aliceInputDesc.textContent = run.picked.desc;
  els.bitM1.textContent = run.bits[0];
  els.bitM2.textContent = run.bits[1];
  els.correctionOutput.textContent = run.correction.label;
  renderStep();
  renderTimeline();
}

function renderStep() {
  const run = state.run;
  if (!run) return;
  const step = run.steps[state.activeStep];
  els.stepBadge.textContent = `Step ${state.activeStep + 1} of ${run.steps.length}`;
  els.bobState.textContent = step.bobLabel;
  els.bobDesc.textContent = step.bobDesc;
  els.mathHintOutput.textContent = els.mathHintsInput.checked ? step.hint : "";
  els.storyOutput.innerHTML = run.steps.map((item, idx) => `
    <div class="story-step">
      <span class="title">${idx + 1}. ${item.title}${idx === state.activeStep ? " • active" : ""}</span>
      <div>${item.text}</div>
    </div>
  `).join("");
  els.keySummary.textContent = step.text;
  drawStage();
}

function renderTimeline() {
  const run = state.run;
  if (!run) return;
  els.timelineList.innerHTML = run.steps.map((step, idx) => `
    <div class="timeline-item">
      <strong>${idx + 1}. ${step.title}</strong>
      <div>${step.text}</div>
    </div>
  `).join("");
}

function drawBloch(ctx, centerX, centerY, radius, vector, color) {
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + vector[0] * radius * 0.8, centerY + vector[1] * radius * 0.8);
  ctx.stroke();
}

function drawStage() {
  const canvas = els.teleportCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const run = state.run;
  const step = run.steps[state.activeStep];
  const baseY = 170;
  const x1 = 190;
  const x2 = 560;
  const x3 = 930;

  ctx.fillStyle = "#eef6ff";
  ctx.font = "16px Segoe UI";
  ctx.fillText("Alice", x1 - 24, 44);
  ctx.fillText("Entangled Link", x2 - 58, 44);
  ctx.fillText("Bob", x3 - 18, 44);

  drawBloch(ctx, x1, baseY, 64, run.picked.vector, "#7effd6");
  drawBloch(ctx, x3, baseY, 64, step.bobLabel === run.picked.label ? run.picked.vector : [-run.picked.vector[1], run.picked.vector[0]], "#7bc7ff");

  ctx.strokeStyle = "#d5a6ff";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x1 + 90, baseY);
  ctx.quadraticCurveTo(x2, baseY - 70, x3 - 90, baseY);
  ctx.stroke();

  ctx.fillStyle = "#d5a6ff";
  ctx.beginPath();
  ctx.arc(x2, baseY - 70, 10, 0, Math.PI * 2);
  ctx.fill();

  if (state.activeStep >= 2) {
    ctx.fillStyle = "#ffd166";
    ctx.font = "28px Consolas";
    ctx.fillText(run.bits, x2 - 16, baseY + 6);
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x2, baseY + 20);
    ctx.lineTo(x3 - 85, baseY + 20);
    ctx.stroke();
  }

  ctx.fillStyle = "#eef6ff";
  ctx.font = "15px Segoe UI";
  ctx.fillText(step.title, 24, 286);
}

function nextStep() {
  if (!state.run) return;
  if (state.activeStep < state.run.steps.length - 1) {
    state.activeStep += 1;
    renderStep();
    setStatus(`Showing step ${state.activeStep + 1}`);
  }
}

function runTeleportation() {
  clearTimeout(state.timer);
  state.run = buildRun();
  state.activeStep = 0;
  renderRun();
  setStatus("Teleportation ready");

  if (!els.autoPlayInput.checked) return;
  const speed = Number(els.speedInput.value) || 900;
  const advance = () => {
    if (!state.run || state.activeStep >= state.run.steps.length - 1) return;
    nextStep();
    state.timer = setTimeout(advance, speed);
  };
  state.timer = setTimeout(advance, speed);
}

function randomizeState() {
  const keys = Object.keys(STATE_LIBRARY);
  els.stateSelect.value = randomChoice(keys);
  runTeleportation();
}

function updateSpeedLabel() {
  els.speedLabel.textContent = `${els.speedInput.value} ms / step`;
}

function exportReport() {
  if (!state.run) {
    alert("Run the demo first.");
    return;
  }
  const payload = {
    project: "Quantum Teleportation Lab",
    generatedAt: new Date().toISOString(),
    inputState: state.run.picked.label,
    classicalBits: state.run.bits,
    correction: state.run.correction.label,
    steps: state.run.steps,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `teleportation-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

els.runBtn.addEventListener("click", runTeleportation);
els.nextStepBtn.addEventListener("click", nextStep);
els.randomizeBtn.addEventListener("click", randomizeState);
els.exportBtn.addEventListener("click", exportReport);
els.speedInput.addEventListener("input", updateSpeedLabel);
els.mathHintsInput.addEventListener("change", renderStep);

updateSpeedLabel();
runTeleportation();
