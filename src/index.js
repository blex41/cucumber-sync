const CucumberStudio = require('cucumber-studio-api');
const crypto = require('crypto');
const Path = require('path');
const utils = require('./utils.js');
const _slugify = str => require('slugify')(str, { lower: true, strict: true });

class CucumberSync {
  constructor () {    
    this.config = {
      env: {
        token: process.env.CUCUMBER_STUDIO_TOKEN,
        clientId: process.env.CUCUMBER_STUDIO_CLIENT_ID,
        uid: process.env.CUCUMBER_STUDIO_UID,
        projectId: process.env.CUCUMBER_STUDIO_PROJECT_ID,
        projectToken: process.env.CUCUMBER_STUDIO_PROJECT_TOKEN
      },
      testRunName: 'Automated test run',
      featuresDir: Path.join(process.cwd(), 'feature_files'),
      scenarioFilter: () => true
    };

    this.api = null;
  }

  init() {
    this.api = new CucumberStudio(this.config.env);
    return this;
  }

  sync() {
    return this.api.getScenarios({include: ['tags']})
      .then(scenarios => this._filterScenarios(scenarios))
      .then(scenarios => scenarios.map(s => s.id))
      .then(scenarioIds => this._createOrReuseTestRun(scenarioIds))
      .then(testRun => this._exportTestRun(testRun.id));
  }

  _filterScenarios(scenarios) {
    const res = scenarios.filter(
      scenario => this.config.scenarioFilter(
        this._hydrateScenario(scenario),
        {
          slugify : _slugify
        }
      )
    );
    console.log(`Found ${res.length} scenarios to import:\n${
      res.map(s => '- ' + s.attributes.name).join('\n')}
      `);
    return res;
  }

  _hydrateScenario(scenario) {
    return {
      data: scenario,
      getTags: ({slugify = false}) => {
        return scenario.relationships.tags.data.map(tag => {
          const label = this._implodeTagLabel(tag.attributes);
          return slugify ? _slugify(label) : label;
        });
      }
    };
  }

  _implodeTagLabel({ key, value }) {
    return [key, value].join(key && value ? ': ' : '');
  }

  async _createOrReuseTestRun(scenarioIds) {
    const hash = this._createTestRunHash(scenarioIds);
    const name = `[${hash}] ${this.config.testRunName}`;

    const existingTestRuns = await this.api.getTestRuns({ status: 'active' });
    const matchingTestRun = existingTestRuns.find(tr => tr.attributes.name === name);

    if (matchingTestRun) {
      return matchingTestRun;
    } else {
      return this.api.createTestRun({ name, description: 'Generated by cucumber-sync', scenarioIds });
    }
  }

  _createTestRunHash(scenarioIds) {
    return crypto.createHash('sha1')
      .update(scenarioIds.toString(), 'binary')
      .digest('hex')
      .slice(0, 8);
  }

  async _exportTestRun(testRunId) {
    const zipBuffer = await this.api.exportTestRun(testRunId);
    console.log('Importing files...');
    let count = 0;
    await utils.unzip(zipBuffer, async (entry, writeFileTo) => {
      if (/^features\/.+/.test(entry.fileName)) {
        const strippedFileName = entry.fileName.replace(/^features\//, '');
        console.log('- ' + strippedFileName);
        count++;
        await writeFileTo(Path.join(this.config.featuresDir, strippedFileName));
      }
    });
    console.log(`Imported ${count} files!`);
  }
}

module.exports = CucumberSync;