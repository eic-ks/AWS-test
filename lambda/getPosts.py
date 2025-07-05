import os
import json
import boto3
from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            # タイムスタンプは数値として扱う
            return int(obj)
        return super(DecimalEncoder, self).default(obj)

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def handler(event, context):
    try:
        # DynamoDBから全件スキャンして取得
        response = table.scan()
        
        items = response.get('Items', [])
        
        # ★★★ ここでPython側でタイムスタンプの降順にソートする ★★★
        sorted_items = sorted(items, key=lambda x: x['timestamp'], reverse=True)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(sorted_items, cls=DecimalEncoder)
        }
    except Exception as e:
        print(f"Error fetching posts: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'message': 'Could not fetch posts.'})
        }
