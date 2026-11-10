import { configuration, generate } from './generate.js';

self.onmessage = ({ data }) => {
  try {
    const config = configuration(data);
    const compact = config.size > 768;
    const world = generate(config, { compact, onProgress: compact ? progress => self.postMessage({ progress }) : undefined });
    const transfer = [...new Set(Object.values(world).filter(ArrayBuffer.isView).map(value => value.buffer))];
    self.postMessage({ world }, transfer);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
