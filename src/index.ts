import express from "express";
import { appendFile, mkdir } from "fs/promises";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { env } from "./config.js";
import { DemoSession } from "./voice/demo-session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use(express.static(publicDir));

app.post("/api/dnc", async (req, res) => {
  const body = req.body as {
    reason?: unknown;
    transcript?: unknown;
    lead?: unknown;
  };
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 240) : "caller_request";
  const transcript = typeof body.transcript === "string" ? body.transcript.slice(0, 500) : "";
  const lead = body.lead && typeof body.lead === "object" ? body.lead : {};
  const record = JSON.stringify({
    createdAt: new Date().toISOString(),
    reason,
    transcript,
    lead,
  });

  try {
    const dataDir = path.join(__dirname, "..", "data");
    await mkdir(dataDir, { recursive: true });
    await appendFile(path.join(dataDir, "dnc.jsonl"), record + "\n", "utf8");
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error("DNC persistence failed", error);
    res.status(500).json({ ok: false });
  }
});

app.get("/demo-config.js", (_req, res) => {
  const configScript = "window.__DEMO_CONFIG = " + JSON.stringify({
    agentId: env.ELEVENLABS_AGENT_ID,
    lead: {
      firstName: env.DEMO_FIRST_NAME,
      lastName: env.DEMO_LAST_NAME,
      rep: env.DEMO_REP_NAME,
      state: env.DEMO_STATE,
    },
  }) + ";";
  res.type("application/javascript").send(configScript);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  const session = new DemoSession(ws);
  let started = false;

  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      session.onAudio(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
      return;
    }
    const text = data.toString();
    try {
      const msg = JSON.parse(text) as { type?: string };
      if (msg.type === "start" && !started) {
        started = true;
        void session.start().catch((e) => {
          ws.send(JSON.stringify({ type: "error", message: String(e) }));
        });
        return;
      }
    } catch {
      /* fall through */
    }
    session.onClientJson(text);
  });

  ws.on("close", () => session.close());
  ws.on("error", () => session.close());
});

server.listen(env.PORT, () => {
  console.log(`\n  Americas Health voice demo`);
  console.log(`  Open http://localhost:${env.PORT}\n`);
  console.log(`  Click Start call, allow mic, talk naturally.`);
  console.log(`  Interrupt the bot anytime — playback should cut instantly.\n`);
});
