import * as AWS from "aws-sdk";

export interface Artifact {
  name: string;
  path: string;
  isDir: boolean;
}

export interface ArchiveManager {
  listArtifacts(path: string): Artifact[];
}

export class S3ArchiveManager implements ArchiveManager {
  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  private bucketName = process.env.AWS_BUCKET;
  private static readonly S3_OPTION = { apiVersion: "2006-03-01" };
  private static readonly PATH_DELIMITER = "/";

  private getParentPath = (objectPath: string) => {
    if (objectPath && objectPath.length > 0) {
      let objectPathNoEndingSlash = "";
      if (objectPath.endsWith(S3ArchiveManager.PATH_DELIMITER)) {
        objectPathNoEndingSlash = objectPath.substring(
          0,
          objectPath.length - 1
        );
      }
      const pathSegs = objectPathNoEndingSlash.split(
        S3ArchiveManager.PATH_DELIMITER
      );
      if (pathSegs.length > 1) {
        const endingKeyLength = pathSegs[pathSegs.length - 1].length;
        return objectPathNoEndingSlash.substring(
          0,
          objectPath.length - endingKeyLength - 1
        );
      }
    }
  };

  public listArtifacts = (path: string): Promise<Artifact[]> => {
    const parentPath = this.getParentPath(path);

    const params = {
      Bucket: this.bucketName,
      Prefix: path,
      Delimiter: S3ArchiveManager.PATH_DELIMITER,
    };

    new AWS.S3(S3ArchiveManager.S3_OPTION).listObjectsV2(
      params,
      (err, data) => {
        if (err) {
          console.log(err, err.stack);
          throw new Error(err.message);
        } else {
          const result = [] as Artifact[];
          data.CommonPrefixes.forEach((value) => {
            result.push({ name: value.Prefix, path: value.Prefix, isDir: true });
          });
          data.Contents.forEach((value) => {
            result.push({name: value.Key, path: value.Key, isDir: false});
          });
          return result;
        }
      }
    );
  };
}

export class LocalFSArchiveManager {}
