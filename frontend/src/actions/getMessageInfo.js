import apiClient from "../api/apiClient";

const getMessageInfo = (messageId) =>
  apiClient.post("/api/message-info", { messageId });

export default getMessageInfo;
