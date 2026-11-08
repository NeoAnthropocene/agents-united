import test from 'node:test';
import assert from 'node:assert/strict';
import { createBottle } from '../registry/skills/threejs-scene-production/examples/create-bottle.mjs';
test('original bottle fixture is deterministic GLB with indexed geometry and recorded PBR material',()=>{const first=createBottle(),second=createBottle();assert.deepEqual(first,second);assert.equal(first.toString('ascii',0,4),'glTF');assert.equal(first.readUInt32LE(8),first.length);const json=JSON.parse(first.toString('utf8',20,20+first.readUInt32LE(12)).trim());assert.equal(json.asset.version,'2.0');assert.equal(json.scene,0);assert.ok(json.meshes[0].primitives[0].indices>=0);assert.ok(json.accessors[0].count>100);assert.equal(json.materials[0].name,'Original jade ceramic');assert.equal(json.buffers[0].byteLength,first.readUInt32LE(20+first.readUInt32LE(12)));});

test('brass covers the cap sides and top while the bottle and neck remain jade', () => {
  const glb = createBottle();
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength).trim());
  const binaryStart = 28 + jsonLength;
  const triangles = json.meshes[0].primitives.flatMap(primitive => {
    const positions = json.accessors[primitive.attributes.POSITION];
    const positionStart = binaryStart + (json.bufferViews[positions.bufferView].byteOffset ?? 0) + (positions.byteOffset ?? 0);
    const indices = json.accessors[primitive.indices];
    const indexStart = binaryStart + (json.bufferViews[indices.bufferView].byteOffset ?? 0) + (indices.byteOffset ?? 0);
    assert.equal(indices.componentType, 5123);
    return Array.from({ length: indices.count / 3 }, (_, triangle) => {
      const ys = Array.from({ length: 3 }, (_, vertex) => {
        const index = glb.readUInt16LE(indexStart + (triangle * 3 + vertex) * 2);
        return glb.readFloatLE(positionStart + index * 12 + 4);
      });
      return { material: json.materials[primitive.material].name, minY: Math.min(...ys), maxY: Math.max(...ys) };
    });
  });
  const capBase = 2.05;
  const tolerance = 1e-6;
  const cap = triangles.filter(triangle => triangle.minY >= capBase - tolerance);
  assert.ok(cap.some(triangle => triangle.maxY - triangle.minY > tolerance), 'the cap must have side faces');
  for (const triangle of cap) assert.equal(triangle.material, 'Original brushed brass cap', 'all cap faces must be brass');
  for (const triangle of triangles.filter(triangle => triangle.minY < capBase - tolerance)) {
    assert.equal(triangle.material, 'Original jade ceramic', 'body and neck must remain jade');
  }
  assert.equal(triangles.length, 960, 'the material fix must preserve the geometry');
});
