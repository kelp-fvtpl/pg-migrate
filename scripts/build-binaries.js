#!/usr/bin/env node
// Packages dist/bin/migrate.js into a self-contained executable per platform.
//
// --public is not optional: pkg emits V8 bytecode by default, and bytecode is
// host/target specific, so a cross-compiled binary dies at startup with
// "V8 rejected the bytecode cache". --public ships plain JS inside instead.
const {execFileSync} = require("child_process")
const fs = require("fs")
const path = require("path")

const TARGETS = [
  {pkg: "node22-linuxstatic-x64", out: "pg-migrate-linux-x64"},
  {pkg: "node22-linuxstatic-arm64", out: "pg-migrate-linux-arm64"},
  {pkg: "node22-macos-arm64", out: "pg-migrate-macos-arm64"},
  {pkg: "node22-macos-x64", out: "pg-migrate-macos-x64"},
]

const root = path.join(__dirname, "..")
const outDir = path.join(root, "build")
const only = process.argv.slice(2)
const targets = only.length
  ? TARGETS.filter((t) => only.includes(t.out) || only.includes(t.pkg))
  : TARGETS

if (targets.length === 0) {
  console.error(`No target matched. Known: ${TARGETS.map((t) => t.out).join(", ")}`)
  process.exit(1)
}

fs.mkdirSync(outDir, {recursive: true})
const pkgBin = path.join(root, "node_modules", ".bin", "pkg")

for (const target of targets) {
  const output = path.join(outDir, target.out)
  console.log(`==> ${target.out}  (${target.pkg})`)
  execFileSync(
    pkgBin,
    [
      "dist/bin/migrate.js",
      "--config", "package.json",
      "--targets", target.pkg,
      "--public",
      "--public-packages", "*",
      "--output", output,
    ],
    {cwd: root, stdio: "inherit"},
  )
}

// Checksums, so a consumer can verify whatever it downloaded or copied.
const lines = targets
  .map((t) => {
    const file = path.join(outDir, t.out)
    if (!fs.existsSync(file)) throw new Error(`pkg produced no output for ${t.out}`)
    const hash = require("crypto")
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex")
    const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(0)
    console.log(`    ${t.out}  ${mb} MB`)
    return `${hash}  ${t.out}`
  })
  .join("\n")

fs.writeFileSync(path.join(outDir, "SHA256SUMS"), lines + "\n")
console.log(`\nWrote ${targets.length} binaries + SHA256SUMS to build/`)
