import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as stock from '../../registry/skills/commercial-stock-sourcer/scripts/fetch-stock.mjs';

// The standalone CLI is valid Node ESM, including its CRLF shebang on Windows.
// Keep these exported-function assertions in the same native loader as the CLI.
test('argument parsing and provider routing', () => {
  const parsed = stock.parseCliArgs(['--query', 'pour over coffee']);
  assert.deepEqual(parsed, {
    query: 'pour over coffee',
    type: 'photo',
    orientation: 'landscape',
    limit: 3,
    output: './assets/stock-candidates',
    provider: 'auto',
  });
  assert.deepEqual(stock.resolveProviderChain('photo', 'auto', { PEXELS_API_KEY: 'px', PIXABAY_API_KEY: 'pb' }), [
    'pexels',
    'pixabay',
    'openverse',
  ]);
  assert.deepEqual(stock.resolveProviderChain('photo', 'auto', {
    UNSPLASH_ACCESS_KEY: 'un',
    PEXELS_API_KEY: 'px',
    PIXABAY_API_KEY: 'pb',
  }), ['unsplash', 'pexels', 'pixabay', 'openverse']);
  assert.deepEqual(stock.resolveProviderChain('photo', 'unsplash', { UNSPLASH_ACCESS_KEY: 'un' }), ['unsplash']);
  assert.deepEqual(stock.resolveProviderChain('photo', 'auto', {}), ['openverse']);
  assert.deepEqual(stock.resolveProviderChain('vector', 'auto', { PIXABAY_API_KEY: 'pb' }), ['pixabay', 'openverse']);
  assert.deepEqual(stock.resolveProviderChain('illustration', 'auto', {}), ['openverse']);
  assert.deepEqual(stock.resolveProviderChain('video', 'auto', { PEXELS_API_KEY: 'px', PIXABAY_API_KEY: 'pb' }), [
    'pexels',
    'pixabay',
  ]);
  assert.deepEqual(stock.resolveProviderChain('video', 'auto', {}), []);
  console.log('STOCK_UNIT_CASE_PASSED: argument parsing and provider routing');
});

test('shoot deduplication, orientation and candidate scoring', () => {
  assert.equal(
    stock.normalizeShootTitle('File:2025-07-05 Pour over coffee shot on Project Indigo camera app 1.jpg'),
    'pour over coffee shot',
  );
  const rolandShoot = [
    { creator: 'roland', title: '2025-07-05 Pour over coffee shot on Project Indigo camera app 1' },
    { creator: 'roland', title: '2025-07-05 Pour over coffee shot on Project Indigo camera app 2' },
    { creator: 'roland', title: '2025-07-05 Pour over coffee shot on Project Indigo camera app 3' },
  ];
  const dedupedStrict = stock.dedupeByCreator(rolandShoot, 3, x => x.creator, {
    getTitle: x => x.title,
    allowBackfill: false,
  });
  assert.equal(dedupedStrict.length, 1);
  assert.equal(stock.matchesOrientation(3849, 2561, 'landscape'), true);
  assert.equal(stock.matchesOrientation(2561, 3849, 'landscape'), false);
  const cc0Hero = stock.scoreCandidate(
    {
      license: 'CC0 / Public Domain (Commercial Safe)',
      width: 3849,
      height: 2561,
      origWidth: 3849,
      title: 'File:Manual drip (pour-over) coffee.jpg',
      creatorUrl: 'https://unsplash.com/@kimsanso',
    },
    { type: 'photo', orientation: 'landscape' },
  );
  const cameraDump = stock.scoreCandidate(
    {
      license: 'CC BY 2.0 (Commercial Safe — Attribution Required)',
      width: 3000,
      height: 4000,
      origWidth: 3000,
      title: '2025-07-05 Pour over coffee shot on Project Indigo camera app',
    },
    { type: 'photo', orientation: 'landscape' },
  );
  const retailPackaging = stock.scoreCandidate(
    {
      license: 'CC0 / Public Domain (Commercial Safe)',
      width: 4000,
      height: 3000,
      origWidth: 4000,
      title: 'File:Cafex anında hazır filtre kahve - drip filter coffee instant product 01.jpg',
    },
    { type: 'photo', orientation: 'landscape' },
  );
  assert.ok(cc0Hero > cameraDump + 100);
  assert.ok(cc0Hero > retailPackaging + 40);
  console.log('STOCK_UNIT_CASE_PASSED: shoot deduplication, orientation and candidate scoring');
});
