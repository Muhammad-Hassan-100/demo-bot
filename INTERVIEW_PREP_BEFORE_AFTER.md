# AI Voice Bot Interview Preparation

## 1. Short introduction to say in the interview

> I reviewed the voice-bot demo from the perspective of a production conversational system. The main goals were to preserve the client script, make the conversation sound natural, handle interruptions correctly, reduce latency, and keep business actions deterministic.
>
> I separated conversational flexibility from business-critical actions. The LLM can understand natural language and objections, but actions such as ending a call, adding a number to the Do-Not-Call list, and transferring a caller must be controlled by explicit application logic or tools.

## 2. Before and after

| Area | Before | After / Recommended design |
|---|---|---|
| Conversation | The bot could repeat the opening or answer an old question | Always answer the caller's latest question first, then return to the script |
| Script | The flow could drift when the caller asked something unexpected | A state machine keeps the bot on the correct script step |
| LLM output | The model could expose internal instructions such as “the next step is…” | The model is restricted to caller-facing speech; prompt-leak phrases are monitored |
| Interruptions | The bot could continue speaking after the caller interrupted | Barge-in cancels pending playback and gives priority to the caller |
| Silence | Silence could cause repeated greetings or an unclear state | After about five seconds ask “Hello? Is anyone there?”; after another timeout end politely |
| DNC | “Do not call me again” could be treated like a normal objection | Detect DNC as a high-priority intent, persist it, and end the session immediately |
| Hangup | The bot might say goodbye but keep the session alive | Use an explicit `hangup_call` action instead of relying only on prompt wording |
| Transfer | Transfer was only a simulated event | Require explicit consent, then call a real telephony transfer tool |
| Voice | TTS could sound slightly unstable after interruption | Use streaming TTS, tuned stability/similarity, and cancel old audio on barge-in |
| UI | UI could show stale pipeline or turn information | UI consumes connection, transcript, intent, step, and end events |
| Script changes | Script changes would require editing scattered code | Store versioned client scripts, rebuttals, and state transitions separately |

## 3. Current demo architecture

The current natural demo uses the ElevenLabs conversational session for the live browser conversation:

```text
Browser microphone
        |
        v
ElevenLabs conversational agent
        |
        +--> live transcript events --> UI observer
        |
        +--> audio response --> browser speaker
```

For a production multi-client system, I would use the company's full orchestration stack:

```text
Caller audio
   |
   v
Deepgram STT
   |
   v
Turn detector / interruption handler
   |
   v
Intent classifier + state machine
   |                  |
   |                  +--> DNC / hangup / callback / transfer tools
   |
   v
OpenRouter LLM for natural replies and rebuttals
   |
   v
ElevenLabs streaming TTS
   |
   v
Caller audio
```

The important design decision is that the LLM should not directly decide whether a legally or operationally important action happened. It should return a structured intent; the application validates it against the current state and then executes the action.

## 4. Script flow

The ACA demo flow is:

1. Rapport / greeting
2. Introduce the representative and recorded-line notice
3. Ask whether the caller has received the ACA subsidy
4. Check Medicare, Medicaid, or work insurance
5. Confirm the caller's state
6. Re-check coverage
7. Ask for permission to connect the caller
8. Transfer only after explicit consent

The flow must never be blindly linear. If the caller asks “Who is calling?”, the agent answers that question first. After answering, it returns to the current state instead of restarting the greeting.

## 5. Priority rules for every caller turn

I would evaluate every transcript in this order:

1. DNC request
2. Explicit hangup, goodbye, wrong person, or hostile end request
3. Safety or urgent situation, such as driving
4. Transfer consent or refusal
5. Direct caller question
6. Current script gate
7. Rebuttal or clarification
8. Fallback clarification

This priority order prevents a caller's latest request from being ignored by the script.

## 6. Deterministic actions

The production agent should have server-side tools similar to these:

```ts
type CallAction =
  | { type: "hangup_call"; reason: string }
  | { type: "add_to_dnc"; reason: string }
  | { type: "schedule_callback"; requestedTime?: string }
  | { type: "transfer_call"; destination: string; consent: true }
  | { type: "continue_script"; step: string };
```

Expected DNC behavior:

```text
Caller: “Please remove my number from your list.”
Agent: “Understood. I’ll mark this number as Do Not Call. Goodbye.”
System: add_to_dnc()
System: hangup_call()
```

The DNC action should be idempotent, meaning repeating the request should not create a harmful duplicate or accidentally remove the protection.

Expected transfer behavior:

```text
Caller: “Please transfer me.”
System: Verify all required gates are complete.
Agent: Ask for explicit consent if it has not already been given.
System: transfer_call() only after consent=true.
```

## 7. How I would reduce latency

- Use streaming STT instead of waiting for a complete recording.
- Use endpointing and utterance-end signals to decide when the caller has finished.
- Stream TTS as soon as a safe response is available.
- Keep the prompt and conversation context small.
- Use a fast model for classification and short rebuttals.
- Cache stable audio such as greetings, disclosures, and silence prompts.
- Pre-warm common TTS lines, but do not cache personal or sensitive content.
- Measure STT finalization, LLM decision, first audio byte, and total response latency separately.

## 8. How I would make it sound human

Naturalness is not only the voice model. It also depends on:

- Short spoken sentences instead of written paragraphs.
- Acknowledging what the caller actually said.
- Avoiding repeated greetings and repeated full pitches.
- Asking one question at a time.
- Using small natural transitions such as “Got it” or “That makes sense.”
- Respecting interruptions immediately.
- Never exposing internal reasoning, state names, or script instructions.
- Keeping a consistent persona and pronunciation.

## 9. How I would support weekly script changes

I would represent each client script as versioned configuration:

```text
client_id
script_version
states
required_answers
rebuttals
disqualifying_conditions
transfer_rules
compliance_disclosures
```

Before activating a new version, I would run regression scenarios for:

- Normal qualification
- Wrong person
- Not interested
- DNC request
- Already insured
- State mismatch
- Callback request
- Silence
- Repeated question
- Barge-in during TTS
- Transfer refusal and transfer consent

## 10. Why use OpenRouter, Deepgram, and ElevenLabs?

These services are not theoretically mandatory. They are important here because they are the company's existing production stack and the assignment is to improve an existing system.

- Deepgram: streaming speech-to-text and turn signals.
- OpenRouter: model routing, classification, rebuttals, and model flexibility.
- ElevenLabs: natural streaming text-to-speech or conversational voice agent.
- Custom orchestration: script state, compliance rules, tool actions, observability, and integrations.

The provider can be replaced behind interfaces, but changing providers should not require rewriting the script engine or business logic.

## 11. What to say about the current demo honestly

> The demo now uses a natural ElevenLabs conversational session for the live browser experience, while the UI observes transcript and session events. I added deterministic client-side protection for explicit DNC and hangup requests, plus a backend endpoint that records DNC requests for the demo.
>
> For production telephony, I would move those controls to authenticated server-side tools. The browser demo proves the interaction, but a real phone hangup, CRM DNC write, callback, or warm transfer must be connected to the telephony and CRM APIs.

Do not claim that a local demo has completed a real phone transfer unless it is connected to a telephony provider and the transfer is verified end-to-end.

## 12. Likely interview questions and answers

### Why not let the LLM control everything?

> LLMs are good at language understanding, but deterministic actions need stronger guarantees. I let the model classify the caller's intent and generate a safe response, then validate the intent against the state machine before executing hangup, DNC, or transfer.

### Why do we need a state machine if we already have an LLM?

> The state machine protects the business process. It prevents the model from skipping a required gate, asking the wrong question, or restarting the call. The LLM handles flexible language inside the current state.

### How do you handle interruptions?

> I detect speech while TTS is playing, cancel the current audio generation and playback, increment the turn generation, and process the latest caller transcript. Old asynchronous audio is ignored using the generation ID.

### How do you prevent prompt leakage?

> The prompt explicitly requires caller-facing speech only, but I also monitor output for internal phrases. More importantly, I keep state and tool execution outside the model's free-form response and reject unsafe tool calls.

### Why cache audio?

> Stable lines such as the greeting or disclosure are repeated frequently. Caching or pre-warming them reduces first-audio latency and provider load. I would never cache sensitive or caller-specific content.

### How do you scale to a million calls per month?

> I would keep call workers stateless, store session state in a shared durable store, use queues for non-real-time work, apply provider rate limits, and add metrics for latency, error rate, hangup reasons, transfer success, and DNC persistence. I would also use idempotency keys for actions such as DNC and transfer.

### What would you improve next?

> I would add authenticated server-side tools for hangup, DNC, callback, and transfer; connect the CRM; version scripts per client; add automated conversation regression tests; and run latency and interruption tests under realistic load.

## 13. Demo test sequence

Use one phrase at a time and wait for the response:

1. “Who is calling?”
2. “I don’t have Medicare, Medicaid, or work insurance.”
3. “I’m still in Texas.”
4. “Do you have to transfer me?”
5. “No, don’t transfer me.”
6. Start another call and say: “Please remove my number from your list.”
7. Start another call and say: “I don’t want to talk. Goodbye.”
8. Start another call, stay silent for five seconds, then remain silent again.
9. Interrupt the bot while it is speaking: “Wait, I have a question.”

For every test, verify both the spoken reply and the UI state. A correct transcript alone is not enough; the actual session, DNC record, and transfer action must also be correct.

## 14. Final one-minute answer

> My approach is to combine an LLM's conversational flexibility with deterministic workflow control. Deepgram handles streaming transcription, OpenRouter handles intent and natural replies, and ElevenLabs handles streaming voice. A custom state machine keeps the agent aligned with the client's script. High-priority intents such as DNC, hangup, callback, and transfer are handled through explicit validated tools rather than prompt instructions alone. I also focus on barge-in handling, short responses, TTS streaming, caching stable lines, and metrics for end-to-end latency. This gives us a bot that sounds natural while remaining compliant, testable, and maintainable when client scripts change.
