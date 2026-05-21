const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');

let packageInfoCache = null;

function getPackageInfo() {
  if (!packageInfoCache) {
    packageInfoCache = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  }

  return packageInfoCache;
}

function getAppMetadata() {
  const packageInfo = getPackageInfo();

  return {
    name: packageInfo.name,
    displayName: 'DePara',
    version: packageInfo.version,
    description: packageInfo.description
  };
}

module.exports = {
  getPackageInfo,
  getAppMetadata
};
