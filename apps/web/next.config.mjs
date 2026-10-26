/** @type {import('next').NextConfig} */
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
function deploymentVersion(){
 if(process.env.NEXT_DEPLOYMENT_ID)return process.env.NEXT_DEPLOYMENT_ID;
 try{return readFileSync(new URL('./.deployment-id',import.meta.url),'utf8').trim()}catch{}
 // Some hosts omit generated dotfiles from the runtime package. Next's build
 // manifest still carries the exact version compiled into the client bundles.
 if(process.env.NODE_ENV==='production')try{return JSON.parse(readFileSync(new URL('./.next/required-server-files.json',import.meta.url),'utf8')).config.deploymentId}catch{}
}
// Live Hostinger builds defaulted to 32 page workers per host. Bound that
// fan-out so concurrent builds leave process headroom for the running sites.
const config={deploymentId:deploymentVersion(),poweredByHeader:false,webpack(webpackConfig){
 // Both hosts share this source. Only the public host can omit private UI CSS;
 // panel builds keep the original sheets and cascade byte-for-byte.
 if(process.env.DEPLOYMENT_ROLE==='public')webpackConfig.module.rules.push({
  test:/\/(?:style|mobile)\.css$/,
  include:fileURLToPath(new URL('./app',import.meta.url)),
  enforce:'pre',
  use:[fileURLToPath(new URL('../../scripts/build/public-css-loader.cjs',import.meta.url))]
 });
 return webpackConfig;
},experimental:{cpus:1,serverActions:{bodySizeLimit:'12mb'}},async headers(){return [{source:'/fonts/:path*',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]},{source:'/brands/:path*',headers:[{key:'Cache-Control',value:'public, max-age=86400, stale-while-revalidate=604800'}]},{source:'/brands/folloopy/:path*',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]},{source:'/:path*',headers:[{key:'Content-Security-Policy',value:"base-uri 'self'; object-src 'none'; frame-ancestors 'none'"},{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},...(process.env.NODE_ENV==='production'?[{key:'Strict-Transport-Security',value:'max-age=31536000'}]:[])]}]},turbopack:{root:fileURLToPath(new URL('../..',import.meta.url))}};
export default config;
