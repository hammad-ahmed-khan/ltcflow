import apiClient from "../api/apiClient";

const getMoreMessages = ({ roomID, firstMessageID }) => {
  return apiClient.post("/api/messages/more", { roomID, firstMessageID });
};

export default getMoreMessages;
