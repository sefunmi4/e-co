const fs = require("fs");
const path = require("path");

const distRoot = path.resolve(__dirname, "..", "dist");
const outputPath = path.join(distRoot, "env.json");

const config = require(path.join(distRoot, "index.js"));

const data = typeof config.toJSON === "function" ? config.toJSON() : {};

fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
