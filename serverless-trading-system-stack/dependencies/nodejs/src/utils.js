import { PublishCommand, GetParametersCommand, DynamoDBClient, DynamoDBDocumentClient, SNSClient, SSMClient, S3Client, EventBridgeClient } from "./dependencies.js";

const getRandomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const getRandom = (min, max) => Math.random() * (max - min) + min;

const getRandomBoolean = () => Math.random() < 0.5;

const getRandomArrayEntry = (array) => array[Math.floor(Math.random() * array.length)];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const region = { region: 'us-east-2' };
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient(region));
const snsClient = new SNSClient(region);
const ssmClient = new SSMClient(region);
const s3Client = new S3Client(region);
const eventBridgeClient = new EventBridgeClient(region);


async function publishToSns(topicArn, message, messageAttributes) {
    console.log('About to publish message ', JSON.stringify(message), ' to the topic ', topicArn);
    const requestParams = {
        Message: JSON.stringify(message),
        TopicArn: topicArn
    };

    if (messageAttributes)
        requestParams["MessageAttributes"] = messageAttributes;

    const messageAcknowledge = await snsClient.send(new PublishCommand(requestParams));
    console.log('SNS reply: ', JSON.stringify(messageAcknowledge));

    return messageAcknowledge;
}

async function getParameters(paramsArray) {
    return new Map((await ssmClient.send(new GetParametersCommand({ Names: paramsArray }))).Parameters.map(p => [p.Name, p.Value]));
}

export {
    getRandomInteger,
    getRandom,
    getRandomBoolean,
    getRandomArrayEntry,
    delay,
    publishToSns,
    getParameters,
    ddbDocClient,
    s3Client,
    eventBridgeClient
}