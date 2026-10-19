export const BLOG_IMAGE_LIMIT=5*1024*1024;
export function blogImageType(bytes:Uint8Array){
 if(bytes.length<12||bytes.length>BLOG_IMAGE_LIMIT)return null;
 if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return {ext:'png',mime:'image/png'};
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {ext:'jpg',mime:'image/jpeg'};
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return {ext:'webp',mime:'image/webp'};
 return null;
}
export function isBlogImage(url:string){return /^\/blog\/media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(url)}
