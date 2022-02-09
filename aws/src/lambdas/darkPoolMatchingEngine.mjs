import { getRandomArrayEntry, getRandom, publishToSns, snsClient, ssmClient } from '/opt/nodejs/src/utils.js';
import { randomUUID, GetParametersCommand } from '/opt/nodejs/src/dependencies.js';

const paramValues = new Map((await ssmClient.send(new GetParametersCommand({Names: ['/darkpool/dev/order-dispatcher-topic-arn', '/darkpool/dev/darkpools']}))).Parameters.map(p => [p.Name, p.Value]));
const orderDispatcherTopicArn = paramValues.get('/darkpool/dev/order-dispatcher-topic-arn');
const darkPools = paramValues.get('/darkpool/dev/darkpools').split(',');

export async function handler(event) {
    const tradesAndNotMatchedWithinDarkPool = [];
    event.Records.forEach(record => {
        //randomly match order within the DarkPool. If not matched, forward it to LightPools.
            tradesAndNotMatchedWithinDarkPool.push(...JSON.parse(record.Sns.Message).map(order => {
                if (getRandomBoolean())
                    return { ...order, 
                        tradeId : randomUUID(), 
                        exchange : getRandomArrayEntry(darkPools), 
                        exchangeType : "DarkPool",
                        tradeDate : new Date(),
                        fee : getRandom(0, 1).toFixed(2),
                        ...(order.type==="Market" ? { price : getRandom(100, 200).toFixed(2) } : {})
                    }
                else
                    return { ...order,
                        notMatchedInDarkPool : "True"
                    }
            }));
    });
    console.log(tradesAndNotMatchedWithinDarkPool);
    
    await Promise.all([await publishToSns(snsClient, orderDispatcherTopicArn, tradesAndNotMatchedWithinDarkPool.filter(t => t.exchangeType === "DarkPool") , {"PostTrade": {
                "DataType": "String",
                "StringValue": "True"
            }}),  publishToSns(snsClient, orderDispatcherTopicArn, tradesAndNotMatchedWithinDarkPool.filter(t => t.notMatchedInDarkPool === "True") , {"PoolType": {
                "DataType": "String",
                "StringValue": "Lit"
            }})]);
            
    return {
        statusCode: 200,
        body: {
            message: `Successfully matched ${tradesAndNotMatchedWithinDarkPool.length} order(s)`,
            trades: tradesAndNotMatchedWithinDarkPool
        }
    };
};

const getRandomBoolean = () => Math.random() < 0.5;