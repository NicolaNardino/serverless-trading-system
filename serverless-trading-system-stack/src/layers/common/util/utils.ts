import { SFNClient, PublishCommand, PublishCommandInput, MessageAttributeValue, GetParameterCommand, GetParametersCommand, DynamoDBClient, DynamoDBDocumentClient, SNSClient, SSMClient, S3Client, EventBridgeClient, fetch } from "./dependencies.js";

const getRandomInteger = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

const getRandom = (min: number, max: number): number => Math.random() * (max - min) + min;

const getRandomBoolean = () => Math.random() < 0.5;

const getRandomArrayEntry = (array: any[]) => array[Math.floor(Math.random() * array.length)];

function getRandomEnum<T>(myEnum: T): T[keyof T] {
    const enumValues = (Object.values(myEnum) as unknown) as T[keyof T][];
    return enumValues[Math.floor(Math.random() * enumValues.length)];
}

const getDefaultIfUndefined = (value: any, defaultValue: any) => (value === undefined ? defaultValue : value);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const region = { region: 'us-east-1' };
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient(region));
const snsClient = new SNSClient(region);
const ssmClient = new SSMClient(region);
const s3Client = new S3Client(region);
const eventBridgeClient = new EventBridgeClient(region);
const sfnClient = new SFNClient(region);

async function publishToSns(topicArn: string, message: object, messageAttributes?: {[key: string]: MessageAttributeValue}) {
    console.log('About to publish message ', JSON.stringify(message), ' to the topic ', topicArn);
    const requestParams: PublishCommandInput = {
        Message: JSON.stringify(message),
        TopicArn: topicArn
    };
    if (messageAttributes)
        requestParams.MessageAttributes = messageAttributes;
    const messageAcknowledge = await snsClient.send(new PublishCommand(requestParams));
    console.log('SNS reply: ', JSON.stringify(messageAcknowledge));
    return messageAcknowledge;
}

async function getParameter(param: string) {
    return (await (ssmClient.send(new GetParameterCommand({ Name: param })))).Parameter?.Value;
}

async function getParameters(paramsArray: string[]) {
    return new Map((await ssmClient.send(new GetParametersCommand({ Names: paramsArray }))).Parameters?.map(p => [p.Name, p.Value]));
}                                                

async function matchOrder(order: object, apiUrl: string) {
    return await (await fetch(apiUrl, {
        method: 'POST',
        body: JSON.stringify(order),
        headers: {'Content-Type': 'application/json'}
    })).json();
}

function splitBy (number: number, n: number) {
    const splitArray = new Array(Math.floor(number / n)).fill(n);
    const remainder = number % n;
    if (remainder > 0)
        splitArray.push(remainder);
    return splitArray;
}

const formatDate = (inputDate: Date) => (inputDate === undefined ? undefined : inputDate.toISOString().split('T')[0]);

export {
    getRandomInteger,
    getRandom,
    getRandomBoolean,
    getRandomArrayEntry,
    getRandomEnum,
    delay,
    publishToSns,
    getParameters, getParameter,
    getDefaultIfUndefined,
    splitBy,
    ddbDocClient,
    s3Client,
    eventBridgeClient,
    sfnClient,
    matchOrder,
    formatDate
}