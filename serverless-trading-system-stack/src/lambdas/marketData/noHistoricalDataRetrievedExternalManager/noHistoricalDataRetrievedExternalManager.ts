import { EventBridgeEvent } from 'aws-lambda';
import { SendTaskSuccessCommand } from '/opt/nodejs/util/dependencies.js';
import { sfnClient } from '/opt/nodejs/util/utils.js';

export async function handler(event: EventBridgeEvent<string, {taskToken: string}>): Promise<void> {
  console.log(JSON.stringify(event));
  await sfnClient.send(new SendTaskSuccessCommand({
    output: JSON.stringify('none'),
    taskToken: event.detail.taskToken
  }));
  console.log('Sent step function - task success');
}