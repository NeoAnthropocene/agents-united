import { mkdir, realpath, lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contained, defaultPreferences, parseFlags, projectRoot, readInput, resultReport, validatePreferences } from '../../audiovisual-review/scripts/review.mjs';

// Both Skills ship together. Never reads .env, installs, invokes a provider or replaces preferences.
async function main(args) {
  const errors = [];
  const [command, ...rest] = args;
  if (command === '--help') return resultReport([], { help: 'project.mjs init --project absolute-root --renderer native|remotion --audio local|api|hybrid --generated-footage yes|no --budget-usd amount; or init --project absolute-root --preferences file.json; or status --project absolute-root. init creates media/project.json once. Selected providers/custom output use --preferences. No setup, authentication or generation occurs.' });
  const allowed = command === 'status' ? ['--project'] : ['--project', '--renderer', '--audio', '--generated-footage', '--budget-usd', '--preferences'];
  const options = parseFlags(rest, allowed, errors);
  if (!['init', 'status'].includes(command) || !options['--project']) errors.push({ code: 'cli.arguments', path: 'arguments', message: 'Use init or status with an absolute --project; see --help.' });
  if (errors.length) return resultReport(errors);
  const root = await projectRoot(options['--project'], errors);
  if (errors.length) return resultReport(errors);
  let preferences;
  if (command === 'init') {
    if (options['--preferences']) {
      if (Object.keys(options).some(key => !['--project', '--preferences'].includes(key))) errors.push({ code: 'cli.arguments', path: 'arguments', message: 'Do not combine --preferences with individual preference flags.' });
      if (!errors.length) preferences = await readInput(options['--preferences'], 'json', errors, 'preferences');
    } else {
      if (['--renderer', '--audio', '--generated-footage', '--budget-usd'].some(flag => options[flag] === undefined)) errors.push({ code: 'cli.arguments', path: 'arguments', message: 'Initial renderer, audio route, footage choice and spend ceiling must be explicit.' });
      preferences = defaultPreferences(options['--renderer'], options['--audio'], options['--generated-footage'] === 'yes' ? true : options['--generated-footage'] === 'no' ? false : undefined,
        typeof options['--budget-usd'] === 'string' && options['--budget-usd'].trim() ? Number(options['--budget-usd']) : NaN);
    }
    if (!errors.length) errors.push(...validatePreferences(preferences));
    if (errors.length) return resultReport(errors);
  }
  const media = path.join(root, 'media');
  try {
    const existing = await lstat(media).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (existing && !contained(root, await realpath(media))) return resultReport([{ code: 'file.outsideProject', path: 'media', message: 'The media directory resolves outside the selected project.' }]);
    if (!existing && command === 'init') await mkdir(media);
    if (existing && !(await lstat(await realpath(media))).isDirectory()) return resultReport([{ code: 'project.directory', path: 'media', message: 'media must be a directory.' }]);
  } catch { return resultReport([{ code: 'project.directory', path: 'media', message: 'Cannot safely access the project media directory.' }]); }
  const file = path.join(media, 'project.json');
  if (command === 'status') {
    preferences = await readInput(file, 'json', errors, 'preferences', root);
    if (!errors.length) errors.push(...validatePreferences(preferences));
    return resultReport(errors, errors.length ? {} : { preferences, productionAuthorized: false });
  }
  try {
    // Recheck the parent before exclusive create. Existing files and links are preserved.
    if (!contained(root, await realpath(media))) return resultReport([{ code: 'file.outsideProject', path: 'media', message: 'The media directory moved outside the selected project.' }]);
    await writeFile(file, `${JSON.stringify(preferences, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    return resultReport([], { preferences, written: 'media/project.json', productionAuthorized: false });
  } catch (error) {
    return resultReport([{ code: error.code === 'EEXIST' ? 'project.exists' : 'project.write', path: 'media/project.json', message: error.code === 'EEXIST' ? 'Existing preferences are preserved; use status and explicitly review any desired edit.' : 'Could not create project preferences; existing files were preserved.' }]);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const report = await main(process.argv.slice(2)); console.log(JSON.stringify(report)); process.exitCode = report.ok ? 0 : 2; }
  catch { console.log(JSON.stringify(resultReport([{ code: 'project.internal', path: '$', message: 'Project preference operation could not complete; input contents were not echoed.' }]))); process.exitCode = 2; }
}
