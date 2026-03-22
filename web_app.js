const els = {
  shotCountInput: document.getElementById("shotCountInput"),
  testFractionInput: document.getElementById("testFractionInput"),
  eveProbabilityInput: document.getElementById("eveProbabilityInput"),
  eveProbabilityLabel: document.getElementById("eveProbabilityLabel"),
  eveEnabledInput: document.getElementById("eveEnabledInput"),
  runBtn: document.getElementById("runBtn"),
  rerunBtn: document.getElementById("rerunBtn"),
  exportBtn: document.getElementById("exportBtn"),
  statusBadge: document.getElementById("statusBadge"),
  metricsGrid: document.getElementById("metricsGrid"),
  transmissionTableBody: document.getElementById("transmissionTableBody"),
  aliceKeyOutput: document.getElementById("aliceKeyOutput"),
  bobKeyOutput: document.getElementById("bobKeyOutput"),
  finalKeyOutput: document.getElementById("finalKeyOutput"),
  keySummary: document.getElementById("keySummary"),
  timelineCanvas: document.getElementById("timelineCanvas"),
  heroShots: document.getElementById("heroShots"),
  heroQber: document.getElementById("heroQber"),
  heroKeyBits: document.getElementById("heroKeyBits"),
};

const state = {
  lastRun: null,
  lastConfig: null,
};

function randBit() {
  return Math.random() < 0.5 ? 0 : 1;
}

function randBasis() {
  return Math.random() < 0.5 ? "+" : "x";
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function encodedState(bit, basis) {
  if (basis === "+") return bit === 0 ? "↑" : "→";
  return bit === 0 ? "↗" : "↘";
}

function measurePhoton(transmittedBit, transmittedBasis, measurementBasis) {
  if (transmittedBasis === measurementBasis) {
    return transmittedBit;
  }
  return randBit();
}

function simulateBB84(config) {
  const transmissions = [];
  for (let i = 0; i < config.shots; i += 1) {
    const aliceBit = randBit();
    const aliceBasis = randBasis();
    const stateSymbol = encodedState(aliceBit, aliceBasis);

    let transmittedBit = aliceBit;
    let transmittedBasis = aliceBasis;
    let eveIntercepted = false;
    let eveBasis = null;
    let eveBit = null;

    if (config.eveEnabled && Math.random() < config.eveProbability) {
      eveIntercepted = true;
      eveBasis = randBasis();
      eveBit = measurePhoton(transmittedBit, transmittedBasis, eveBasis);
      transmittedBit = eveBit;
      transmittedBasis = eveBasis;
    }

    const bobBasis = randBasis();
    const bobBit = measurePhoton(transmittedBit, transmittedBasis, bobBasis);
    const keep = aliceBasis === bobBasis;

    transmissions.push({
      index: i,
      aliceBit,
      aliceBasis,
      stateSymbol,
      eveIntercepted,
      eveBasis,
      eveBit,
      bobBasis,
      bobBit,
      keep,
      tested: false,
      final: false,
    });
  }

  const kept = transmissions.filter((t) => t.keep);
  const keptIndices = kept.map((t) => t.index);
  const testCount = Math.min(
    kept.length,
    Math.max(1, Math.floor(kept.length * config.testFraction))
  );
  const testedIndices = new Set(shuffle(keptIndices).slice(0, testCount));

  transmissions.forEach((t) => {
    if (testedIndices.has(t.index)) t.tested = true;
    if (t.keep && !t.tested) t.final = true;
  });

  const tested = transmissions.filter((t) => t.tested);
  const qber = tested.length
    ? tested.filter((t) => t.aliceBit !== t.bobBit).length / tested.length
    : 0;

  const siftedAlice = kept.map((t) => t.aliceBit).join("");
  const siftedBob = kept.map((t) => t.bobBit).join("");

  const finalBitsAlice = transmissions.filter((t) => t.final).map((t) => t.aliceBit);
  const finalBitsBob = transmissions.filter((t) => t.final).map((t) => t.bobBit);
  const finalKeyAlice = finalBitsAlice.join("");
  const finalKeyBob = finalBitsBob.join("");
  const finalKeyAgreement = finalBitsAlice.length
    ? finalBitsAlice.filter((bit, idx) => bit === finalBitsBob[idx]).length / finalBitsAlice.length
    : 0;

  return {
    config,
    transmissions,
    keptCount: kept.length,
    testedCount: tested.length,
    finalKeyAlice,
    finalKeyBob,
    siftedAlice,
    siftedBob,
    qber,
    finalKeyAgreement,
    eveInterceptedCount: transmissions.filter((t) => t.eveIntercepted).length,
  };
}

function metricClass(valueType, value) {
  if (valueType === "qber") {
    if (value < 0.05) return "pass";
    if (value < 0.15) return "warn";
    return "fail";
  }
  if (valueType === "agreement") {
    if (value > 0.98) return "pass";
    if (value > 0.85) return "warn";
    return "fail";
  }
  return "";
}

function renderMetrics(run) {
  const metrics = [
    ["Kept after basis match", `${run.keptCount}`, ""],
    ["Test bits revealed", `${run.testedCount}`, ""],
    ["Estimated QBER", `${(run.qber * 100).toFixed(1)}%`, metricClass("qber", run.qber)],
    ["Final key length", `${run.finalKeyAlice.length}`, ""],
    ["Final key agreement", `${(run.finalKeyAgreement * 100).toFixed(1)}%`, metricClass("agreement", run.finalKeyAgreement)],
    ["Eve interceptions", `${run.eveInterceptedCount}`, run.eveInterceptedCount ? "warn" : "pass"],
  ];
  els.metricsGrid.innerHTML = metrics.map(([label, value, cls]) => `
    <article class="stat-card">
      <span class="label">${label}</span>
      <div class="value ${cls}">${value}</div>
    </article>
  `).join("");

  els.heroShots.textContent = String(run.config.shots);
  els.heroQber.textContent = `${(run.qber * 100).toFixed(1)}%`;
  els.heroKeyBits.textContent = String(run.finalKeyAlice.length);
}

function chip(text, cls) {
  return `<span class="chip ${cls}">${text}</span>`;
}

function renderTable(run) {
  const preview = run.transmissions.slice(0, 24);
  els.transmissionTableBody.innerHTML = preview.map((t) => `
    <tr>
      <td>${t.index + 1}</td>
      <td>${t.aliceBit}</td>
      <td>${t.aliceBasis}</td>
      <td>${t.stateSymbol}</td>
      <td>${t.eveIntercepted ? `${chip("yes", "intercept")} ${t.eveBasis}/${t.eveBit}` : chip("no", "drop")}</td>
      <td>${t.bobBasis}</td>
      <td>${t.bobBit}</td>
      <td>${t.keep ? chip("keep", "keep") : chip("drop", "drop")}</td>
      <td>${t.tested ? chip("test", "test") : t.final ? chip("final", "keep") : chip("none", "drop")}</td>
    </tr>
  `).join("");
}

function renderKeys(run) {
  els.aliceKeyOutput.value = run.siftedAlice || "No sifted key";
  els.bobKeyOutput.value = run.siftedBob || "No sifted key";
  els.finalKeyOutput.value = run.finalKeyAlice || "No final secret key";

  if (!run.finalKeyAlice.length) {
    els.keySummary.textContent = "No secret key survived after testing. Increase the shot count or lower Eve interference.";
    return;
  }

  if (run.qber < 0.05) {
    els.keySummary.textContent = `Low QBER. Alice and Bob can trust the remaining ${run.finalKeyAlice.length} key bits.`;
  } else if (run.qber < 0.15) {
    els.keySummary.textContent = `Moderate QBER. The channel is suspicious and the key should be treated carefully.`;
  } else {
    els.keySummary.textContent = `High QBER. The protocol detected too much disturbance, so the key should be rejected.`;
  }
}

function drawTimeline(run) {
  const canvas = els.timelineCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#edf6ff";
  ctx.font = "16px Segoe UI";
  ctx.fillText("Transmission status across all attempts", 18, 24);

  const cols = 32;
  const rows = Math.ceil(run.transmissions.length / cols);
  const cellW = (width - 40) / cols;
  const cellH = Math.max(18, (height - 50) / Math.max(rows, 1));

  run.transmissions.forEach((t, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = 20 + col * cellW;
    const y = 38 + row * cellH;

    let fill = "rgba(255,255,255,0.10)";
    if (t.keep) fill = "#6ef3a5";
    if (t.tested) fill = "#ffd166";
    if (t.tested && t.aliceBit !== t.bobBit) fill = "#ff7f7f";
    if (t.eveIntercepted && !t.keep) fill = "#7cc6ff";

    ctx.fillStyle = fill;
    ctx.fillRect(x, y, cellW - 3, cellH - 3);
  });
}

function exportReport(run) {
  const payload = {
    project: "BB84 Quantum Key Distribution Lab",
    generatedAt: new Date().toISOString(),
    config: run.config,
    qber: run.qber,
    keptCount: run.keptCount,
    testedCount: run.testedCount,
    finalKeyLength: run.finalKeyAlice.length,
    finalKeyAgreement: run.finalKeyAgreement,
    eveInterceptedCount: run.eveInterceptedCount,
    transmissionsPreview: run.transmissions.slice(0, 24),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bb84-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function currentConfig() {
  return {
    shots: Number(els.shotCountInput.value) || 128,
    testFraction: Number(els.testFractionInput.value) || 0.25,
    eveEnabled: els.eveEnabledInput.checked,
    eveProbability: els.eveEnabledInput.checked ? (Number(els.eveProbabilityInput.value) || 0) / 100 : 0,
  };
}

function runProtocol() {
  const config = currentConfig();
  els.statusBadge.textContent = "Running";
  const run = simulateBB84(config);
  state.lastRun = run;
  state.lastConfig = config;
  renderMetrics(run);
  renderTable(run);
  renderKeys(run);
  drawTimeline(run);
  els.statusBadge.textContent = "Complete";
}

function updateProbabilityLabel() {
  els.eveProbabilityLabel.textContent = `${els.eveProbabilityInput.value}%`;
}

els.runBtn.addEventListener("click", runProtocol);
els.rerunBtn.addEventListener("click", () => {
  if (!state.lastConfig) {
    runProtocol();
    return;
  }
  runProtocol();
});
els.exportBtn.addEventListener("click", () => {
  if (!state.lastRun) {
    alert("Run the protocol first.");
    return;
  }
  exportReport(state.lastRun);
});
els.eveProbabilityInput.addEventListener("input", updateProbabilityLabel);
els.eveEnabledInput.addEventListener("change", () => {
  els.eveProbabilityInput.disabled = !els.eveEnabledInput.checked;
  updateProbabilityLabel();
});

els.eveProbabilityInput.disabled = !els.eveEnabledInput.checked;
updateProbabilityLabel();
runProtocol();
