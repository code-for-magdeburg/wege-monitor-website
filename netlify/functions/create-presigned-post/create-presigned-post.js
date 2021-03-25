const AWS = require('aws-sdk')

const { WM_AWS_ACCESS_KEY_ID, WM_AWS_SECRET_ACCESS_KEY, WM_S3_BUCKET_NAME, WM_MAX_UPLOAD_FILESIZE_BYTES } = process.env;
const s3 = new AWS.S3({
  signatureVersion: 'v4',
  region: 'eu-central-1',
  credentials: new AWS.Credentials(WM_AWS_ACCESS_KEY_ID, WM_AWS_SECRET_ACCESS_KEY)
});


module.exports.handler = async (event, context) => {

  const key = require('crypto').randomBytes(16).toString('hex');
  const s3Params = {
    Bucket: WM_S3_BUCKET_NAME,
    Fields: { key },
    Conditions: [
      ['content-length-range', 0, WM_MAX_UPLOAD_FILESIZE_BYTES],
    ]
  };
  const uploadURL = s3.createPresignedPost(s3Params);

  return {
    statusCode: 200,
    body: JSON.stringify({ uploadURL })
  };

}
