import apiClient from "../api/apiClient";

const sendCode = (email) => {
  return apiClient.post("/api/auth/code", { email });
};

export default sendCode;
