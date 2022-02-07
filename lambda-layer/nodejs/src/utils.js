import { PublishCommand, DynamoDBClient, DynamoDBDocumentClient } from "./dependencies.js";

const region = { region: 'us-east-2' };

const getRandomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const getRandom = (min, max) => Math.random() * (max - min) + min;

const getRandomBoolean = () => Math.random() < 0.5;

const getRandomArrayEntry = (array) => array[Math.floor(Math.random() * array.length)];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient(region));

const publishToSns = async (snsClient, topicArn, message, messageAttributes) => {
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

export {
    getRandomInteger,
    getRandom,
    getRandomBoolean,
    getRandomArrayEntry,
    delay,
    publishToSns,
    ddbDocClient
}