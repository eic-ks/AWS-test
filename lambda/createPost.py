import os
import json
import boto3
import uuid
import time

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def handler(event, context):
    try:
        body = json.loads(event.get('body', '{}'))
        content = body.get('content')

        if not content:
            return {
                'statusCode': 400,
                'headers': { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                'body': json.dumps({'message': 'Content is required.'})
            }
        
        new_post = {
            'id': str(uuid.uuid4()),
            'content': content,
            # DynamoDBはfloatを嫌うことがあるのでintで保存
            'timestamp': int(time.time() * 1000)
        }
        
        table.put_item(Item=new_post)
        
        return {
            'statusCode': 201,
            'headers': { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            'body': json.dumps({'message': 'Post created successfully!', 'postId': new_post['id']})
        }
    except Exception as e:
        print(e)
        return {
            'statusCode': 500,
            'headers': { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            'body': json.dumps({'message': 'Could not create post.'})
        }
