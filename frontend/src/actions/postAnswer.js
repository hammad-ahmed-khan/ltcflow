import apiClient from "../api/apiClient";

const postAnswer = ({ userID, meetingID, answer }) => {
  return apiClient.post("/api/meeting/answer", { userID, meetingID, answer });
};

export default postAnswer;
