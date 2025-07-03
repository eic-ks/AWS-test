// back
import { aws_apigateway as apigateway } from 'aws-cdk-lib';
import { aws_lambda_nodejs as lambda } from 'aws-cdk-lib';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import * as path from 'path';
// front
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

    // backend
    // 1. DynamoDBテーブルを作成
    const table = new dynamodb.Table(this, 'PostsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 2. API Gatewayを作成
    const api = new apigateway.RestApi(this, 'PostsApi', {
      restApiName: 'Posts Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });
    
    // 3. Lambda関数を作成
    // 投稿を取得するLambda
    const getPostsLambda = new lambda.NodejsFunction(this, 'GetPostsHandler', {
      entry: path.join(__dirname, '../lambda/getPosts.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // 投稿を作成するLambda
    const createPostLambda = new lambda.NodejsFunction(this, 'CreatePostHandler', {
      entry: path.join(__dirname, '../lambda/createPost.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // 4. LambdaにDynamoDBへのアクセス権限を付与
    table.grantReadData(getPostsLambda);
    table.grantReadWriteData(createPostLambda);

    // 5. API GatewayのルートとLambdaを統合
    const posts = api.root.addResource('posts');
    posts.addMethod('GET', new apigateway.LambdaIntegration(getPostsLambda));

    const post = api.root.addResource('post');
    post.addMethod('POST', new apigateway.LambdaIntegration(createPostLambda));

    // 6. API GatewayのURLを出力
    new CfnOutput(this, 'ApiUrl', {
        value: api.url,
        description: 'The URL of the API Gateway',
    });





    // frontend
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
