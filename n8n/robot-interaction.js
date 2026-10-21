// Pure interaction planner. Dispatch, persistent dedup and device ACK belong to the caller.
function planRobot(input, now = Date.now()) {
  const states = ["sleep", "awake", "listening", "thinking", "speaking"];
  const events = ["presence", "wakeword", "question", "answer", "audio_finished", "idle_timeout", "fault"];
  const validId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
  const result = { robot_id: input.robot_id, event_id: input.event_id, dispatch: false, execute: false, next_state: input.state, steps: [] };
  const hold = reason => ({ ...result, reason });
  if (!validId(input.robot_id) || !validId(input.event_id)) return hold("invalid_identity");
  if (!states.includes(input.state) || !events.includes(input.event)) return hold("invalid_event_or_state");
  const observed = Date.parse(input.observed_at);
  if (!Number.isFinite(observed) || observed > now + 5000 || now - observed > 30000) return hold("stale_event");
  if (input.quiet === true) return hold("quiet_mode");
  result.command_id = `interaction:${input.robot_id}:${input.event_id}`;
  result.expires_at = new Date(now + 30000).toISOString();
  const wake = { action: "face", expression: "waking", duration_ms: 1600,
    keyframes: [{ at_ms: 0, eyes: "closed" }, { at_ms: 500, eyes: "half_open" },
      { at_ms: 1000, eyes: "open" }, { at_ms: 1250, eyes: "blink" }, { at_ms: 1600, eyes: "open", expression: "happy" }] };
  const listen = { action: "listen", expression: "listening", start_after: "previous_step_completed", timeout_ms: 9000,
    wake_detector: true, record_question: true, auto_submit_after_silence_ms: 1100 };
  const complete = (state, steps, reason = "ready") => ({ ...result, execute: true, next_state: state, steps, reason });
  if (input.event === "presence") {
    if (input.state !== "sleep" || input.active_job_id) return hold("already_awake_or_busy");
    const lastGreeting = input.last_greeted_at == null ? null : Date.parse(input.last_greeted_at);
    if (lastGreeting !== null && !Number.isFinite(lastGreeting)) return hold("invalid_greeting_time");
    if (lastGreeting !== null && now - lastGreeting < 120000) return hold("greeting_cooldown");
    return complete("awake", [wake, { action: "prepare_greeting", expression: "happy",
      text: "Halo, saya AERO-BOT. Ada yang bisa saya bantu?", tts_provider: "gemini", start_after: "previous_step_completed",
      after_audio: "emit_audio_finished" }], "presence_indication");
  }
  if (input.event === "wakeword") {
    if (["thinking", "speaking"].includes(input.state) || input.active_job_id) return hold("conversation_busy");
    return complete("listening", [...(input.state === "sleep" ? [wake] : []), listen]);
  }
  if (input.event === "question") {
    if (!["awake", "listening"].includes(input.state) || input.active_job_id) return hold("question_not_expected");
    return complete("thinking", [{ action: "pause_question_capture", wake_detector: true },
      { action: "face", expression: "thinking" }, { action: "route_robot_chat" }]);
  }
  if (input.event === "answer") {
    if (input.state !== "thinking") return hold("answer_not_expected");
    if (!validId(input.job_id) || input.job_id !== input.active_job_id) return hold("answer_job_mismatch");
    if (typeof input.text !== "string" || !input.text.trim() || input.text.length > 2000) return hold("invalid_answer");
    if (input.audio_ready !== true) return hold("audio_not_ready");
    // Tone comes from the validated answer metadata, never a claim that an IR object is human.
    const expression = ["neutral", "happy", "concerned"].includes(input.answer_expression) ? input.answer_expression : "neutral";
    return complete("speaking", [{ action: "pause_question_capture", wake_detector: true },
      { action: "speak", job_id: input.job_id, text: input.text, expression, mouth_sync: "local_audio_rms",
        start_after: "audio_playback_started", after_audio: "emit_audio_finished" }]);
  }
  if (input.event === "audio_finished") {
    if (input.state !== "speaking" || !validId(input.job_id) || input.job_id !== input.active_job_id) return hold("audio_ack_mismatch");
    return complete("listening", [listen]);
  }
  if (input.event === "idle_timeout") {
    if (!["awake", "listening"].includes(input.state) || input.active_job_id) return hold("conversation_busy");
    const lastInteraction = Date.parse(input.last_interaction_at);
    if (!Number.isFinite(lastInteraction) || now - lastInteraction < 120000) return hold("idle_not_reached");
    return complete("sleep", [{ action: "stop_question_capture", wake_detector: true },
      { action: "face", expression: "sleeping", duration_ms: 1200, eyes: "close_slowly" }]);
  }
  return complete("awake", [{ action: "face", expression: "error" },
    { action: "accessible_notice", text: "Maaf, koneksi AERO-BOT sedang bermasalah. Silakan coba lagi." }], "fault");
}
return { json: planRobot($json) };
