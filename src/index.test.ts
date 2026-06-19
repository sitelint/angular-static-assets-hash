import crypto from 'node:crypto';
import { promises as fsPromises } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  afterEach, beforeEach, describe, it, mock
} from 'node:test';
import { strict as assert } from 'node:assert';

import { AngularStaticAssetsHash } from './index.js';

const invokeGeObjectKey = (
  instance: AngularStaticAssetsHash,
  obj: unknown,
  key: string
): string | null => {
  return (
    instance as Record<string, (o: unknown, k: string) => string | null>
  ).geObjectKey(obj, key);
};

describe('AngularStaticAssetsHash', () => {
  describe('createHashes — integration with temp directory', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fsPromises.mkdtemp(path.join(tmpdir(), 'angular-hash-test-'));
    });

    afterEach(async () => {
      await fsPromises.rm(tempDir, {
        force: true, recursive: true
      });
    });

    it('processes real files and writes correct assets.json', async () => {
      const angularJSON = {
        sourceRoot: '.'
      };
      const assetsRoot = 'assets';
      const assetsDir = path.join(tempDir, assetsRoot);
      const originalArgv = [...process.argv];
      const originalCwd = process.cwd();


      await fsPromises.writeFile(path.join(tempDir, 'angular.json'), JSON.stringify(angularJSON));

      await fsPromises.mkdir(assetsDir, {
        recursive: true
      });

      await fsPromises.writeFile(path.join(assetsDir, 'logo.svg'), '<svg>logo</svg>');

      await fsPromises.writeFile(path.join(assetsDir, 'style.css'), 'body { color: red; }');

      process.chdir(tempDir);

      try {
        const instance = new AngularStaticAssetsHash();


        (instance as Record<string, unknown>).angularJSON = angularJSON;

        process.argv = ['node', 'script', `--staticAssetsPath=${assetsRoot}`];

        await instance.createHashes();

        const assetsJSONPath = path.join(tempDir, 'assets.json');

        const written = await fsPromises.readFile(assetsJSONPath, {
          encoding: 'utf-8'
        });
        const hashes = JSON.parse(written);

        const expectedSVGHash = crypto.createHash('sha256')
          .update('<svg>logo</svg>', 'utf-8')
          .digest('base64url');
        const expectedCSSHash = crypto.createHash('sha256')
          .update('body { color: red; }', 'utf-8')
          .digest('base64url');

        assert.strictEqual(hashes['assets/logo.svg'], expectedSVGHash);
        assert.strictEqual(hashes['assets/style.css'], expectedCSSHash);
        assert.strictEqual(Object.keys(hashes).length, 2);
      } finally {
        process.chdir(originalCwd);
        process.argv = originalArgv;
      }
    });
  });

  describe('geObjectKey', () => {
    it('returns value for a direct key with string value', () => {
      const instance = new AngularStaticAssetsHash();
      const result = invokeGeObjectKey(instance, {
        sourceRoot: 'src'
      }, 'sourceRoot');

      assert.strictEqual(result, 'src');
    });

    it('returns null when key value is not a string', () => {
      const instance = new AngularStaticAssetsHash();
      const result = invokeGeObjectKey(instance, {
        sourceRoot: 123
      }, 'sourceRoot');

      assert.strictEqual(result, null);
    });

    it('returns value for a nested key', () => {
      const instance = new AngularStaticAssetsHash();
      const obj = {
        projects: {
          app: {
            sourceRoot: 'src'
          }
        }
      };
      const result = invokeGeObjectKey(instance, obj, 'sourceRoot');

      assert.strictEqual(result, 'src');
    });

    it('returns value from deeply nested key', () => {
      const instance = new AngularStaticAssetsHash();
      const obj = {
        level1: {
          level2: {
            level3: {
              targetKey: 'found'
            }
          }
        }
      };
      const result = invokeGeObjectKey(instance, obj, 'targetKey');

      assert.strictEqual(result, 'found');
    });

    it('returns first match when key appears in multiple locations', () => {
      const instance = new AngularStaticAssetsHash();
      const obj = {
        nested: {
          sourceRoot: 'second'
        },
        sourceRoot: 'first'
      };
      const result = invokeGeObjectKey(instance, obj, 'sourceRoot');

      assert.strictEqual(result, 'first');
    });

    it('returns null when key is not found', () => {
      const instance = new AngularStaticAssetsHash();
      const result = invokeGeObjectKey(instance, {
        name: 'test'
      }, 'sourceRoot');

      assert.strictEqual(result, null);
    });

    it('returns null for null input', () => {
      const instance = new AngularStaticAssetsHash();
      const result = invokeGeObjectKey(instance, null, 'key');

      assert.strictEqual(result, null);
    });

    it('returns null for undefined input', () => {
      const instance = new AngularStaticAssetsHash();
      const result = invokeGeObjectKey(instance, undefined, 'key');

      assert.strictEqual(result, null);
    });

    it('returns null for string input', () => {
      const instance = new AngularStaticAssetsHash();
      const result = invokeGeObjectKey(instance, 'not an object', 'key');

      assert.strictEqual(result, null);
    });

    it('returns null for empty object', () => {
      const instance = new AngularStaticAssetsHash();
      const result = invokeGeObjectKey(instance, {}, 'key');

      assert.strictEqual(result, null);
    });

    it('skips non-object values during recursion', () => {
      const instance = new AngularStaticAssetsHash();
      const obj = {
        nested: {
          key: 'value'
        },
        num: 42,
        str: 'text'
      };
      const result = invokeGeObjectKey(instance, obj, 'key');

      assert.strictEqual(result, 'value');
    });

    it('searches sibling branches after finding a non-string match', () => {
      const instance = new AngularStaticAssetsHash();
      const obj = {
        branchA: {
          target: 100
        },
        branchB: {
          target: 'found'
        }
      };
      const result = invokeGeObjectKey(instance, obj, 'target');

      assert.strictEqual(result, 'found');
    });
  });

  describe('createHashes', () => {
    let capturedWriteContent: string;
    let capturedWritePath: string;

    beforeEach(() => {
      capturedWriteContent = '';
      capturedWritePath = '';

      // eslint-disable-next-line require-await
      mock.method(fsPromises, 'writeFile', async (filePath: string, content: string) => {
        capturedWritePath = filePath;
        capturedWriteContent = content;
      });

      // eslint-disable-next-line require-await
      mock.method(fsPromises, 'stat', async () => {
        return {
          isDirectory: (): boolean => {
            return false;
          }
        };
      });

      // eslint-disable-next-line require-await
      mock.method(fsPromises, 'readFile', async (filePath: string) => {
        if (filePath.endsWith('angular.json')) {
          return JSON.stringify({
            projects: {
              app: {
                sourceRoot: 'src'
              }
            },
            sourceRoot: 'src'
          });
        }

        return `content of ${filePath}`;
      });


      mock.method(fsPromises, 'glob', async function* (pattern: string | string[]) {
        void pattern;

        yield 'src/assets/images/logo.png';
        yield 'src/assets/images/banner.jpg';
      });
    });

    afterEach(() => {
      mock.restoreAll();
    });

    it('throws when sourceRoot is not found in angularJSON', async () => {
      const instance = new AngularStaticAssetsHash();


      (instance as Record<string, unknown>).angularJSON = {
        projects: {}
      };

      await assert.rejects(
        () => {
          return instance.createHashes();
        },
        {
          message: 'sourceRoot not found in angular.json'
        }
      );
    });

    it('reads angular.json lazily when angularJSON is not pre-set', async () => {
      const instance = new AngularStaticAssetsHash();

      await instance.createHashes();

      assert.ok(capturedWriteContent);
    });

    it('generates correct hashes for files globbed', async () => {
      const instance = new AngularStaticAssetsHash();


      (instance as Record<string, unknown>).angularJSON = {
        sourceRoot: 'src'
      };

      await instance.createHashes();

      const hashes = JSON.parse(capturedWriteContent);

      const expectedLogo = crypto.createHash('sha256')
        .update('content of src/assets/images/logo.png', 'utf-8')
        .digest('base64url');
      const expectedBanner = crypto.createHash('sha256')
        .update('content of src/assets/images/banner.jpg', 'utf-8')
        .digest('base64url');

      assert.strictEqual(hashes['assets/images/logo.png'], expectedLogo);
      assert.strictEqual(hashes['assets/images/banner.jpg'], expectedBanner);
    });

    it('skips directories and only hashes files', async () => {
      const instance = new AngularStaticAssetsHash();


      (instance as Record<string, unknown>).angularJSON = {
        sourceRoot: 'src'
      };


      mock.method(fsPromises, 'glob', async function* (pattern: string | string[]) {
        void pattern;
        yield 'src/assets/images/dir';
        yield 'src/assets/images/file.png';
      });

      // eslint-disable-next-line require-await
      mock.method(fsPromises, 'stat', async (filePath: string) => {
        const isDir = filePath.endsWith('dir');

        return {
          isDirectory: (): boolean => {
            return isDir;
          }
        };
      });

      await instance.createHashes();

      const hashes = JSON.parse(capturedWriteContent);

      assert.strictEqual(Object.keys(hashes).length, 1);
      assert.ok(hashes['assets/images/file.png']);
    });

    it('writes empty assets.json when no files match', async () => {
      const instance = new AngularStaticAssetsHash();


      (instance as Record<string, unknown>).angularJSON = {
        sourceRoot: 'src'
      };


      mock.method(fsPromises, 'glob', async function* (_pattern: string | string[]) {
        void _pattern;
      });

      await instance.createHashes();

      const hashes = JSON.parse(capturedWriteContent);

      assert.strictEqual(Object.keys(hashes).length, 0);
    });

    it('handles --staticAssetsPath CLI argument', async () => {
      const instance = new AngularStaticAssetsHash();


      (instance as Record<string, unknown>).angularJSON = {
        sourceRoot: 'src'
      };

      let capturedPattern = '';


      mock.method(fsPromises, 'glob', async function* (pattern: string | string[]) {
        capturedPattern = String(pattern);
      });

      process.argv = ['node', 'script', '--staticAssetsPath=custom/assets'];

      await instance.createHashes();

      assert.ok(capturedPattern.includes('custom/assets'));
    });

    it('handles --globPattern CLI argument', async () => {
      const instance = new AngularStaticAssetsHash();


      (instance as Record<string, unknown>).angularJSON = {
        sourceRoot: 'src'
      };

      let capturedPattern = '';


      mock.method(fsPromises, 'glob', async function* (pattern: string | string[]) {
        capturedPattern = String(pattern);
      });

      process.argv = ['node', 'script', '--globPattern=/**.svg'];

      await instance.createHashes();

      assert.ok(capturedPattern.includes('.svg'));
    });

    it('writes assets.json to sourceRoot/assets.json', async () => {
      const instance = new AngularStaticAssetsHash();


      (instance as Record<string, unknown>).angularJSON = {
        sourceRoot: 'public'
      };

      await instance.createHashes();

      const expectedPath = path.join('public', 'assets.json');

      assert.ok(capturedWritePath.endsWith(expectedPath));
    });

    it('formats JSON output with 2-space indentation', async () => {
      const instance = new AngularStaticAssetsHash();


      (instance as Record<string, unknown>).angularJSON = {
        sourceRoot: 'src'
      };


      mock.method(fsPromises, 'glob', async function* (_pattern: string | string[]) {
        void _pattern;
        yield 'src/a.png';
      });

      await instance.createHashes();

      const hashes = JSON.parse(capturedWriteContent);

      assert.strictEqual(typeof hashes['a.png'], 'string');
      assert.ok(capturedWriteContent.includes('\n  "'));
    });
  });
});
