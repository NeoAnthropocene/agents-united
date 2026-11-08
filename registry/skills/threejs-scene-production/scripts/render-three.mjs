import path from "node:path";
import { render } from "./shared-3d-runtime.mjs";
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: node render-three.mjs --project <absolute-project> --asset <relative-glb> --output-dir <relative-directory> --out <relative-receipt> --width <pixels> --height <pixels> --fps <fps> --start-frame <frame> --frame-count <count> [--rotation <radians-per-second>] [--browser <absolute-executable>] [--deadline-ms <ms>]");
} else {
  try {
    const allowed = ["project", "asset", "output-dir", "out", "width", "height", "fps", "start-frame", "frame-count", "rotation", "browser", "deadline-ms"];
    const opts = {};
    if (args.length % 2) throw Error("Expected option/value pairs");
    for (let i = 0; i < args.length; i += 2) {
      const k = args[i].replace(/^--/, "");
      if (args[i] !== `--${k}` || !allowed.includes(k) || opts[k] !== void 0) throw Error("Invalid option");
      opts[k] = args[i + 1];
    }
    for (const key of ["project", "asset", "output-dir", "out", "width", "height", "fps", "start-frame", "frame-count"]) if (!opts[key]) throw Error(`Missing --${key}`);
    if (!path.isAbsolute(opts.project) || opts.browser && !path.isAbsolute(opts.browser)) throw Error("Project and browser must be absolute");
    const result = await render({ project: opts.project, asset: opts.asset, outputDir: opts["output-dir"], out: opts.out, width: Number(opts.width), height: Number(opts.height), fps: Number(opts.fps), startFrame: Number(opts["start-frame"]), frameCount: Number(opts["frame-count"]), rotationRadiansPerSecond: opts.rotation === void 0 ? 0 : Number(opts.rotation), browser: opts.browser, deadlineMs: opts["deadline-ms"] === void 0 ? void 0 : Number(opts["deadline-ms"]) });
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
