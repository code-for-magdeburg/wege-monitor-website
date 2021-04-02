const AWS = require('aws-sdk')
const { nanoid } = require('nanoid');


const {
  WM_AWS_ACCESS_KEY_ID,
  WM_AWS_SECRET_ACCESS_KEY,
  WM_S3_BUCKET_NAME,
  WM_MAX_UPLOAD_FILESIZE_BYTES,
  WM_UPLOAD_URL_EXPIRES
} = process.env;

const s3 = new AWS.S3({
  signatureVersion: 'v4',
  region: 'eu-central-1',
  credentials: new AWS.Credentials(WM_AWS_ACCESS_KEY_ID, WM_AWS_SECRET_ACCESS_KEY)
});


module.exports.handler = async (event, context) => {

  // SEC: Authentication/Authorization etc. is missing!

  const key = `submitted-recordings/${new Date().toISOString()}-${nanoid()}.zip`;
  const s3Params = {
    Bucket: WM_S3_BUCKET_NAME,
    Expires: WM_UPLOAD_URL_EXPIRES,
    Fields: { key, 'Content-Type': 'application/zip' },
    Conditions: [
      ['content-length-range', 0, WM_MAX_UPLOAD_FILESIZE_BYTES]
    ]
  };
  const uploadURL = s3.createPresignedPost(s3Params);

  return {
    statusCode: 200,
    body: JSON.stringify(uploadURL)
  };

}
