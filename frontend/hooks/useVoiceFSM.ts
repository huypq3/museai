import { useReducer, useRef, useCallback, useEffect, type MutableRefObject } from "react";

export type VoiceState =
  | "connecting"
  | "ready"
  | "recording"
  | "processing"
  | "ai_speaking"
  | "draining"
  | "paused"
  | "text_input_open"
  | "reconnecting"
  | "error"
  | "session_ended";

export type DrainingIntent = "ask_voice" | "ask_text" | "stop";

export type VoiceEvent =
  | { type: "WS_CONNECTED" }
  | { type: "WS_DISCONNECTED" }
  | { type: "GREETING_REQUESTED" }
  | { type: "ASK_VOICE" }
  | { type: "ASK_TEXT" }
  | { type: "TEXT_SENT" }
  | { type: "TEXT_CANCELLED" }
  | { type: "INTERRUPT"; drainingIntent?: DrainingIntent }
  | { type: "STOP_PRESSED"; drainingIntent?: DrainingIntent }
  | { type: "END_OF_TURN" }
  | { type: "NO_SPEECH" }
  | { type: "CANCEL_RECORDING" }
  | { type: "FIRST_AI_CHUNK" }
  | { type: "TURN_COMPLETE" }
  | { type: "TURN_COMPLETE_EMPTY" }
  | { type: "RESUME_PRESSED" }
  | { type: "PROCESSING_TIMEOUT" }
  | { type: "DRAINING_TIMEOUT" }
  | { type: "FATAL_ERROR"; message?: string }
  | { type: "SESSION_ENDED" };

export type TransitionLog = {
  from: VoiceState;
  event: VoiceEvent["type"];
  to: VoiceState;
  ts: number;
  meta?: string;
};

type FSMState = {
  current: VoiceState;
  previous: VoiceState | null;
  drainingIntent: DrainingIntent | null;
  log: TransitionLog[];
};

const DR = "_DR_" as const;
type NextState = VoiceState | typeof DR;
type StateMap = Partial<Record<VoiceEvent["type"], NextState>>;
type Table = Partial<Record<VoiceState, StateMap>>;

const GLOBAL: StateMap = {
  WS_DISCONNECTED: "reconnecting",
  FATAL_ERROR: "error",
  SESSION_ENDED: "session_ended",
};

const TRANSITIONS: Table = {
  connecting: {
    ...GLOBAL,
    WS_CONNECTED: "ready",
  },
  ready: {
    ...GLOBAL,
    GREETING_REQUESTED: "ai_speaking",
    ASK_VOICE: "recording",
    ASK_TEXT: "text_input_open",
  },
  recording: {
    ...GLOBAL,
    END_OF_TURN: "processing",
    NO_SPEECH: "ready",
    CANCEL_RECORDING: "ready",
  },
  processing: {
    ...GLOBAL,
    FIRST_AI_CHUNK: "ai_speaking",
    TURN_COMPLETE: "ai_speaking",
    TURN_COMPLETE_EMPTY: "ready",
    PROCESSING_TIMEOUT: "ready",
  },
  ai_speaking: {
    ...GLOBAL,
    TURN_COMPLETE: "ready",
    INTERRUPT: "draining",
    STOP_PRESSED: "draining",
  },
  draining: {
    ...GLOBAL,
    TURN_COMPLETE: DR,
    DRAINING_TIMEOUT: DR,
  },
  paused: {
    ...GLOBAL,
    RESUME_PRESSED: "ai_speaking",
    ASK_VOICE: "recording",
    ASK_TEXT: "text_input_open",
  },
  text_input_open: {
    ...GLOBAL,
    TEXT_SENT: "processing",
    TEXT_CANCELLED: "ready",
    ASK_VOICE: "recording",
  },
  reconnecting: {
    FATAL_ERROR: "error",
    SESSION_ENDED: "session_ended",
    WS_CONNECTED: "ready",
  },
  error: {},
  session_ended: {},
};

function resolveDraining(intent: DrainingIntent | null): VoiceState {
  if (intent === "ask_voice") return "recording";
  if (intent === "ask_text") return "text_input_open";
  return "paused";
}

function fsmReducer(state: FSMState, event: VoiceEvent): FSMState {
  const table = TRANSITIONS[state.current];
  const nextRaw = table?.[event.type];

  if (nextRaw === undefined) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[FSM] ⚠️ INVALID: ${state.current} + ${event.type} -> ignored`);
    }
    return state;
  }

  let next: VoiceState = nextRaw === DR ? resolveDraining(state.drainingIntent) : (nextRaw as VoiceState);

  if (
    (event.type === "CANCEL_RECORDING" || event.type === "NO_SPEECH" || event.type === "TEXT_CANCELLED") &&
    state.previous === "paused"
  ) {
    next = "paused";
  }

  let drainingIntent = state.drainingIntent;
  if (next === "draining") {
    if (event.type === "INTERRUPT") drainingIntent = event.drainingIntent ?? "ask_voice";
    if (event.type === "STOP_PRESSED") drainingIntent = event.drainingIntent ?? "stop";
  }
  if (state.current === "draining" && next !== "draining") {
    drainingIntent = null;
  }

  const meta =
    next === "draining"
      ? `intent=${drainingIntent}`
      : state.current === "draining"
        ? `resolved_intent=${state.drainingIntent}`
        : undefined;
  const entry: TransitionLog = {
    from: state.current,
    event: event.type,
    to: next,
    ts: Date.now(),
    meta,
  };

  if (process.env.NODE_ENV !== "production") {
    const tag = meta ? ` [${meta}]` : "";
    console.log(`[FSM] ✅ ${state.current} --[${event.type}]--> ${next}${tag}`);
  }

  return {
    current: next,
    previous: state.current,
    drainingIntent,
    log: [...state.log.slice(-49), entry],
  };
}

export type VoiceFSM = {
  state: VoiceState;
  stateRef: MutableRefObject<VoiceState>;
  drainingIntent: DrainingIntent | null;
  previousState: VoiceState | null;
  dispatch: (event: VoiceEvent) => void;
  can: (eventType: VoiceEvent["type"]) => boolean;
  getLog: () => TransitionLog[];
  is: {
    connecting: boolean;
    ready: boolean;
    recording: boolean;
    processing: boolean;
    aiSpeaking: boolean;
    draining: boolean;
    paused: boolean;
    textInputOpen: boolean;
    reconnecting: boolean;
    error: boolean;
    sessionEnded: boolean;
    aiActive: boolean;
    inputBlocked: boolean;
  };
};

export function useVoiceFSM(): VoiceFSM {
  const [fsm, dispatch] = useReducer(fsmReducer, {
    current: "connecting",
    previous: null,
    drainingIntent: null,
    log: [],
  });

  const stateRef = useRef<VoiceState>("connecting");
  useEffect(() => {
    stateRef.current = fsm.current;
  }, [fsm]);

  const can = useCallback((eventType: VoiceEvent["type"]): boolean => {
    const table = TRANSITIONS[stateRef.current];
    return table !== undefined && eventType in table;
  }, []);

  const getLog = useCallback(() => fsm.log, [fsm.log]);

  const s = fsm.current;
  const is = {
    connecting: s === "connecting",
    ready: s === "ready",
    recording: s === "recording",
    processing: s === "processing",
    aiSpeaking: s === "ai_speaking",
    draining: s === "draining",
    paused: s === "paused",
    textInputOpen: s === "text_input_open",
    reconnecting: s === "reconnecting",
    error: s === "error",
    sessionEnded: s === "session_ended",
    aiActive: s === "ai_speaking" || s === "processing",
    inputBlocked:
      s === "connecting" ||
      s === "reconnecting" ||
      s === "processing" ||
      s === "draining" ||
      s === "error" ||
      s === "session_ended",
  };

  return {
    state: fsm.current,
    stateRef,
    drainingIntent: fsm.drainingIntent,
    previousState: fsm.previous,
    dispatch,
    can,
    getLog,
    is,
  };
}
