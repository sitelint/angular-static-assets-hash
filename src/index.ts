import crypto from 'node:crypto';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

export class AngularStaticAssetsHash {
  private angularJSON: object | undefined;

  private geObjectKey(obj: unknown, key: string): string | null {
    if (obj && typeof obj === 'object') {
      if (Object.hasOwn(obj, key)) {
        const directValue: unknown = obj[key as keyof typeof obj];

        return typeof directValue === 'string' ? directValue : null;
      }

      for (const k in obj as Record<string, unknown>) {
        if (Object.hasOwn(obj, k) === false) {
          continue;
        }


        const value: unknown = (obj as Record<string, unknown>)[k];

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
    }

    return null;
  }

  public async createHashes(): Promise<void> {
    if (typeof this.angularJSON === 'undefined') {
      const angularJSONstr = await fsPromises.readFile('angular.json', {
        encoding: 'utf-8'
      });

      this.angularJSON = JSON.parse(angularJSONstr);
    }

    const angularSourceRoot: string | null = this.geObjectKey(this.angularJSON, 'sourceRoot');

    if (angularSourceRoot === null) {
      throw new Error('sourceRoot not found in angular.json');
    }

    const args: string[] = process.argv.slice(2);
    const staticAssetsPathArg: string | undefined = args.find((param: string): boolean => {
      return param.includes('--staticAssetsPath');
    });
    const customGlobPatternArg: string | undefined = args.find((param: string): boolean => {
      return param.includes('--globPattern');
    });

    let angularAssets: string = path.join(angularSourceRoot, 'assets/images');

    if (staticAssetsPathArg) {
      angularAssets = staticAssetsPathArg.split('=')[1];
    }

    let globPattern = '/**/*';

    if (typeof customGlobPatternArg === 'string') {
      globPattern = customGlobPatternArg.split('=')[1];
    }

    const searchPattern: string = path.join(angularAssets, globPattern);
    const assetsHashes: Record<string, string> = {};

    for await (const filePath of fsPromises.glob(searchPattern)) {

      const fileStat = await fsPromises.stat(filePath);

      if (fileStat.isDirectory()) {
        continue;
      }


      const content: string = await fsPromises.readFile(filePath, {
        encoding: 'utf-8'
      });
      const hash = crypto.createHash('sha256').update(content, 'utf-8');
      const sha: string = hash.digest('base64url');
      const relativePath: string = filePath.replace(`${angularSourceRoot}/`, '');


      assetsHashes[relativePath] = sha;
    }

    const staticAssetsFilePath: string = path.join(angularSourceRoot, 'assets.json');


    await fsPromises.writeFile(staticAssetsFilePath, JSON.stringify(assetsHashes, null, 2));
  }
}
