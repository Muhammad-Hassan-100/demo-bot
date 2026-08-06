# Voice Bot — Before and Current After

## What was actually wrong before

During the earlier tests, the bot often failed to prioritize the caller's latest question. Whatever the caller asked, it could repeat the same opening, subsidy pitch, or current script question.

Examples:

- Caller: “Who is calling?”
  - Bot: repeated the subsidy question or greeting.
- Caller: “Can you hear me?”
  - Bot: continued with the current insurance question.
- Caller: “I’m not Jordan.”
  - Bot: could still say “Hi Jordan.”
- Caller: “Why are you calling me?”
  - Bot: repeated the same subsidy pitch.
- Caller: “Do not call me again.”
  - Bot: could continue with a sales question instead of respecting the request.
- Caller: “Goodbye.”
  - Bot: could ask for confirmation or fail to end the session immediately.
- Caller remained silent.
  - Bot: could repeat the greeting or the previous question.
- Caller interrupted the bot.
  - Bot: could continue the old audio or old question.

This made the caller feel that the bot was not listening. As a result, the conversation felt repetitive and trust was reduced.

## Current active demo flow

```text
Browser microphone
        |
        v
ElevenLabs Conversation SDK
        |
        v
ElevenLabs conversational agent
        |
        +--> streamed voice -> browser speaker
        +--> transcript events -> UI observer
```

### Step 1: The call starts

The user clicks **Start call**. The browser requests microphone permission and opens a live session with the configured ElevenLabs conversational agent through the Conversation SDK.

The browser does not receive the ElevenLabs API secret. It receives the public Agent ID and demo lead metadata.

### Step 2: Caller audio reaches the agent

The caller speaks into the microphone. The audio goes to the active ElevenLabs conversational session. The agent uses its configured identity, ACA context, conversation instructions, and current context to generate a response.

### Step 3: The agent replies with natural voice

The ElevenLabs agent streams the response back as voice, and the browser plays it through the speaker. This hosted conversational session is why the current demo sounds more natural than the earlier fixed and repetitive response behavior.

### Step 4: Transcript events update the UI

Final caller and bot messages arrive through the `onMessage` callback.

The UI then:

1. Adds the caller or bot message to Activity.
2. Shows the latest caller turn in the Turn-taking panel.
3. Classifies the caller's words into a visible intent.
4. Infers the current pipeline step from the conversation.
5. Updates the turn reason, QA flags, and notes.
6. Displays `decideMs` from the caller transcript to the next bot transcript.

The UI does not rewrite the agent's response. It observes the natural session and displays its state.

### Step 5: The pipeline is shown in the UI

The visible pipeline contains:

```text
how_are_you
pitch
insurance_check_1
state_confirm
insurance_check_2
transfer_consent
transferring
```

The UI updates these visible steps from the transcript so the reviewer can follow the conversation.

### Step 6: The latest caller question gets priority

The important improvement is that the caller's latest question is handled before continuing the script.

```text
Caller: Who is calling?
After bot: This is Alex with Americas Health. I’m calling for a quick ACA health-subsidy eligibility check. The call is recorded. Have you received that subsidy before?
```

```text
Caller: Why are you calling me?
After bot: I’m calling to check whether you may qualify for an ACA health-subsidy option. I’m only checking a few eligibility questions.
```

```text
Caller: I’m not Jordan.
After bot: I’m sorry about that. I may have the wrong person, so I’ll let you go. Take care.
```

The agent no longer treats every caller turn as if it were an answer to the same subsidy question.

### Step 7: DNC and hangup protection

The browser checks the final caller transcript for explicit phrases such as:

- “Do not call me again”
- “Stop calling me”
- “Remove my number”
- “Take me off your list”
- “Goodbye”
- “Hang up”
- “End the call”
- “I don’t want to talk”

When a phrase matches:

1. The UI shows a DNC or Ended status.
2. The active session is closed with `conversation.endSession()`.
3. A DNC request is sent to `/api/dnc` when appropriate.
4. Late bot messages are ignored in Activity.

The DNC record is saved locally in `data/dnc.jsonl` with the timestamp, reason, transcript, and demo lead metadata. This is a local demo record, not a real CRM or carrier-level Do-Not-Call registration.

### Step 8: Manual Hang Up

When the user clicks **Hang Up**, the browser runs:

```js
await conversation?.endSession();
```

The session is ended, the status changes, and Start call becomes available again. This ends the browser conversation session; it is not a real PSTN call-control integration.

### Step 9: Silence and interruption

The active ElevenLabs conversational session handles live turn-taking and the natural voice interaction. The UI observes the session and its transcript events.

If the caller says an explicit DNC or hangup phrase, the local browser guard ends the session. Normal live interruption behavior is handled by the active ElevenLabs session.

## Before and current After comparison

| Situation | Before | Current After |
|---|---|---|
| Caller asks who is calling | The bot could repeat the pitch | The agent explains its identity and purpose |
| Caller asks “Can you hear me?” | The script gate could continue | The agent responds to the audio question |
| Caller says they are the wrong person | The wrong name could be repeated | The agent can acknowledge the wrong person and end politely |
| Caller asks why they are being called | An unrelated subsidy question could return | The call purpose is explained first |
| Caller requests DNC | The sales script could continue | An explicit phrase triggers the local DNC and end-session guard |
| Caller says goodbye | The bot could ask unnecessary confirmation | The session-ending action can run immediately |
| Caller asks an unexpected question | The old question could be repeated | The latest caller turn receives priority |
| UI status | Transcript or step could become stale | Transcript, step, intent, and status are updated from events |
| Conversation feel | Fixed and repetitive | Natural hosted ElevenLabs conversation |

## Current remote agent settings

The current configured agent settings are:

| Setting | Value |
|---|---:|
| Hosted model | `gpt-4o-mini` |
| Temperature | `0.1` |
| Response limit | `120` tokens |
| Reasoning summary | Disabled |
| Voice model | `eleven_flash_v2` |
| Stability | `0.62` |
| Similarity boost | `0.83` |
| Speed | `1.0` |
| Streaming optimization | `1` |

## What can be stated about latency

The current UI displays `decideMs`, which is the browser-side time between receiving the caller transcript and receiving the next bot transcript.

A controlled average, p50, or p95 benchmark for the direct ElevenLabs session has not been collected yet. Therefore, an exact percentage improvement should not be claimed.

## Current demo summary

```text
Caller speaks
  -> ElevenLabs agent understands and responds
  -> Voice is streamed to the browser speaker
  -> Transcript events appear in Activity
  -> UI updates step, intent, and session status
  -> Explicit DNC or hangup phrase ends the session
```

This is the current active demo flow.
