import bodyParser from 'body-parser';
import express from 'express';
import expressSession from 'express-session';
import methodOverride from 'method-override';
import { S3ArchiveManager } from './ArchiveManager';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { GitHubTeamAccessCheck } from './AccessControl';

// Create Express server
const app = express();
const port = process.env.PORT || 8080;
const baseUrl = getBaseUrl();

const archiveManager = new S3ArchiveManager(process.env.AWS_BUCKET);

const gitHubAuthConfig = {
  clientID: process.env.GITHUB_AUTH_ID,
  clientSecret: process.env.GITHUB_AUTH_SECRET,
  callbackURL: process.env.GITHUB_AUTH_CALLBACK,
};

passport.use(new GitHubStrategy(gitHubAuthConfig, verify));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(methodOverride());
app.use(expressSession({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));

app.use(passport.initialize());
app.use(passport.session());

function getBaseUrl() {
  if (process.env.BASE_URL) {
    if (process.env.BASE_URL.endsWith('/')) {
      return process.env.BASE_URL.substring(0, process.env.BASE_URL.length - 1);
    }
    return process.env.BASE_URL;
  }
  return '';
}

function verify(accessToken: string, refreshToken: string, profile: any, cb: any) {
  cb(null, { profile, accessToken });
}

function getBrowseLinkToDirectory(displayText: string, path: string) {
  if (path === '/') {
    return `<p><a href='${baseUrl}/browse'>${displayText}</a></p>`;
  }
  return `<p><a href='${baseUrl}/browse?path=${path}'>${displayText}</a></p>`;
}

function getDownloadLinkToDirectory(displayText: string, path: string) {
  return `<p><a href='${baseUrl}/download?path=${path}'>${displayText}</a></p>`;
}

function redirectHome(res: express.Response) {
  res.redirect(`${baseUrl}/browse`);
}

const gitHubAuthScope = ['read:org', 'read:user'];

const gitHubAuthOptions = { failureRedirect: `${baseUrl}/auth/failure`, scope: gitHubAuthScope };

app.get(`${baseUrl}/auth`, passport.authenticate('github', gitHubAuthOptions));

app.get(`${baseUrl}/auth/callback`, passport.authenticate('github', gitHubAuthOptions), (req, res) => {
  req.session.githubAccessToken = req.query.code;
  redirectHome(res);
});

app.get(`${baseUrl}/auth/failure`, (req, res) => {
  res.send('Authnorization failure.');
});

app.get(`${baseUrl}/browse`, ensureAuthenticated, checkPermission, (req, res) => {

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

app.get(`${baseUrl}/download`, ensureAuthenticated, (req, res) => {
  const downloadPath = req.query.path;
  archiveManager.getDownloadUrl(downloadPath)
    .then(url => res.redirect(url))
    .catch  ((reason) => {
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

function ensureAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect(`${baseUrl}/auth`);
}

function checkPermission(req: any, res: any, next: any) {
  if (!req.session || !req.session.passport
    || !req.session.passport.user || !req.session.passport.user.accessToken) {
    console.warn('No session or access token is available.');
    req.session.destroy();
    res.status(403).send('Not authorized. Please make sure you logged in to GitHub.');
  } else {
    const token = req.session.passport.user.accessToken;
    const username = req.session.passport.user.profile.username;
    const accessControlChecker = new GitHubTeamAccessCheck(username, token);
    accessControlChecker.getPermission(username, req.query.path)
      .then((permission) => {
        if (permission.allowBrowse && permission.allowDownload) {
          next();
        } else {
          req.session.destroy();
          res.status(403).send(`${username} is not permitted to access this resource.`);
        }
      }).catch((cause) => {
        req.session.destroy();
        res.status(403).send(`${username} is not permitted to access this resource. (${cause})`);
      });
  }
}
