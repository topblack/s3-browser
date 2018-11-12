import rest from "@octokit/rest";

export interface Permission {
  allowBrowse: boolean;
  allowDownload: boolean;
}

interface AccessControlRule {
  keyRegex: RegExp;
  organization: string;
  team: string;
  permission: Permission;
}

export class GitHubTeamAccessCheck {
  rules = [] as AccessControlRule[];

  github: rest;

  username: string;

  constructor(username: string, accessToken: string) {
    this.username = username;
    this.github = new rest();
    this.github.authenticate({ type: "oauth", token: accessToken });
    this.initRules();
  }

  private handleRule = (username: string, rule: AccessControlRule, resolve: any, reject: any) => {
    this.github.orgs
    .getTeams({ org: rule.organization })
    .then(result => {
      let foundTeam = false;
      for (const team of result.data) {
        if (team.name.toLowerCase() === rule.team) {
          foundTeam = true;
          this.github.orgs
            .getTeamMembership({ username, team_id: team.id })
            .then(result => {
              if (result.data.state === "active") {
                resolve(rule.permission);
              } else {
                reject(`The user ${username}'s state is not active.`);
              }
            })
            .catch(cause => {
              reject(
                `The user ${username} doesn't belong to ${rule.team}.`
              );
            });
          break;
        }
      }
      if (!foundTeam) {
        reject(`Unable to get information of the team ${rule.team}.`);
      }
    })
    .catch((cause: any) => {
      reject(
        `Unable to get information of the organization ${
          rule.organization
        }`
      );
    });
  }

  public getPermission = (
    username: string,
    resourceKey: string
  ): Promise<Permission> => {
    const fullResourceKey = resourceKey && resourceKey.startsWith('/') ? resourceKey : `/${resourceKey}`;
    return new Promise((resolve, reject) => {
      let matchedRule: AccessControlRule = null;
      for (const rule of this.rules) {
        if (rule.keyRegex.test(fullResourceKey)) {
          matchedRule = rule;
          break;
        }
      }
      if (matchedRule) {
        this.handleRule(username, matchedRule, resolve, reject);
      } else {
        reject(`No matched rule found for ${fullResourceKey}`);
      }
    });
  };

  private initRules = () => {
    this.addRule('\\/.*', process.env.AC_ORG, process.env.AC_TEAM, {
      allowBrowse: true,
      allowDownload: true
    });
  };

  private addRule = (
    keyRegex: string,
    organization: string,
    team: string,
    permission: Permission
  ) => {
    this.rules.push({ keyRegex: new RegExp(keyRegex), organization, team, permission });
  };
}
