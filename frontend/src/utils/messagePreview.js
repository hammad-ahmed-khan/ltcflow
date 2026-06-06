// frontend/src/utils/messagePreview.js
//
// Single source of truth for the short text that represents a message in
// previews (room list, notifications, etc). Keeps non-text message types — like
// call events, whose `content` is a JSON blob — from leaking raw data into the
// UI. Use this anywhere a message is shown as a one-line preview.

export default function messagePreview(message) {
  if (!message || typeof message !== 'object') return '';

  switch (message.type) {
    case 'file':
      return 'Sent a file.';
    case 'image':
      return 'Sent a picture.';
    case 'call': {
      let media = 'Voice';
      try {
        media = JSON.parse(message.content || '{}').media === 'video' ? 'Video' : 'Voice';
      } catch (e) {
        media = 'Voice';
      }
      return `${media} call`;
    }
    default:
      return message.content || '';
  }
}
