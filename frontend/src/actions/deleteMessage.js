// frontend/src/actions/deleteMessage.js
import apiClient from "../api/apiClient";

const deleteMessage = (messageId) => {
  return apiClient.post("/api/message/delete", { messageId });
};

export default deleteMessage;
