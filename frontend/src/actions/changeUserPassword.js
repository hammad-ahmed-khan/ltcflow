import apiClient from "../api/apiClient";

const changeUserPassword = (password) => {
  return apiClient.post("/api/users/change-password", { password });
};

export default changeUserPassword;
