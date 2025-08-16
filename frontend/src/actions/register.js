import apiClient from "../api/apiClient";

const register = (data) => {
  return apiClient.post("/api/register", data);
};

export default register;
