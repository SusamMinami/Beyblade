import JSZip from "jszip";
import * as Tone from "tone";
import "./styles.css";

const SAMPLE_RATE = 48000;
const renderCache = new Map();
let activePlayer = null;
let busy = false;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function createOutput(params) {
  const limiter = new Tone.Limiter(-1).toDestination();
  return new Tone.Volume(params.volumeDb).connect(limiter);
}

function hitVelocity(params, scale = 1) {
  return clamp(0.72 * params.intensity * scale, 0.08, 1);
}

function createNoiseSweep(output, options) {
  const filter = new Tone.Filter({
    frequency: options.fromFrequency,
    type: options.type ?? "bandpass",
    Q: options.q ?? 2.5,
  }).connect(output);
  const noise = new Tone.NoiseSynth({
    volume: options.volume ?? -12,
    noise: { type: options.noiseType ?? "white" },
    envelope: {
      attack: options.attack ?? 0.002,
      decay: options.decay,
      sustain: 0,
    },
  }).connect(filter);
  filter.frequency.setValueAtTime(options.fromFrequency, options.time);
  filter.frequency.exponentialRampToValueAtTime(
    options.toFrequency,
    options.time + options.decay,
  );
  noise.triggerAttackRelease(
    options.decay,
    options.time,
    options.velocity ?? 0.8,
  );
}

function buildLauncher(params) {
  const output = createOutput(params);
  const bright = params.brightness;

  createNoiseSweep(output, {
    time: 0.02,
    decay: 0.42,
    fromFrequency: 380 * bright,
    toFrequency: 2600 * bright,
    q: 1.2,
    volume: -12,
    velocity: hitVelocity(params, 0.85),
  });

  const releaseFilter = new Tone.Filter({
    frequency: 3200 * bright,
    type: "highpass",
    Q: 0.8,
  }).connect(output);
  const release = new Tone.NoiseSynth({
    volume: -7,
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.085, sustain: 0 },
  }).connect(releaseFilter);
  release.triggerAttackRelease(0.09, 0.43, hitVelocity(params, 1.05));

  const body = new Tone.MembraneSynth({
    volume: -8,
    pitchDecay: 0.055,
    octaves: 3.4,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.22, sustain: 0 },
  }).connect(output);
  body.triggerAttackRelease("G1", 0.24, 0.445, hitVelocity(params));

  const catchTone = new Tone.MetalSynth({
    volume: -15,
    frequency: 180 * bright,
    envelope: { attack: 0.001, decay: 0.18, release: 0.03 },
    harmonicity: 4.1,
    modulationIndex: 14,
    resonance: 2600 * bright,
    octaves: 1.4,
  }).connect(output);
  catchTone.triggerAttackRelease(0.16, 0.48, hitVelocity(params, 0.55));
}

function buildSpinLoop(params) {
  const output = createOutput(params);
  const bright = params.brightness;
  const base = 126;

  const rotor = new Tone.FMOscillator({
    frequency: base,
    type: "sine",
    modulationType: "triangle",
    harmonicity: 2,
    modulationIndex: 1.6 * bright,
    volume: -16,
    phase: 0,
  }).connect(output);
  rotor.start(0).stop(2);

  const upperRotor = new Tone.FMOscillator({
    frequency: base * 3,
    type: "sine",
    modulationType: "sine",
    harmonicity: 2,
    modulationIndex: 0.8 * bright,
    volume: -25,
    phase: 0,
  }).connect(output);
  upperRotor.start(0).stop(2);

  const airGain = new Tone.Gain(0.08 * params.intensity).connect(output);
  const airFilter = new Tone.Filter({
    frequency: 1200 * bright,
    type: "bandpass",
    Q: 0.7,
  }).connect(airGain);
  const air = new Tone.AMOscillator({
    frequency: 252,
    type: "sine",
    modulationType: "sine",
    harmonicity: 0.5,
    volume: -15,
    phase: 0,
  }).connect(airFilter);
  air.start(0).stop(2);
}

function buildLightCollision(params) {
  const output = createOutput(params);
  const bright = params.brightness;

  const click = new Tone.MetalSynth({
    volume: -10,
    frequency: 230 * bright,
    envelope: { attack: 0.001, decay: 0.11, release: 0.02 },
    harmonicity: 3.2,
    modulationIndex: 10,
    resonance: 3400 * bright,
    octaves: 1.2,
  }).connect(output);
  click.triggerAttackRelease(0.1, 0.025, hitVelocity(params, 0.68));

  const body = new Tone.MembraneSynth({
    volume: -16,
    pitchDecay: 0.025,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
  }).connect(output);
  body.triggerAttackRelease("D2", 0.12, 0.028, hitVelocity(params, 0.5));
}

function buildHeavyCollision(params) {
  const output = createOutput(params);
  const bright = params.brightness;

  const body = new Tone.MembraneSynth({
    volume: -5,
    pitchDecay: 0.08,
    octaves: 4.5,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.38, sustain: 0 },
  }).connect(output);
  body.triggerAttackRelease("C1", 0.34, 0.025, hitVelocity(params, 1.1));

  createNoiseSweep(output, {
    time: 0.026,
    decay: 0.16,
    fromFrequency: 4800 * bright,
    toFrequency: 720 * bright,
    q: 0.9,
    volume: -9,
    velocity: hitVelocity(params),
  });

  const ring = new Tone.MetalSynth({
    volume: -12,
    frequency: 150 * bright,
    envelope: { attack: 0.001, decay: 0.42, release: 0.04 },
    harmonicity: 5.1,
    modulationIndex: 18,
    resonance: 2100 * bright,
    octaves: 1.8,
  }).connect(output);
  ring.triggerAttackRelease(0.38, 0.03, hitVelocity(params, 0.8));
}

function buildWobbleScrape(params) {
  const output = createOutput(params);
  const bright = params.brightness;

  const scrapeFilter = new Tone.Filter({
    frequency: 1650 * bright,
    type: "bandpass",
    Q: 1.8,
  }).connect(output);
  scrapeFilter.frequency.setValueAtTime(980 * bright, 0);
  scrapeFilter.frequency.linearRampToValueAtTime(2200 * bright, 0.72);
  scrapeFilter.frequency.linearRampToValueAtTime(1200 * bright, 1.42);

  const scrape = new Tone.NoiseSynth({
    volume: -13,
    noise: { type: "brown" },
    envelope: {
      attack: 0.035,
      decay: 0.2,
      sustain: 0.72,
      release: 0.12,
    },
  }).connect(scrapeFilter);
  scrape.triggerAttack(0, hitVelocity(params, 0.8));
  scrape.triggerRelease(1.38);

  const wobble = new Tone.AMOscillator({
    frequency: 92,
    type: "sine",
    modulationType: "sine",
    harmonicity: 0.075,
    volume: -20,
  }).connect(output);
  wobble.start(0).stop(1.5);
}

function buildSpinOut(params) {
  const output = createOutput(params);
  const bright = params.brightness;

  const motor = new Tone.FMOscillator({
    frequency: 186,
    type: "sine",
    modulationType: "triangle",
    harmonicity: 1.5,
    modulationIndex: 2.2 * bright,
    volume: -13,
  }).connect(output);
  motor.frequency.setValueAtTime(186, 0);
  motor.frequency.exponentialRampToValueAtTime(24, 1.7);
  motor.volume.setValueAtTime(-13, 0);
  motor.volume.linearRampToValueAtTime(-30, 1.72);
  motor.start(0).stop(1.75);

  const finalTap = new Tone.MembraneSynth({
    volume: -13,
    pitchDecay: 0.018,
    octaves: 1.4,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
  }).connect(output);
  finalTap.triggerAttackRelease("C2", 0.11, 1.54, hitVelocity(params, 0.52));
}

function buildRingOut(params) {
  const output = createOutput(params);
  const bright = params.brightness;

  const impact = new Tone.MembraneSynth({
    volume: -7,
    pitchDecay: 0.075,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
  }).connect(output);
  impact.triggerAttackRelease("F1", 0.28, 0.025, hitVelocity(params));

  createNoiseSweep(output, {
    time: 0.06,
    decay: 0.52,
    fromFrequency: 2600 * bright,
    toFrequency: 540 * bright,
    q: 0.7,
    volume: -15,
    velocity: hitVelocity(params, 0.78),
  });

  const rail = new Tone.MetalSynth({
    volume: -11,
    frequency: 130 * bright,
    envelope: { attack: 0.001, decay: 0.65, release: 0.05 },
    harmonicity: 5.4,
    modulationIndex: 20,
    resonance: 1900 * bright,
    octaves: 2,
  }).connect(output);
  rail.triggerAttackRelease(0.62, 0.035, hitVelocity(params, 0.8));
}

function buildPartBreak(params) {
  const output = createOutput(params);
  const bright = params.brightness;

  createNoiseSweep(output, {
    time: 0.02,
    decay: 0.24,
    fromFrequency: 6200 * bright,
    toFrequency: 900 * bright,
    q: 0.8,
    volume: -7,
    velocity: hitVelocity(params, 1.08),
  });

  [0.025, 0.12, 0.21, 0.34].forEach((time, index) => {
    const shard = new Tone.MetalSynth({
      volume: -12,
      frequency: (230 + index * 58) * bright,
      envelope: { attack: 0.001, decay: 0.24, release: 0.02 },
      harmonicity: 6.2,
      modulationIndex: 24,
      resonance: 3600 * bright,
      octaves: 2.2,
    }).connect(output);
    shard.triggerAttackRelease(
      0.18,
      time,
      hitVelocity(params, 0.9 - index * 0.12),
    );
  });

  const body = new Tone.MembraneSynth({
    volume: -9,
    pitchDecay: 0.045,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.28, sustain: 0 },
  }).connect(output);
  body.triggerAttackRelease("A1", 0.25, 0.03, hitVelocity(params, 0.9));
}

function buildUiSelect(params) {
  const output = createOutput(params);
  [
    ["E6", 0.06, 0.015, 0.45],
    ["B6", 0.045, 0.072, 0.32],
  ].forEach(([note, duration, time, velocity]) => {
    const synth = new Tone.Synth({
      volume: -14,
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.055, sustain: 0, release: 0.02 },
    }).connect(output);
    synth.triggerAttackRelease(
      note,
      duration,
      time,
      hitVelocity(params, velocity),
    );
  });
}

function buildReward(params) {
  const output = createOutput(params);
  const synth = new Tone.PolySynth(Tone.Synth, {
    volume: -13,
    oscillator: { type: "triangle" },
    envelope: {
      attack: 0.004,
      decay: 0.12,
      sustain: 0.08,
      release: 0.18,
    },
  }).connect(output);
  [
    ["C5", 0.02],
    ["E5", 0.13],
    ["G5", 0.24],
    [["C6", "E6"], 0.38],
  ].forEach(([note, time], index) => {
    synth.triggerAttackRelease(
      note,
      index === 3 ? 0.34 : 0.18,
      time,
      hitVelocity(params, index === 3 ? 0.6 : 0.45),
    );
  });
}

const sounds = [
  {
    id: "launcher_pull_release",
    name: "拉绳发射",
    description: "拉绳摩擦、卡扣释放与陀螺落地的三层瞬态。",
    duration: 1.1,
    build: buildLauncher,
  },
  {
    id: "spin_loop_fast",
    name: "高速旋转循环",
    description: "可循环的转子基频，后续在 Godot 中随转速调整音高。",
    duration: 2,
    build: buildSpinLoop,
  },
  {
    id: "collision_light",
    name: "轻碰撞",
    description: "适用于低冲量擦碰，短促且不过度抢占听觉空间。",
    duration: 0.45,
    build: buildLightCollision,
  },
  {
    id: "collision_heavy",
    name: "重碰撞",
    description: "低频冲击、塑料爆点和金属余振的叠加。",
    duration: 0.9,
    build: buildHeavyCollision,
  },
  {
    id: "wobble_scrape",
    name: "失衡刮擦",
    description: "轴尖倾斜后与场地摩擦，适合按倾角淡入。",
    duration: 1.6,
    build: buildWobbleScrape,
  },
  {
    id: "spin_out",
    name: "停转",
    description: "转速快速下落并以轻触地面结束。",
    duration: 1.85,
    build: buildSpinOut,
  },
  {
    id: "ring_out",
    name: "撞飞出界",
    description: "边缘撞击、短促风噪和护栏金属余振。",
    duration: 1.1,
    build: buildRingOut,
  },
  {
    id: "part_break",
    name: "部件破坏",
    description: "主体冲击后接多段碎片散落声。",
    duration: 1.05,
    build: buildPartBreak,
  },
  {
    id: "ui_select",
    name: "零件选择",
    description: "用于组装界面的轻量双音确认。",
    duration: 0.24,
    build: buildUiSelect,
  },
  {
    id: "reward",
    name: "奖励结算",
    description: "四段简短上行音型，不遮挡战斗结算信息。",
    duration: 1,
    build: buildReward,
  },
];

document.querySelector("#app").innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">SPIN / CORE · AUDIO LAB</p>
        <h1>战斗陀螺音效实验室</h1>
        <p class="subtitle">Tone.js 程序化合成 · 48 kHz / 16-bit WAV。先确定声音语言，再由 Godot 根据转速、冲量和倾角动态驱动。</p>
      </div>
      <button class="primary" id="export-all">导出第一批 WAV</button>
    </header>

    <section class="controls" aria-label="全局声音参数">
      <label class="control">
        <span class="control-head"><span>机械力度</span><output id="intensity-value">100%</output></span>
        <input id="intensity" type="range" min="70" max="130" value="100" step="1">
      </label>
      <label class="control">
        <span class="control-head"><span>金属亮度</span><output id="brightness-value">100%</output></span>
        <input id="brightness" type="range" min="70" max="130" value="100" step="1">
      </label>
      <label class="control">
        <span class="control-head"><span>输出音量</span><output id="volume-value">-3 dB</output></span>
        <input id="volume" type="range" min="-12" max="0" value="-3" step="1">
      </label>
    </section>

    <p class="status" id="status" role="status">点击试听时浏览器会首次启用音频上下文。</p>

    <section class="sound-grid">
      ${sounds
        .map(
          (sound, index) => `
            <article class="sound-card">
              <div>
                <span class="sound-index">SFX ${String(index + 1).padStart(2, "0")}</span>
                <h2>${sound.name}</h2>
                <p>${sound.description}</p>
                <span class="duration">${sound.id}.wav · ${sound.duration.toFixed(2)} s</span>
              </div>
              <div class="card-actions">
                <button class="preview-button" data-preview="${sound.id}">试听</button>
                <button class="export-button" data-export="${sound.id}" aria-label="导出 ${sound.name}">WAV</button>
              </div>
            </article>
          `,
        )
        .join("")}
    </section>

    <p class="footer-note">说明：旋转循环采用确定性谐波，避免循环边界产生明显爆音。碰撞声在游戏中应按冲量随机选择轻/重层并轻微随机音高，避免连续撞击完全相同。</p>
  </main>
`;

const statusElement = document.querySelector("#status");
const parameterInputs = {
  intensity: document.querySelector("#intensity"),
  brightness: document.querySelector("#brightness"),
  volume: document.querySelector("#volume"),
};

function getParameters() {
  return {
    intensity: Number(parameterInputs.intensity.value) / 100,
    brightness: Number(parameterInputs.brightness.value) / 100,
    volumeDb: Number(parameterInputs.volume.value),
  };
}

function getCacheKey(sound, params) {
  return `${sound.id}:${params.intensity}:${params.brightness}:${params.volumeDb}`;
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.style.color = isError ? "#ff8f84" : "";
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = value;
  });
}

async function renderSound(sound, params) {
  const cacheKey = getCacheKey(sound, params);
  if (renderCache.has(cacheKey)) {
    return renderCache.get(cacheKey);
  }

  const buffer = await Tone.Offline(
    () => sound.build(params),
    sound.duration,
    2,
    SAMPLE_RATE,
  );
  renderCache.set(cacheKey, buffer);
  return buffer;
}

async function previewSound(sound) {
  if (busy) return;
  setBusy(true);
  setStatus(`正在生成：${sound.name}`);
  try {
    await Tone.start();
    if (activePlayer) {
      activePlayer.stop();
      activePlayer.dispose();
    }
    const buffer = await renderSound(sound, getParameters());
    activePlayer = new Tone.Player(buffer).toDestination();
    activePlayer.start();
    setStatus(`正在试听：${sound.name}`);
  } catch (error) {
    console.error(error);
    setStatus(`生成失败：${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodeWav(toneBuffer, options = {}) {
  const audioBuffer = toneBuffer.get();
  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = audioBuffer.length * blockAlign;
  const wav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wav);
  const channelData = Array.from({ length: channels }, (_, index) =>
    audioBuffer.getChannelData(index),
  );

  let peak = 0;
  channelData.forEach((channel) => {
    for (let index = 0; index < channel.length; index += 1) {
      peak = Math.max(peak, Math.abs(channel[index]));
    }
  });
  const normalization = peak > 0 ? Math.min(0.92 / peak, 4) : 1;
  const edgeFadeFrames = Math.floor(
    audioBuffer.sampleRate * (options.edgeFadeSeconds ?? 0),
  );

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < audioBuffer.length; frame += 1) {
    let edgeGain = 1;
    if (edgeFadeFrames > 0 && frame < edgeFadeFrames) {
      const progress = frame / edgeFadeFrames;
      edgeGain = Math.sin(progress * Math.PI * 0.5) ** 2;
    } else if (
      edgeFadeFrames > 0 &&
      frame >= audioBuffer.length - edgeFadeFrames
    ) {
      const progress = (audioBuffer.length - 1 - frame) / edgeFadeFrames;
      edgeGain = Math.sin(progress * Math.PI * 0.5) ** 2;
    }
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = clamp(
        channelData[channel][frame] * normalization * edgeGain,
        -1,
        1,
      );
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += bytesPerSample;
    }
  }

  return new Blob([wav], { type: "audio/wav" });
}

function getWavOptions(sound) {
  return {
    edgeFadeSeconds: sound.id === "spin_loop_fast" ? 0.004 : 0,
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportSound(sound) {
  if (busy) return;
  setBusy(true);
  setStatus(`正在导出：${sound.name}`);
  try {
    const buffer = await renderSound(sound, getParameters());
    downloadBlob(encodeWav(buffer, getWavOptions(sound)), `${sound.id}.wav`);
    setStatus(`已导出：${sound.id}.wav`);
  } catch (error) {
    console.error(error);
    setStatus(`导出失败：${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

async function exportAll() {
  if (busy) return;
  setBusy(true);
  const zip = new JSZip();
  const params = getParameters();
  try {
    for (let index = 0; index < sounds.length; index += 1) {
      const sound = sounds[index];
      setStatus(`正在生成 ${index + 1}/${sounds.length}：${sound.name}`);
      const buffer = await renderSound(sound, params);
      zip.file(
        `${sound.id}.wav`,
        encodeWav(buffer, getWavOptions(sound)),
      );
    }
    zip.file(
      "README.txt",
      [
        "战斗陀螺 Tone.js 第一批音效",
        `采样率：${SAMPLE_RATE} Hz`,
        "格式：16-bit PCM WAV / stereo",
        `机械力度：${Math.round(params.intensity * 100)}%`,
        `金属亮度：${Math.round(params.brightness * 100)}%`,
        `输出音量：${params.volumeDb} dB`,
        "spin_loop_fast.wav：4 ms 余弦边缘淡化，Godot 中启用正向循环",
        "",
        ...sounds.map((sound) => `${sound.id}.wav - ${sound.name}`),
      ].join("\r\n"),
    );
    const archive = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    downloadBlob(archive, "beyblade_sfx_batch_01.zip");
    setStatus("第一批音效已导出，共 10 个 WAV。");
  } catch (error) {
    console.error(error);
    setStatus(`整批导出失败：${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

Object.entries(parameterInputs).forEach(([name, input]) => {
  const output = document.querySelector(`#${name}-value`);
  input.addEventListener("input", () => {
    output.value =
      name === "volume" ? `${input.value} dB` : `${input.value}%`;
    renderCache.clear();
  });
});

document.querySelectorAll("[data-preview]").forEach((button) => {
  button.addEventListener("click", () => {
    previewSound(sounds.find((sound) => sound.id === button.dataset.preview));
  });
});

document.querySelectorAll("[data-export]").forEach((button) => {
  button.addEventListener("click", () => {
    exportSound(sounds.find((sound) => sound.id === button.dataset.export));
  });
});

document.querySelector("#export-all").addEventListener("click", exportAll);
