// Presentation-only distance to sea: preserves terrain generation and save identity.
export function seaBeachDistance(world) {
  const {stride}=world, length=stride*stride;
  const distance=new Uint8Array(length).fill(255),queue=new Int32Array(length);
  let tail=0;
  for(let i=0;i<length;i++)if(world.waterKind.at(i)===1 && world.wet.at(i)>0){distance[i]=0;queue[tail++]=i;}
  for(let head=0;head<tail;head++){
    const i=queue[head],d=distance[i];if(d>=14)continue;
    const x=i%stride,z=Math.floor(i/stride);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,nz=z+dz,j=nz*stride+nx;
      if(nx<0||nz<0||nx>=stride||nz>=stride||distance[j]!==255)continue;
      distance[j]=d+1;queue[tail++]=j;
    }
  }
  return {at:i=>distance[i]};
}

// Offshore distance to dry land, on a two-metre presentation grid. Chamfer
// sweeps approximate Euclidean distance without a full-resolution float grid.
export function seaShoreDistance(world) {
  const step = 2, size = world.config.size, side = Math.ceil(size / step) + 1;
  const distance = new Uint16Array(side * side).fill(1280);
  for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) {
    const px = Math.min(size, x * step), pz = Math.min(size, z * step), i = pz * world.stride + px;
    if (world.wet.at(i) <= 0 && world.ground.at(i) >= 0) distance[z * side + x] = 0;
  }
  for (const reverse of [false, true]) {
    const start = reverse ? side - 1 : 0, end = reverse ? -1 : side, dir = reverse ? -1 : 1;
    const neighbors = [[-dir,0,20],[0,-dir,20],[-dir,-dir,28],[dir,-dir,28]];
    for (let z = start; z !== end; z += dir) for (let x = start; x !== end; x += dir) {
      const i = z * side + x;
      let d = distance[i];
      for (const [dx,dz,cost] of neighbors) {
        const nx = x + dx, nz = z + dz;
        if (nx >= 0 && nz >= 0 && nx < side && nz < side) d = Math.min(d, distance[nz * side + nx] + cost);
      }
      distance[i] = d;
    }
  }
  return Object.freeze({ bytes: distance.byteLength, sample(x,z) {
    if (x < 0 || z < 0 || x > size || z > size) return 128;
    const gx = Math.min(side - 2, Math.floor(x / step)), gz = Math.min(side - 2, Math.floor(z / step));
    const u = (x - gx * step) / Math.min(step, size - gx * step);
    const v = (z - gz * step) / Math.min(step, size - gz * step);
    const a = distance[gz * side + gx] * (1-u) + distance[gz * side + gx+1] * u;
    const b = distance[(gz+1) * side + gx] * (1-u) + distance[(gz+1) * side + gx+1] * u;
    return (a * (1-v) + b * v) * .1;
  } });
}
