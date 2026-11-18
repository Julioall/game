export class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.pending = [];
    this.samples = [];
    this.serial = 0;
    this.frame = 0;
  }
  begin() {
    if (!this.extension || ++this.frame % 4) return;
    const gl = this.gl;
    if (gl.getParameter(this.extension.GPU_DISJOINT_EXT)) {
      for (const query of this.pending) gl.deleteQuery(query);
      this.pending.length = 0;
      this.samples.length = 0;
      return;
    }
    while (this.pending.length && gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const query = this.pending.shift();
      const ms = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(query);
      if (Number.isFinite(ms) && ms > 0) {
        this.samples.push(ms);
        this.lastSampleMs = ms;
        if (this.samples.length > 64) this.samples.shift();
        this.serial++;
      }
    }
    if (this.pending.length >= 4) return;
    this.active = gl.createQuery();
    gl.beginQuery(this.extension.TIME_ELAPSED_EXT, this.active);
  }
  end() {
    if (!this.active) return;
    this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }
  average() {
    return this.samples.length ? this.samples.reduce((a, b) => a + b, 0) / this.samples.length : null;
  }
  dispose() {
    if (this.active) this.end();
    for (const query of this.pending) this.gl.deleteQuery(query);
    this.pending.length = 0;
  }
}

export class GpuDensityBudget {
  constructor() { this.cap = 1.5; this.lastSerial = 0; this.observations = 0; }
  observe(gpuMs, cpuMs, serial, stable) {
    if (!stable || gpuMs === null) { this.observations = 0; this.lastSerial = serial; return false; }
    if (serial === this.lastSerial) return false;
    this.lastSerial = serial;
    if (++this.observations < 30) return false;
    this.observations = 0;
    const previous = this.cap;
    if (gpuMs > 7 && gpuMs > cpuMs * 1.15) this.cap = Math.max(1.25, this.cap - 1 / 12);
    else if (gpuMs < 4.5) this.cap = Math.min(1.5, this.cap + 1 / 12);
    return previous !== this.cap;
  }
}
