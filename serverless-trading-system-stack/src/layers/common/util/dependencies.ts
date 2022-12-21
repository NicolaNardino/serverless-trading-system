import { SNSClient, PublishCommand, PublishCommandInput, MessageAttributeValue } from "@aws-sdk/client-sns";
import { S3Client, PutObjectCommand, ListObjectsCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { SSMClient, GetParameterCommand, GetParametersCommand } from "@aws-sdk/client-ssm";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"; 
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand  } from "@aws-sdk/lib-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { SendTaskSuccessCommand, SendTaskFailureCommand } from "@aws-sdk/client-sfn";
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import yahooFinance from "yahoo-finance2";

export {
    SNSClient, PublishCommand, PublishCommandInput, MessageAttributeValue,
    S3Client, PutObjectCommand, ListObjectsCommand, HeadObjectCommand,
    SSMClient, GetParameterCommand, GetParametersCommand,
    DynamoDBClient, DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand,
    EventBridgeClient, PutEventsCommand,
    SendTaskSuccessCommand, SendTaskFailureCommand,
    randomUUID,
    fetch,
    yahooFinance
}