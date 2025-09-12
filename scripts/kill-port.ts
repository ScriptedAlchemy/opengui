#!/usr/bin/env tsx

import { execSync } from "child_process"
import * as fs from "fs"

const env = process.env["PORT"]
const p0 = env ? parseInt(env) : NaN
const f = "test/.e2e-port"
let t = ""
try {
  t = fs.readFileSync(f, "utf-8")
} catch {
  // File doesn't exist
}
const p1 = t ? parseInt(t) : NaN
const p = Number.isFinite(p0) && p0 > 0 && p0 < 65536 ? p0 : Number.isFinite(p1) && p1 > 0 && p1 < 65536 ? p1 : 3001

try {
  const s = execSync(`lsof -ti tcp:${p}`, { encoding: "utf-8" }).trim()
  if (s) {
    console.log(`[pretest] Killing PIDs on port ${p}:`, s)
    execSync(`kill -9 ${s.split("\n").join(" ")}`)
  }
} catch {
  console.log(`[pretest] No process found on port ${p}`)
}

