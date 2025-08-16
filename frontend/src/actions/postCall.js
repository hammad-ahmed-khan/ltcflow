import apiClient from "../api/apiClient";

const postCall = ({ roomID, meetingID }) => {
  return apiClient.post("/api/meeting/call", { roomID, meetingID });
};

export default postCall;
