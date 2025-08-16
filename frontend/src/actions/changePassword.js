import apiClient from "../api/apiClient";

const changePassword = (email, authCode, password) => {
  return apiClient.post("/api/auth/change", {
    email,
    code: authCode,
    password,
  });
};

export default changePassword;
