import crypto from 'node:crypto';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
export class AngularStaticAssetsHash {
    angularJSON;
    geObjectKey(obj, key) {
        if (!obj || typeof obj !== 'object') {
            return null;
        }
        if (Object.hasOwn(obj, key)) {
            const directValue = obj[key];
            return typeof directValue === 'string' ? directValue : null;
        }
        for (const k in obj) {
            if (Object.hasOwn(obj, k) === false) {
                continue;
            }
            const value = obj[k];
            if (k === key && typeof value === 'string') {
                return value;
            }
            if (value && typeof value === 'object') {
                const result = this.geObjectKey(value, key);
                if (result !== null) {
                    return result;
                }
            }
        }
        return null;
    }
    async createHashes() {
        if (typeof this.angularJSON === 'undefined') {
            let angularJSONstr;
            try {
                angularJSONstr = await fsPromises.readFile('angular.json', {
                    encoding: 'utf-8'
                });
            }
            catch (error) {
                throw new Error('[AngularStaticAssetsHash.createHashes] Failed to read angular.json', {
                    cause: error
                });
            }
            this.angularJSON = JSON.parse(angularJSONstr);
        }
        const angularSourceRoot = this.geObjectKey(this.angularJSON, 'sourceRoot');
        if (angularSourceRoot === null) {
            throw new Error('sourceRoot not found in angular.json');
        }
        const args = process.argv.slice(2);
        const staticAssetsPathArg = args.find((param) => {
            return param.includes('--staticAssetsPath');
        });
        const customGlobPatternArg = args.find((param) => {
            return param.includes('--globPattern');
        });
        let angularAssets = path.join(angularSourceRoot, 'assets/images');
        if (staticAssetsPathArg) {
            angularAssets = staticAssetsPathArg.split('=')[1];
        }
        let globPattern = '/**/*';
        if (typeof customGlobPatternArg === 'string') {
            globPattern = customGlobPatternArg.split('=')[1];
        }
        const searchPattern = path.join(angularAssets, globPattern);
        const assetsHashes = {};
        try {
            for await (const filePath of fsPromises.glob(searchPattern)) {
                let fileStat;
                try {
                    fileStat = await fsPromises.stat(filePath);
                }
                catch (error) {
                    throw new Error(`[AngularStaticAssetsHash.createHashes] Failed to stat asset: ${filePath}`, {
                        cause: error
                    });
                }
                const isDirectory = fileStat.isDirectory();
                if (isDirectory) {
                    continue;
                }
                let content;
                try {
                    content = await fsPromises.readFile(filePath, {
                        encoding: 'utf-8'
                    });
                }
                catch (error) {
                    throw new Error(`[AngularStaticAssetsHash.createHashes] Failed to read asset: ${filePath}`, {
                        cause: error
                    });
                }
                const hash = crypto.createHash('sha256').update(content, 'utf-8');
                const sha = hash.digest('base64url');
                const relativePath = filePath.replace(`${angularSourceRoot}/`, '');
                assetsHashes[relativePath] = sha;
            }
        }
        catch (error) {
            throw new Error('[AngularStaticAssetsHash.createHashes] Failed to create asset hashes', {
                cause: error
            });
        }
        const staticAssetsFilePath = path.join(angularSourceRoot, 'assets.json');
        try {
            await fsPromises.writeFile(staticAssetsFilePath, JSON.stringify(assetsHashes, null, 2));
        }
        catch (error) {
            throw new Error(`[AngularStaticAssetsHash.createHashes] Failed to write asset hashes: ${staticAssetsFilePath}`, {
                cause: error
            });
        }
    }
}
//# sourceMappingURL=../src/dist/index.js.map