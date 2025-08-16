import apiClient from "../api/apiClient";

export const postCreate = (data) => {
  return apiClient.post("/api/register", data);
};

export const postUpdate = (data) => {
  return apiClient.post("/api/user/edit", data);
};

export const postDelete = (data) => {
  return apiClient.post("/api/user/delete", data);
};
