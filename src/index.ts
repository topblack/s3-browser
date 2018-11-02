import bodyParser from 'body-parser';
import express from 'express';
import { S3ArchiveManager } from './ArchiveManager';

// Create Express server
const app = express();
const port = process.env.PORT || 8080;

const archiveManager = new S3ArchiveManager(process.env.AWS_BUCKET);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

function getBrowseLinkToDirectory(displayText: string, path: string) {
  if (path === '/') {
    return `<p><a href='browse'>${displayText}</a></p>`;
  }
  return `<p><a href='browse?path=${path}'>${displayText}</a></p>`;
}

function getDownloadLinkToDirectory(displayText: string, path: string) {
  return `<p><a href='download?path=${path}'>${displayText}</a></p>`;
}

function redirectHome(res: express.Response) {
  res.redirect('browse');
}

app.get('/browse', (req, res) => {

  const listPath = req.query.path;
  const parentPath = archiveManager.getParentPath(listPath);

  archiveManager.listArtifacts(listPath)
    .then((artifacts) => {
      let content = '';

      if (listPath) {
        content += getBrowseLinkToDirectory(`. (${listPath})`, listPath);
        if (parentPath) {
          content += getBrowseLinkToDirectory(`.. (${parentPath})`, parentPath);
        } else {
          content += getBrowseLinkToDirectory('.. (/)', '/');
        }
      }

      artifacts.sort((a, b) => {
        return -(a.name).localeCompare(b.name);
      });

      artifacts.forEach((artifact) => {
        if (artifact.isDir) {
          content += getBrowseLinkToDirectory(artifact.name, artifact.path);
        } else {
          content += getDownloadLinkToDirectory(artifact.name, artifact.path);
        }
      });
      res.send(content);
    }).catch((reason) => {
      console.log(reason, reason.stack);
      res.sendStatus(404);
    });
});

app.get('/download', (req, res) => {
  const downloadPath = req.query.path;
  archiveManager.getDownloadUrl(downloadPath)
    .then(url => res.redirect(url))
    .catch((reason) => {
      console.log(reason, reason.stack);
      res.sendStatus(503);
    });
});

app.get('*', (req, res) => {
  redirectHome(res);
});

app.listen(port, () => {
  console.log(`Listening ${port}`);
});
