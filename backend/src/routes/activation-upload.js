// backend/src/routes/activation-upload.js (New unauthenticated upload for activation)
const Image = require("../models/Image");
const User = require("../models/User");
const mkdirp = require("mkdirp");
const sharp = require("sharp");
const store = require("../store"); 
const randomstring = require("randomstring");
const bcrypt = require("bcryptjs");
const isEmpty = require("../utils/isEmpty");

module.exports = async (req, res) => {
  try {
    const image = req.files.image;
    const { crop, activationToken } = req.fields;
    const companyId = req.headers["x-company-id"];

    // Validation
    if (!image) {
      return res.status(400).json({ 
        status: 400, 
        error: "FILE_REQUIRED",
        message: "Image file is required"
      });
    }

    if (!companyId) {
      return res.status(400).json({ 
        status: 400, 
        error: "COMPANY_ID_REQUIRED",
        message: "Company ID is required"
      });
    }

    if (isEmpty(activationToken)) {
      return res.status(400).json({ 
        status: 400, 
        error: "ACTIVATION_TOKEN_REQUIRED",
        message: "Activation token is required"
      });
    }

    // 🆕 Validate activation token (similar to activation routes)
    const pendingUsers = await User.find({
      companyId: companyId,
      status: "pending",
      activationToken: { $ne: null },
    }).select("-password");

    // Find the user by comparing the raw token with the hashed tokens
    let user = null;
    for (const pendingUser of pendingUsers) {
      try {
        // Compare raw token with hashed token in database
        const isValidToken = await bcrypt.compare(
          activationToken,
          pendingUser.activationToken
        );
        if (isValidToken) {
          user = pendingUser;
          break;
        }
      } catch (compareError) {
        // If bcrypt.compare fails, try direct comparison (for tokens stored as raw)
        if (activationToken === pendingUser.activationToken) {
          user = pendingUser;
          break;
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        status: 401,
        error: "INVALID_ACTIVATION_TOKEN",
        message: "Invalid activation token or user not found.",
      });
    }

    // Check if activation token has expired
    if (user.tokenExpiry && new Date() > user.tokenExpiry) {
      return res.status(401).json({
        status: 401,
        error: "TOKEN_EXPIRED",
        message: "Activation token has expired.",
      });
    }

    // 🆕 Only allow root users to upload during activation
    if (user.level !== 'root') {
      return res.status(403).json({
        status: 403,
        error: "INSUFFICIENT_PRIVILEGES",
        message: "Only root users can upload company logos during activation.",
      });
    }

    const path = image.path;
    const shield = randomstring.generate({
      length: 120,
      charset: "alphanumeric",
      capitalization: "lowercase",
    });

    let imageObject = new Image({
      name: image.name,
      author: user._id, // Use the pending user's ID
      size: image.size,
      shield,
      companyId,
    });

    try {
      await imageObject.save();
    } catch (err) {
      console.error("Database save error:", err);
      return res.status(500).json({ 
        status: 500, 
        error: "DATABASE_ERROR", 
        message: "Failed to save image to database",
        details: err.message 
      });
    }

    // Create folder for the user (even though they're not activated yet)
    const folder = `${store.config.dataFolder}/${user._id}`;

    try {
      await mkdirp(folder);
    } catch (err) {
      console.error("Folder creation error:", err);
      return res.status(500).json({ 
        status: 500, 
        error: "WRITE_ERROR", 
        message: "Failed to create upload directory",
        details: err.message 
      });
    }

    const shieldedID = shield + imageObject._id;
    const location = `${folder}/${shieldedID}.jpg`;

    try {
      await sharp(path).rotate().toFile(location);
    } catch (err) {
      console.error("Image processing error:", err);
      return res.status(500).json({
        status: 500,
        error: "IMAGE_PROCESSING_ERROR",
        message: "Failed to process image",
        details: err.message,
      });
    }

    // Create different sized versions
    for (let i = 0; i < store.config.sizes.length; i++) {
      const resizedLocation = `${folder}/${shieldedID}-${store.config.sizes[i]}.jpg`;

      let size = {};
      if (crop === "square")
        size = { width: store.config.sizes[i], height: store.config.sizes[i] };
      else size = { width: store.config.sizes[i] };

      try {
        await sharp(path).rotate().resize(size).toFile(resizedLocation);
      } catch (err) {
        console.error("Resize error:", err);
        return res.status(500).json({ 
          status: 500, 
          error: "RESIZE_ERROR", 
          message: "Failed to create image thumbnails",
          details: err.message 
        });
      }
    }

    imageObject.location = location;
    imageObject.shieldedID = shieldedID;

    try {
      await imageObject.save();
    } catch (err) {
      console.error("Final save error:", err);
      return res.status(500).json({ 
        status: 500, 
        error: "DATABASE_ERROR", 
        message: "Failed to update image record",
        details: err.message 
      });
    }

    console.log(`✅ Activation logo uploaded successfully for user: ${user.email} (Company: ${companyId})`);

    res.status(200).json({ 
      status: 200, 
      image: imageObject,
      message: "Company logo uploaded successfully"
    });
  } catch (err) {
    console.error("Activation upload error:", err);
    res.status(500).json({ 
      status: 500, 
      error: "UNKNOWN_ERROR", 
      message: "Server error during image upload",
      details: err.message 
    });
  }
};