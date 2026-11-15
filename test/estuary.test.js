import test from 'node:test';
import assert from 'node:assert/strict';
import { carveEstuary } from '../src/world/terrain/water-flow.js';
test('final estuary pass cuts a continuous deep corridor across a sand barrier', () => {
 const stride = 101, n = stride ** 2;
 const world = {stride, ground:new Float32Array(n).fill(.3), surface:new Float32Array(n), wet:new Float32Array(n).fill(-1), waterKind:new Uint8Array(n)};
 const mouth = {x:50,z:50,dx:1,dz:0,kind:1,level:0,width:3,length:30};
 carveEstuary(world,mouth);
 for(let x=40;x<=70;x++) {const i=50*stride+x;assert.ok(world.ground[i]<-2);assert.ok(world.wet[i]>0);assert.equal(world.surface[i],0);}
 assert.equal(world.ground[65*stride+50],Math.fround(.3));
});
