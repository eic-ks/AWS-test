import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async () => {
  try {
    const command = new ScanCommand({
      TableName: process.env.TABLE_NAME,
      // タイムスタンプの降順でソートして取得（新しい順）
      ScanIndexForward: false,
    });

    const response = await docClient.send(command);

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // CORS設定
      },
      body: JSON.stringify(response.Items),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ message: 'Could not fetch posts.' }),
    };
  }
};
