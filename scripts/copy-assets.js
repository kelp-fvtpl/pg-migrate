#!/usr/bin/env node
// Copies non-TypeScript assets from src/ to dist/ (tsc only emits .js).
// Replaces an `rsync` call so the build runs on any machine with node.
const fs = require("fs")
const path = require("path")

const SKIP_DIRS = new Set(["__tests__", "__unit__", "__integration__"])
const root = path.join(__dirname, "..")

function copyDir(from, to) {
  for (const entry of fs.readdirSync(from, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      copyDir(path.join(from, entry.name), path.join(to, entry.name))
    } else if (!entry.name.endsWith(".ts")) {
      fs.mkdirSync(to, {recursive: true})
      fs.copyFileSync(path.join(from, entry.name), path.join(to, entry.name))
    }
  }
}

fs.rmSync(path.join(root, "dist"), {recursive: true, force: true})
copyDir(path.join(root, "src"), path.join(root, "dist"))
