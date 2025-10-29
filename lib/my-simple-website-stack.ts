// backend
import { aws_cognito as cognito } from 'aws-cdk-lib';
import { aws_apigateway as apigateway } from 'aws-cdk-lib';
// import { aws_lambda_nodejs as lambda } from 'aws-cdk-lib'; // lambdaをtypescriptで書く場合
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import * as path from 'path';
// frontend
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

    // Cognitoによる認証を追加
    // 1. Cognito User Poolを作成
    const userPool = new cognito.UserPool(this, 'BulletinBoardUserPool', {
      userPoolName: 'bulletin-board-users',
      selfSignUpEnabled: true, // ユーザー自身がサインアップできるようにする
      signInAliases: { email: true }, // Eメールをユーザー名として使う
      autoVerify: { email: true }, // Eメールを自動で検証
      passwordPolicy: { // パスワードの要件
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
    });

    // 2. User Pool Clientを作成 (フロントエンドが対話する相手)
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
    });


    // 2. API Gatewayを作成
    const api = new apigateway.RestApi(this, 'PostsApi', {
      restApiName: 'Posts Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'], // Corsで許可するヘッダーを選択
      },
    });


    // ★★★ここからCognitoオーソライザーのコードを追加★★★

    // 3. Cognitoオーソライザーを作成
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'PostsAuthorizer', {
      cognitoUserPools: [userPool],
    });
    
    // 3. Lambda関数を作成
    // 投稿を取得するLambda
    const getPostsLambda = new PythonFunction(this, 'GetPostsHandler', {
      entry: path.join(__dirname, '../lambda'),
      runtime: lambda.Runtime.PYTHON_3_11,  // ★必須: Pythonのバージョンを指定
      index: 'getPosts.py',
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // 投稿を作成するLambda
    const createPostLambda = new PythonFunction(this, 'CreatePostHandler', {
      entry: path.join(__dirname, '../lambda'),
      runtime: lambda.Runtime.PYTHON_3_11,  // ★必須: Pythonのバージョンを指定
      index: 'createPost.py',
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

    posts.addMethod('POST', new apigateway.LambdaIntegration(createPostLambda), {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

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

   
    // 3. 'frontend'フォルダと'config.js'をまとめてS3バケットにデプロイ
    new s3deploy.BucketDeployment(this, 'DeployWebsiteAndConfig', {
      sources: [
        // ソース1: frontendフォルダ
        s3deploy.Source.asset(path.join(__dirname, '../frontend')),
        
        // ソース2: 動的に生成するconfig.js
        s3deploy.Source.data(
          '/config.js',
          `window.APP_CONFIG = {
            apiUrl: "${api.url.replace(/\/$/, '')}",
            userPoolId: "${userPool.userPoolId}",
            userPoolClientId: "${userPoolClient.userPoolClientId}",
            region: "${this.region}"
          };`
        )
      ],
      destinationBucket: websiteBucket,
      distribution: distribution,
      // キャッシュクリアの対象を両方のファイルにする
      distributionPaths: ['/index.html', '/config.js', '/*'],
    });


    // 4. CloudFrontのURLを出力
    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });
    // CognitoのIDが出力
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
  }
}
