const File = require('../models/File');
const mkdirp = require('mkdirp');
const fs = require('fs');
const store = require('../store');
const randomstring = require('randomstring');

module.exports = async (req, res) => {
  const file = req.files.file;
  const path = file.path;
  const companyId = req.headers["x-company-id"]; // Read from header

  // Validate required fields
  if (!file) {
    return res.status(400).json({ status: 400, error: 'FILE_REQUIRED' });
  }
  if (!companyId) {
    return res.status(400).json({ status: 400, error: 'COMPANY_ID_REQUIRED' });
  }

  const shield = randomstring.generate({ 
    length: 120, 
    charset: 'alphanumeric', 
    capitalization: 'lowercase' 
  });

  let fileObject;

  // Create file object with companyId
  fileObject = new File({
    name: file.name,
    author: req.user.id,
    size: file.size,
    file: file.type,
    shield,
    companyId, // Include companyId for data isolation
  });

  try {
    await fileObject.save();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 500, error: 'DATABASE_ERROR' });
  }

  // Create company-specific folder structure: dataFolder/companyId/userId
  const folder = `${store.config.dataFolder}/${companyId}/${req.user.id}`;

  try {
    await mkdirp(folder);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 500, error: 'WRITE_ERROR' });
  }

  const shieldedID = shield + file._id;
  const location = `${folder}/${shieldedID}.jpg`;

  try {
    const stream = fs.createWriteStream(location);
    const reader = fs.createReadStream(path);
    reader.pipe(stream);

    fileObject.location = location;
    fileObject.shieldedID = shieldedID;

    await fileObject.save();

    res.status(200).json({ status: 200, file: fileObject });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, error: 'FILE_PROCESSING_ERROR' });
  }
};