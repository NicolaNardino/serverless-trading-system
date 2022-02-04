import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SSMClient, GetParameterCommand, GetParametersCommand } from "@aws-sdk/client-ssm";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"; 
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand  } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from 'crypto';

export {
    SNSClient,
    PublishCommand,
    S3Client,
    PutObjectCommand,
    SSMClient,
    GetParameterCommand,
    GetParametersCommand,
    DynamoDBClient, 
    DynamoDBDocumentClient, 
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
    randomUUID
}