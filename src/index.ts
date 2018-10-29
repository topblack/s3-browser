import * as AWS from 'aws-sdk';
import bodyParser from 'body-parser';
import express from'express';

// Create Express server
const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const bucketName = process.env.AWS_BUCKET;
const s3Option = { apiVersion: '2006-03-01' };
const pathDelimiter = '/';

function getParentPath(objectPath: string) {
  if (objectPath && objectPath.length > 0) {
    let objectPathNoEndingSlash = '';
    if (objectPath.endsWith('/')) {
      objectPathNoEndingSlash = objectPath.substring(0, objectPath.length - 1);
    }
    const pathSegs = objectPathNoEndingSlash.split(pathDelimiter);
    if (pathSegs.length > 1) {
      const endingKeyLength = pathSegs[pathSegs.length - 1].length;
      return objectPathNoEndingSlash.substring(0, objectPath.length - endingKeyLength - 1);
    }
  }
}

function getBrowseLinkToDirectory(displayText: string, path: string) {
  if (path === '/') {
    return `<p><a href='browse'>${displayText}</a></p>`;
  }
  return `<p><a href='browse?path=${path}'>${displayText}</a></p>`;
}

function getDownloadLinkToDirectory(displayText: string, path: string) {
  return `<p><a href='download?path=${path}'>${displayText}</a></p>`;
}

app.get('/browse', (req, res) => {
  const listPath = req.query.path;
  const params = {
    Bucket: bucketName,
    Prefix: listPath,
    Delimiter: pathDelimiter,
  };

  const parentPath = getParentPath(listPath);

  new AWS.S3(s3Option).listObjectsV2(params, (err, data) => {
    if (err) {
      console.log(err, err.stack);
    } else {
      let content = '';

      if (listPath) {
        if (parentPath) {
          content += getBrowseLinkToDirectory('..', parentPath);
        } else {
          content += getBrowseLinkToDirectory('..', '/');
        }
      }

      data.CommonPrefixes.forEach((value) => {
        const displayText = value.Prefix.substring(0, value.Prefix.length - 1);
        content += getBrowseLinkToDirectory(displayText, value.Prefix);
      });
      data.Contents.forEach((value) => {
        content += getDownloadLinkToDirectory(value.Key, value.Key);
      });
      res.send(content);
    }
  });
});

app.get('/download', (req, res) => {
  const downloadPath = req.query.path;
  const params = {
    Bucket: bucketName,
    Key: downloadPath,
    Expires: 60 * 60 * 1,
  };
  const url = new AWS.S3(s3Option).getSignedUrl('getObject', params);
  res.redirect(url);
});

app.listen(port, () => {
  console.log(`Listening ${port}`);
});
