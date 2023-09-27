# Angular and create a list of static assets with their hashes

Cache busting static files (images, pdfs, pngs, etc.) for the Angular application.

When building, Angular will add a hash to JavaScript, CSS, and assets referenced in your CSS files. However, what about images and other assets you have in your assets folder that you reference in templates?

Those assets are not hashed.

The package looks for static assets, creates a list of them with their hashes, and saves it as a JSON file. This is useful when you want to change the same static asset without changing the name and ensure that the browser will always fetch the latest version.

Note that the hash is created the same way as for Subresource Integrity (SRI).

## Getting started

### Install

```bash
npm install @sitelintcode/angular-static-assets-hash --save--dev
```

### CLI

You can use directly in `package.json` `script` or through `npx createAngularStaticHashes` [params].

#### Parameters

- `--staticAssetsPath=[path to static assets]`. Default: `[angular root folder]/assets/images`
- `--globPattern=[glob pattern]`. Default: `/**/*`

### Import

```JavaScript
import { createHashes } from '@sitelintcode/angular-static-assets-hash';

const angularStaticAssetsHash = new AngularStaticAssetsHash();

angularStaticAssetsHash.createHashes();
```

## Example output

```JSON
{
  "assets/images/example.png": "iY5RY0G8wePLPRkZSTgW2XYZFZ7kQOqXoJTFpQFG5nI",
  "assets/images/avatar.svg": "7A7qFs_iOghsdUtLG-7y-5cxT3FC8S_BRXl5ldsNY7Y",
  "assets/images/body-background.svg": "K2FTBtDsxgKLQFr4BUW1ptnLWqPCKPyGypHCBTfcctQ",
  "assets/images/icons.svg": "Ka-ngr7Fht6ucmN03kzJeMN7f2iOtnkD-D63QJ01jhM"
}
```

## Angular

Once the list of static assets is created, we need to have a way to use it with Angular. For that purpose, we can use an [Angular Pipe](https://angular.io/api/core/Pipe).

### Notes

1. Notice the `staticAssetsList` private property. It points to the location of `assets.json` file is created.
2. The default path for static assets is `[angular root path]/assets/images`.

### TypeScript Pipe for Angular

```TypeScript
import { Pipe, PipeTransform } from '@angular/core';

import staticAssetsList from '../../assets.json';

@Pipe({
  name: 'fileHash'
})
export class FileHashPipe implements PipeTransform {

  private staticAssets: { [key: string]: string };

  constructor() {
    this.staticAssets = staticAssetsList;
  }

  private addParamsToUrl(givenUrl: string, urlParameters: string): string {

    if (typeof urlParameters !== 'string' || urlParameters.length === 0) {
      return givenUrl;
    }

    const urlSplitByHash: string[] = givenUrl.split('#');
    const hash: string = urlSplitByHash[1] || '';
    const params: string[] = urlParameters.split('&');
    let url: string = urlSplitByHash[0];

    if (url.indexOf('?') === -1) {
      url += '?';
    } else {
      url += '&';
    }

    url += params.map((paramItem: string): string => {
      const p: string[] = paramItem.split('=');

      return `${p[0]}=${window.encodeURIComponent(p[1])}`;
    })
      .join('&');

    url = url.slice(0, -1); // remove last &

    return hash ? `${url}#${hash}` : url;
  }

  private getHashForStaticAsset(assetPath: string): string {
    const path: string = assetPath.split('#')[0];

    if (typeof ResourceUtility.staticAssets[path] === 'string') {
      return this.addParamsToUrl(assetPath, `c=${this.staticAssets[path]}`);
    }

    return '';
  }

  public transform(filePath: string): string {
    const filePathWithCacheHash: string = this.getHashForStaticAsset(filePath);

    return filePathWithCacheHash;
  }
}
```

Later in the code the pipe can be used in the following way.

### Image example

```HTML
<img attr.src="{{ 'assets/images/example.png' | fileHash }}" alt="">
```

The hash is quite useful when we want to manage, e.g., one file with all `<svg>` icons. While you could change your single file with all svg icons all the time, your code remains the same.

### SVG sprite example

```HTML
<svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" width="32" height="32">
  <use attr.href="{{ 'assets/images/icons.svg#image-logo' | fileHash }}"></use>
</svg>
```

## Workable example

You can see the implementation by looking at the source code of the [app based on Angular](https://platform.sitelint.com/).

## Contributing

Contributions are welcome, and greatly appreciated! Contributing doesn't just mean submitting pull requests. There are many different ways for you to get involved, including answering questions on the issues, reporting or triaging bugs, and participating in the features evolution process.

## License

MOZILLA PUBLIC LICENSE, VERSION 2.0
