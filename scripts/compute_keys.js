import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const playlistPath = path.join(__dirname, '..', 'public', 'playlist.json');
const srcPlaylistPath = path.join(__dirname, '..', 'src', 'data', 'playlist.json');

const raw = JSON.parse(fs.readFileSync(playlistPath, 'utf8'));
const tracks = raw.tracks || raw;

// Decode 30s slice from second 20 to 50 using ffmpeg
function decodeSlice(filePath, sampleRate = 11025) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-ss', '20',
      '-t', '30',
      '-i', filePath,
      '-f', 'f32le',
      '-acodec', 'pcm_f32le',
      '-ac', '1',
      '-ar', String(sampleRate),
      '-'
    ]);

    const chunks = [];
    ffmpeg.stdout.on('data', chunk => chunks.push(chunk));
    ffmpeg.stderr.on('data', () => {});
    ffmpeg.on('close', code => {
      if (code !== 0 && chunks.length === 0) {
        return reject(new Error(`ffmpeg exited with code ${code}`));
      }
      const buffer = Buffer.concat(chunks);
      const floatArray = new Float32Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength / 4
      );
      resolve({ floatArray, sampleRate });
    });
    ffmpeg.on('error', reject);
  });
}

// Goertzel power calculation
function goertzelEnergy(samples, targetFreq, sampleRate) {
  const k = Math.round((samples.length * targetFreq) / sampleRate);
  const omega = (2 * Math.PI * k) / samples.length;
  const coeff = 2 * Math.cos(omega);

  let q0 = 0;
  let q1 = 0;
  let q2 = 0;

  for (let i = 0; i < samples.length; i++) {
    q0 = coeff * q1 - q2 + samples[i];
    q2 = q1;
    q1 = q0;
  }

  return q1 * q1 + q2 * q2 - q1 * q2 * coeff;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CAMELOT_MAP = {
  'C_maj': '8B', 'C_min': '5A',
  'C#_maj': '3B', 'C#_min': '12A',
  'D_maj': '10B', 'D_min': '7A',
  'D#_maj': '5B', 'D#_min': '2A',
  'E_maj': '12B', 'E_min': '9A',
  'F_maj': '7B', 'F_min': '4A',
  'F#_maj': '2B', 'F#_min': '11A',
  'G_maj': '9B', 'G_min': '6A',
  'G#_maj': '4B', 'G#_min': '1A',
  'A_maj': '11B', 'A_min': '8A',
  'A#_maj': '6B', 'A#_min': '3A',
  'B_maj': '1B', 'B_min': '10A'
};

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function pearsonCorrelation(x, y) {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return denominator === 0 ? 0 : numerator / denominator;
}

function detectKey(samples, sampleRate) {
  // Downsample/slice 8192 samples around center
  const hop = Math.max(1, Math.floor(samples.length / 16384));
  const subSamples = [];
  for (let i = 0; i < samples.length; i += hop) {
    subSamples.push(samples[i]);
  }
  const pcm = new Float32Array(subSamples);
  const actualSr = sampleRate / hop;

  const chroma = new Array(12).fill(0);

  // Compute energy for octaves 2 to 5 (MIDI notes 36 to 83)
  for (let midi = 36; midi <= 83; midi++) {
    const pitchClass = midi % 12;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    if (freq < actualSr / 2) {
      const e = goertzelEnergy(pcm, freq, actualSr);
      chroma[pitchClass] += Math.sqrt(Math.max(0, e));
    }
  }

  // Normalize chroma
  const maxChroma = Math.max(...chroma, 1e-6);
  const normChroma = chroma.map(v => v / maxChroma);

  let bestScore = -999;
  let bestKey = 'C';
  let bestMode = 'maj';

  for (let root = 0; root < 12; root++) {
    const rotMaj = [];
    const rotMin = [];
    for (let i = 0; i < 12; i++) {
      rotMaj.push(MAJOR_PROFILE[(i - root + 12) % 12]);
      rotMin.push(MINOR_PROFILE[(i - root + 12) % 12]);
    }

    const rMaj = pearsonCorrelation(normChroma, rotMaj);
    if (rMaj > bestScore) {
      bestScore = rMaj;
      bestKey = NOTE_NAMES[root];
      bestMode = 'maj';
    }

    const rMin = pearsonCorrelation(normChroma, rotMin);
    if (rMin > bestScore) {
      bestScore = rMin;
      bestKey = NOTE_NAMES[root];
      bestMode = 'min';
    }
  }

  const keyKey = `${bestKey}_${bestMode}`;
  const camelot = CAMELOT_MAP[keyKey] || '8A';
  const displayKey = bestMode === 'min' ? `${bestKey}m` : bestKey;

  return { key: displayKey, camelot };
}

async function run() {
  console.log(`Starting Key & Camelot detection for ${tracks.length} tracks...`);

  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    const audioPath = path.join(__dirname, '..', 'public', t.audioUrl);
    try {
      const { floatArray, sampleRate } = await decodeSlice(audioPath, 11025);
      const res = detectKey(floatArray, sampleRate);
      t.key = res.key;
      t.camelot = res.camelot;
      console.log(`[${i + 1}/${tracks.length}] ${t.title} -> Key: ${t.key}, Camelot: ${t.camelot}`);
    } catch (e) {
      // Fallback
      t.key = 'Am';
      t.camelot = '8A';
      console.warn(`[${i + 1}/${tracks.length}] Failed for ${t.title}: ${e.message}`);
    }
  }

  if (raw.tracks) {
    raw.tracks = tracks;
    fs.writeFileSync(playlistPath, JSON.stringify(raw, null, 2), 'utf8');
    fs.writeFileSync(srcPlaylistPath, JSON.stringify(raw, null, 2), 'utf8');
  } else {
    fs.writeFileSync(playlistPath, JSON.stringify(tracks, null, 2), 'utf8');
    fs.writeFileSync(srcPlaylistPath, JSON.stringify(tracks, null, 2), 'utf8');
  }

  console.log(`Done! Updated playlist.json with harmonic keys and Camelot codes.`);
}

run();
