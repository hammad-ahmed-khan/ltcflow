import apiClient from "../api/apiClient";

const login = (email, password) => {
  return apiClient.post("/api/login", { email, password });
};

export default login;
