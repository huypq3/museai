# VoiceChat FSM Migration Guide — v2

## State diagram tóm tắt

```text
connecting ──[WS_CONNECTED]──────────────────────────► ready
                                                         │
                  ┌──────────────────────────────────────┤
                  │ ASK_VOICE          │ ASK_TEXT          │ GREETING_REQUESTED
                  ▼                   ▼                   ▼
              recording         text_input_open       ai_speaking
                  │ END_OF_TURN        │ TEXT_SENT          │ INTERRUPT → draining (intent=ask_voice)
                  ▼                   ▼                     │ STOP     → draining (intent=stop)
              processing ◄───────────┘                     │ TURN_COMPLETE
                  │ FIRST_AI_CHUNK                          ▼
                  ▼                                      ready
              ai_speaking ──[TURN_COMPLETE]──────────► ready

draining ──[TURN_COMPLETE old]──► recording        (intent=ask_voice)
                               ──► text_input_open  (intent=ask_text)
                               ──► paused           (intent=stop)

ANY ──[WS_DISCONNECTED]──► reconnecting ──[WS_CONNECTED]──► ready
ANY ──[FATAL_ERROR]──────► error
ANY ──[SESSION_ENDED]────► session_ended
```

## Hook đã triển khai

- `frontend/hooks/useVoiceFSM.ts`
- API chính:
  - `state`, `stateRef`
  - `is.*` booleans
  - `can(event)`, `dispatch(event)`
  - `drainingIntent`, `previousState`, `getLog()`

## VoiceChat integration checklist

1. Replace local state machine (`setState`, `skipOldTurnRef`) bằng `useVoiceFSM`.
2. Map websocket lifecycle vào FSM:
   - `WS_CONNECTED`, `WS_DISCONNECTED`, `SESSION_ENDED`.
3. Map turn lifecycle vào FSM:
   - `ASK_VOICE`, `END_OF_TURN`, `FIRST_AI_CHUNK`, `TURN_COMPLETE`, `TURN_COMPLETE_EMPTY`.
4. Khi interrupt/stop:
   - vào `draining`, chặn xử lý old turn cho tới `TURN_COMPLETE` hoặc `DRAINING_TIMEOUT`.
5. UI guard dùng `is.*` + `is.inputBlocked` thay vì condition rời rạc.

## Safety rules

- Chỉ cho gửi audio khi đang `recording`.
- Không nhận input mới khi `draining`.
- Timeout bắt buộc:
  - `PROCESSING_TIMEOUT` (15s)
  - `DRAINING_TIMEOUT` (5s)
