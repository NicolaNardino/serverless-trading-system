import { S3Handler } from 'aws-lambda';
// @ts-ignore
import { ListObjectsCommand } from '/opt/nodejs/src/dependencies.js';
// @ts-ignore
import { s3Client } from '/opt/nodejs/src/utils.js';

export const handler: S3Handler = async (event) => {
  console.log(event);
  const s3Objects = await s3Client.send(new ListObjectsCommand({
      Bucket: event.Records[0].s3.bucket.name
    }));
  console.log(s3Objects);
};