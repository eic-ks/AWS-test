// lib/my-simple-website-stack.ts

import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
// ↓↓↓ この行を修正しました
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export class MySimpleWebsiteStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. ウェブサイトのファイルを格納するS3バケットを作成
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Origin Access Identity (OAI) を作成
    // ↓↓↓ 'new cloudfront.OriginAccessIdentity' の形に修正しました
    const oai = new cloudfront.OriginAccessIdentity(this, 'MyWebsiteOAI');
    websiteBucket.grantRead(oai);

    // 2. CloudFrontディストリビューションを作成
    const distribution = new cloudfront.Distribution(this, 'MyDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity: oai,
        }),
      },
      defaultRootObject: 'index.html',
    });

    // 3. 'frontend' ディレクトリのファイルをS3バケットにデプロイ
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('./frontend')],
      destinationBucket: websiteBucket,
      distribution: distribution,
      distributionPaths: ['/*'],
    });

    // 4. CloudFrontのURLを出力
    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });
  }
}
