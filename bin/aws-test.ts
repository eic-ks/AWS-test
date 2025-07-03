#!/usr/bin/env node
import 'source-map-support/register';
// 'aws-cdk-lib'からAppをインポートする
import { App } from 'aws-cdk-lib';
import { MySimpleWebsiteStack } from '../lib/my-simple-website-stack';

// 'new cdk.App()' ではなく 'new App()' に変更
const app = new App(); 
new MySimpleWebsiteStack(app, 'MySimpleWebsiteStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});
