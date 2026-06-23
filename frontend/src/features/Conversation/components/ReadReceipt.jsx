// frontend/src/features/Conversation/components/ReadReceipt.jsx
//
// WhatsApp-style status tick shown on the author's own messages:
//   • single gray check  → "sent"
//   • double gray check   → "delivered"
//   • double blue check   → "read"
// Rendered as inline SVG so it needs no extra icon dependency.

const GRAY = '#8696a0';
const BLUE = '#53bdeb';

function SingleCheck({ color }) {
  return (
    <svg viewBox="0 0 16 11" width="16" height="11" aria-hidden="true">
      <path
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 6.2 L6.2 8.9 L12.5 2"
      />
    </svg>
  );
}

function DoubleCheck({ color }) {
  return (
    <svg viewBox="0 0 18 11" width="18" height="11" aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.5 6.2 L4.2 8.9 L10.5 2" />
        <path d="M6.5 8.6 L7.2 8.9 L13.5 2" />
      </g>
    </svg>
  );
}

function ReadReceipt({ status }) {
  let node;
  if (status === 'read') node = <DoubleCheck color={BLUE} />;
  else if (status === 'delivered') node = <DoubleCheck color={GRAY} />;
  else node = <SingleCheck color={GRAY} />;

  return (
    <span
      className={`read-receipt read-receipt-${status || 'sent'}`}
      title={status === 'read' ? 'Read' : status === 'delivered' ? 'Delivered' : 'Sent'}
      style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4, verticalAlign: 'middle' }}
    >
      {node}
    </span>
  );
}

export default ReadReceipt;
