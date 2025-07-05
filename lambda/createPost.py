import os
import json
import boto3
import uuid
import time

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def handler(event, context):
    try:
        # Cognitoオーソライザーから渡されたユーザーIDを取得
        # 'sub'はユーザーを一意に識別するIDです
        user_id = event['requestContext']['authorizer']['claims']['sub']
        
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
            'timestamp': int(time.time() * 1000),
            'owner': user_id  # ★★★ 投稿者のIDを保存 ★★★
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
