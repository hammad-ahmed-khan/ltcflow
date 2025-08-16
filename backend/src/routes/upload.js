const Image = require("../models/Image");
const mkdirp = require("mkdirp");
const sharp = require("sharp");
const store = require("../store");
const randomstring = require("randomstring");

module.exports = async (req, res) => {
  try {
    const image = req.files.image;
    const { crop } = req.fields; // companyId from frontend
    const companyId = req.headers["x-company-id"]; // read from header

    if (!image) {
      return res.status(400).json({ status: 400, error: "FILE_REQUIRED" });
    }

    // Check companyId is provided
    if (!companyId) {
      return res
        .status(400)
        .json({ status: 400, error: "COMPANY_ID_REQUIRED" });
    }

    // Check companyId matches logged-in user's companyId
    if (companyId != req.user.companyId) {
      return res.status(403).json({ status: 403, error: "INVALID_ACCESS" });
    }

    const path = image.path;
    const shield = randomstring.generate({
      length: 120,
      charset: "alphanumeric",
      capitalization: "lowercase",
    });

    let imageObject = new Image({
      name: image.name,
      author: req.user.id,
      size: image.size,
      shield,
      companyId, // save verified companyId
    });

    try {
      await imageObject.save();
    } catch (err) {
      return res
        .status(500)
        .json({ status: 500, error: "DATABASE_ERROR", details: err.message });
    }

    const folder = `${store.config.dataFolder}/${req.user.id}`;

    try {
      await mkdirp(folder);
    } catch (err) {
      return res
        .status(500)
        .json({ status: 500, error: "WRITE_ERROR", details: err.message });
    }

    const shieldedID = shield + imageObject._id;
    const location = `${folder}/${shieldedID}.jpg`;

    try {
      await sharp(path).rotate().toFile(location);
    } catch (err) {
      return res.status(500).json({
        status: 500,
        error: "IMAGE_PROCESSING_ERROR",
        details: err.message,
      });
    }

    for (let i = 0; i < store.config.sizes.length; i++) {
      const resizedLocation = `${folder}/${shieldedID}-${store.config.sizes[i]}.jpg`;

      let size = {};
      if (crop === "square")
        size = { width: store.config.sizes[i], height: store.config.sizes[i] };
      else size = { width: store.config.sizes[i] };

      try {
        await sharp(path).rotate().resize(size).toFile(resizedLocation);
      } catch (err) {
        return res
          .status(500)
          .json({ status: 500, error: "RESIZE_ERROR", details: err.message });
      }
    }

    imageObject.location = location;
    imageObject.shieldedID = shieldedID;

    try {
      await imageObject.save();
    } catch (err) {
      return res
        .status(500)
        .json({ status: 500, error: "DATABASE_ERROR", details: err.message });
    }

    res.status(200).json({ status: 200, image: imageObject });
  } catch (err) {
    res
      .status(500)
      .json({ status: 500, error: "UNKNOWN_ERROR", details: err.message });
  }
};
