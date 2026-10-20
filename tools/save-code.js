#!/usr/bin/env node
/** Save one CODE file to Adventure Land without PowerShell JSON truncation. */
const fs = require("fs");
const https = require("https");
const path = require("path");

const root = path.join(__dirname, "..");
const name = process.argv[2];
const slot = process.argv[3];
const file = process.argv[4];
if (!name || !slot || !file) {
	console.error("usage: node tools/save-code.js <name> <slot> <file>");
	process.exit(1);
}

let token = process.env.AL_MCP_TOKEN || "";
if (!token) {
	try {
		const cfg = JSON.parse(fs.readFileSync(path.join(root, ".cursor", "mcp.json"), "utf8"));
		token = String(cfg.mcpServers["Adventure Land"].headers.Authorization || "").replace(/^Bearer\s+/i, "");
	} catch { /* Optional legacy local credential source. */ }
}
if (!token) {
	console.error("Set AL_MCP_TOKEN in your environment before saving CODE.");
	process.exit(1);
}
const code = fs.readFileSync(path.isAbsolute(file) ? file : path.join(root, file), "utf8");
const body = JSON.stringify({ token, slot, name, code });

const req = https.request(
	{
		hostname: "adventure.land",
		path: "/mcp_api/save_code",
		method: "POST",
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Length": Buffer.byteLength(body)
		}
	},
	(res) => {
		let data = "";
		res.on("data", (c) => (data += c));
		res.on("end", () => {
			let j;
			try {
				j = JSON.parse(data);
			} catch (e) {
				console.error(name, "BAD_JSON: game service returned an invalid response");
				process.exit(1);
			}
			if (!j.success) {
				console.error(name, "FAILED", j.reason || "request rejected");
				process.exit(1);
			}
			const saved = (j.code && j.code.code) || "";
			console.log(
				name,
				"saved as version",
				j.code.version,
				"(local",
				code.length,
				"bytes" + (saved ? ", echo " + saved.length : "") + ")"
			);
			// API often omits code echo; do not treat empty echo as truncation.
		});
	}
);
req.on("error", (e) => {
	console.error(name, e.message);
	process.exit(1);
});
req.setTimeout(20000, () => req.destroy(new Error('Game request timed out')));
req.write(body);
req.end();
