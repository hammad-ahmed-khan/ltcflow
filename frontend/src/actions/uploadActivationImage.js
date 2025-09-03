// frontend/src/actions/uploadActivationImage.js (New action for activation uploads)
import axios from "axios";
import Config from "../config";
import store from "../store";

const uploadActivationImage = (image, activationToken, onProgress = () => {}, crop) => {
  const url = `${Config.url || ""}/api/activation-upload`;

  const state = store.getState();
  const companyId = state.company?.companyId;

  const data = new FormData();
  data.append("image", image, image.name);
  data.append("crop", crop);
  data.append("activationToken", activationToken); // ?? Include activation token

  const config = {
    onUploadProgress: onProgress,
    headers: {}, // initialize headers object
  };

  if (companyId) {
    config.headers["X-Company-Id"] = companyId;
  }

  // Note: No Authorization header needed since this is for unauthenticated activation uploads

  return axios.post(url, data, config);
};

export default uploadActivationImage;