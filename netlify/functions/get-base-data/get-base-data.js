const AWS = require('aws-sdk');

const { WM_AWS_ACCESS_KEY_ID, WM_AWS_SECRET_ACCESS_KEY } = process.env;


const docClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: 'eu-central-1',
  credentials: new AWS.Credentials(WM_AWS_ACCESS_KEY_ID, WM_AWS_SECRET_ACCESS_KEY)
});


const handler = async (event) => {

  // TODO: Paginate the results!!
  // See: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html

  try {

    const h3Res7Key = event.queryStringParameters.h3Res7Key;
    const params = { Key: { h3IndexRes07: h3Res7Key }, TableName: 'AccelerationBaseDataH3Res07' };
    const getResult = await docClient.get(params).promise();
    const items = getResult.Item && getResult.Item.h3IndexRes13 != null ? getResult.Item.h3IndexRes13 : [];

    const result = [];

    for (const key in items) {
      result.push({ h3Index: key, ...items[key] });
    }

    return { statusCode: 200, body: JSON.stringify(result) };

  } catch (error) {
    return { statusCode: 500, body: error.toString() }
  }

}

module.exports = { handler }
