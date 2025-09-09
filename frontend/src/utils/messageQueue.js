// frontend/src/utils/messageQueue.js
class MessageQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxQueueSize = 100;
  }

  add(message) {
    if (this.queue.length >= this.maxQueueSize) {
      // Remove oldest message to prevent memory issues
      this.queue.shift();
    }

    this.queue.push({
      ...message,
      timestamp: Date.now(),
      id: `${message.type}-${Date.now()}-${Math.random()}`,
    });

    console.log(
      `📦 Queued message (${this.queue.length} in queue):`,
      message.type
    );
  }

  process(socket) {
    if (
      this.isProcessing ||
      this.queue.length === 0 ||
      !socket ||
      !socket.connected
    ) {
      return;
    }

    this.isProcessing = true;
    console.log(`🚀 Processing ${this.queue.length} queued messages`);

    const messages = [...this.queue];
    this.queue = [];

    messages.forEach((message, index) => {
      setTimeout(() => {
        if (socket.connected) {
          const { id, timestamp, ...messageData } = message;
          socket.emit(message.type, messageData);
          console.log(
            `✅ Sent queued message ${index + 1}/${messages.length}:`,
            message.type
          );
        }

        if (index === messages.length - 1) {
          this.isProcessing = false;
        }
      }, index * 100); // Small delay between messages
    });
  }

  clear() {
    this.queue = [];
    this.isProcessing = false;
    console.log("🧹 Message queue cleared");
  }

  size() {
    return this.queue.length;
  }
}

export default new MessageQueue();
