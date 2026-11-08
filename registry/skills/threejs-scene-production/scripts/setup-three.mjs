import path from "node:path";
import { setup } from "./shared-3d-runtime.mjs";
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: node setup-three.mjs --project <absolute-project> --npm-cli <absolute-npm-cli>");
} else {
  try {
    if (args.length !== 4 || args[0] !== "--project" || args[2] !== "--npm-cli" || !path.isAbsolute(args[1]) || !path.isAbsolute(args[3])) throw Error("Use --project <absolute-project> --npm-cli <absolute-npm-cli>");
    const result = await setup(path.join(args[1], "media", "3d-runtime"), args[3]);
    console.log(JSON.stringify(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
