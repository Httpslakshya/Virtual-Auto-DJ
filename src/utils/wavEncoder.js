// 16-bit Stereo PCM WAV Encoder for OfflineAudioContext rendered AudioBuffers

export function audioBufferToWavBlob(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const left = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;

  const length = left.length * numChannels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  // Write WAV Header
  // "RIFF"
  writeString(view, 0, 'RIFF');
  // file length - 8
  view.setUint32(4, 36 + length, true);
  // "WAVE"
  writeString(view, 8, 'WAVE');
  // "fmt " chunk
  writeString(view, 12, 'fmt ');
  // chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * numChannels * bytesPerSample)
  view.setUint32(28, sampleRate * numChannels * 2, true);
  // block align (numChannels * bytesPerSample)
  view.setUint16(32, numChannels * 2, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // "data" chunk
  writeString(view, 36, 'data');
  // data length
  view.setUint32(40, length, true);

  // Write interleaved PCM samples (clamped to [-1.0, 1.0])
  let offset = 44;
  for (let i = 0; i < left.length; i++) {
    // Left channel
    let sampleL = Math.max(-1, Math.min(1, left[i]));
    view.setInt16(offset, sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7fff, true);
    offset += 2;

    // Right channel
    if (numChannels > 1) {
      let sampleR = Math.max(-1, Math.min(1, right[i]));
      view.setInt16(offset, sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
