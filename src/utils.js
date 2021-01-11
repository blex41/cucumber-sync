const yauzl = require('yauzl');
const fs = require('fs');
const Path = require('path');

function unzip(zipBuffer, cb) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(zipBuffer, {lazyEntries: true}, (err, zipfile) => {
      if (err) return reject(err);
      zipfile.readEntry();
      zipfile.on('end', resolve);
      zipfile.on('entry', async (entry) => {
        await cb(entry, writeFileFactory(zipfile, entry));
        zipfile.readEntry();
      });
    });
  });
}

function writeFileFactory(zipfile, entry) {
  return async dest => {
    await ensureDir(dest);
    return new Promise((resolve, reject) => {
      zipfile.openReadStream(entry, function(err, readStream) {
        const writeStream = fs.createWriteStream(dest);
        if (err) return reject(err);
        readStream.on('end', resolve);
        readStream.pipe(writeStream);
      });
    });
  };
}

function ensureDir(pathname) {
  return new Promise(resolve => {
    pathname = pathname.split(Path.delimiter).slice(0, -1).join(Path.delimiter);
    fs.mkdir(pathname, { recursive: true }, resolve);
  });
}

module.exports = {
  unzip
};