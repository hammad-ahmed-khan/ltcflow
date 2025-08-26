// FIXED VERSION: backend/src/routes/upload-file.js
// Remove the problematic debug console.log

const File = require("../models/File");
const mkdirp = require("mkdirp");
const fs = require("fs");
const path = require("path");
const store = require("../store");
const randomstring = require("randomstring");

module.exports = async (req, res) => {
  const file = req.files.file;
  const filePath = file.path;
  const companyId = req.headers["x-company-id"];

  // Validate required fields
  if (!file) {
    return res.status(400).json({ status: 400, error: "FILE_REQUIRED" });
  }
  if (!companyId) {
    return res.status(400).json({ status: 400, error: "COMPANY_ID_REQUIRED" });
  }

  // ✅ ADD DEBUG INFO HERE (before any variable reassignments)
  console.log("📁 File upload debug:", {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    companyId: companyId,
    userId: req.user.id,
  });

  const shield = randomstring.generate({
    length: 120,
    charset: "alphanumeric",
    capitalization: "lowercase",
  });

  // Get proper file extension
  const originalExtension = path.extname(file.name) || ".bin";

  let fileObject;

  try {
    // Create file object with companyId
    fileObject = new File({
      name: file.name,
      author: req.user.id,
      size: file.size,
      type: file.type,
      shield,
      companyId,
    });

    await fileObject.save();

    console.log("💾 File saved to database:", {
      id: fileObject._id,
      name: fileObject.name,
      type: fileObject.type,
    });
  } catch (err) {
    console.error("Database save error:", err);
    return res.status(500).json({ status: 500, error: "DATABASE_ERROR" });
  }

  // Multi-tenant folder structure
  const folder = `${store.config.dataFolder}/${companyId}/${req.user.id}`;

  try {
    await mkdirp(folder);
  } catch (err) {
    console.error("Folder creation error:", err);
    return res.status(500).json({ status: 500, error: "WRITE_ERROR" });
  }

  const shieldedID = shield + fileObject._id;
  const location = `${folder}/${shieldedID}${originalExtension}`;

  try {
    // Better file streaming with error handling
    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(location);
      const reader = fs.createReadStream(filePath);

      stream.on("error", reject);
      reader.on("error", reject);
      stream.on("finish", resolve);

      reader.pipe(stream);
    });

    // Update file object with final location
    fileObject.location = location;
    fileObject.shieldedID = shieldedID;

    await fileObject.save();

    console.log(
      `✅ File uploaded successfully: ${fileObject.name} (${fileObject.size} bytes) -> ${shieldedID}${originalExtension}`
    );

    res.status(200).json({
      status: 200,
      file: fileObject,
    });
  } catch (err) {
    console.error("File processing error:", err);

    // Cleanup on error
    try {
      if (fs.existsSync(location)) {
        fs.unlinkSync(location);
      }
      await File.deleteOne({ _id: fileObject._id });
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }

    res.status(500).json({
      status: 500,
      error: "FILE_PROCESSING_ERROR",
      message: "Failed to process uploaded file",
    });
  }
};
