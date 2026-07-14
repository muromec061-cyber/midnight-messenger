const crypto = require('crypto');

// Random hex identifier. Used for user ids, message ids and upload filenames.
function newId(bytes = 8) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = { newId };
