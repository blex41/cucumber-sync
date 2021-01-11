#!/usr/bin/env node

const Path = require('path');
const CucumberSync = require('./index.js');
const userRunConfig = getUserRunConfig('.cucumberstudiorc.js');

(async () => {
  const sync = new CucumberSync();
  const output = await userRunConfig(sync.config);

  // The user may mutate the config in place, or return it:
  if (typeof output !== 'undefined') {
    sync.config = output;
  }

  sync.init();
  sync.sync();
})();

function getUserRunConfig(filename) {
  try {
    return require(Path.join(process.cwd(), filename));
  } catch(e) {
    return config => config;
  }
}