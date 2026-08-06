/**
 * Direct ElevenLabs conversation with a passive UI observer.
 * The observer reads final transcript events only; it never changes the agent prompt.
 */

import { Conversation } from "https://cdn.jsdelivr.net/npm/@11labs/client@0.1.4/dist/lib.modern.js";

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const leadNameEl = document.getElementById("leadName");
const leadRepEl = document.getElementById("leadRep");
const leadStateEl = document.getElementById("leadState");
const stepCodeEl = document.getElementById("stepCode");
const endpointEl = document.getElementById("endpoint");
const partialEl = document.getElementById("partial");
const decideMsEl = document.getElementById("decideMs");
const userTurnEl = document.getElementById("userTurn");
const turnReasonEl = document.getElementById("turnReason");
const lastIntentEl = document.getElementById("lastIntent");
const stripIntentEl = document.getElementById("stripIntent");
const qaStatusEl = document.getElementById("qaStatus");
const qaFlagsEl = document.getElementById("qaFlags");
const qaNotesEl = document.getElementById("qaNotes");
const logEl = document.getElementById("log");
const pipelineEl = document.getElementById("pipeline");

const PIPELINE_ORDER = [
  "how_are_you",
  "pitch",
  "insurance_check_1",
  "state_confirm",
  "insurance_check_2",
  "transfer_consent",
  "transferring",
];

let conversation = null;
let activeStep = "how_are_you";
let lastUserAt = 0;
let endingForCallerRequest = false;

function setStatus(text, className = "") {
  statusEl.textContent = text;
  statusEl.className = ("chip " + className).trim();
}

function setPipeline(step) {
  if (!PIPELINE_ORDER.includes(step)) return;
  activeStep = step;
  stepCodeEl.textContent = step;
  const current = PIPELINE_ORDER.indexOf(step);
  for (const item of pipelineEl.querySelectorAll("li")) {
    const index = PIPELINE_ORDER.indexOf(item.dataset.step);
    item.classList.toggle("active", item.dataset.step === step);
    item.classList.toggle("done", index >= 0 && index < current);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function addLog(who, text, className = who) {
  const empty = document.getElementById("transcriptEmpty");
  if (empty) empty.hidden = true;
  const item = document.createElement("li");
  item.className = className;
  item.innerHTML = '<span class="who">' + escapeHtml(who) + '</span><div>' + escapeHtml(text) + '</div>';
  logEl.prepend(item);
}

function describeError(value) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object") {
    const detail = value;
    return [detail.message, detail.code && ("code " + detail.code), detail.reason]
      .filter(Boolean)
      .join(" — ") || JSON.stringify(detail);
  }
  return String(value);
}

function applyAnalysis(analysis) {
  if (analysis.step) setPipeline(analysis.step);
  if (analysis.intent) lastIntentEl.textContent = analysis.intent;
  if (analysis.reason) turnReasonEl.textContent = analysis.reason;
  qaFlagsEl.textContent = analysis.flags?.length ? analysis.flags.join(" · ") : "—";
  if (analysis.notes) qaNotesEl.textContent = analysis.notes;
}

function hydrateLead() {
  const lead = window.__DEMO_CONFIG?.lead;
  if (!lead) return;
  leadNameEl.textContent = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  leadRepEl.textContent = lead.rep || "—";
  leadStateEl.textContent = lead.state || "—";
}

function classifyUserTurn(text) {
  const value = text.toLowerCase().replace(/[^a-z0-9?' ]/g, " ").replace(/\s+/g, " ").trim();

  if (/\b(i am not|i'm not|wrong person|wrong number)\b/.test(value)) {
    return { intent: "Wrong person", reason: "Caller is not the listed lead", flags: ["Wrong person"], notes: "Agent should end without restarting." };
  }
  if (/\b(not interested|stop calling|leave me alone|don't call|do not call|goodbye|bye|fuck off|shut up|go away)\b/.test(value)) {
    return { intent: "DNC / hostile", reason: "Caller requested to end", flags: ["Hangup requested"], notes: "Agent should end immediately." };
  }
  if (/\b(callback|call me back|busy|driving|in a meeting|can't talk|cannot talk)\b/.test(value)) {
    return { intent: "Busy / callback", reason: "Caller cannot continue", flags: ["End call"], notes: "Acknowledge the stated reason and end." };
  }
  if (/\b(can you hear me|do you hear me|hear me clearly|can't hear|cannot hear|not hearing)\b/.test(value)) {
    return { intent: "Audio check", reason: "Caller checked audio", flags: [], notes: "Answer audio before resuming the flow." };
  }
  if (/\b(urdu|hindi|punjabi|spanish|language)\b/.test(value)) {
    return { intent: "Language request", reason: "Caller requested another language", flags: [], notes: "State the supported language clearly." };
  }
  if (/\b(who is alex|who's alex|who are you|who is calling|who's calling|why are you calling|why calling|what do you want)\b/.test(value)) {
    return { intent: "Identity / why call", reason: "Caller asked identity or purpose", flags: [], notes: "Answer identity and purpose first." };
  }
  if (/\b(medicare|medicaid|insurance|insured|coverage|work insurance|work coverage|employer coverage)\b/.test(value)) {
    const step = activeStep === "state_confirm" || activeStep === "insurance_check_2" ? "insurance_check_2" : "insurance_check_1";
    return { intent: "Coverage answer", reason: "Caller answered a coverage gate", flags: [], notes: "Coverage answer received.", step };
  }
  if (/\b(texas|state|where do you live|where are you located)\b/.test(value)) {
    return { intent: "State answer", reason: "Caller answered the state question", flags: [], notes: "State response received.", step: "state_confirm" };
  }
  if (/\b(subsidy|aca|affordable care|obamacare|health insurance)\b/.test(value)) {
    return { intent: "Subsidy answer", reason: "Caller discussed the ACA offer", flags: [], notes: "Keep the offer factual.", step: "pitch" };
  }
  if (/\b(yes|yeah|yep|no|nope|maybe|not sure|i don't know|don't know)\b/.test(value)) {
    return { intent: "Script answer", reason: "Caller answered the latest question", flags: [], notes: "Continue from the current agent step." };
  }
  return { intent: "Caller question", reason: "Caller spoke", flags: [], notes: "Answer the latest question first." };
}

function inferBotStep(text) {
  const value = text.toLowerCase();
  if (/\b(how are you|how are you doing)\b/.test(value)) return "how_are_you";
  if (/\b(have you received|have you gotten|health subsidy|affordable care act)\b/.test(value)) return "pitch";
  if (/\b(medicare|medicaid|insurance through work|work insurance|work coverage)\b/.test(value)) {
    return activeStep === "state_confirm" || activeStep === "insurance_check_2" ? "insurance_check_2" : "insurance_check_1";
  }
  if (/\b(still in texas|what state|which state|state are you)\b/.test(value)) return "state_confirm";
  if (/\b(connect you|licensed agent|transfer you|permission to connect)\b/.test(value)) return "transfer_consent";
  if (/\b(transfer is ready|transferring|connecting you now)\b/.test(value)) return "transferring";
  return null;
}

function hasPromptLeak(text) {
  return /\b(the user|the caller|my instructions|the next step|the script|conversation flow|based on the flow|i need to|i should)\b/i.test(text);
}

function callerControlRequest(text) {
  const value = text.toLowerCase().replace(/[^a-z0-9?' ]/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(do not call|don't call|dont call|stop calling|remove my number|take me off|remove me from your list|unsubscribe|put me on the do not call list)\b/.test(value)) {
    return { kind: "dnc", reason: "Caller requested Do Not Call" };
  }
  if (/\b(hang up|end the call|end this call|cut the call|please go|go away|leave me alone|i don't want to talk|i do not want to talk|goodbye|good bye|bye|fuck off|shut up)\b/.test(value)) {
    return { kind: "hangup", reason: "Caller requested to end the call" };
  }
  return null;
}

function persistDnc(text) {
  const lead = window.__DEMO_CONFIG?.lead || {};
  void fetch("/api/dnc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason: "caller_requested_dnc", transcript: text, lead }),
    keepalive: true,
  }).catch(() => {
    addLog("sys", "DNC request detected; local persistence was unavailable.", "sys");
  });
}

function endForCallerRequest(text, control) {
  if (endingForCallerRequest) return;
  endingForCallerRequest = true;
  if (control.kind === "dnc") persistDnc(text);
  addLog("sys", control.kind === "dnc" ? "DNC request detected — call ended." : "Caller requested to end — call ended.", "sys");
  setStatus("Ended");
  qaStatusEl.textContent = control.kind === "dnc" ? "DNC" : "Ended";
  qaStatusEl.className = "mono";
  startBtn.disabled = false;
  stopBtn.disabled = true;
  const activeConversation = conversation;
  conversation = null;
  void activeConversation?.endSession().catch((error) => addLog("sys", describeError(error), "sys"));
}

function syncFromTranscript(source, text) {
  if (!text) return;
  if (source === "user") {
    lastUserAt = performance.now();
    userTurnEl.textContent = text;
    partialEl.textContent = "Final transcript";
    applyAnalysis(classifyUserTurn(text));
    return;
  }

  if (lastUserAt) {
    decideMsEl.textContent = Math.round(performance.now() - lastUserAt) + " ms";
    lastUserAt = 0;
  }
  const nextStep = inferBotStep(text);
  if (nextStep) setPipeline(nextStep);
  if (hasPromptLeak(text)) {
    qaStatusEl.textContent = "FLAGGED";
    qaStatusEl.className = "mono bad";
    applyAnalysis({
      intent: "Prompt leak",
      reason: "Agent exposed internal instructions",
      flags: ["Prompt leak"],
      notes: "Review the remote agent prompt; UI is only observing this response.",
    });
  }
}

function resetActivity() {
  activeStep = "how_are_you";
  lastUserAt = 0;
  endingForCallerRequest = false;
  logEl.innerHTML = "";
  const empty = document.getElementById("transcriptEmpty");
  if (empty) empty.hidden = false;
  hydrateLead();
  setPipeline("how_are_you");
  endpointEl.textContent = "ElevenLabs turn";
  partialEl.textContent = "Final transcript";
  decideMsEl.textContent = "—";
  userTurnEl.textContent = "—";
  turnReasonEl.textContent = "—";
  lastIntentEl.textContent = "Waiting for caller";
  stripIntentEl.textContent = "ElevenLabs session";
  qaStatusEl.textContent = "Live";
  qaStatusEl.className = "mono ok";
  qaFlagsEl.textContent = "—";
  qaNotesEl.textContent = "UI is observing the natural agent session";
}

async function startCall() {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  resetActivity();
  setStatus("Connecting...", "warn");

  try {
    conversation = await Conversation.startSession({
      agentId: window.__DEMO_CONFIG?.agentId,
      onConnect: () => {
        setStatus("Live", "live");
        applyAnalysis({ intent: "Connected", reason: "Awaiting caller", flags: [], notes: "Natural conversation handled by ElevenLabs." });
        addLog("sys", "Connected to the conversational agent.", "sys");
      },
      onDisconnect: (details) => {
        if (details?.reason === "error") {
          addLog("sys", describeError(details), "sys");
          setStatus("Error", "danger");
        } else {
          setStatus("Ended");
          if (!endingForCallerRequest) {
            qaStatusEl.textContent = "Ended";
            qaStatusEl.className = "mono";
          }
        }
        conversation = null;
        startBtn.disabled = false;
        stopBtn.disabled = true;
      },
      onStatusChange: ({ status }) => {
        if (status === "connected") setStatus("Live", "live");
        if (status === "connecting") setStatus("Connecting...", "warn");
      },
      onModeChange: ({ mode }) => {
        setStatus(mode === "speaking" ? "Agent speaking" : "Listening", "live");
      },
      onMessage: ({ source, message }) => {
        if (!message || (endingForCallerRequest && source !== "user")) return;
        syncFromTranscript(source, message);
        addLog(source === "user" ? "you" : "bot", message, source === "user" ? "you" : "bot");
        if (source === "user") {
          const control = callerControlRequest(message);
          if (control) endForCallerRequest(message, control);
        }
      },
      onError: (error) => {
        addLog("sys", describeError(error), "sys");
        setStatus("Error", "danger");
      },
    });
  } catch (error) {
    addLog("sys", describeError(error), "sys");
    setStatus("Mic error", "danger");
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

async function hangup() {
  try {
    await conversation?.endSession();
  } catch (error) {
    addLog("sys", describeError(error), "sys");
  }
  conversation = null;
  setStatus("Idle");
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

startBtn.addEventListener("click", () => void startCall());
stopBtn.addEventListener("click", () => void hangup());
hydrateLead();
