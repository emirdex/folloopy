import {outlookReadiness,OUTLOOK_REDIRECT_URI,OUTLOOK_DELEGATED_SCOPES} from '../packages/provider-adapters/outlook-readiness';
// Prints only names of missing settings; never credentials, tokens or account identifiers.
const result=outlookReadiness(process.env);
console.log(JSON.stringify({...result,plannedRedirectUri:OUTLOOK_REDIRECT_URI,delegatedScopes:OUTLOOK_DELEGATED_SCOPES},null,2));
if(!result.configured)process.exitCode=1;
