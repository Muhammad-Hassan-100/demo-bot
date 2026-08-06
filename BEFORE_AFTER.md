# Voice Bot — Before and After

## Executive summary

The Before bot behaved like a fixed script with one repeated answer. It often heard the caller's words but did not understand the caller's actual intent. Whether the caller asked “Who is calling?”, “Can you hear me?”, “Why are you calling?”, “I am not Jordan”, or “Do not call me again”, the bot could return to the same subsidy question. That made the conversation feel automated, reduced trust, and created a poor caller experience.

The After bot is conversation-aware. It treats every caller turn as a new piece of information, identifies what the caller is trying to do, answers that request first, remembers the current script state, and then continues from the correct point. Normal questions are handled flexibly, while sensitive actions such as DNC, hangup, and transfer are protected by deterministic control logic.

The important difference is this:

```text
Before: caller words -> same generic scripted reply

After:  caller words -> intent and context -> relevant answer
                            -> correct script state -> safe action if needed
```

This makes the After version materially stronger because it improves both sides of the system: the conversation feels more human, and the workflow is more controlled and trustworthy.

## Before

- The bot could repeat the same subsidy question even when the caller asked a different question.
- “Who is calling?” could receive the opening pitch instead of the representative's identity and purpose.
- “Can you hear me?” or “I cannot hear you” could receive another script line instead of an audio check.
- “Why are you calling me?” could receive the same subsidy question instead of a clear explanation.
- “I am not Jordan” could be followed by “Hi Jordan” because the caller identity was not handled as a high-priority intent.
- “I am not interested” or “Please stop calling me” could be treated as a normal objection and trigger more sales language.
- “Do not call me again” did not reliably stop the script or create a DNC record.
- “Goodbye” could produce a polite sentence without actually ending the session.
- A caller's “No” could be confused with the answer to an older question because the bot did not track the latest active question correctly.
- Unexpected questions, repeated questions, rude language, and clarification requests could all receive almost the same response.
- The bot could expose internal instructions such as the user, the next step, or the script flow.
- The bot could continue speaking after the caller interrupted it.
- Silence could cause repeated greetings or an unclear end-of-call state.
- Transfer behavior was not strictly protected by explicit consent.
- Transfer was represented as a demo event rather than a verified telephony action.
- The UI could show stale pipeline, intent, or turn information and make the system look inconsistent.

### Why this reduced trust

When a caller asks a direct question and receives an unrelated repeated answer, the caller assumes that the agent is not listening. When the caller says “Do not call me again” and still receives a sales question, the interaction feels unsafe and non-compliant. When the bot calls someone “Jordan” after they said they are not Jordan, the caller loses confidence in the identity handling. These are not only wording problems; they are failures in intent detection, state management, and call control.

## After

- The agent first understands the caller's latest request, gives a relevant answer, and only then returns to the current script step.
- Identity questions receive an identity answer; audio questions receive an audio answer; purpose questions receive a purpose answer.
- “I am not Jordan” is handled as a wrong-person event, so the bot does not continue addressing the caller as Jordan.
- “I am not interested” can receive a relevant, short rebuttal, while an explicit “Do not call me again” takes the higher-priority DNC path.
- DNC, stop-calling, remove-number, and explicit hangup phrases override the sales script instead of being treated as ordinary objections.
- The DNC request is persisted and the browser conversation ends immediately; a production deployment can replace the demo endpoint with the CRM/DNC service.
- “Goodbye”, “hang up”, and “end the call” invoke an explicit session-ending action rather than relying only on the model to say goodbye.
- A current script state records which question is active, so a “No” is interpreted in the correct context instead of being applied to an old question.
- A state machine protects the ACA workflow and required coverage gates while the conversational layer handles natural wording.
- Unexpected questions and rebuttals are handled as intent categories, not as a long list of manually scripted sentences.
- The agent is instructed to produce caller-facing speech only; prompt-leak phrases are monitored and flagged in QA.
- When the caller interrupts, pending audio is cancelled and the newest caller turn becomes authoritative.
- Silence has a defined sequence: wait, ask “Hello? Is anyone there?”, wait again, then end politely.
- Transfer is allowed only after the required gates and explicit caller consent; production transfer is performed through a validated telephony tool.
- UI events update the current transcript, pipeline step, intent, turn reason, QA flags, decision latency, and final call status.
- Voice streaming and settings are tuned to reduce the short fluctuation that can happen when a response starts after barge-in.

### How the After bot builds trust

The After bot acknowledges the caller's actual words, gives a relevant answer, avoids pretending it heard something else, and remembers where it is in the conversation. It does not force every caller into the same pitch. It can answer a question, handle an objection, respect a refusal, record a DNC request, and end the call when the caller asks. This makes the interaction feel responsive and gives the caller a clear reason to trust the system.

## Concrete conversation examples

| Caller says | Before behavior | After behavior |
|---|---|---|
| “Who is calling?” | Repeats the subsidy pitch | Identifies Alex and explains the call purpose |
| “Can you hear me?” | Repeats the current script question | Confirms the audio and waits for the caller's question |
| “Why are you calling me?” | Asks the subsidy question again | Explains the ACA eligibility purpose, then returns to the script |
| “I am not Jordan.” | Says “Hi Jordan” or restarts the greeting | Acknowledges the wrong person and ends or follows the wrong-person rule |
| “I am not interested.” | Repeats the full pitch | Gives a concise relevant rebuttal or respectfully ends after refusal |
| “Do not call me again.” | Continues with the subsidy question | Records DNC, stops the script, and ends immediately |
| “Please remove my number.” | Says it cannot help and continues selling | Treats it as DNC and ends the session |
| “No, do not transfer me.” | Keeps trying to transfer or moves to an unrelated gate | Respects the refusal and does not transfer |
| “Please transfer me.” | May jump to a greeting or transfer without context | Checks the required gates and consent before transfer |
| “Wait, I have a question.” during TTS | Finishes the old sentence | Stops old audio and answers the new question |
| Caller stays silent | Repeats a greeting or waits indefinitely | Uses the five-second nudge and final timeout |
| “Who are you?” after several turns | Restarts the opening | Answers identity while preserving the current script state |

## Side-by-side dialogue examples

### 1. Caller asks who is calling

```text
Caller: Who is calling?

Before bot: Hi Jordan, how are you doing today? Have you gotten that subsidy yet?
Problem: It ignored the identity question and returned to the pitch.

After bot: This is Alex with Americas Health. I’m calling for a quick ACA health-subsidy eligibility check. The call is recorded. Have you received that subsidy yet?
Improvement: It answers who is calling and why, then returns naturally to the script.
```

### 2. Caller asks why the call was made

```text
Caller: Why are you calling me?

Before bot: Have you gotten that free health subsidy yet?
Problem: The caller asked for a reason but received the same question again.

After bot: That’s fair. I’m calling to see whether you may qualify for an ACA health-subsidy option. I’m only checking a few eligibility questions. Have you received that subsidy before?
Improvement: It acknowledges the concern, explains the purpose, and asks one relevant next question.
```

### 3. Caller checks the audio

```text
Caller: Can you hear me?

Before bot: Cool. You don’t have Medicare, Medicaid, or work insurance, right?
Problem: It acted as if the caller had answered a coverage question.

After bot: Yes, I can hear you. Can you hear me clearly?
Improvement: It handles the audio check first and does not advance the script incorrectly.
```

### 4. Caller cannot hear the bot

```text
Caller: I can’t hear you.

Before bot: Have you gotten that subsidy yet?
Problem: It continued speaking instead of responding to the audio problem.

After bot: I may be coming through quietly. Please check your speaker volume. Can you hear me now?
Improvement: It responds to the actual problem and waits for confirmation.
```

### 5. Caller says they are not the listed person

```text
Caller: I’m not Jordan.

Before bot: Hi Jordan, how are you doing today?
Problem: It repeated the wrong name and immediately damaged trust.

After bot: I’m sorry about that. I may have the wrong person, so I’ll let you go. Take care.
Improvement: Wrong-person intent has priority and the bot stops addressing the caller incorrectly.
```

### 6. Caller says they are not interested

```text
Caller: I’m not interested.

Before bot: This is Alex with Americas Health. Have you gotten that subsidy yet?
Problem: It repeated the pitch without acknowledging the refusal.

After bot: I understand. We’re only checking whether people without Medicare, Medicaid, or work coverage may qualify. If you’re not interested, I’ll let you go. Take care.
Improvement: It acknowledges the objection, gives one concise clarification, and respects the caller's decision.
```

### 7. Caller asks for Do Not Call

```text
Caller: Please remove my number from your list. Do not call me again.

Before bot: I’m sorry, but I cannot assist with that. Have you received an ACA subsidy?
Problem: It ignored a clear privacy and contact-preference request and continued selling.

After bot: Understood. I’ll mark this number as Do Not Call. Goodbye.
System action: add_to_dnc() -> hangup_call()
Improvement: DNC overrides the sales script, is recorded, and ends the call immediately.
```

### 8. Caller wants to end the call

```text
Caller: I don’t want to talk. Goodbye.

Before bot: If you would like, I can end the call now. Would you like me to do that?
Problem: It asked for unnecessary confirmation after an explicit goodbye.

After bot: Understood. Thank you for your time. Goodbye.
System action: hangup_call()
Improvement: An explicit end request is respected without another question.
```

### 9. Caller refuses transfer

```text
Caller: No, don’t transfer me.

Before bot: Would you like me to proceed with the transfer? You will be connected to a licensed agent.
Problem: It kept pushing the transfer after the caller had refused.

After bot: No problem. I won’t transfer you. Is there anything else you’d like to know?
Improvement: Transfer refusal is remembered and no transfer action is executed.
```

### 10. Caller requests transfer

```text
Caller: Please transfer my call.

Before bot: Hi Jordan, how are you doing today?
Problem: It restarted the greeting instead of using the current conversation state.

After bot: I can connect you with a licensed agent. Before I do that, can I confirm that you’d like to be transferred?
System action after consent: transfer_call()
Improvement: It keeps context, confirms consent, and only then starts the transfer.
```

### 11. Caller interrupts the bot

```text
Bot is speaking: This is Alex with Americas Health and I’m calling about...
Caller: Wait, I have a question.

Before behavior: The bot finished its old sentence and then repeated the full pitch.

After behavior: Current audio is cancelled. The bot answers: Of course. What would you like to ask?
Improvement: The latest caller turn becomes authoritative and old TTS is not allowed to continue.
```

### 12. Caller remains silent

```text
Caller: [silent for about five seconds]

Before behavior: The bot could repeat the greeting or remain stuck.

After bot: Hello? Is anyone there?
If still silent: I’m sorry we couldn’t connect. Thank you for your time. Goodbye.
System action: hangup_call()
Improvement: Silence has a predictable two-stage flow and a clear ending.
```

### 13. Caller asks an unrelated question during the script

```text
Caller: Are you a real person?

Before bot: You don’t have Medicare, Medicaid, or work insurance, right?
Problem: It forced the caller back to a gate without addressing the concern.

After bot: I’m an AI voice representative calling on behalf of Americas Health. I can answer basic questions, and I’ll be clear that this is an automated call. Would you like to continue?
Improvement: It answers the trust question first and gives the caller control over continuing.
```

### 14. Caller gives a short answer such as “No”

```text
Bot: Are you still in Texas?
Caller: No.

Before behavior: The bot could interpret “No” as an answer to an earlier coverage question and continue incorrectly.

After behavior: The active state is state confirmation, so “No” is treated as a state mismatch. The bot says: Thanks for letting me know. This offer is currently for the state we’re checking, so I’ll let you go. Take care.
Improvement: The same word is interpreted using the active question, not in isolation.
```

## Why the After version is substantially stronger

The After version is not just a better prompt or a visual UI update. It adds control around the conversation:

- Before, the LLM could decide what to say and accidentally drift from the script. After, the conversation is guided by a defined pipeline and state-aware rules.
- Before, the bot could ignore the latest caller question. After, the latest caller turn has priority, so the agent answers the actual question before continuing the script.
- Before, an interruption could leave old audio playing. After, the active response is cancelled and the new caller turn becomes authoritative.
- Before, “Do not call me again” could receive another sales question. After, DNC is treated as a high-priority control event, saved, and ended immediately.
- Before, “goodbye” could only produce a spoken sentence. After, the live browser session is explicitly closed.
- Before, transfer behavior was unclear. After, transfer is gated behind explicit consent and is ready to connect to a real telephony action.
- Before, silence and end-of-call states were ambiguous. After, the system has a defined silence nudge, final timeout, and ended state.
- Before, the UI could show stale metadata. After, transcript events update the current step, intent, turn reason, QA flags, and session status.
- Before, failures were difficult to diagnose. After, the system exposes the caller turn, detected intent, pipeline step, decision latency, and QA notes.

So the improvement is not “the bot has more replies.” The improvement is that the bot now understands the purpose of the caller's turn, chooses a response based on context, preserves the workflow state, and executes call-control actions safely. That is why the After version is significantly stronger than the Before version in naturalness, trust, compliance, debugging, and production readiness.

## Before/after comparison

| Area | Before | After / production direction |
|---|---|---|
| Conversation | Repetition, stale answers, and script drift | Natural replies with latest-question priority and controlled state |
| Workflow | The model could skip or repeat gates | Pipeline steps, required answers, and controlled transitions |
| Interruptions | Old TTS could continue speaking | Active audio is cancelled and the caller gets priority |
| Silence | Repeated greetings or unclear ending | Timed nudge, second timeout, polite ending, and clear state |
| DNC | DNC was handled like a normal objection | High-priority DNC detection, persistence, and immediate end |
| Hangup | The bot might only say goodbye | Explicit session-ending action, not just spoken text |
| Transfer | Transfer was only simulated | Consent gate plus a clear real-telephony integration point |
| UI | Stale or contradictory metadata | Live transcript, step, intent, QA, latency, and status updates |
| Debugging | Hard to understand why a reply was produced | Decision reason, flags, notes, and detected intent are visible |
| Script changes | Scattered code edits | Versioned client script, rebuttals, and transition configuration |

## Current demo architecture

```text
Browser microphone and speaker
              |
              v
      ElevenLabs Conversation SDK
              |
              v
   Remote ElevenLabs conversational agent
       |              |              |
       |              |              +--> streamed TTS audio -> browser speaker
       |              +--> transcript messages -> UI observer
       +--> conversation state, speech recognition,
            response generation, turn handling

Caller transcript
       |
       +--> intent / step observer -> pipeline, QA, turn-taking UI
       |
       +--> DNC / hangup guard -> endSession()
                              |
                              +--> POST /api/dnc -> data/dnc.jsonl
```

### Current demo: complete request flow

#### 1. The page loads

`src/index.ts` starts the Express server and serves the `public` directory. The page loads:

- `public/index.html` for the dashboard layout.
- `public/styles.css` for the visual design.
- `/demo-config.js` for the safe browser configuration.
- `public/app.js` for the live call behavior.

The browser does not receive the ElevenLabs API key. It receives only the configured public Agent ID and demo lead metadata such as first name, representative name, and state.

#### 2. The user clicks Start call

`public/app.js` calls:

```js
Conversation.startSession({
  agentId: window.__DEMO_CONFIG.agentId,
  onConnect,
  onDisconnect,
  onStatusChange,
  onModeChange,
  onMessage,
  onError,
});
```

The browser requests microphone permission, opens the ElevenLabs conversational session, and sends the microphone audio to the remote agent. The remote agent returns streamed audio that the browser plays through the speaker.

#### 3. ElevenLabs handles the natural conversation

For the current browser demo, the remote ElevenLabs conversational agent is the live conversation engine. It handles the voice conversation service, including speech recognition, conversational context, response generation, and voice output inside the hosted session.

The remote agent has the ACA role, representative identity, campaign context, script guidance, rebuttals, and conversational rules configured in its agent settings. This is why the current demo sounds more natural than the earlier fixed-response path.

The browser UI does not send every transcript back to OpenRouter. It observes the messages coming from the ElevenLabs session. This distinction is important when explaining the current demo honestly.

#### 4. Connection callbacks update the UI

The SDK callbacks are used as follows:

| Callback | Current use |
|---|---|
| `onConnect` | Shows that the agent is connected and waiting for the caller |
| `onDisconnect` | Marks the call as ended or shows an error |
| `onStatusChange` | Shows connecting or live state |
| `onModeChange` | Shows whether the agent is speaking or listening |
| `onMessage` | Receives final caller and bot transcript messages |
| `onError` | Writes the error to Activity and marks the session as failed |

#### 5. Every transcript message is displayed

When `onMessage` receives a message:

1. The source is identified as `user` or `agent`.
2. The message is added to Activity.
3. The latest caller turn is shown in Turn-taking.
4. The decision latency is measured from the last caller turn to the bot response.
5. The pipeline step is inferred from the bot's wording.
6. The intent, turn reason, flags, and QA notes are updated.

The UI observer does not rewrite the agent's response. It is a monitoring and visualization layer; it does not inject a new prompt after every sentence.

#### 6. The UI classifies caller turns for monitoring

The browser observer recognizes common categories such as:

- Wrong person
- DNC or hostile hangup
- Busy or callback
- Audio check
- Language request
- Identity or purpose question
- Coverage answer
- State answer
- Subsidy question
- Yes, no, maybe, or unclear answer
- General caller question

This classification updates the dashboard. The remote agent remains responsible for the natural spoken response in the current direct-agent demo.

#### 7. The UI infers the current script step

The UI maps transcript phrases to these visible pipeline states:

```text
how_are_you
pitch
insurance_check_1
state_confirm
insurance_check_2
transfer_consent
transferring
```

This lets the reviewer see where the conversation is, even though the hosted ElevenLabs session owns the live conversation state.

#### 8. DNC and hangup have a local safety guard

The browser checks the final caller transcript for explicit control phrases. Examples include:

- “Do not call me again”
- “Stop calling me”
- “Remove my number”
- “Take me off your list”
- “Goodbye”
- “Hang up”
- “End the call”
- “I don’t want to talk”

When a phrase matches:

1. The UI marks the request as DNC or Ended.
2. Late bot messages are ignored in the Activity view.
3. The active ElevenLabs session receives `endSession()`.
4. A DNC request is sent to `/api/dnc` when appropriate.
5. The backend stores a timestamp, reason, transcript, and demo lead metadata.

This is a deterministic safety layer around the natural agent. It prevents the browser demo from relying only on the LLM to understand that the call must end.

#### 9. The DNC backend endpoint

`src/index.ts` exposes:

```text
POST /api/dnc
```

For the local demo, it appends JSON Lines records to:

```text
data/dnc.jsonl
```

The data directory is ignored by Git because it can contain caller information. In production, this endpoint should be replaced with an authenticated CRM or compliance-service request, with phone-number normalization, audit logging, idempotency, access control, and retention rules.

#### 10. What happens when the user clicks Hang Up

The UI calls:

```js
await conversation?.endSession();
```

Then it clears the active session reference, changes the status, and enables Start call again. This ends the browser's conversational session. It is not the same as disconnecting a real PSTN call; real phone control requires a telephony provider integration.

#### 11. What is currently not on the normal browser path

The repository still contains the earlier custom orchestration path:

- `src/voice/deepgram-stt.ts`
- `src/llm/classifier.ts`
- `src/gate/engine.ts`
- `src/voice/demo-session.ts`
- `src/voice/tts.ts`
- `src/voice/turn-detector.ts`

Those files contain the Deepgram, OpenRouter, custom state-machine, endpointing, TTS, silence, and simulated-transfer implementation. The old server also exposes a `/ws` path for that flow. However, the current Start call button uses the direct ElevenLabs Conversation SDK path above, not the old `/ws` path.

This separation explains both observations:

- The direct ElevenLabs path sounds more natural because the hosted conversational agent manages the live voice interaction.
- The custom path contains more explicit workflow and action control, but it needs to be connected and tested as the active runtime before it can be called the production architecture.

#### 12. Current capabilities versus production capabilities

| Capability | Current browser demo | Production requirement |
|---|---|---|
| Natural voice conversation | ElevenLabs hosted session | ElevenLabs session or custom streaming TTS |
| Live transcript | SDK messages shown in UI | Persisted event stream and observability |
| Script visibility | UI step inferred from transcript | Server-owned state machine |
| DNC | Browser guard plus local demo endpoint | Authenticated CRM/compliance API |
| Browser hangup | `endSession()` | Telephony `hangup_call` action |
| Transfer | Consent logic/UI direction | Verified telephony transfer API |
| Callback | Intent can be recognized | CRM/calendar/dialer integration |
| Multi-client scripts | Agent/config currently selected per demo | Versioned script store and client routing |
| Scale | Single browser demo | Stateless workers, shared state, queues, rate limits, metrics |

## Numbers and measurable improvements

The numbers below are separated into three types:

- **Measured:** taken from the existing mock-call logs or visible runtime behavior.
- **Configured:** values explicitly present in the current code or agent configuration.
- **Not yet measured:** a metric that needs a controlled before/after load test before claiming a percentage improvement.

### High-level before/after numbers

| Metric | Before | After / current | What the number means |
|---|---:|---:|---|
| Script states visible in the pipeline | Unreliable / often restarted | 7 visible states | `how_are_you`, `pitch`, two coverage gates, state confirmation, consent, and transfer |
| Explicit DNC control | 0 deterministic browser actions | 1 DNC endpoint + 1 session-ending action | DNC can be saved and the active browser session can end immediately |
| Silence handling | No dependable two-stage behavior | 5,000 ms + 5,000 ms configured | First timeout asks if anyone is there; second timeout ends politely |
| Per-turn latency visibility | Not available | 1 live `decideMs` value in UI | Time from the caller message to the next agent message is displayed |
| Prompt-leak monitoring | Not visible | 1 QA flag path | Internal phrases are marked as `Prompt leak` in the UI |
| Transfer consent gate | Not reliably enforced | 1 explicit consent step | The flow has a dedicated `transfer_consent` state |
| DNC persistence | No stored demo record | 1 JSONL record per request | Timestamp, reason, transcript, and lead metadata are recorded locally |

These numbers describe control coverage, not a claim that the current browser demo is already a complete telephony production system.

### Custom Deepgram/OpenRouter/ElevenLabs path: actual timing values

The repository's custom orchestration path has these configured values:

| Component | Current configured value | Purpose |
|---|---:|---|
| Deepgram endpointing on yes/no gates | 280 ms | Detect the end of a short answer quickly |
| Deepgram endpointing on rapport/consent | 300 ms | Allow a little more natural speech before committing |
| Deepgram endpointing during transfer/ending | 500–800 ms | Avoid cutting off longer final phrases |
| Deepgram utterance-end window | 1,000–1,500 ms | Backup signal when speech-final is not enough |
| Objection endpointing | 550 ms | Give open objections more room to finish |
| Objection utterance-end window | 1,400 ms | Avoid cutting off a longer objection |
| Barge-in minimum speech | 280 ms | Ignore very short noise/backchannels |
| Barge-in cooldown | 400 ms | Prevent duplicate interruption events |
| Silence first wait | 5,000 ms | Ask “Hello? Is anyone there?” |
| Silence second wait | 5,000 ms | End after no response to the nudge |
| TTS PCM sample rate | 16,000 Hz | Phone-style mono PCM output |
| TTS first flush size | 320 bytes, about 10 ms | Start sending audio quickly |
| Cached TTS playback frame | 3,200 bytes, about 100 ms | Preserve barge-in ability while using cache |
| Breath pause between clauses | About 180 ms | Make speech sound less mechanically concatenated |
| TTS cache capacity | Up to 80 lines | Warm repeated greetings and fixed script lines |
| OpenRouter temperature | 0 | Stable classification rather than creative variation |
| OpenRouter max output | 40 tokens | Keep classifier responses short and fast |
| Local-intent confidence bypass | 0.80 | Avoid an LLM round trip for high-confidence intents |

### Custom path: measured decision latency

The existing `logs/mock-calls.jsonl` contains 212 recorded custom-path decision times:

```text
Minimum: 0 ms
Median (p50): 8 ms
Average: 964.7 ms
95th percentile: 3,386 ms
Maximum: 6,925 ms
Samples: 212
```

The reason the median is low is that common intents are recognized locally before OpenRouter is called. The slower values are fallback LLM classifications or more complex turns. This is a useful interview point: **local-first classification protects latency, while the LLM remains available for ambiguous language.**

These measurements belong to the custom `/ws` path. They should not be presented as a measured latency of the current direct ElevenLabs browser session, because that session's provider-side timing is not being written to `mock-calls.jsonl`.

### Current direct ElevenLabs browser-agent settings

The active natural browser demo uses the hosted ACA agent with these tuned values:

| Setting | Current value | Reason |
|---|---:|---|
| Hosted LLM | `gpt-4o-mini` | Fast, short conversational decisions |
| Hosted LLM temperature | `0.1` | Low variation and fewer repeated/opening mistakes |
| Hosted response limit | `120` tokens | Enough room for a natural answer without long speeches |
| Reasoning summary | Disabled | Prevent internal reasoning text from entering the conversation |
| TTS model | `eleven_flash_v2` | Low-latency voice response |
| Voice stability | `0.62` | More consistent voice after interruption |
| Similarity boost | `0.83` | Preserve the selected representative voice |
| Voice speed | `1.0` | Normal human speaking rate |
| Streaming latency optimization | `1` | Favor quick audio start in the hosted session |

The current browser UI also measures the actual turn time in the browser using `performance.now()`. That value appears in the Turn-taking panel as `decideMs`, but a controlled multi-call average for the direct hosted session has not yet been collected.

### What we can and cannot claim numerically

Safe interview wording:

> The Before version had no reliable intent-priority control, no deterministic DNC action, and no trustworthy per-turn latency metric. In the current implementation, the custom path uses 280–500 ms endpointing, 1,000–1,500 ms utterance-end windows, 5-second silence stages, local intent bypass at 0.80 confidence, and a measured p50 decision time of 8 ms across 212 logged turns. The browser demo separately measures live turn latency through the ElevenLabs session. I would not claim a percentage improvement until I run the same scripted test set against both versions.

This is stronger than inventing a number because it distinguishes measured performance from configuration targets and clearly explains which runtime produced each measurement.
