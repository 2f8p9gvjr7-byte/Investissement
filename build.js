#!/usr/bin/env node
// Script à lancer avant chaque déploiement Vercel : node build.js
// Il injecte le timestamp actuel dans sw.js pour forcer la mise à jour du cache.

const fs = require("fs");
const path = require("path");

const timestamp = Date.now();
const swPath = path.join(__dirname, "sw.js");

let sw = fs.readFileSync(swPath, "utf8");
sw = sw.replace("__VERSION_TIMESTAMP__", timestamp);
fs.writeFileSync(swPath, sw);

console.log(`✓ sw.js mis à jour avec la version : ${timestamp}`);
console.log(`  Cache : comparateur-rendements-${timestamp}`);
