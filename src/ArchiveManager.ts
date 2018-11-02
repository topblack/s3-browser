import * as AWS from 'aws-sdk';

export interface Artifact {
  name: string;
  path: string;
  isDir: boolean;
}

export interface ArchiveManager {
  listArtifacts(path: string): Promise<Artifact[]>;
  getDownloadUrl(path: string): Promise<string>;
  getParentPath(path: string): string;
}

export class S3ArchiveManager implements ArchiveManager {
  constructor(bucketName: string) {
    this.bucketName = bucketName;
    this.s3api = new AWS.S3(S3ArchiveManager.S3_OPTION);
  }

  private bucketName: string;
  private s3api: AWS.S3;
  private static readonly S3_OPTION = { apiVersion: '2006-03-01' };
  private static readonly PATH_DELIMITER = '/';

  public getParentPath = (objectPath: string): string => {
    if (objectPath && objectPath.length > 0) {
      let objectPathNoEndingSlash = '';
      if (objectPath.endsWith(S3ArchiveManager.PATH_DELIMITER)) {
        objectPathNoEndingSlash = objectPath.substring(
          0,
          objectPath.length - 1,
        );
      }
      const pathSegs = objectPathNoEndingSlash.split(
        S3ArchiveManager.PATH_DELIMITER,
      );
      if (pathSegs.length > 1) {
        const endingKeyLength = pathSegs[pathSegs.length - 1].length;
        return objectPathNoEndingSlash.substring(
          0,
          objectPath.length - endingKeyLength - 1,
        );
      }
    }
  }

  public getDownloadUrl = (path: string): Promise<string> => {
    const downloadPath = path;
    const params = {
      Bucket: this.bucketName,
      Key: downloadPath,
      Expires: 60 * 60 * 1,
    };

    return new Promise((resolve, reject) => {
      try {
        const presignedUrl = this.s3api.getSignedUrl('getObject', params);
        resolve(presignedUrl);
      } catch (error) {
        reject(error);
      }
    });
  }

  public listArtifacts = (path: string): Promise<Artifact[]> => {
    const params = {
      Bucket: this.bucketName,
      Prefix: path,
      Delimiter: S3ArchiveManager.PATH_DELIMITER,
    };

    return new Promise((resolve, reject) => {
      this.s3api.listObjectsV2(
        params,
        (err, data) => {
          if (err) {
            console.log(err, err.stack);
            reject(err);
          } else {
            const result = [] as Artifact[];
            data.CommonPrefixes.forEach((value) => {
              const name = path ? value.Prefix.substring(path.length) : value.Prefix;
              result.push({ name, path: value.Prefix, isDir: true });
            });
            data.Contents.forEach((value) => {
              const name = path ? value.Key.substring(path.length) : value.Key;
              result.push({ name, path: value.Key, isDir: false });
            });
            resolve(result);
          }
        });
    },
    );
  }
}

export class LocalFSArchiveManager { }
