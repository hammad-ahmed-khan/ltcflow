import apiClient from "../api/apiClient";

const message = (data) => {
  return apiClient.post("/api/message", data);
};

export default message;
