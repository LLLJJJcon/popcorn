import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extensionSource = join(repositoryRoot, "extension");
const defaultOutput = join(repositoryRoot, "dist", "popcorn-extension");

const RUNTIME_FILES = Object.freeze([
  "auth.js",
  "background.js",
  "content.js",
  "icons/icon128.png",
  "icons/icon16.png",
  "icons/icon48.png",
  "options.css",
  "options.html",
  "options.js",
  "prompts/analysis.md",
  "prompts/explain.md",
  "prompts/note-cleanup.md",
  "prompts/translation.md",
  "settings.js",
  "sidepanel.css",
  "sidepanel.html",
  "sidepanel.js",
  "sync-queue.js",
]);

function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const octets = hostname.split(".");
  return octets.length === 4 &&
    octets[0] === "127" &&
    octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

export function parseRuntimeOrigin(value) {
  if (typeof value !== "string" || !value || value !== value.trim()) {
    throw new Error("Invalid extension runtime origin.");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid extension runtime origin.");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/" ||
    value !== parsed.origin ||
    (parsed.protocol === "http:" && !isLoopbackHostname(parsed.hostname))
  ) {
    throw new Error("Invalid extension runtime origin.");
  }
  return parsed.origin;
}

function runtimeConfigFromTemplate(template, values) {
  const replacements = {
    __POPCORN_APP_URL__: values.appUrl,
    __POPCORN_SUPABASE_URL__: values.supabaseUrl,
    __POPCORN_SUPABASE_ANON_KEY__: values.supabaseAnonKey,
  };
  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    if (result.split(placeholder).length !== 2) {
      throw new Error("Invalid extension runtime configuration template.");
    }
    result = result.replace(placeholder, () => JSON.stringify(value));
  }
  return result;
}

function containsPath(parent, child) {
  const pathFromParent = relative(parent, child);
  return pathFromParent === "" || (
    pathFromParent !== ".." &&
    !pathFromParent.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromParent)
  );
}

export function resolveOutputDirectory(outputDirectory) {
  if (typeof outputDirectory !== "string" || !outputDirectory || !isAbsolute(outputDirectory)) {
    throw new Error("Extension output directory must be absolute.");
  }
  const output = resolve(outputDirectory);
  if (
    output === parse(output).root ||
    output === resolve(tmpdir()) ||
    containsPath(output, repositoryRoot) ||
    (containsPath(repositoryRoot, output) && output !== defaultOutput)
  ) {
    throw new Error("Unsafe extension output directory.");
  }
  return output;
}

export async function buildLocalExtension({
  appUrl,
  supabaseUrl,
  supabaseAnonKey,
  outputDirectory = defaultOutput,
}) {
  const runtime = {
    appUrl: parseRuntimeOrigin(appUrl),
    supabaseUrl: parseRuntimeOrigin(supabaseUrl),
    supabaseAnonKey,
  };
  if (typeof runtime.supabaseAnonKey !== "string" || !runtime.supabaseAnonKey) {
    throw new Error("Missing public Supabase anonymous key.");
  }

  const output = resolveOutputDirectory(outputDirectory);
  const sourceManifest = JSON.parse(await readFile(join(extensionSource, "manifest.json"), "utf8"));
  if (typeof sourceManifest.key !== "string" || !sourceManifest.key) {
    throw new Error("The fixed extension manifest key is missing.");
  }
  const manifest = {
    ...sourceManifest,
    permissions: sourceManifest.permissions.filter((permission) => permission !== "identity"),
    host_permissions: [
      "https://www.youtube.com/*",
      `${runtime.appUrl}/*`,
      `${runtime.supabaseUrl}/*`,
    ],
  };
  const template = await readFile(join(extensionSource, "runtime-config.template.js"), "utf8");
  const runtimeConfig = runtimeConfigFromTemplate(template, runtime);

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const file of RUNTIME_FILES) {
    const target = join(output, file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(extensionSource, file), target);
  }
  await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(join(output, "runtime-config.js"), runtimeConfig, "utf8");

  return { outputDirectory: output };
}

/**
 * @param {{
 *   environment?: Record<string, string | undefined>,
 *   outputDirectory?: string,
 * }} [options]
 */
export function buildLocalExtensionFromEnvironment({
  environment = process.env,
  outputDirectory = defaultOutput,
} = {}) {
  return buildLocalExtension({
    appUrl: environment.APP_URL,
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    outputDirectory,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildLocalExtensionFromEnvironment()
    .then(() => console.log("Generated dist/popcorn-extension."))
    .catch(() => {
      console.error("Unable to generate the local Popcorn extension. Check the three public runtime settings.");
      process.exitCode = 1;
    });
}
