#!/usr/bin/env node

import { readFileSync, writeFileSync, statSync } from 'fs';
import crypto from 'crypto';
import path from 'path';
import glob from 'glob-all';

export class AngularStaticAssetsHash {
  private ANGULAR_JSON: string;
  private angularJSONstr: string;
  private angularJSON: string;

  constructor() {
    this.ANGULAR_JSON = 'angular.json';
    this.angularJSONstr = readFileSync(this.ANGULAR_JSON, 'utf-8');
    this.angularJSON = JSON.parse(this.angularJSONstr);
  }

  private geObjectKey(obj: any, key: string): any {
    if (Object.hasOwn(obj, key)) {
      return obj[key];
    }
    for (const k in obj) {
      if (typeof obj[k] === 'string' && k === key) {
        return obj[k];
      } else if (typeof obj[k] === 'object' && obj[k] !== null) {
        return this.geObjectKey(obj[k], key);
      }
    }

    return null;
  }

  public createHashes(): void {
    const angularSourceRoot: string = this.geObjectKey(this.angularJSON, 'sourceRoot');

    const args: string[] = process.argv.slice(2);

    const staticAssetsPath = args.find((param: string): boolean => {
      return param.includes('--staticAssetsPath');
    });

    let angularAssets: string = `${angularSourceRoot}/assets/images`;

    if (typeof staticAssetsPath === 'string') {
      angularAssets = staticAssetsPath.split('=')[1];
    }

    const customGlobPattern = args.find((param: string): boolean => {
      return param.includes('--globPattern');
    });

    let globPattern: string = '/**/*';

    if (typeof customGlobPattern === 'string') {
      globPattern = customGlobPattern.split('=')[1];
    }

    const paths: string[] = [
      `${angularAssets}${globPattern}`
    ];

    const assetsHashes: { [key: string]: string } = {};

    const createHashForFile = (filePath: string): void => {
      const encoding = 'utf-8';
      const content = readFileSync(filePath, encoding).toString();
      const hash = crypto.createHash('sha256').update(content, encoding);
      const sha = hash.digest('base64url');

      assetsHashes[filePath.replace(`${angularSourceRoot}/`, '')] = sha;
    };

    const excludeDirectory = (resourcePath: string): boolean => {
      return statSync(resourcePath).isDirectory() === false;
    };

    glob.sync(paths).filter(excludeDirectory)
      .forEach(createHashForFile);

    const staticAssetsFilePath: string = path.join(angularSourceRoot, 'assets.json');

    writeFileSync(staticAssetsFilePath, JSON.stringify(assetsHashes, null, 2));
  }
}
