#!/usr/bin/env node
import { AngularStaticAssetsHash } from './index';

const angularStaticAssetsHash = new AngularStaticAssetsHash();

angularStaticAssetsHash.createHashes();
