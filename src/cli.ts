#!/usr/bin/env node
import { AngularStaticAssetsHash } from './index.js';

const angularStaticAssetsHash = new AngularStaticAssetsHash();

angularStaticAssetsHash.createHashes();
