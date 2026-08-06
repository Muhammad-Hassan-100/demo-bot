# Voice Bot — Before and After

## Before

- The conversation could repeat the greeting or restart the script.
- The bot sometimes answered an old script question instead of the caller's latest question.
- Unexpected questions could move the agent to the wrong pipeline step.
- Internal reasoning or instructions could appear in the spoken response.
- The bot could continue speaking after an interruption.
- Silence could cause repeated greetings or unclear call state.
- DNC phrases such as “Do not call me again” could be treated as normal objections.
- Saying goodbye did not always end the live session.
- Transfer was only represented as a demo event, not a real telephony transfer.
- UI fields could show stale step, intent, or turn information.

## After

- The agent answers the caller's latest question first, then returns to the script.
- A state machine protects the required ACA workflow and coverage gates.
- Prompt-leak phrases are monitored and flagged.
- Interruptions cancel pending audio so the caller gets priority.
- Silence handling can ask “Hello? Is anyone there?” and then end politely.
- Explicit DNC phrases trigger immediate session ending.
- DNC requests are sent to a backend endpoint for persistence in the demo.
- Explicit hangup phrases end the browser session instead of relying only on prompt wording.
- Transfer requires explicit consent and should call a real telephony tool in production.
- UI observes connection, transcript, pipeline step, intent, QA flags, and end events.
- Voice settings and streaming behavior are tuned for more stable responses after barge-in.

## Before/after comparison

| Area | Before | After / production direction |
|---|---|---|
| Conversation | Repetition and stale answers | Latest-question priority |
| Workflow | Script could drift | State machine and required gates |
| Interruptions | Old TTS could continue | Cancel old playback immediately |
| Silence | Repeated or unclear behavior | Nudge after timeout, then hangup |
| DNC | Normal objection handling | High-priority DNC action and persistence |
| Hangup | Verbal goodbye only | Explicit session-ending action |
| Transfer | Simulated event | Validated consent plus telephony tool |
| UI | Stale metadata | Live transcript and state observer |
| Script changes | Scattered edits | Versioned client script configuration |

## Current demo architecture

```text
Browser microphone
        |
        v
ElevenLabs conversational agent
        |
        +--> transcript events --> UI observer
        |
        +--> streamed audio --> browser speaker
```

## Recommended production architecture

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
Intent classifier + script state machine
   |                         |
   |                         +--> DNC / hangup / callback / transfer tools
   v
OpenRouter LLM for natural replies and rebuttals
   |
   v
ElevenLabs streaming TTS
   |
   v
Caller audio
```

## Current demo limitation

The browser demo proves the natural conversation and UI behavior. Real phone-level hangup, CRM DNC, callback scheduling, and warm transfer require authenticated server-side integrations with the telephony and CRM systems.

Do not describe the demo as a completed real transfer unless it is connected and tested end-to-end with a telephony provider.
