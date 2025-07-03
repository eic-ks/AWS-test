import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3deploy from '@aws-cdk/aws-s3-deployment';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';

export class MySimpleWebsiteStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. ウェブサイトのファイルを格納するS3バケットを作成
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html', // インデックスドキュメントを指定
      publicReadAccess: true,             // パブリック読み取りを許可
      removalPolicy: cdk.RemovalPolicy.DESTROY, // スタック削除時にバケットも削除
      autoDeleteObjects: true,                  // スタック削除時にバケット内のオブジェクトも削除
    });

    // 2. CloudFrontディストリビューションを作成
    const distribution = new cloudfront.Distribution(this, 'MyDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket), // オリジンとして先ほど作成したS3バケットを指定
      },
      defaultRootObject: 'index.html', // デフォルトルートオブジェクトを指定
    });

    // 3. 'website' ディレクトリのファイルをS3バケットにデプロイ
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('./website')], // デプロイするファイルのソースディレクトリ
      destinationBucket: websiteBucket,               // デプロイ先のS3バケット
      distribution: distribution,                     // デプロイ後にキャッシュをクリアするCloudFrontディストリビューション
      distributionPaths: ['/*'],                      // キャッシュをクリアするパス
    });

    // 4. CloudFrontのURLを出力
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });
  }
}
