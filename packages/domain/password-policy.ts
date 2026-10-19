// Shared by browser forms, server actions and API services. Spaces and digits
// do not count as special characters; Turkish upper/lowercase letters do count.
export const PASSWORD_PATTERN=String.raw`(?=.*\p{Lu})(?=.*\p{Ll})(?=.*[^\p{L}\p{N}\s]).{8,128}`;
export const PASSWORD_HELP='En az 8 karakter; bir büyük harf, bir küçük harf ve bir özel karakter (!, @, # vb.) içermeli.';
export function validNewPassword(password:string){return new RegExp('^(?:'+PASSWORD_PATTERN+')$','u').test(password)}
