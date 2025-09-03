import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure top-left filler doesn't request extra output pad

test('filler top-left filter chain', (t) => {
  let captured: string[] | undefined;
  const runMod = require('../ffmpeg/run');
  t.mock.method(runMod, 'runFFmpeg', (args: string[]) => { captured = args; });

  const { renderFillerSegment } = require('./filler');
  renderFillerSegment({ duration: 1 }, 'out.mp4', {
    fps: 30,
    videoW: 1920,
    videoH: 1080,
    logoPosition: 'top-left',
    logoPath: 'missing.png',
    fillColor: 'red'
  });

  assert.ok(captured);
  const idx = captured!.indexOf('-filter_complex');
  assert.notEqual(idx, -1);
  const fchain = captured![idx + 1];
  assert.equal(fchain, `[0:v]format=rgba[base];[base]null[v]`);
});
