// frontend/src/actions/uploadFile.js
import axios from "axios";
import Config from "../config";
import store from "../store";

const uploadFile = (file, token, onProgress = () => {}, abortSignal = null) => {
  const url = `${Config.url || ""}/api/upload/file`;
  const state = store.getState();
  const companyId = state.company?.companyId;

  const data = new FormData();
  data.append("file", file, file.name);

  const config = {
    onUploadProgress: onProgress,
    headers: {},
  };

  // Add abort signal support - this is critical for cancellation
  if (abortSignal) {
    config.signal = abortSignal;
  }

  if (companyId) {
    config.headers["X-Company-Id"] = companyId;
  }

  return axios.post(url, data, config);
};

export default uploadFile;
