# S3 Browser

```
npm run build
npm start
```

## Running in the docker

```
docker run -p 8080:8080 -d -e AWS_BUCKET=<YourBucketName> -e AWS_ACCESS_KEY_ID=<YourAWSKeyID> -e AWS_SECRET_ACCESS_KEY=<YourAWSSecretKey> --restart=always qinling/s3-browser
```

## Reference

https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/getting-started-nodejs.html
