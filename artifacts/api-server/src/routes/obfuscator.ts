import { Router, type IRouter } from "express";
import {
  ListObfuscatorPresetsResponse,
  ObfuscateLuaBody,
  ObfuscateLuaResponse,
} from "@workspace/api-zod";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const router: IRouter = Router();
const execFileAsync = promisify(execFile);
const maxSourceBytes = 256 * 1024;
const engineDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../obfuscator-engine",
);
const runnerPath = join(engineDirectory, "run.lua");

const presets = [
  {
    name: "Minify",
    description: "Reprints Lua with whitespace and formatting reduced.",
    luaVersion: "LuaU" as const,
  },
  {
    name: "Weak",
    description: "Lightweight protection with basic variable and string transforms.",
    luaVersion: "LuaU" as const,
  },
  {
    name: "Normal",
    description: "Balanced protection for everyday scripts.",
    luaVersion: "LuaU" as const,
  },
  {
    name: "Strong",
    description: "Maximum bundled protection with deeper transformations.",
    luaVersion: "LuaU" as const,
  },
  {
    name: "Vmify",
    description: "Wraps the script with the bundled virtual-machine transform.",
    luaVersion: "LuaU" as const,
  },
];

function getUserFacingError(
  error: Error & { stderr?: string },
): string {
  const raw = `${error.stderr ?? ""}
${error.message ?? ""}`
    .replace(/\u001b\[[0-9;]*m/g, "")
    .trim();
  const match = raw.match(
    /:\d+:\s+((?:Lexing|Parsing|Unexpected|Invalid)[^\n]+)/i,
  );
  return (
    match?.[1]?.trim() ??
    "The Lua source could not be obfuscated. Check the syntax and selected Lua version."
  );
}

router.get("/obfuscator/presets", (_req, res) => {
  res.json(ListObfuscatorPresetsResponse.parse(presets));
});

router.post("/obfuscator/obfuscate", async (req, res) => {
  const parsed = ObfuscateLuaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide valid Lua source and a supported preset." });
    return;
  }

  const input = parsed.data;
  const inputBytes = Buffer.byteLength(input.source, "utf8");
  if (inputBytes > maxSourceBytes) {
    res.status(413).json({ error: "Source files must be 256 KB or smaller." });
    return;
  }

  const luaVersion = input.luaVersion ?? "LuaU";
  const workingDirectory = await mkdtemp(join(tmpdir(), "hello-obfuscator-"));
  const sourcePath = join(workingDirectory, "input.lua");
  const outputPath = join(workingDirectory, "output.lua");
  const startedAt = Date.now();

  try {
    await writeFile(sourcePath, input.source, "utf8");
    await execFileAsync(
      "lua",
      [
        runnerPath,
        sourcePath,
        outputPath,
        input.preset,
        luaVersion,
        String(input.prettyPrint === true),
      ],
      {
        cwd: engineDirectory,
        timeout: 20_000,
        maxBuffer: 1024 * 1024,
      },
    );

    const output = await readFile(outputPath, "utf8");
    const result = ObfuscateLuaResponse.parse({
      source: output,
      preset: input.preset,
      luaVersion,
      inputBytes,
      outputBytes: Buffer.byteLength(output, "utf8"),
      durationMs: Date.now() - startedAt,
    });
    res.json(result);
  } catch (error) {
    const processError = error as Error & {
      code?: string | number;
      stderr?: string;
    };
    const details = processError.stderr?.trim() || processError.message;
    req.log.warn({ err: error }, "Lua obfuscation failed");
    res.status(processError.code === "ETIMEDOUT" ? 504 : 400).json({
      error: getUserFacingError({ ...processError, message: details }),
    });
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
});

export default router;