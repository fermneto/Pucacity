import { describe, expect, it } from 'vitest';
import { RoadGraph } from '../../src/core/RoadGraph';
import { nearestEdge, nearestNode, pointSegmentDistance } from '../../src/core/Spatial';
import { tinyCity } from './fixtures';

describe('Spatial', () => {
  it('pointSegmentDistance: projeção dentro, antes e depois do segmento', () => {
    expect(pointSegmentDistance(5, 3, 0, 0, 10, 0)).toBeCloseTo(3);
    expect(pointSegmentDistance(-3, 4, 0, 0, 10, 0)).toBeCloseTo(5);
    expect(pointSegmentDistance(13, 4, 0, 0, 10, 0)).toBeCloseTo(5);
    expect(pointSegmentDistance(1, 1, 2, 2, 2, 2)).toBeCloseTo(Math.SQRT2);
  });

  const g = new RoadGraph(tinyCity());

  it('nearestNode respeita maxDist', () => {
    expect(g.node(nearestNode(g, 9, 1)!.index).id).toBe(2);
    expect(nearestNode(g, 5, 5, 1)).toBeNull();
  });

  it('nearestEdge acha a via sob o cursor', () => {
    const hit = nearestEdge(g, 5, 9.5)!; // perto de 3—4
    expect(g.edge(hit.index).cityEdgeId).toBe(13);
    expect(hit.dist).toBeCloseTo(0.5);
  });
});
