// Bounded measurement window. No allocations on individual render frames,
// apart from the fixed-size sample arrays during their initial fill.
export class FrameMetrics {
  constructor(capacity = 360) {
    this.capacity = capacity;
    this.frames = new Float32Array(capacity);
    this.cpu = new Float32Array(capacity);
    this.gpu = new Float32Array(capacity);
    this.samples = 0;
    this.cursor = 0;
    this.gpuSamples = 0;
    this.gpuCursor = 0;
    this.longFrames = 0;
    this.heapBytes = null;
  }
  record(frameSeconds, cpuMs, gpuMs = null, heapBytes = null) {
    if (!Number.isFinite(frameSeconds) || frameSeconds <= 0) return;
    const frameMs = frameSeconds * 1000;
    if (frameMs > 50) this.longFrames++;
    this.frames[this.cursor] = frameMs;
    this.cpu[this.cursor] = Number.isFinite(cpuMs) ? cpuMs : 0;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.samples = Math.min(this.capacity, this.samples + 1);
    if (Number.isFinite(gpuMs) && gpuMs > 0) {
      this.gpu[this.gpuCursor] = gpuMs;
      this.gpuCursor = (this.gpuCursor + 1) % this.capacity;
      this.gpuSamples = Math.min(this.capacity, this.gpuSamples + 1);
    }
    if (Number.isFinite(heapBytes)) this.heapBytes = heapBytes;
  }
  snapshot() {
    const percentile = (buffer, count, fraction) => {
      if (!count) return null;
      const sorted = Array.from(buffer.subarray(0, count)).sort((a, b) => a - b);
      return sorted[Math.min(count - 1, Math.ceil(count * fraction) - 1)];
    };
    let sum = 0, cpuSum = 0;
    for (let i = 0; i < this.samples; i++) {
      sum += this.frames[i]; cpuSum += this.cpu[i];
    }
    return {
      frameSamples: this.samples,
      fpsAverage: sum > 0 ? this.samples * 1000 / sum : null,
      frameP95Ms: percentile(this.frames, this.samples, .95),
      frameWorstMs: percentile(this.frames, this.samples, 1),
      renderCpuAverageMs: this.samples ? cpuSum / this.samples : null,
      gpuP95Ms: percentile(this.gpu, this.gpuSamples, .95),
      gpuSamples: this.gpuSamples,
      longFrames: this.longFrames,
      jsHeapBytes: this.heapBytes
    };
  }
}
