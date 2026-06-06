// frontend/src/features/Meeting/components/CallEnded.jsx
//
// Brief full-screen "Call ended" overlay shown to the party that did NOT hang
// up, before they're returned to the chat. Mirrors WhatsApp: the person who
// ends the call leaves immediately; the other sees a short confirmation.

import { FiPhoneOff } from "react-icons/fi";

const LABELS = {
  completed: "Call ended",
  declined: "Call declined",
  cancelled: "Call cancelled",
  no_answer: "No answer",
  abandoned: "Call ended",
  failed: "Call disconnected",
};

function CallEnded({ reason }) {
  const label = LABELS[reason] || "Call ended";
  return (
    <div
      className="call-ended-overlay"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "black",
        color: "white",
        zIndex: 3000,
        gap: 16,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "#d61314",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
        }}
      >
        <FiPhoneOff />
      </div>
      <div style={{ fontSize: 18, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export default CallEnded;
