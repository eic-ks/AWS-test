import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  const { content } = JSON.parse(event.body);

  if (!content) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: 'Content is required.' }),
    };
  }

  const newPost = {
    id: uuidv4(),
    content: content,
    timestamp: Date.now(),
  };

  try {
    const command = new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: newPost,
    });

    await docClient.send(command);

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: 'Post created successfully!', postId: newPost.id }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: 'Could not create post.' }),
    };
  }
};
