const AWS = require('aws-sdk');

const { WM_AWS_ACCESS_KEY_ID, WM_AWS_SECRET_ACCESS_KEY } = process.env;


const handler = async (event) => {

  // TODO: Paginate the results!!
  // See: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html

  try {
    const h3Res7Key = event.queryStringParameters.h3Res7Key;
    const dynamoDb = new AWS.DynamoDB({
      apiVersion: '2012-08-10',
      region: 'eu-central-1',
      credentials: new AWS.Credentials(WM_AWS_ACCESS_KEY_ID, WM_AWS_SECRET_ACCESS_KEY)
    });
    const params = {
      KeyConditionExpression: 'h3IndexRes07 = :key', // TODO: Filter by resolution 13
      ExpressionAttributeValues: { ':key': { S: h3Res7Key } },
      ProjectionExpression: 'h3IndexRes13, avgAcceleration, maxAcceleration',
      TableName: 'AccelerationBaseData'
    };
    const queryResult = await dynamoDb.query(params).promise();
    const queryResultItems = queryResult.Items;
    const items = queryResultItems.map(item => ({
      h3Index: item.h3IndexRes13.S,
      maxAcceleration: +item.maxAcceleration.N,
      avgAcceleration: +item.avgAcceleration.N
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(items),
    }
  } catch (error) {
    return { statusCode: 500, body: error.toString() }
  }
}

module.exports = { handler }
