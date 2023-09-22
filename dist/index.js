import { readFileSync, writeFileSync, statSync } from 'fs';
import crypto from 'crypto';
import path from 'path';
import glob from 'glob-all';
export class AngularStaticAssetsHash {
    ANGULAR_JSON;
    angularJSONstr;
    angularJSON;
    constructor() {
        this.ANGULAR_JSON = 'angular.json';
        this.angularJSONstr = readFileSync(this.ANGULAR_JSON, 'utf-8');
        this.angularJSON = JSON.parse(this.angularJSONstr);
    }
    geObjectKey(obj, key) {
        if (Object.hasOwn(obj, key)) {
            return obj[key];
        }
        for (const k in obj) {
            if (typeof obj[k] === 'string' && k === key) {
                return obj[k];
            }
            else if (typeof obj[k] === 'object' && obj[k] !== null) {
                return this.geObjectKey(obj[k], key);
            }
        }
        return null;
    }
    createHashes() {
        const angularSourceRoot = this.geObjectKey(this.angularJSON, 'sourceRoot');
        const args = process.argv.slice(2);
        const staticAssetsPath = args.find((param) => {
            return param.includes('--staticAssetsPath');
        });
        let angularAssets = `${angularSourceRoot}/assets/images`;
        if (typeof staticAssetsPath === 'string') {
            angularAssets = staticAssetsPath.split('=')[1];
        }
        const customGlobPattern = args.find((param) => {
            return param.includes('--globPattern');
        });
        let globPattern = '/**/*';
        if (typeof customGlobPattern === 'string') {
            globPattern = customGlobPattern.split('=')[1];
        }
        const paths = [
            `${angularAssets}${globPattern}`
        ];
        const assetsHashes = {};
        const createHashForFile = (filePath) => {
            const encoding = 'utf-8';
            const content = readFileSync(filePath, encoding).toString();
            const hash = crypto.createHash('sha256').update(content, encoding);
            const sha = hash.digest('base64url');
            assetsHashes[filePath.replace(`${angularSourceRoot}/`, '')] = sha;
        };
        const excludeDirectory = (resourcePath) => {
            return statSync(resourcePath).isDirectory() === false;
        };
        glob.sync(paths).filter(excludeDirectory)
            .forEach(createHashForFile);
        const staticAssetsFilePath = path.join(angularSourceRoot, 'assets.json');
        writeFileSync(staticAssetsFilePath, JSON.stringify(assetsHashes, null, 2));
    }
}
//# sourceMappingURL=../src/dist/index.js.map