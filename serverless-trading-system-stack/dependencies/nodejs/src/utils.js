import { PublishCommand, GetParameterCommand, GetParametersCommand, DynamoDBClient, DynamoDBDocumentClient, SNSClient, SSMClient, S3Client, EventBridgeClient, fetch } from "./dependencies.js";

const getRandomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const getRandom = (min, max) => Math.random() * (max - min) + min;

const getRandomBoolean = () => Math.random() < 0.5;

const getRandomArrayEntry = (array) => array[Math.floor(Math.random() * array.length)];

const getDefaultIfUndefined = (value, defaultValue) => (value === undefined ? defaultValue : value);

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const region = { region: 'us-east-1' };
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

async function getParameter(param) {
    return (await (ssmClient.send(new GetParameterCommand({ Name: param })))).Parameter?.Value;
}

async function getParameters(paramsArray) {
    return new Map((await ssmClient.send(new GetParametersCommand({ Names: paramsArray }))).Parameters.map(p => [p.Name, p.Value]));
}

async function matchOrder(order, apiUrl) {
    return await (await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify(order),
        headers: {'Content-Type': 'application/json'}
    })).json();
}

function splitBy (number, n) {
    const splitArray = new Array(Math.floor(number / n)).fill(n);
    const remainder = number % n;
    if (remainder > 0)
        splitArray.push(remainder);
    return splitArray;
}

export {
    getRandomInteger,
    getRandom,
    getRandomBoolean,
    getRandomArrayEntry,
    delay,
    publishToSns,
    getParameters, getParameter,
    getDefaultIfUndefined,
    splitBy,
    ddbDocClient,
    s3Client,
    eventBridgeClient,
    matchOrder
}